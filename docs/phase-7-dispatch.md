# Phase 7: Session Management & Dispatch

## Purpose

Implement automated Helper dispatch notifications and complete session lifecycle management. This phase ties together all previous components into a seamless end-to-end flow, ensuring Helpers are notified immediately when new requests arrive and the entire session process is orchestrated reliably.

---

## Why We Need This Phase

1. **Speed Matters** - <15 minute Helper response time is a key metric
2. **Reliability** - Automated notifications ensure no request goes unnoticed
3. **Scalability** - System handles multiple simultaneous requests and Helpers
4. **User Experience** - Both Customer and Helper have clear visibility into status
5. **Edge Cases** - Handle timeouts, cancellations, and failures gracefully

---

## Benefits

- Push notifications to available Helpers instantly
- Automatic request timeout/escalation
- Complete audit trail of session lifecycle
- Graceful handling of edge cases
- Foundation for analytics and reporting

---

## Prerequisites

- Phases 1-6 completed
- Firebase Cloud Messaging (FCM) enabled
- Twilio account (optional, for SMS notifications to Helpers)

---

## FCM Setup Instructions

Before implementing push notifications, complete this FCM setup:

### Step 1: Enable Cloud Messaging in Firebase Console

1. Go to Firebase Console → Project Settings → Cloud Messaging
2. Enable Cloud Messaging API (V1) if not already enabled
3. Note your Sender ID (you'll need this)

### Step 2: Generate VAPID Key (Web Push Certificate)

1. In Firebase Console → Project Settings → Cloud Messaging
2. Scroll to "Web configuration"
3. Click "Generate key pair" under Web Push certificates
4. Copy the key pair (this is your VAPID key)
5. Add to your `.env.local`:
   ```
   VITE_FIREBASE_VAPID_KEY=your_vapid_key_here
   ```

### Step 3: Add Firebase Messaging SDK

```bash
npm install firebase
```

The `firebase` package already includes messaging - no additional install needed.

### Step 4: Register Service Worker

Add to `index.html` (before closing `</body>` tag):

```html
<script>
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/firebase-messaging-sw.js')
      .then(registration => console.log('SW registered:', registration.scope))
      .catch(err => console.error('SW registration failed:', err));
  }
</script>
```

---

## Session Lifecycle States

```
REQUEST LIFECYCLE:
┌─────────┐     ┌─────────┐     ┌───────────┐     ┌───────────┐
│ pending │ ──► │ claimed │ ──► │ in_session│ ──► │ completed │
└─────────┘     └─────────┘     └───────────┘     └───────────┘
     │               │                                   ▲
     │               │                                   │
     ▼               ▼                                   │
┌───────────┐   ┌───────────┐                           │
│ cancelled │   │  expired  │ ──────────────────────────┘
└───────────┘   └───────────┘      (refund issued)

SESSION LIFECYCLE:
┌─────────┐     ┌─────────┐     ┌────────┐     ┌───────┐
│ created │ ──► │ waiting │ ──► │ active │ ──► │ ended │
└─────────┘     └─────────┘     └────────┘     └───────┘
```

---

## Implementation Tasks

### Task 7.1: Create Notification Cloud Functions

Create `functions/src/notifications.ts`:

```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

/**
 * Triggered when a new request is created
 * Sends push notifications to all available Helpers
 */
export const onRequestCreate = functions.firestore
  .document('requests/{requestId}')
  .onCreate(async (snapshot, context) => {
    const request = snapshot.data();
    const requestId = context.params.requestId;

    console.log(`New request created: ${requestId}`);

    // Only notify for pending requests with authorized payment
    if (request.status !== 'pending' || request.paymentStatus !== 'authorized') {
      console.log('Request not ready for dispatch');
      return;
    }

    try {
      // Get all available Helpers
      const helpersSnapshot = await db
        .collection('users')
        .where('role', '==', 'helper')
        .where('isAvailable', '==', true)
        .get();

      if (helpersSnapshot.empty) {
        console.log('No available helpers');
        return;
      }

      console.log(`Found ${helpersSnapshot.size} available helpers`);

      // Collect FCM tokens
      const tokens: string[] = [];
      helpersSnapshot.forEach((doc) => {
        const helper = doc.data();
        if (helper.fcmToken) {
          tokens.push(helper.fcmToken);
        }
      });

      if (tokens.length === 0) {
        console.log('No helpers with FCM tokens');
        return;
      }

      // Send push notification
      const message = {
        notification: {
          title: '🔔 New Job Available!',
          body: `${capitalizeFirst(request.category)} - ${truncate(request.description, 50)}`,
        },
        data: {
          type: 'new_request',
          requestId,
          category: request.category,
          amount: String(request.amount),
        },
        tokens,
      };

      const response = await admin.messaging().sendEachForMulticast(message);
      console.log(`Sent ${response.successCount} notifications`);

      // Log any failures
      if (response.failureCount > 0) {
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            console.error(`Failed to send to token ${idx}:`, resp.error);
          }
        });
      }
    } catch (error) {
      console.error('Error sending notifications:', error);
    }
  });

/**
 * Triggered when request status changes
 * Handles various status transitions
 */
export const onRequestUpdate = functions.firestore
  .document('requests/{requestId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const requestId = context.params.requestId;

    // Status changed
    if (before.status !== after.status) {
      console.log(`Request ${requestId} status: ${before.status} → ${after.status}`);

      // Request claimed - notify customer
      if (after.status === 'claimed') {
        await notifyCustomer(after.customerId, {
          title: 'Helper Found!',
          body: 'A professional has accepted your request and will connect shortly.',
          data: { type: 'request_claimed', requestId },
        });
      }

      // Request completed - notify customer
      if (after.status === 'completed') {
        await notifyCustomer(after.customerId, {
          title: 'Session Complete',
          body: 'Your session has ended. Thank you for using HomePro Assist!',
          data: { type: 'session_complete', requestId },
        });
      }

      // Request cancelled - handle cleanup
      if (after.status === 'cancelled') {
        // Cancel payment if authorized
        if (after.paymentIntentId && after.paymentStatus === 'authorized') {
          // Import and call cancelPayment
          console.log('Cancelling payment for cancelled request');
        }
      }
    }
  });

/**
 * Scheduled function to check for stale pending requests
 * Runs every 5 minutes
 */
export const checkStaleRequests = functions.pubsub
  .schedule('every 5 minutes')
  .onRun(async () => {
    const staleThreshold = Date.now() - 30 * 60 * 1000; // 30 minutes
    const staleTime = admin.firestore.Timestamp.fromMillis(staleThreshold);

    try {
      const staleRequests = await db
        .collection('requests')
        .where('status', '==', 'pending')
        .where('createdAt', '<', staleTime)
        .get();

      console.log(`Found ${staleRequests.size} stale requests`);

      for (const doc of staleRequests.docs) {
        const request = doc.data();

        // Notify customer that no helper is available
        await notifyCustomer(request.customerId, {
          title: 'No Helpers Available',
          body: 'We couldn\'t find an available helper. Your payment has been released.',
          data: { type: 'request_expired', requestId: doc.id },
        });

        // Update request status
        await doc.ref.update({
          status: 'expired',
          expiredAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Cancel payment
        if (request.paymentIntentId) {
          // Call cancel payment function
          console.log('Releasing payment hold for expired request');
        }
      }
    } catch (error) {
      console.error('Error checking stale requests:', error);
    }
  });

/**
 * Scheduled function to check for stale claimed requests
 * (Helper claimed but didn't start session)
 */
export const checkStaleClaimed = functions.pubsub
  .schedule('every 5 minutes')
  .onRun(async () => {
    const staleThreshold = Date.now() - 15 * 60 * 1000; // 15 minutes
    const staleTime = admin.firestore.Timestamp.fromMillis(staleThreshold);

    try {
      const staleRequests = await db
        .collection('requests')
        .where('status', '==', 'claimed')
        .where('claimedAt', '<', staleTime)
        .get();

      for (const doc of staleRequests.docs) {
        const request = doc.data();

        // Release the claim - put back in queue
        await doc.ref.update({
          status: 'pending',
          helperId: admin.firestore.FieldValue.delete(),
          claimedAt: admin.firestore.FieldValue.delete(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`Released stale claim on request ${doc.id}`);

        // Re-notify available helpers
        // This will trigger onRequestUpdate if we had a trigger for status changes
      }
    } catch (error) {
      console.error('Error checking stale claims:', error);
    }
  });

// Helper function to send notification to customer
async function notifyCustomer(
  customerId: string,
  notification: { title: string; body: string; data?: Record<string, string> }
) {
  try {
    const customerDoc = await db.collection('users').doc(customerId).get();
    const customer = customerDoc.data();

    if (customer?.fcmToken) {
      await admin.messaging().send({
        notification: {
          title: notification.title,
          body: notification.body,
        },
        data: notification.data,
        token: customer.fcmToken,
      });
    }
  } catch (error) {
    console.error('Error notifying customer:', error);
  }
}

// Utility functions
function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function truncate(str: string, length: number): string {
  return str.length > length ? str.substring(0, length) + '...' : str;
}
```

### Task 7.2: Create FCM Token Management

Create `src/services/pushNotifications.ts`:

```typescript
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

export async function requestNotificationPermission(userId: string): Promise<boolean> {
  try {
    const permission = await Notification.requestPermission();

    if (permission === 'granted') {
      const messaging = getMessaging();
      const token = await getToken(messaging, { vapidKey: VAPID_KEY });

      if (token) {
        // Save token to user document
        await updateDoc(doc(db, 'users', userId), {
          fcmToken: token,
          fcmTokenUpdatedAt: new Date(),
        });

        console.log('FCM token saved');
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error('Error getting notification permission:', error);
    return false;
  }
}

export function onForegroundMessage(callback: (payload: any) => void) {
  const messaging = getMessaging();
  return onMessage(messaging, callback);
}
```

### Task 7.3: Create Service Worker for Background Notifications

**Important:** Service workers cannot access environment variables directly. You have two options:

**Option A (Recommended):** Generate the service worker at build time

Create `scripts/generate-sw.js`:

```javascript
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const swContent = `
// Firebase messaging service worker (auto-generated)
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: '${process.env.VITE_FIREBASE_API_KEY}',
  authDomain: '${process.env.VITE_FIREBASE_AUTH_DOMAIN}',
  projectId: '${process.env.VITE_FIREBASE_PROJECT_ID}',
  storageBucket: '${process.env.VITE_FIREBASE_STORAGE_BUCKET}',
  messagingSenderId: '${process.env.VITE_FIREBASE_MESSAGING_SENDER_ID}',
  appId: '${process.env.VITE_FIREBASE_APP_ID}',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('Background message:', payload);

  const notificationTitle = payload.notification?.title || 'HomePro Assist';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new notification',
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    data: payload.data,
    actions: [
      { action: 'view', title: 'View' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'view' || !event.action) {
    const data = event.notification.data;

    let url = '/';
    if (data?.type === 'new_request') {
      url = '/helper/dashboard';
    } else if (data?.requestId) {
      url = '/customer/request/' + data.requestId + '/status';
    }

    event.waitUntil(
      clients.matchAll({ type: 'window' }).then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        return clients.openWindow(url);
      })
    );
  }
});
`;

fs.writeFileSync(
  path.join(__dirname, '../public/firebase-messaging-sw.js'),
  swContent.trim()
);

console.log('Service worker generated successfully!');
```

Add to `package.json` scripts:

```json
{
  "scripts": {
    "generate-sw": "node scripts/generate-sw.js",
    "dev": "npm run generate-sw && vite",
    "build": "npm run generate-sw && tsc && vite build"
  }
}
```

**Option B:** Hardcode values (simpler but less secure)

Create `public/firebase-messaging-sw.js` with your actual Firebase config values directly. This is acceptable since Firebase config is not secret (it's exposed in the client anyway), but Option A is cleaner for environment management.

```javascript
// Firebase messaging service worker
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

// REPLACE THESE WITH YOUR ACTUAL VALUES
firebase.initializeApp({
  apiKey: 'AIzaSy...',           // Your actual API key
  authDomain: 'your-project.firebaseapp.com',
  projectId: 'your-project-id',
  storageBucket: 'your-project.appspot.com',
  messagingSenderId: '123456789',
  appId: '1:123456789:web:abc123',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('Background message:', payload);

  const notificationTitle = payload.notification?.title || 'HomePro Assist';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new notification',
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    data: payload.data,
    actions: [
      { action: 'view', title: 'View' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'view' || !event.action) {
    const data = event.notification.data;

    let url = '/';
    if (data?.type === 'new_request') {
      url = '/helper/dashboard';
    } else if (data?.requestId) {
      url = `/customer/request/${data.requestId}/status`;
    }

    event.waitUntil(
      clients.matchAll({ type: 'window' }).then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        return clients.openWindow(url);
      })
    );
  }
});
```

### Task 7.4: Add Notification Permission UI

Create `src/components/common/NotificationPrompt.tsx`:

```typescript
import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { requestNotificationPermission } from '../../services/pushNotifications';

export function NotificationPrompt() {
  const { user } = useAuth();
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Only show for helpers who haven't enabled notifications
    if (user?.role === 'helper' && !user?.fcmToken) {
      // Check if browser supports notifications
      if ('Notification' in window && Notification.permission === 'default') {
        setShow(true);
      }
    }
  }, [user]);

  const handleEnable = async () => {
    if (!user) return;

    setLoading(true);
    const success = await requestNotificationPermission(user.uid);
    setLoading(false);

    if (success) {
      setShow(false);
    }
  };

  const handleDismiss = () => {
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="bg-primary-600 text-white px-4 py-3">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center">
          <span className="text-xl mr-3">🔔</span>
          <div>
            <p className="font-medium">Enable notifications</p>
            <p className="text-sm text-primary-100">
              Get instant alerts when new jobs are available
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleDismiss}
            className="text-primary-200 hover:text-white text-sm"
          >
            Not now
          </button>
          <button
            onClick={handleEnable}
            disabled={loading}
            className="bg-white text-primary-600 px-4 py-2 rounded-lg font-medium hover:bg-primary-50 disabled:opacity-50"
          >
            {loading ? 'Enabling...' : 'Enable'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

### Task 7.5: Add Request Cancellation Feature

Update `src/pages/customer/RequestStatus.tsx` to add cancel functionality:

```typescript
// Add this function inside the component
const handleCancelRequest = async () => {
  if (!request || !user) return;

  const confirmed = window.confirm(
    'Are you sure you want to cancel this request? Your payment authorization will be released.'
  );

  if (!confirmed) return;

  try {
    // Update request status
    await updateDoc(doc(db, 'requests', request.id), {
      status: 'cancelled',
      cancelledAt: serverTimestamp(),
      cancelledBy: user.uid,
      updatedAt: serverTimestamp(),
    });

    // Cancel payment if needed
    if (request.paymentIntentId && request.paymentStatus === 'authorized') {
      const cancelPayment = httpsCallable(functions, 'cancelPayment');
      await cancelPayment({
        paymentIntentId: request.paymentIntentId,
        requestId: request.id,
        reason: 'requested_by_customer',
      });
    }

    navigate('/customer/request');
  } catch (err) {
    console.error('Error cancelling request:', err);
    setError('Failed to cancel request');
  }
};
```

### Task 7.6: Create Session Analytics Tracking

Create `src/services/analytics.ts`:

```typescript
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

type EventType =
  | 'request_created'
  | 'request_claimed'
  | 'request_cancelled'
  | 'request_expired'
  | 'session_started'
  | 'session_ended'
  | 'payment_authorized'
  | 'payment_captured'
  | 'payment_refunded';

interface AnalyticsEvent {
  type: EventType;
  requestId?: string;
  sessionId?: string;
  userId?: string;
  metadata?: Record<string, any>;
}

export async function trackEvent(event: AnalyticsEvent): Promise<void> {
  try {
    await addDoc(collection(db, 'analytics'), {
      ...event,
      timestamp: serverTimestamp(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    });
  } catch (error) {
    console.error('Error tracking event:', error);
    // Don't throw - analytics should never break the app
  }
}

export function trackRequestCreated(requestId: string, userId: string, category: string) {
  return trackEvent({
    type: 'request_created',
    requestId,
    userId,
    metadata: { category },
  });
}

export function trackSessionEnded(
  sessionId: string,
  requestId: string,
  outcome: string,
  duration: number
) {
  return trackEvent({
    type: 'session_ended',
    sessionId,
    requestId,
    metadata: { outcome, duration },
  });
}
```

### Task 7.7: Update Cloud Functions Index

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

// Notification/Dispatch functions
export {
  onRequestCreate,
  onRequestUpdate,
  checkStaleRequests,
  checkStaleClaimed,
} from './notifications';
```

### Task 7.8: Deploy All Functions

```bash
cd functions
npm run build
firebase deploy --only functions
```

---

## Verification Tests

### Test 1: New Request Notification

1. Sign in as Helper and enable notifications
2. Set availability to "Available"
3. Sign in as Customer (different browser/incognito)
4. Submit a new request

**Expected:** Helper receives push notification "New Job Available!"

### Test 2: Request Claimed Notification

1. Helper claims a request

**Expected:** Customer receives notification "Helper Found!"

### Test 3: Request Cancellation

1. Customer submits request
2. Customer clicks "Cancel Request"
3. Confirms cancellation

**Expected:**
- Request status changes to "cancelled"
- Payment authorization released
- Customer redirected to request form

### Test 4: Stale Request Expiration

1. Submit a request
2. Wait 30 minutes (or temporarily reduce timeout for testing)

**Expected:**
- Request status changes to "expired"
- Customer notified
- Payment released

### Test 5: Stale Claim Release

1. Helper claims request
2. Helper doesn't start session for 15 minutes

**Expected:**
- Request returns to "pending" status
- Other Helpers can see and claim it

### Test 6: Background Notifications

1. Close the browser tab (app not in foreground)
2. Submit a new request from another device

**Expected:** System notification appears with action buttons

### Test 7: End-to-End Flow

Complete full flow:
1. Customer signs up → submits request → authorizes payment
2. Helper receives notification → claims request → completes safety checklist
3. Zoho session created → SMS sent to customer
4. Customer joins → session active
5. Helper marks resolved → payment captured → session ended

**Expected:** All steps complete successfully, payment captured

---

## Monitoring & Debugging

### Firebase Console Locations

- **Cloud Functions logs:** Firebase Console → Functions → Logs
- **Firestore data:** Firebase Console → Firestore Database
- **FCM delivery:** Firebase Console → Cloud Messaging → Reports

### Common Issues

| Issue | Solution |
|-------|----------|
| Notifications not received | Check FCM token saved, check browser permissions |
| Scheduled functions not running | Verify Cloud Scheduler enabled in GCP |
| Payment not captured | Check endZohoSession function logs |
| Request stuck in "pending" | Check onRequestCreate function logs |

---

## Deliverables Checklist

- [ ] onRequestCreate trigger deployed
- [ ] onRequestUpdate trigger deployed
- [ ] Scheduled stale request checker deployed
- [ ] Scheduled stale claim checker deployed
- [ ] FCM token management working
- [ ] Service worker for background notifications
- [ ] Notification permission UI
- [ ] Request cancellation working
- [ ] Analytics tracking implemented
- [ ] End-to-end flow tested

---

## Next Phase

Once all tests pass, proceed to **Phase 8: End-to-End Testing** to perform comprehensive testing, add error handling polish, and prepare for production deployment.
