# Phase 6: Payment Integration

## Purpose

Integrate Stripe for secure payment processing. Implement pre-authorization when customers submit requests, and capture payment only after successful session completion. Handle refunds for cancelled sessions.

---

## Why We Need This Phase

1. **Revenue** - Payment enables the business model
2. **Pre-authorization** - Validates customer can pay before Helper commits time
3. **Trust** - Customers aren't charged until they receive value
4. **Protection** - Reduces fraud and no-shows
5. **Automation** - Payments captured automatically after session

---

## Benefits

- Card validated before session starts
- Payment only captured after successful completion
- Automatic refunds for cancelled requests
- Secure handling via Stripe (PCI compliant)
- Clear pricing displayed to customers

---

## Prerequisites

- Phase 5 completed
- Stripe account created
- Stripe API keys (test mode for development)
- Webhook endpoint configured

---

## Stripe Setup

### Step 1: Get API Keys

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/apikeys)
2. Copy Publishable Key and Secret Key
3. For webhooks, go to Developers > Webhooks

### Step 2: Configure Environment

Frontend `.env.local`:
```bash
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
```

Functions `functions/.env`:
```bash
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

---

## Implementation Tasks

### Task 6.1: Create Stripe Service (Cloud Functions)

Create `functions/src/stripe_service.ts`:

```typescript
import Stripe from 'stripe';

const stripe_cfg = {
  secret_key: process.env.STRIPE_SECRET_KEY || '',
  webhook_secret: process.env.STRIPE_WEBHOOK_SECRET || '',
};

const stripe = new Stripe(stripe_cfg.secret_key, {
  apiVersion: '2023-10-16',
});

export async function create_payment_intent(
  amount_cents: number,
  customer_email: string,
  request_id: string
): Promise<{ client_secret: string; payment_intent_id: string }> {
  const payment_intent = await stripe.paymentIntents.create({
    amount: amount_cents,
    currency: 'usd',
    capture_method: 'manual', // Pre-authorization only
    receipt_email: customer_email,
    metadata: {
      request_id,
    },
  });

  return {
    client_secret: payment_intent.client_secret!,
    payment_intent_id: payment_intent.id,
  };
}

export async function capture_payment(payment_intent_id: string): Promise<void> {
  await stripe.paymentIntents.capture(payment_intent_id);
}

export async function cancel_payment(payment_intent_id: string): Promise<void> {
  await stripe.paymentIntents.cancel(payment_intent_id);
}

export async function refund_payment(payment_intent_id: string): Promise<void> {
  await stripe.refunds.create({
    payment_intent: payment_intent_id,
  });
}

export function verify_webhook_signature(
  payload: string | Buffer,
  signature: string
): Stripe.Event {
  return stripe.webhooks.constructEvent(
    payload,
    signature,
    stripe_cfg.webhook_secret
  );
}

export { stripe };
```

### Task 6.2: Add Payment Cloud Functions

Add to `functions/src/index.ts`:

```typescript
import {
  create_payment_intent,
  capture_payment,
  cancel_payment,
  verify_webhook_signature,
} from './stripe_service';

export const createPaymentIntent = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  }

  const { request_id } = data;
  if (!request_id) {
    throw new functions.https.HttpsError('invalid-argument', 'request_id required');
  }

  const request_doc = await db.collection('requests').doc(request_id).get();
  if (!request_doc.exists) {
    throw new functions.https.HttpsError('not-found', 'Request not found');
  }

  const request = request_doc.data()!;
  if (request.customer_id !== context.auth.uid) {
    throw new functions.https.HttpsError('permission-denied', 'Not your request');
  }

  const user_doc = await db.collection('users').doc(context.auth.uid).get();
  const user_email = user_doc.data()?.email;

  try {
    const result = await create_payment_intent(
      request.amount,
      user_email,
      request_id
    );

    await db.collection('requests').doc(request_id).update({
      payment_intent_id: result.payment_intent_id,
      payment_status: 'pending',
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { client_secret: result.client_secret };
  } catch (error: any) {
    console.error('Payment error:', error);
    throw new functions.https.HttpsError('internal', 'Payment setup failed');
  }
});

export const captureSessionPayment = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  }

  const { session_id } = data;
  const session_doc = await db.collection('sessions').doc(session_id).get();
  const session = session_doc.data()!;

  if (session.helper_id !== context.auth.uid) {
    throw new functions.https.HttpsError('permission-denied', 'Not authorized');
  }

  const request_doc = await db.collection('requests').doc(session.request_id).get();
  const request = request_doc.data()!;

  if (!request.payment_intent_id) {
    throw new functions.https.HttpsError('failed-precondition', 'No payment to capture');
  }

  if (request.payment_status === 'captured') {
    return { success: true, already_captured: true };
  }

  try {
    await capture_payment(request.payment_intent_id);

    await db.collection('requests').doc(session.request_id).update({
      payment_status: 'captured',
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true };
  } catch (error: any) {
    console.error('Capture error:', error);
    throw new functions.https.HttpsError('internal', 'Payment capture failed');
  }
});

export const cancelRequestPayment = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  }

  const { request_id } = data;
  const request_doc = await db.collection('requests').doc(request_id).get();
  const request = request_doc.data()!;

  if (request.customer_id !== context.auth.uid) {
    throw new functions.https.HttpsError('permission-denied', 'Not your request');
  }

  if (request.status !== 'pending') {
    throw new functions.https.HttpsError('failed-precondition', 'Cannot cancel');
  }

  if (request.payment_intent_id) {
    await cancel_payment(request.payment_intent_id);
  }

  await db.collection('requests').doc(request_id).update({
    status: 'cancelled',
    payment_status: 'cancelled',
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true };
});

// Webhook handler
export const stripeWebhook = functions.https.onRequest(async (req, res) => {
  const signature = req.headers['stripe-signature'] as string;

  try {
    const event = verify_webhook_signature(req.rawBody, signature);

    switch (event.type) {
      case 'payment_intent.succeeded':
        const pi = event.data.object as Stripe.PaymentIntent;
        const request_id = pi.metadata.request_id;
        if (request_id) {
          await db.collection('requests').doc(request_id).update({
            payment_status: 'authorized',
          });
        }
        break;

      case 'payment_intent.payment_failed':
        const failed_pi = event.data.object as Stripe.PaymentIntent;
        const failed_request_id = failed_pi.metadata.request_id;
        if (failed_request_id) {
          await db.collection('requests').doc(failed_request_id).update({
            payment_status: 'failed',
          });
        }
        break;
    }

    res.json({ received: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    res.status(400).send(`Webhook Error: ${error.message}`);
  }
});
```

### Task 6.3: Create Frontend Stripe Service

Create `src/services/stripe_client.ts`:

```typescript
import { loadStripe, Stripe } from '@stripe/stripe-js';

const stripe_cfg = {
  publishable_key: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY,
};

let stripe_promise: Promise<Stripe | null> | null = null;

export function get_stripe(): Promise<Stripe | null> {
  if (!stripe_promise) {
    stripe_promise = loadStripe(stripe_cfg.publishable_key);
  }
  return stripe_promise;
}
```

### Task 6.4: Create Payment Hook

Create `src/hooks/use_payment.ts`:

```typescript
import { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../services/firebase_client';
import { get_stripe } from '../services/stripe_client';

export function usePayment() {
  const [is_loading, set_is_loading] = useState(false);
  const [error, set_error] = useState<string | null>(null);

  const create_payment = async (request_id: string) => {
    set_is_loading(true);
    set_error(null);

    try {
      const fn = httpsCallable(functions, 'createPaymentIntent');
      const result = await fn({ request_id });
      return (result.data as { client_secret: string }).client_secret;
    } catch (err: any) {
      set_error(err.message);
      throw err;
    } finally {
      set_is_loading(false);
    }
  };

  const confirm_payment = async (client_secret: string, card_element: any) => {
    set_is_loading(true);
    set_error(null);

    try {
      const stripe = await get_stripe();
      if (!stripe) throw new Error('Stripe not loaded');

      const result = await stripe.confirmCardPayment(client_secret, {
        payment_method: { card: card_element },
      });

      if (result.error) {
        throw new Error(result.error.message);
      }

      return result.paymentIntent;
    } catch (err: any) {
      set_error(err.message);
      throw err;
    } finally {
      set_is_loading(false);
    }
  };

  const cancel_request = async (request_id: string) => {
    set_is_loading(true);
    try {
      const fn = httpsCallable(functions, 'cancelRequestPayment');
      await fn({ request_id });
    } catch (err: any) {
      set_error(err.message);
      throw err;
    } finally {
      set_is_loading(false);
    }
  };

  return { create_payment, confirm_payment, cancel_request, is_loading, error };
}
```

### Task 6.5: Create Payment Page

Create `src/pages/customer/PaymentPage.tsx`:

```typescript
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase_client';
import { get_stripe } from '../../services/stripe_client';
import { usePayment } from '../../hooks/use_payment';
import { Header } from '../../components/common/Header';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { Request } from '../../types';
import { app_config } from '../../config/app_config';

function PaymentForm({ request }: { request: Request }) {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const { create_payment, confirm_payment, is_loading, error } = usePayment();
  const [local_error, set_local_error] = useState<string | null>(null);

  const handle_submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    set_local_error(null);

    try {
      const client_secret = await create_payment(request.id);
      const card = elements.getElement(CardElement);
      if (!card) return;

      await confirm_payment(client_secret, card);
      navigate(`/customer/request/${request.id}/status`);
    } catch (err: any) {
      set_local_error(err.message);
    }
  };

  return (
    <form onSubmit={handle_submit} className="space-y-6">
      {(error || local_error) && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error || local_error}
        </div>
      )}

      <div className="card">
        <h3 className="font-semibold mb-4">Payment Details</h3>
        <div className="p-4 border border-gray-200 rounded-lg">
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: '16px',
                  color: '#374151',
                  '::placeholder': { color: '#9CA3AF' },
                },
              },
            }}
          />
        </div>
      </div>

      <div className="card bg-gray-50">
        <div className="flex justify-between items-center">
          <span className="text-gray-600">Session Fee</span>
          <span className="text-xl font-bold">
            ${(request.amount / 100).toFixed(2)}
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Your card will be pre-authorized but not charged until your session is complete.
        </p>
      </div>

      <button
        type="submit"
        disabled={is_loading || !stripe}
        className="btn-primary w-full py-3"
      >
        {is_loading ? <LoadingSpinner size="sm" /> : 'Authorize Payment'}
      </button>
    </form>
  );
}

export function PaymentPage() {
  const { request_id } = useParams<{ request_id: string }>();
  const [request, set_request] = useState<Request | null>(null);
  const [loading, set_loading] = useState(true);

  useEffect(() => {
    if (!request_id) return;
    return onSnapshot(doc(db, 'requests', request_id), (snap) => {
      if (snap.exists()) {
        set_request({ id: snap.id, ...snap.data() } as Request);
      }
      set_loading(false);
    });
  }, [request_id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Header />
        <div className="flex items-center justify-center min-h-[60vh]">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Header />
        <div className="max-w-md mx-auto px-4 py-16 text-center">
          <h1 className="text-xl font-semibold">Request not found</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <main className="max-w-md mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Complete Payment</h1>

        <div className="card mb-6">
          <h3 className="font-semibold mb-2">Your Request</h3>
          <p className="text-sm text-gray-600 capitalize mb-1">
            Category: {request.category}
          </p>
          <p className="text-sm text-gray-600 line-clamp-2">
            {request.description}
          </p>
        </div>

        <Elements stripe={get_stripe()}>
          <PaymentForm request={request} />
        </Elements>
      </main>
    </div>
  );
}
```

### Task 6.6: Install Stripe Package

```bash
npm install @stripe/stripe-js @stripe/react-stripe-js
```

### Task 6.7: Update Routes

Update `src/App.tsx`:

```typescript
import { PaymentPage } from './pages/customer/PaymentPage';

// Add route:
<Route
  path="request/:request_id/payment"
  element={
    <ProtectedRoute allowed_role="customer">
      <PaymentPage />
    </ProtectedRoute>
  }
/>
```

---

## Verification Tests

### Test 1: Payment Intent Creation

1. Submit request
2. Navigate to payment page

**Expected:** Stripe card element displays

### Test 2: Card Authorization

1. Enter test card: 4242 4242 4242 4242
2. Click "Authorize Payment"

**Expected:**
- Payment authorized (not captured)
- Redirected to status page
- payment_status: 'authorized' in Firestore

### Test 3: Payment Capture

1. Complete a session as Helper

**Expected:** Payment captured, payment_status: 'captured'

### Test 4: Request Cancellation

1. Cancel a pending request

**Expected:** Payment intent cancelled, payment_status: 'cancelled'

### Test 5: Webhook Updates

1. Check Stripe webhook events

**Expected:** Events processed, Firestore updated

---

## Deliverables Checklist

- [ ] Stripe service in Cloud Functions
- [ ] Payment intent creation function
- [ ] Payment capture function
- [ ] Cancel/refund functions
- [ ] Webhook handler
- [ ] Frontend Stripe integration
- [ ] Payment hook
- [ ] Payment page with card element
- [ ] Routes updated

---

## Next Phase

Proceed to **Phase 7: Session Management** for end-to-end flow completion.
