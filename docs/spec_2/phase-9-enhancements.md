# Phase 9: Post-MVP Enhancements

## Purpose

Add critical reliability and user experience improvements that strengthen the MVP for production use. This phase focuses on three key areas: push notifications for faster Helper response, payment capture reliability, and real-time UI updates.

---

## Why We Need This Phase

1. **Helper Responsiveness** - Helpers need notifications even when the app is closed to meet the <15 minute dispatch target
2. **Revenue Protection** - Payment capture failures must be retried and tracked to prevent lost revenue
3. **UI Consistency** - Profile changes should reflect immediately without page refresh
4. **Production Readiness** - These enhancements address real-world reliability concerns

---

## Benefits

- Helpers receive push notifications on desktop and mobile, even with browser closed
- Payment capture retries automatically with admin visibility for failures
- Availability toggle and profile updates reflect instantly in UI
- Reduced support requests from "I didn't get notified" or "payment didn't process"
- Foundation for future notification types (session reminders, etc.)

---

## Prerequisites

- Phases 0-8 completed and tested
- Full end-to-end flow working
- Firebase project with Cloud Messaging enabled

---

## Pre-Phase Fixes

Before implementing Phase 9, apply these small fixes to earlier phases:

### Fix 1: Update Session Type (Phase 1)

In `src/types/index.ts`, add missing fields to Session interface:

```typescript
export interface Session {
  id: string;
  request_id: string;
  customer_id: string;
  helper_id: string;

  // Zoho Lens integration
  zoho_session_id?: string;
  technician_url?: string;        // URL for Helper to access Zoho console
  customer_join_url?: string;     // URL for Customer to join session

  // SMS tracking
  sms_sent_at?: Timestamp;

  // Session state
  status: SessionStatus;
  safety_checklist_completed: boolean;

  // Timing
  started_at?: Timestamp;
  ended_at?: Timestamp;
  duration?: number;

  // Outcome
  outcome?: SessionOutcome;
  notes?: string;

  created_at: Timestamp;
  updated_at: Timestamp;
}
```

### Fix 2: Add Camera Capture (Phase 3)

In `src/components/customer/PhotoUpload.tsx`, update the file input:

```typescript
<input
  ref={file_input_ref}
  type="file"
  accept={app_config.photos.allowed_types.join(',')}
  capture="environment"  // ADD THIS LINE - enables rear camera on mobile
  multiple
  onChange={handle_file_select}
  className="hidden"
/>
```

### Fix 3: Add Zoho API Warning (Phase 5)

Add this warning box at the top of Phase 5, after the Purpose section:

```markdown
> ⚠️ **API VERIFICATION REQUIRED**
>
> The Zoho Lens API code in this phase is based on documented patterns but
> MUST be verified against the actual API before implementation.
>
> Before coding:
> 1. Create Zoho Lens account (Professional plan for API access)
> 2. Review official API docs: https://www.zoho.com/lens/resources/api/
> 3. Generate OAuth credentials in Zoho API Console
> 4. Test session creation manually in sandbox
> 5. Confirm response field names match this spec
>
> Recommendation: Create a standalone test script to validate API calls
> before integrating into the application.
```

---

## Implementation Tasks

### Task 9.1: FCM Setup and Configuration

#### Step 1: Enable Cloud Messaging

1. Go to Firebase Console → Project Settings → Cloud Messaging
2. Enable Cloud Messaging API (V1) if not already enabled
3. Note your Sender ID

#### Step 2: Generate VAPID Key

1. In Firebase Console → Project Settings → Cloud Messaging
2. Scroll to "Web configuration" section
3. Click "Generate key pair" under Web Push certificates
4. Copy the generated key

#### Step 3: Add Environment Variables

Add to `.env.local`:

```bash
VITE_FIREBASE_VAPID_KEY=your_generated_vapid_key_here
```

Add to `functions/.env`:

```bash
# FCM is configured automatically via Firebase Admin SDK
# No additional env vars needed for server-side
```

---

### Task 9.2: Create Service Worker Generator

Service workers cannot access environment variables, so we generate the file at build time.

Create `scripts/generate_sw.js`:

```javascript
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const sw_content = `
// Firebase Messaging Service Worker
// Auto-generated - do not edit directly

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

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Background message received:', payload);

  const notification_title = payload.notification?.title || 'HomePro Assist';
  const notification_options = {
    body: payload.notification?.body || 'You have a new notification',
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    tag: payload.data?.request_id || 'default',
    data: payload.data,
    actions: [
      { action: 'view', title: 'View' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
    vibrate: [200, 100, 200],
  };

  self.registration.showNotification(notification_title, notification_options);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const data = event.notification.data;
  let target_url = '/helper/dashboard';

  if (data?.type === 'new_request' && data?.request_id) {
    target_url = '/helper/dashboard';
  } else if (data?.type === 'session_ready' && data?.session_id) {
    target_url = '/helper/session/' + data.session_id;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((client_list) => {
      // Focus existing window if available
      for (const client of client_list) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(target_url);
          return client.focus();
        }
      }
      // Open new window if no existing window
      return clients.openWindow(target_url);
    })
  );
});
`.trim();

const output_path = path.join(__dirname, '../public/firebase-messaging-sw.js');
fs.writeFileSync(output_path, sw_content);

console.log('✓ Service worker generated:', output_path);
```

Update `package.json` scripts:

```json
{
  "scripts": {
    "generate-sw": "node scripts/generate_sw.js",
    "dev": "npm run generate-sw && vite",
    "build": "npm run generate-sw && tsc && vite build",
    "preview": "vite preview"
  }
}
```

---

### Task 9.3: Create FCM Client Service

Create `src/services/fcm_client.ts`:

```typescript
import { getMessaging, getToken, onMessage, Messaging } from 'firebase/messaging';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { app, db } from './firebase_client';

const fcm_config = {
  vapid_key: import.meta.env.VITE_FIREBASE_VAPID_KEY,
};

let messaging: Messaging | null = null;

function get_messaging(): Messaging | null {
  if (!messaging && typeof window !== 'undefined' && 'Notification' in window) {
    try {
      messaging = getMessaging(app);
    } catch (error) {
      console.error('Failed to initialize messaging:', error);
    }
  }
  return messaging;
}

export async function request_notification_permission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.log('This browser does not support notifications');
    return false;
  }

  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

export async function get_fcm_token(): Promise<string | null> {
  const msg = get_messaging();
  if (!msg) return null;

  try {
    const token = await getToken(msg, { vapidKey: fcm_config.vapid_key });
    return token;
  } catch (error) {
    console.error('Failed to get FCM token:', error);
    return null;
  }
}

export async function register_fcm_token(user_id: string): Promise<boolean> {
  const has_permission = await request_notification_permission();
  if (!has_permission) {
    console.log('Notification permission denied');
    return false;
  }

  const token = await get_fcm_token();
  if (!token) {
    console.error('Failed to get FCM token');
    return false;
  }

  try {
    await updateDoc(doc(db, 'users', user_id), {
      fcm_tokens: arrayUnion(token),
      updated_at: new Date(),
    });
    console.log('FCM token registered');
    return true;
  } catch (error) {
    console.error('Failed to save FCM token:', error);
    return false;
  }
}

export async function unregister_fcm_token(user_id: string): Promise<void> {
  const token = await get_fcm_token();
  if (!token) return;

  try {
    await updateDoc(doc(db, 'users', user_id), {
      fcm_tokens: arrayRemove(token),
    });
  } catch (error) {
    console.error('Failed to remove FCM token:', error);
  }
}

export function on_foreground_message(callback: (payload: any) => void): () => void {
  const msg = get_messaging();
  if (!msg) return () => {};

  return onMessage(msg, (payload) => {
    console.log('Foreground message received:', payload);
    callback(payload);
  });
}
```

---

### Task 9.4: Create Push Notification Hook

Create `src/hooks/use_push_notifications.ts`:

```typescript
import { useEffect, useState } from 'react';
import { useAuth } from './use_auth';
import {
  request_notification_permission,
  register_fcm_token,
  on_foreground_message,
} from '../services/fcm_client';
import { useToast } from '../components/common/Toast';

export function usePushNotifications() {
  const { user } = useAuth();
  const { show_toast } = useToast();
  const [is_enabled, set_is_enabled] = useState(false);
  const [is_loading, set_is_loading] = useState(false);

  // Register for push notifications when Helper logs in
  useEffect(() => {
    if (!user || user.role !== 'helper') return;

    // Check if already has permission
    if ('Notification' in window && Notification.permission === 'granted') {
      register_fcm_token(user.uid).then(set_is_enabled);
    }
  }, [user]);

  // Listen for foreground messages
  useEffect(() => {
    if (!user || user.role !== 'helper') return;

    const unsubscribe = on_foreground_message((payload) => {
      // Show toast for foreground notifications
      const title = payload.notification?.title || 'New Notification';
      const body = payload.notification?.body || '';
      show_toast(`${title}: ${body}`, 'info');
    });

    return () => unsubscribe();
  }, [user, show_toast]);

  const enable_notifications = async (): Promise<boolean> => {
    if (!user) return false;

    set_is_loading(true);
    try {
      const success = await register_fcm_token(user.uid);
      set_is_enabled(success);

      if (success) {
        show_toast('Push notifications enabled', 'success');
      } else {
        show_toast('Failed to enable notifications', 'error');
      }

      return success;
    } finally {
      set_is_loading(false);
    }
  };

  const permission_status = (): 'granted' | 'denied' | 'default' | 'unsupported' => {
    if (!('Notification' in window)) return 'unsupported';
    return Notification.permission;
  };

  return {
    is_enabled,
    is_loading,
    enable_notifications,
    permission_status: permission_status(),
  };
}
```

---

### Task 9.5: Create Notification Permission Prompt

Create `src/components/helper/NotificationPrompt.tsx`:

```typescript
import { useState } from 'react';
import { usePushNotifications } from '../../hooks/use_push_notifications';

export function NotificationPrompt() {
  const { is_enabled, is_loading, enable_notifications, permission_status } =
    usePushNotifications();
  const [dismissed, set_dismissed] = useState(false);

  // Don't show if already enabled, denied, or dismissed
  if (is_enabled || permission_status === 'denied' || dismissed) {
    return null;
  }

  // Don't show if not supported
  if (permission_status === 'unsupported') {
    return null;
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
      <div className="flex items-start space-x-3">
        <span className="text-2xl">🔔</span>
        <div className="flex-1">
          <h3 className="font-medium text-gray-900">Enable Push Notifications</h3>
          <p className="text-sm text-gray-600 mt-1">
            Get notified instantly when new jobs are available, even when your browser is closed.
          </p>
          <div className="flex space-x-3 mt-3">
            <button
              onClick={enable_notifications}
              disabled={is_loading}
              className="btn-primary text-sm py-1.5 px-3"
            >
              {is_loading ? 'Enabling...' : 'Enable Notifications'}
            </button>
            <button
              onClick={() => set_dismissed(true)}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Maybe Later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

### Task 9.6: Update Helper Dashboard

Update `src/pages/helper/HelperDashboard.tsx` to include the notification prompt:

```typescript
// Add import
import { NotificationPrompt } from '../../components/helper/NotificationPrompt';

// In the render, add after the top bar and before error display:
export function HelperDashboard() {
  // ... existing code ...

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Top Bar */}
        <div className="flex items-center justify-between mb-8">
          {/* ... existing top bar code ... */}
        </div>

        {/* ADD THIS: Notification Permission Prompt */}
        <NotificationPrompt />

        {error && (
          // ... existing error display ...
        )}

        {/* ... rest of existing code ... */}
      </main>
    </div>
  );
}
```

---

### Task 9.7: Add FCM to Cloud Functions

Update `functions/src/index.ts` to send push notifications:

```typescript
import * as admin from 'firebase-admin';

// Add this helper function
async function send_push_to_helpers(
  helper_ids: string[],
  notification: { title: string; body: string },
  data: Record<string, string>
): Promise<void> {
  const tokens: string[] = [];

  // Collect all FCM tokens for the helpers
  for (const helper_id of helper_ids) {
    const helper_doc = await db.collection('users').doc(helper_id).get();
    const helper_tokens = helper_doc.data()?.fcm_tokens || [];
    tokens.push(...helper_tokens);
  }

  if (tokens.length === 0) {
    console.log('No FCM tokens found for helpers');
    return;
  }

  // Send to all tokens
  const message: admin.messaging.MulticastMessage = {
    tokens,
    notification: {
      title: notification.title,
      body: notification.body,
    },
    data,
    webpush: {
      fcmOptions: {
        link: '/helper/dashboard',
      },
    },
  };

  try {
    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`Push sent: ${response.successCount} success, ${response.failureCount} failed`);

    // Clean up invalid tokens
    if (response.failureCount > 0) {
      const invalid_tokens: string[] = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success && resp.error?.code === 'messaging/registration-token-not-registered') {
          invalid_tokens.push(tokens[idx]);
        }
      });

      // Remove invalid tokens from user documents
      for (const token of invalid_tokens) {
        const users_with_token = await db
          .collection('users')
          .where('fcm_tokens', 'array-contains', token)
          .get();

        for (const user_doc of users_with_token.docs) {
          await user_doc.ref.update({
            fcm_tokens: admin.firestore.FieldValue.arrayRemove(token),
          });
        }
      }
    }
  } catch (error) {
    console.error('Error sending push notification:', error);
  }
}

// Update onRequestCreated to send push notifications
export const onRequestCreated = functions.firestore
  .document('requests/{requestId}')
  .onCreate(async (snapshot, context) => {
    const request = snapshot.data();
    const request_id = context.params.requestId;

    // Get all available helpers
    const helpers_snapshot = await db
      .collection('users')
      .where('role', '==', 'helper')
      .where('is_available', '==', true)
      .get();

    if (helpers_snapshot.empty) {
      console.log('No available helpers for request:', request_id);
      return;
    }

    const helper_ids = helpers_snapshot.docs.map((doc) => doc.id);

    // Create in-app notification documents (existing code)
    const batch = db.batch();
    const notification_data = {
      type: 'new_request',
      request_id,
      category: request.category,
      description: request.description.slice(0, 100),
      amount: request.amount,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      read: false,
    };

    helpers_snapshot.docs.forEach((helper_doc) => {
      const notification_ref = db
        .collection('users')
        .doc(helper_doc.id)
        .collection('notifications')
        .doc();
      batch.set(notification_ref, notification_data);
    });

    await batch.commit();

    // NEW: Send push notifications
    const category_label = request.category.charAt(0).toUpperCase() + request.category.slice(1);
    await send_push_to_helpers(
      helper_ids,
      {
        title: `New ${category_label} Job Available`,
        body: `$${(request.amount / 100).toFixed(2)} - ${request.description.slice(0, 50)}...`,
      },
      {
        type: 'new_request',
        request_id,
        category: request.category,
      }
    );

    console.log(`Notified ${helpers_snapshot.size} helpers of new request (in-app + push)`);
  });
```

---

### Task 9.8: Update User Type for FCM Tokens

Update `src/types/index.ts`:

```typescript
export interface User {
  uid: string;
  email: string;
  phone: string;
  display_name: string;
  role: UserRole;
  created_at: Timestamp;
  updated_at: Timestamp;

  // Helper-specific fields
  is_available?: boolean;
  specialties?: string[];
  completed_sessions?: number;

  // FCM tokens for push notifications
  fcm_tokens?: string[];
}
```

---

### Task 9.9: Payment Capture with Retry Logic

Update `functions/src/stripe_service.ts` to add retry logic:

```typescript
const MAX_CAPTURE_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

export async function capture_payment_with_retry(
  payment_intent_id: string,
  request_id: string
): Promise<{ success: boolean; error?: string }> {
  let last_error: any = null;

  for (let attempt = 1; attempt <= MAX_CAPTURE_RETRIES; attempt++) {
    try {
      await stripe.paymentIntents.capture(payment_intent_id);
      return { success: true };
    } catch (error: any) {
      last_error = error;
      console.error(`Payment capture attempt ${attempt} failed:`, error.message);

      // Don't retry for non-recoverable errors
      if (
        error.type === 'StripeCardError' ||
        error.code === 'payment_intent_unexpected_state' ||
        error.code === 'payment_intent_already_captured'
      ) {
        break;
      }

      // Wait before retrying (exponential backoff)
      if (attempt < MAX_CAPTURE_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * attempt));
      }
    }
  }

  // All retries failed - log for admin review
  await db.collection('payment_failures').add({
    request_id,
    payment_intent_id,
    error_message: last_error?.message || 'Unknown error',
    error_code: last_error?.code,
    attempts: MAX_CAPTURE_RETRIES,
    created_at: admin.firestore.FieldValue.serverTimestamp(),
  });

  return {
    success: false,
    error: last_error?.message || 'Payment capture failed after retries',
  };
}
```

Update `onSessionEnded` in `functions/src/index.ts`:

```typescript
import { capture_payment_with_retry } from './stripe_service';

export const onSessionEnded = functions.firestore
  .document('sessions/{sessionId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    // Check if session just ended
    if (before.status !== 'ended' && after.status === 'ended') {
      const session_id = context.params.sessionId;
      const request_id = after.request_id;
      const helper_id = after.helper_id;

      // Get request for payment info
      const request_doc = await db.collection('requests').doc(request_id).get();
      const request = request_doc.data()!;

      // Capture payment if authorized (with retry logic)
      if (request.payment_intent_id && request.payment_status === 'authorized') {
        const result = await capture_payment_with_retry(
          request.payment_intent_id,
          request_id
        );

        if (result.success) {
          await db.collection('requests').doc(request_id).update({
            payment_status: 'captured',
            payment_captured_at: admin.firestore.FieldValue.serverTimestamp(),
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
          });
          console.log(`Payment captured for session ${session_id}`);
        } else {
          await db.collection('requests').doc(request_id).update({
            payment_status: 'capture_failed',
            payment_error: result.error,
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
          });
          console.error(`Payment capture failed for session ${session_id}: ${result.error}`);
        }
      }

      // Update Helper stats
      await db.collection('users').doc(helper_id).update({
        completed_sessions: admin.firestore.FieldValue.increment(1),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Calculate and store session duration
      if (after.started_at && after.ended_at) {
        const duration = Math.floor(
          (after.ended_at.toDate() - after.started_at.toDate()) / 1000
        );
        await db.collection('sessions').doc(session_id).update({
          duration,
        });
      }
    }
  });
```

---

### Task 9.10: Real-Time User Profile Listener

Update `src/hooks/use_auth.tsx` to add real-time profile sync:

```typescript
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  ReactNode,
} from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebase_sign_out,
  updateProfile,
} from 'firebase/auth';
import {
  doc,
  setDoc,
  serverTimestamp,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { auth, db } from '../services/firebase_client';
import { User, UserRole } from '../types';

interface AuthContextType {
  firebase_user: FirebaseUser | null;
  user: User | null;
  loading: boolean;
  error: string | null;
  sign_in: (email: string, password: string) => Promise<void>;
  sign_up: (
    email: string,
    password: string,
    display_name: string,
    phone: string,
    role: UserRole
  ) => Promise<void>;
  sign_out: () => Promise<void>;
  clear_error: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebase_user, set_firebase_user] = useState<FirebaseUser | null>(null);
  const [user, set_user] = useState<User | null>(null);
  const [loading, set_loading] = useState(true);
  const [error, set_error] = useState<string | null>(null);

  // Ref to store the Firestore user listener for cleanup
  const user_listener_ref = useRef<Unsubscribe | null>(null);

  // Listen for auth state changes and user profile updates
  useEffect(() => {
    const unsubscribe_auth = onAuthStateChanged(auth, (fb_user) => {
      set_firebase_user(fb_user);

      // Clean up any existing user listener
      if (user_listener_ref.current) {
        user_listener_ref.current();
        user_listener_ref.current = null;
      }

      if (fb_user) {
        // Set up real-time listener for user profile
        const user_doc_ref = doc(db, 'users', fb_user.uid);

        user_listener_ref.current = onSnapshot(
          user_doc_ref,
          (doc_snapshot) => {
            if (doc_snapshot.exists()) {
              set_user({ uid: fb_user.uid, ...doc_snapshot.data() } as User);
            } else {
              set_user(null);
            }
            set_loading(false);
          },
          (err) => {
            console.error('Error listening to user profile:', err);
            set_user(null);
            set_loading(false);
          }
        );
      } else {
        set_user(null);
        set_loading(false);
      }
    });

    // Cleanup function
    return () => {
      unsubscribe_auth();
      if (user_listener_ref.current) {
        user_listener_ref.current();
        user_listener_ref.current = null;
      }
    };
  }, []);

  const sign_in = async (email: string, password: string) => {
    try {
      set_error(null);
      set_loading(true);
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      set_error(get_error_message(err.code));
      throw err;
    }
    // Note: set_loading(false) happens in onSnapshot callback
  };

  const sign_up = async (
    email: string,
    password: string,
    display_name: string,
    phone: string,
    role: UserRole
  ) => {
    try {
      set_error(null);
      set_loading(true);

      // Create Firebase auth user
      const credential = await createUserWithEmailAndPassword(auth, email, password);

      // Update display name in Firebase Auth
      await updateProfile(credential.user, { displayName: display_name });

      // Create user profile in Firestore
      const user_profile: Omit<User, 'uid'> = {
        email,
        phone,
        display_name,
        role,
        created_at: serverTimestamp() as any,
        updated_at: serverTimestamp() as any,
        ...(role === 'helper' && {
          is_available: false,
          specialties: [],
          completed_sessions: 0,
          fcm_tokens: [],
        }),
      };

      await setDoc(doc(db, 'users', credential.user.uid), user_profile);
    } catch (err: any) {
      set_error(get_error_message(err.code));
      throw err;
    }
    // Note: set_loading(false) happens in onSnapshot callback
  };

  const sign_out = async () => {
    try {
      await firebase_sign_out(auth);
    } catch (err: any) {
      set_error(get_error_message(err.code));
      throw err;
    }
  };

  const clear_error = () => set_error(null);

  return (
    <AuthContext.Provider
      value={{
        firebase_user,
        user,
        loading,
        error,
        sign_in,
        sign_up,
        sign_out,
        clear_error,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

function get_error_message(error_code: string): string {
  switch (error_code) {
    case 'auth/email-already-in-use':
      return 'This email is already registered. Please sign in instead.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/operation-not-allowed':
      return 'Email/password sign in is not enabled.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    case 'auth/user-not-found':
      return 'No account found with this email.';
    case 'auth/wrong-password':
      return 'Incorrect password. Please try again.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again later.';
    default:
      return 'An error occurred. Please try again.';
  }
}
```

---

## Verification Tests

### Push Notification Tests

#### Test 1: Permission Request

1. Login as Helper
2. See notification prompt on dashboard

**Expected:** Prompt displays asking to enable notifications

#### Test 2: Enable Notifications

1. Click "Enable Notifications"
2. Accept browser permission

**Expected:**
- Browser shows permission dialog
- Toast confirms "Push notifications enabled"
- FCM token saved to user document

#### Test 3: Background Notification

1. Enable notifications as Helper
2. Close browser completely
3. Submit new request as Customer

**Expected:**
- Desktop notification appears
- Clicking notification opens dashboard

#### Test 4: Foreground Notification

1. Keep Helper dashboard open
2. Submit new request as Customer

**Expected:**
- Toast notification appears
- In-app notification bell also shows

### Payment Retry Tests

#### Test 5: Successful Capture

1. Complete a session normally

**Expected:** Payment captured, `payment_status: 'captured'`

#### Test 6: Retry on Failure (simulate with test mode)

1. Check Cloud Functions logs for retry attempts

**Expected:** Retries up to 3 times with backoff

#### Test 7: Failed Capture Logging

1. Simulate persistent failure
2. Check Firestore `payment_failures` collection

**Expected:** Failure documented with error details

### Real-Time Profile Tests

#### Test 8: Availability Toggle

1. Toggle availability on Helper dashboard

**Expected:** UI updates immediately without refresh

#### Test 9: Profile Update

1. Update Helper profile from another tab

**Expected:** Changes reflect in first tab automatically

---

## Deliverables Checklist

### FCM Push Notifications
- [ ] VAPID key generated and added to env
- [ ] Service worker generator script created
- [ ] FCM client service implemented
- [ ] Push notification hook created
- [ ] Notification prompt component added
- [ ] Helper dashboard updated with prompt
- [ ] Cloud function sends push on new request
- [ ] User type updated with fcm_tokens field
- [ ] Invalid token cleanup implemented

### Payment Capture Reliability
- [ ] Retry logic with exponential backoff
- [ ] Non-recoverable error detection
- [ ] payment_failures collection for logging
- [ ] capture_failed status added
- [ ] onSessionEnded updated with retry

### Real-Time User Profile
- [ ] useAuth hook uses onSnapshot
- [ ] Proper listener cleanup with useRef
- [ ] Availability toggle reflects immediately

---

## Browser Compatibility Notes

FCM Web Push works on:
- Chrome (desktop & Android)
- Firefox (desktop & Android)
- Edge (desktop)
- Opera (desktop)

**Not supported:**
- Safari (use APNs for iOS/macOS - future enhancement)
- iOS browsers (no Web Push support)

For iOS Helpers, consider a future native app or PWA with APNs.

---

## Success Metrics

| Metric | Before Phase 9 | Target After |
|--------|----------------|--------------|
| Helper notification delivery | 70% (tab must be open) | 95%+ |
| Payment capture success | 95% | 99%+ |
| UI update latency | Page refresh required | < 1 second |
| Request to claim time | Varies | < 10 minutes |

---

## Next Steps (Future Phases)

After Phase 9 is complete, consider:

1. **iOS Push Notifications** - Native app or PWA with APNs
2. **SMS Fallback** - Send SMS to Helpers if push fails
3. **Notification Preferences** - Let Helpers choose notification types
4. **Admin Dashboard** - View payment failures and system health
5. **Rating System** - Post-session ratings (from original "Out of Scope")
