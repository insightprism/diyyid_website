# Phase 6: Payment Integration

## Purpose

Implement Stripe payment processing with pre-authorization workflow. Customers authorize payment when submitting a request, but funds are only captured after a successful session. This protects both customers (only pay for completed service) and Helpers (guaranteed payment for work done).

---

## Why We Need This Phase

1. **Business Model** - Revenue generation through session fees
2. **Customer Trust** - Pre-auth means customers aren't charged until service is delivered
3. **Helper Assurance** - Payment is guaranteed before starting work
4. **Fraud Prevention** - Valid payment method verified before connecting
5. **Flexibility** - Can cancel/refund if session doesn't happen

---

## Benefits

- Secure payment collection via Stripe
- Pre-authorization holds funds without charging
- Automatic capture after successful session
- Full refund if session cancelled/failed
- PCI compliance handled by Stripe
- Support for multiple payment methods

---

## Prerequisites

- Phase 5 completed (sessions can be created and ended)
- Stripe account created (https://stripe.com)
- Stripe API keys (publishable and secret)
- Stripe webhook endpoint configured

---

## Payment Flow

```
1. Customer submits request
   ↓
2. Payment form appears (Stripe Elements)
   ↓
3. Create PaymentIntent with capture_method: 'manual'
   ↓
4. Customer confirms → Payment authorized (not charged yet)
   ↓
5. Request submitted with paymentIntentId
   ↓
6. Helper claims and completes session
   ↓
7. Session ends successfully → Capture payment
   OR
8. Session cancelled/failed → Cancel PaymentIntent (no charge)
```

---

## Implementation Tasks

### Task 6.1: Install Stripe Dependencies

```bash
# Frontend
npm install @stripe/stripe-js @stripe/react-stripe-js

# Cloud Functions
cd functions
npm install stripe
```

### Task 6.2: Create Stripe Cloud Functions

Create `functions/src/stripe.ts`:

```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';

const db = admin.firestore();

// Initialize Stripe
const stripe = new Stripe(functions.config().stripe.secret_key, {
  apiVersion: '2023-10-16',
});

/**
 * Create a PaymentIntent for pre-authorization
 */
export const createPaymentIntent = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  }

  const { amount, currency = 'usd', customerEmail } = data;

  if (!amount || amount < 100) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Amount must be at least $1.00'
    );
  }

  try {
    // Create PaymentIntent with manual capture
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      capture_method: 'manual', // Pre-authorization only
      receipt_email: customerEmail,
      metadata: {
        userId: context.auth.uid,
      },
    });

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    };
  } catch (error: any) {
    console.error('Error creating PaymentIntent:', error);
    throw new functions.https.HttpsError('internal', 'Failed to create payment');
  }
});

/**
 * Capture a pre-authorized payment
 */
export const capturePayment = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  }

  const { paymentIntentId, requestId } = data;

  if (!paymentIntentId) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'PaymentIntent ID required'
    );
  }

  try {
    // Capture the payment
    const paymentIntent = await stripe.paymentIntents.capture(paymentIntentId);

    // Update request payment status
    if (requestId) {
      await db.collection('requests').doc(requestId).update({
        paymentStatus: 'captured',
        paymentCapturedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    return {
      success: true,
      paymentIntent: {
        id: paymentIntent.id,
        status: paymentIntent.status,
        amount: paymentIntent.amount,
      },
    };
  } catch (error: any) {
    console.error('Error capturing payment:', error);
    throw new functions.https.HttpsError('internal', 'Failed to capture payment');
  }
});

/**
 * Cancel a pre-authorized payment (refund)
 */
export const cancelPayment = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  }

  const { paymentIntentId, requestId, reason } = data;

  if (!paymentIntentId) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'PaymentIntent ID required'
    );
  }

  try {
    // Cancel the PaymentIntent (releases the hold)
    const paymentIntent = await stripe.paymentIntents.cancel(paymentIntentId, {
      cancellation_reason: reason || 'requested_by_customer',
    });

    // Update request payment status
    if (requestId) {
      await db.collection('requests').doc(requestId).update({
        paymentStatus: 'refunded',
        paymentCancelledAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    return {
      success: true,
      status: paymentIntent.status,
    };
  } catch (error: any) {
    console.error('Error cancelling payment:', error);
    throw new functions.https.HttpsError('internal', 'Failed to cancel payment');
  }
});

/**
 * Stripe webhook handler
 */
export const stripeWebhook = functions.https.onRequest(async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = functions.config().stripe.webhook_secret;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      req.rawBody,
      sig!,
      webhookSecret
    );
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      console.log('PaymentIntent succeeded:', paymentIntent.id);
      break;

    case 'payment_intent.payment_failed':
      const failedPayment = event.data.object as Stripe.PaymentIntent;
      console.log('Payment failed:', failedPayment.id);

      // Update request if we can find it
      const failedRequests = await db
        .collection('requests')
        .where('paymentIntentId', '==', failedPayment.id)
        .get();

      failedRequests.forEach(async (doc) => {
        await doc.ref.update({
          paymentStatus: 'failed',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });
      break;

    case 'payment_intent.canceled':
      const canceledPayment = event.data.object as Stripe.PaymentIntent;
      console.log('Payment canceled:', canceledPayment.id);
      break;

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  res.json({ received: true });
});
```

### Task 6.3: Update Cloud Functions Index

Update `functions/src/index.ts`:

```typescript
import * as admin from 'firebase-admin';

admin.initializeApp();

// Zoho Lens functions
export { createZohoSession, sendSessionInvite, endZohoSession } from './zohoLens';

// Stripe functions
export {
  createPaymentIntent,
  capturePayment,
  cancelPayment,
  stripeWebhook,
} from './stripe';
```

### Task 6.4: Set Stripe Configuration

```bash
firebase functions:config:set \
  stripe.secret_key="sk_test_YOUR_SECRET_KEY" \
  stripe.webhook_secret="whsec_YOUR_WEBHOOK_SECRET"
```

### Task 6.5: Create Payment Form Component

Create `src/components/payment/PaymentForm.tsx`:

```typescript
import { useState } from 'react';
import {
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { LoadingSpinner } from '../common/LoadingSpinner';

interface PaymentFormProps {
  amount: number;
  onSuccess: (paymentIntentId: string) => void;
  onError: (error: string) => void;
}

export function PaymentForm({ amount, onSuccess, onError }: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setMessage(null);

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.origin + '/customer/request/payment-complete',
        },
        redirect: 'if_required',
      });

      if (error) {
        if (error.type === 'card_error' || error.type === 'validation_error') {
          setMessage(error.message || 'Payment failed');
        } else {
          setMessage('An unexpected error occurred');
        }
        onError(error.message || 'Payment failed');
      } else if (paymentIntent) {
        if (paymentIntent.status === 'requires_capture') {
          // Pre-authorization successful
          onSuccess(paymentIntent.id);
        } else if (paymentIntent.status === 'succeeded') {
          onSuccess(paymentIntent.id);
        }
      }
    } catch (err: any) {
      setMessage('An error occurred');
      onError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-gray-50 rounded-lg p-4 mb-4">
        <div className="flex justify-between items-center">
          <span className="text-gray-700">Session fee (pre-authorized)</span>
          <span className="text-xl font-bold text-gray-900">
            ${(amount / 100).toFixed(2)}
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Your card will be authorized but not charged until your session is complete.
        </p>
      </div>

      <PaymentElement
        options={{
          layout: 'tabs',
        }}
      />

      {message && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {message}
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || isProcessing}
        className="btn-primary w-full py-3 flex items-center justify-center"
      >
        {isProcessing ? (
          <>
            <LoadingSpinner size="sm" className="mr-2" />
            Processing...
          </>
        ) : (
          `Authorize $${(amount / 100).toFixed(2)}`
        )}
      </button>

      <p className="text-xs text-gray-500 text-center">
        Secured by Stripe. Your payment information is encrypted.
      </p>
    </form>
  );
}
```

### Task 6.6: Create Payment Wrapper Component

Create `src/components/payment/PaymentWrapper.tsx`:

```typescript
import { useEffect, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../services/firebase';
import { PaymentForm } from './PaymentForm';
import { LoadingSpinner } from '../common/LoadingSpinner';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

interface PaymentWrapperProps {
  amount: number;
  customerEmail: string;
  onSuccess: (paymentIntentId: string) => void;
  onError: (error: string) => void;
}

export function PaymentWrapper({
  amount,
  customerEmail,
  onSuccess,
  onError,
}: PaymentWrapperProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const createIntent = async () => {
      try {
        const createPaymentIntent = httpsCallable(functions, 'createPaymentIntent');
        const result = await createPaymentIntent({
          amount,
          customerEmail,
        });

        const data = result.data as { clientSecret: string; paymentIntentId: string };
        setClientSecret(data.clientSecret);
      } catch (err: any) {
        console.error('Error creating payment intent:', err);
        setError('Failed to initialize payment. Please try again.');
        onError('Failed to initialize payment');
      } finally {
        setLoading(false);
      }
    };

    createIntent();
  }, [amount, customerEmail, onError]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !clientSecret) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
        {error || 'Unable to initialize payment'}
      </div>
    );
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: 'stripe',
          variables: {
            colorPrimary: '#2563eb',
            colorBackground: '#ffffff',
            colorText: '#1f2937',
            colorDanger: '#ef4444',
            fontFamily: 'system-ui, sans-serif',
            borderRadius: '8px',
          },
        },
      }}
    >
      <PaymentForm
        amount={amount}
        onSuccess={onSuccess}
        onError={onError}
      />
    </Elements>
  );
}
```

### Task 6.7: Update Request Form with Payment

Update `src/pages/customer/RequestForm.tsx` to include payment step:

```typescript
import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../hooks/useAuth';
import { useImageUpload } from '../../hooks/useImageUpload';
import { Header } from '../../components/common/Header';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { PaymentWrapper } from '../../components/payment/PaymentWrapper';
import { RequestCategory } from '../../types';

const CATEGORIES: { value: RequestCategory; label: string; icon: string }[] = [
  { value: 'plumbing', label: 'Plumbing', icon: '🚿' },
  { value: 'electrical', label: 'Electrical', icon: '⚡' },
  { value: 'hvac', label: 'HVAC', icon: '❄️' },
  { value: 'appliance', label: 'Appliance', icon: '🔧' },
  { value: 'other', label: 'Other', icon: '🏠' },
];

const SESSION_PRICE_CENTS = parseInt(
  import.meta.env.VITE_SESSION_PRICE_CENTS || '2500',
  10
);

type FormStep = 'details' | 'payment' | 'submitting';

export function RequestForm() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [step, setStep] = useState<FormStep>('details');
  const [category, setCategory] = useState<RequestCategory | ''>('');
  const [description, setDescription] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { uploadImages, isUploading } = useImageUpload();

  // ... (keep existing file handling functions from Phase 3)

  const handleContinueToPayment = () => {
    if (!category) {
      setError('Please select a category');
      return;
    }
    if (!description.trim()) {
      setError('Please describe your issue');
      return;
    }
    if (selectedFiles.length === 0) {
      setError('Please upload at least one photo');
      return;
    }

    setError(null);
    setStep('payment');
  };

  const handlePaymentSuccess = async (paymentIntentId: string) => {
    if (!user) return;

    setStep('submitting');
    setError(null);

    try {
      const tempRequestId = `temp-${Date.now()}`;
      const photoUrls = await uploadImages(selectedFiles, tempRequestId);

      const requestData = {
        customerId: user.uid,
        customerPhone: user.phone,
        category,
        description: description.trim(),
        photoUrls,
        status: 'pending',
        paymentIntentId,
        paymentStatus: 'authorized',
        amount: SESSION_PRICE_CENTS,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'requests'), requestData);
      navigate(`/customer/request/${docRef.id}/status`);
    } catch (err: any) {
      console.error('Error creating request:', err);
      setError(err.message || 'Failed to submit request');
      setStep('payment');
    }
  };

  const handlePaymentError = (errorMessage: string) => {
    setError(errorMessage);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Progress Indicator */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              step === 'details' ? 'bg-primary-600 text-white' : 'bg-primary-100 text-primary-600'
            }`}>
              1
            </div>
            <div className={`w-16 h-1 ${step !== 'details' ? 'bg-primary-600' : 'bg-gray-200'}`} />
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              step === 'payment' || step === 'submitting'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-200 text-gray-500'
            }`}>
              2
            </div>
          </div>
        </div>

        <div className="card">
          {/* Step 1: Details */}
          {step === 'details' && (
            <>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                What do you need help with?
              </h1>
              <p className="text-gray-600 mb-6">
                Describe your issue and upload photos.
              </p>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              {/* Category, Description, Photo Upload - same as before */}
              {/* ... (keep existing form fields from Phase 3) */}

              <button
                onClick={handleContinueToPayment}
                className="btn-primary w-full py-3 mt-6"
              >
                Continue to Payment
              </button>
            </>
          )}

          {/* Step 2: Payment */}
          {step === 'payment' && (
            <>
              <div className="flex items-center mb-6">
                <button
                  onClick={() => setStep('details')}
                  className="text-gray-500 hover:text-gray-700 mr-4"
                >
                  ← Back
                </button>
                <h1 className="text-2xl font-bold text-gray-900">
                  Payment
                </h1>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              {/* Summary */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h3 className="font-medium text-gray-900 mb-2">Request Summary</h3>
                <p className="text-sm text-gray-600 capitalize">
                  Category: {category}
                </p>
                <p className="text-sm text-gray-600 line-clamp-2 mt-1">
                  {description}
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  {selectedFiles.length} photo(s) attached
                </p>
              </div>

              <PaymentWrapper
                amount={SESSION_PRICE_CENTS}
                customerEmail={user?.email || ''}
                onSuccess={handlePaymentSuccess}
                onError={handlePaymentError}
              />
            </>
          )}

          {/* Step 3: Submitting */}
          {step === 'submitting' && (
            <div className="text-center py-8">
              <LoadingSpinner size="lg" className="mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900">
                Submitting your request...
              </h2>
              <p className="text-gray-600 mt-2">
                Uploading photos and creating your request.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
```

### Task 6.8: Add Payment Capture to Session End

Update `functions/src/zohoLens.ts` to capture payment when session ends:

```typescript
// Add this import at the top
import { capturePayment } from './stripe';

// In the endZohoSession function, after updating the session:

// Capture payment if session was successful
if (outcome === 'resolved') {
  const sessionDoc = await db.collection('sessions').doc(sessionId).get();
  const sessionData = sessionDoc.data();

  if (sessionData?.requestId) {
    const requestDoc = await db.collection('requests').doc(sessionData.requestId).get();
    const requestData = requestDoc.data();

    if (requestData?.paymentIntentId && requestData?.paymentStatus === 'authorized') {
      try {
        // Capture the pre-authorized payment
        const stripe = new (await import('stripe')).default(
          functions.config().stripe.secret_key,
          { apiVersion: '2023-10-16' }
        );

        await stripe.paymentIntents.capture(requestData.paymentIntentId);

        await db.collection('requests').doc(sessionData.requestId).update({
          paymentStatus: 'captured',
          paymentCapturedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log('Payment captured for request:', sessionData.requestId);
      } catch (paymentError) {
        console.error('Error capturing payment:', paymentError);
        // Don't throw - session was successful even if payment capture failed
      }
    }
  }
}
```

### Task 6.9: Configure Stripe Webhook in Firebase

Add webhook URL to Stripe Dashboard:
1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://us-central1-YOUR_PROJECT.cloudfunctions.net/stripeWebhook`
3. Select events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`
4. Copy the webhook signing secret
5. Update Firebase config: `firebase functions:config:set stripe.webhook_secret="whsec_..."`

---

## Verification Tests

### Test 1: Payment Intent Creation

1. Start a new request
2. Fill in details and proceed to payment

**Expected:** Payment form loads with Stripe Elements

### Test 2: Card Authorization

1. Enter test card: 4242 4242 4242 4242
2. Any future expiry, any CVC
3. Click "Authorize"

**Expected:**
- Loading state shows
- Authorization succeeds
- Request is created with `paymentStatus: 'authorized'`

### Test 3: Pre-Authorization Hold

1. Complete test authorization
2. Check Stripe Dashboard

**Expected:** Payment shows as "Uncaptured" with hold on funds

### Test 4: Payment Capture on Session Complete

1. Complete a full session (Helper marks as "Resolved")
2. Check Stripe Dashboard

**Expected:**
- Payment captured
- Request `paymentStatus` changes to "captured"

### Test 5: Payment Cancellation

1. Submit a request with payment
2. Cancel the request before session starts

**Expected:**
- PaymentIntent cancelled
- Funds hold released
- Request `paymentStatus` changes to "refunded"

### Test 6: Failed Card

1. Use test card: 4000 0000 0000 0002
2. Try to authorize

**Expected:** Error message "Your card was declined"

### Test 7: 3D Secure Flow

1. Use test card: 4000 0025 0000 3155
2. Complete 3D Secure challenge

**Expected:** 3D Secure modal appears, authorization completes after challenge

---

## Stripe Test Cards

| Card Number | Scenario |
|-------------|----------|
| 4242 4242 4242 4242 | Successful payment |
| 4000 0000 0000 0002 | Card declined |
| 4000 0025 0000 3155 | 3D Secure required |
| 4000 0000 0000 9995 | Insufficient funds |

Use any future expiry date and any 3-digit CVC.

---

## Deliverables Checklist

- [ ] Stripe Cloud Functions created
- [ ] PaymentIntent creation working
- [ ] Stripe Elements form rendering
- [ ] Card authorization flow working
- [ ] Payment capture on session end
- [ ] Payment cancellation on request cancel
- [ ] Stripe webhook handler deployed
- [ ] Error handling for payment failures
- [ ] Test cards working correctly

---

## Security Considerations

1. **Never log full card numbers** - Stripe handles all card data
2. **Webhook verification** - Always verify webhook signatures
3. **Server-side capture** - Only capture from trusted server code
4. **Idempotency** - Handle duplicate webhook deliveries
5. **Amount validation** - Validate amounts match expected session fee

---

## Next Phase

Once all tests pass, proceed to **Phase 7: Session Management & Dispatch** to implement automated Helper notifications and full session orchestration.
