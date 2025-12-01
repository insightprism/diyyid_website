# Phase 7: Session Management

## Purpose

Complete the end-to-end session lifecycle including Helper dispatch notifications, customer waiting experience, session outcome tracking, and automatic payment capture. This phase ties all previous components into a cohesive flow.

---

## Why We Need This Phase

1. **Dispatch Speed** - Helpers must be notified immediately when requests come in
2. **Customer Experience** - Customers need clear status updates while waiting
3. **Session Tracking** - Track outcomes for quality metrics
4. **Payment Automation** - Capture payment only on successful completion
5. **Helper Metrics** - Track completed sessions for performance

---

## Benefits

- Sub-30-second Helper notification
- Real-time status updates for customers
- Automatic payment capture on completion
- Session outcome tracking for analytics
- Helper performance metrics

---

## Prerequisites

- Phase 6 completed (payment working)
- All previous phases functional

---

## Implementation Tasks

### Task 7.1: Create Helper Notification Function

Add to `functions/src/index.ts`:

```typescript
// Trigger when new request is created
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

    // Create notification documents for each helper
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
    console.log(`Notified ${helpers_snapshot.size} helpers of new request`);
  });

// Capture payment when session ends successfully
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

      // Capture payment if authorized
      if (request.payment_intent_id && request.payment_status === 'authorized') {
        try {
          await capture_payment(request.payment_intent_id);

          await db.collection('requests').doc(request_id).update({
            payment_status: 'captured',
            updated_at: admin.firestore.FieldValue.serverTimestamp(),
          });

          console.log(`Payment captured for session ${session_id}`);
        } catch (error) {
          console.error('Payment capture failed:', error);
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

### Task 7.2: Create Notifications Hook

Create `src/hooks/use_notifications.ts`:

```typescript
import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  limit,
} from 'firebase/firestore';
import { db } from '../services/firebase_client';
import { useAuth } from './use_auth';

interface Notification {
  id: string;
  type: string;
  request_id: string;
  category: string;
  description: string;
  amount: number;
  created_at: any;
  read: boolean;
}

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, set_notifications] = useState<Notification[]>([]);
  const [unread_count, set_unread_count] = useState(0);

  useEffect(() => {
    if (!user || user.role !== 'helper') return;

    const q = query(
      collection(db, 'users', user.uid, 'notifications'),
      where('read', '==', false),
      orderBy('created_at', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Notification[];

      set_notifications(items);
      set_unread_count(items.length);

      // Play sound for new notifications
      if (items.length > 0) {
        // Optional: play notification sound
        // new Audio('/notification.mp3').play();
      }
    });

    return () => unsubscribe();
  }, [user]);

  const mark_as_read = async (notification_id: string) => {
    if (!user) return;
    await updateDoc(
      doc(db, 'users', user.uid, 'notifications', notification_id),
      { read: true }
    );
  };

  const mark_all_read = async () => {
    if (!user) return;
    const updates = notifications.map((n) =>
      updateDoc(doc(db, 'users', user.uid, 'notifications', n.id), {
        read: true,
      })
    );
    await Promise.all(updates);
  };

  return { notifications, unread_count, mark_as_read, mark_all_read };
}
```

### Task 7.3: Create Notification Bell Component

Create `src/components/helper/NotificationBell.tsx`:

```typescript
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../hooks/use_notifications';
import { format_distance_to_now } from '../../utils/date_utils';
import { app_config } from '../../config/app_config';

export function NotificationBell() {
  const { notifications, unread_count, mark_as_read, mark_all_read } =
    useNotifications();
  const [is_open, set_is_open] = useState(false);
  const navigate = useNavigate();

  const handle_click = async (notification: any) => {
    await mark_as_read(notification.id);
    set_is_open(false);
    navigate('/helper/dashboard');
  };

  return (
    <div className="relative">
      <button
        onClick={() => set_is_open(!is_open)}
        className="relative p-2 text-gray-600 hover:text-gray-900"
      >
        <span className="text-xl">&#128276;</span>
        {unread_count > 0 && (
          <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
            {unread_count > 9 ? '9+' : unread_count}
          </span>
        )}
      </button>

      {is_open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => set_is_open(false)}
          />
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border z-50">
            <div className="p-3 border-b flex justify-between items-center">
              <span className="font-semibold">Notifications</span>
              {unread_count > 0 && (
                <button
                  onClick={mark_all_read}
                  className="text-xs text-primary-600 hover:underline"
                >
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  No new notifications
                </div>
              ) : (
                notifications.map((notification) => {
                  const category = app_config.categories.find(
                    (c) => c.value === notification.category
                  );
                  return (
                    <button
                      key={notification.id}
                      onClick={() => handle_click(notification)}
                      className="w-full p-3 text-left hover:bg-gray-50 border-b last:border-0"
                    >
                      <div className="flex items-start space-x-2">
                        <span className="text-xl">{category?.icon || '🏠'}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">
                            New {category?.label} Request
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {notification.description}
                          </p>
                          <div className="flex justify-between mt-1">
                            <span className="text-xs text-gray-400">
                              {format_distance_to_now(notification.created_at)}
                            </span>
                            <span className="text-xs font-medium text-green-600">
                              ${(notification.amount / 100).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
```

### Task 7.4: Create Session Outcome Component

Create `src/components/helper/SessionOutcome.tsx`:

```typescript
import { useState } from 'react';
import { SessionOutcome as OutcomeType } from '../../types';

interface SessionOutcomeProps {
  on_submit: (outcome: OutcomeType, notes: string) => Promise<void>;
  is_loading: boolean;
}

const OUTCOMES: { value: OutcomeType; label: string; icon: string }[] = [
  { value: 'resolved', label: 'Issue Resolved', icon: '&#10003;' },
  { value: 'unresolved', label: 'Not Resolved', icon: '&#10007;' },
  { value: 'escalated', label: 'Needs In-Person Visit', icon: '&#128736;' },
];

export function SessionOutcome({ on_submit, is_loading }: SessionOutcomeProps) {
  const [outcome, set_outcome] = useState<OutcomeType | null>(null);
  const [notes, set_notes] = useState('');

  const handle_submit = async () => {
    if (!outcome) return;
    await on_submit(outcome, notes);
  };

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">How did the session go?</h3>

      <div className="grid grid-cols-3 gap-3">
        {OUTCOMES.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => set_outcome(o.value)}
            className={`p-4 rounded-lg border-2 text-center transition-all ${
              outcome === o.value
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <span
              className="text-2xl block mb-1"
              dangerouslySetInnerHTML={{ __html: o.icon }}
            />
            <span className="text-sm">{o.label}</span>
          </button>
        ))}
      </div>

      <div>
        <label className="label">Notes (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => set_notes(e.target.value)}
          rows={3}
          className="input-field resize-none"
          placeholder="Any notes about the session..."
        />
      </div>

      <button
        onClick={handle_submit}
        disabled={!outcome || is_loading}
        className="btn-primary w-full"
      >
        {is_loading ? 'Saving...' : 'Complete Session'}
      </button>
    </div>
  );
}
```

### Task 7.5: Update Header with Notifications

Update `src/components/common/Header.tsx`:

```typescript
import { Link, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../../services/firebase_client';
import { useAuth } from '../../hooks/use_auth';
import { NotificationBell } from '../helper/NotificationBell';
import { app_config } from '../../config/app_config';

export function Header() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handle_sign_out = async () => {
    await signOut(auth);
    navigate('/');
  };

  const dashboard_link =
    user?.role === 'helper' ? '/helper/dashboard' : '/customer/request';

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link to={dashboard_link} className="flex items-center space-x-2">
          <span className="text-2xl">🏠</span>
          <span className="font-bold text-xl text-gray-900">
            {app_config.app_name}
          </span>
        </Link>

        {user && (
          <div className="flex items-center space-x-4">
            {user.role === 'helper' && <NotificationBell />}
            <span className="text-sm text-gray-600">
              {user.display_name}
              <span className="ml-2 px-2 py-0.5 text-xs bg-gray-100 rounded capitalize">
                {user.role}
              </span>
            </span>
            <button
              onClick={handle_sign_out}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Sign Out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
```

### Task 7.6: Update Helper Session with Outcome

Update `src/pages/helper/HelperSession.tsx` to add outcome tracking:

```typescript
// Add to the 'active' stage section, before the End Session button
// or add as a modal when ending

import { SessionOutcome } from '../../components/helper/SessionOutcome';

// In the component, add state:
const [show_outcome, set_show_outcome] = useState(false);

// Update handle_end:
const handle_end = () => {
  set_show_outcome(true);
};

const submit_outcome = async (outcome: string, notes: string) => {
  if (!session_id) return;

  await updateDoc(doc(db, 'sessions', session_id), {
    outcome,
    notes,
  });

  await end_session(session_id);
  navigate('/helper/dashboard');
};

// In render, show outcome modal when show_outcome is true
{show_outcome && (
  <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-xl max-w-md w-full p-6">
      <SessionOutcome
        on_submit={submit_outcome}
        is_loading={is_loading}
      />
    </div>
  </div>
)}
```

### Task 7.7: Create Customer Session Page

Create `src/pages/customer/CustomerSession.tsx`:

```typescript
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase_client';
import { Header } from '../../components/common/Header';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { Session, Request } from '../../types';

export function CustomerSession() {
  const { session_id } = useParams<{ session_id: string }>();
  const navigate = useNavigate();
  const [session, set_session] = useState<Session | null>(null);
  const [request, set_request] = useState<Request | null>(null);
  const [loading, set_loading] = useState(true);

  useEffect(() => {
    if (!session_id) return;
    return onSnapshot(doc(db, 'sessions', session_id), (snap) => {
      if (snap.exists()) {
        set_session({ id: snap.id, ...snap.data() } as Session);
      }
      set_loading(false);
    });
  }, [session_id]);

  useEffect(() => {
    if (!session?.request_id) return;
    return onSnapshot(doc(db, 'requests', session.request_id), (snap) => {
      if (snap.exists()) set_request({ id: snap.id, ...snap.data() } as Request);
    });
  }, [session?.request_id]);

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

  const join_url = session?.customer_join_url;

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />

      <main className="max-w-md mx-auto px-4 py-8">
        {session?.status === 'waiting' && (
          <div className="card text-center">
            <span className="text-4xl block mb-4">📹</span>
            <h1 className="text-xl font-bold mb-2">Your Session is Ready</h1>
            <p className="text-gray-600 mb-6">
              Click below to join the video call with your Helper.
            </p>
            {join_url ? (
              <a
                href={join_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary w-full block text-center"
              >
                Join Video Session
              </a>
            ) : (
              <p className="text-gray-500">Waiting for session link...</p>
            )}
          </div>
        )}

        {session?.status === 'active' && (
          <div className="card text-center">
            <span className="text-4xl block mb-4">&#128994;</span>
            <h1 className="text-xl font-bold mb-2">Session in Progress</h1>
            <p className="text-gray-600 mb-6">
              Your session is active. If you closed the video tab, click below to rejoin.
            </p>
            {join_url && (
              <a
                href={join_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary w-full block text-center"
              >
                Rejoin Video Session
              </a>
            )}
          </div>
        )}

        {session?.status === 'ended' && (
          <div className="card text-center">
            <span className="text-4xl block mb-4">&#10003;</span>
            <h1 className="text-xl font-bold mb-2">Session Complete</h1>
            <p className="text-gray-600 mb-4">
              Thank you for using HomePro Assist!
            </p>
            {session.outcome && (
              <p className="text-sm text-gray-500 mb-4">
                Outcome: <span className="capitalize">{session.outcome}</span>
              </p>
            )}
            <button
              onClick={() => navigate('/customer/request')}
              className="btn-primary"
            >
              Submit Another Request
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
```

---

## Verification Tests

### Test 1: Helper Notification

1. Create a request as Customer
2. Check Helper's notification bell

**Expected:** Notification appears within seconds

### Test 2: Real-time Status

1. Watch Customer status page
2. Helper claims and starts session

**Expected:** Status updates automatically

### Test 3: Session Outcome

1. Helper ends session
2. Select outcome and notes

**Expected:** Outcome saved to session document

### Test 4: Payment Auto-Capture

1. Complete a session

**Expected:** Payment captured automatically

### Test 5: Helper Stats Update

1. Complete a session
2. Check Helper profile

**Expected:** completed_sessions incremented

### Test 6: Session Duration

1. Complete a session

**Expected:** Duration calculated and stored

---

## Deliverables Checklist

- [ ] onRequestCreated trigger for notifications
- [ ] onSessionEnded trigger for payment capture
- [ ] Notifications hook
- [ ] NotificationBell component
- [ ] SessionOutcome component
- [ ] Header updated with notifications
- [ ] CustomerSession page
- [ ] Payment auto-capture working
- [ ] Helper stats updating

---

## Next Phase

Proceed to **Phase 8: Testing & Polish** for final QA and deployment preparation.
