# Phase 4: Helper Dashboard

## Purpose

Create the Helper Console where professionals view incoming requests, review customer issues, claim jobs, and manage their availability. This is the primary interface for Helpers to receive and accept work.

---

## Why We Need This Phase

1. **Job Discovery** - Helpers need to see available requests in real-time
2. **Informed Decisions** - Photos and descriptions help Helpers accept appropriate jobs
3. **Availability Management** - Helpers can toggle online/offline status
4. **Claim Process** - Clear workflow for accepting a job before starting
5. **Queue Management** - Prevents multiple Helpers from claiming the same job

---

## Benefits

- Real-time request notifications
- Rich context (photos, description) before accepting
- Clear job queue with status indicators
- Availability toggle for work-life balance
- Desktop-optimized interface for efficient workflow

---

## Prerequisites

- Phase 3 completed (customers can submit requests)
- At least one test request in Firestore
- Helper account created

---

## Implementation Tasks

### Task 4.1: Create Date Utilities

Create `src/utils/date_utils.ts`:

```typescript
import { Timestamp } from 'firebase/firestore';

export function format_distance_to_now(timestamp: Timestamp | undefined): string {
  if (!timestamp) return 'Unknown';

  const date = timestamp.toDate();
  const now = new Date();
  const diff_seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diff_seconds < 60) {
    return 'Just now';
  }

  const diff_minutes = Math.floor(diff_seconds / 60);
  if (diff_minutes < 60) {
    return `${diff_minutes}m ago`;
  }

  const diff_hours = Math.floor(diff_minutes / 60);
  if (diff_hours < 24) {
    return `${diff_hours}h ago`;
  }

  const diff_days = Math.floor(diff_hours / 24);
  return `${diff_days}d ago`;
}

export function format_time(timestamp: Timestamp | undefined): string {
  if (!timestamp) return '';
  return timestamp.toDate().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function format_date(timestamp: Timestamp | undefined): string {
  if (!timestamp) return '';
  return timestamp.toDate().toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  });
}
```

### Task 4.2: Create Request Card Component

Create `src/components/helper/RequestCard.tsx`:

```typescript
import { useState } from 'react';
import { Request } from '../../types';
import { app_config } from '../../config/app_config';
import { format_distance_to_now } from '../../utils/date_utils';

interface RequestCardProps {
  request: Request;
  on_claim: (request_id: string) => Promise<void>;
  is_claiming: boolean;
}

export function RequestCard({ request, on_claim, is_claiming }: RequestCardProps) {
  const [selected_image, set_selected_image] = useState<string | null>(null);

  const category = app_config.categories.find((c) => c.value === request.category);
  const category_icon = category?.icon || '🏠';
  const category_label = category?.label || 'Other';

  const handle_claim = async () => {
    await on_claim(request.id);
  };

  return (
    <div className="card hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-2">
          <span className="text-2xl">{category_icon}</span>
          <div>
            <span className="font-medium text-gray-900">{category_label}</span>
            <p className="text-sm text-gray-500">
              {format_distance_to_now(request.created_at)}
            </p>
          </div>
        </div>
        <span className="text-lg font-bold text-green-600">
          ${(request.amount / 100).toFixed(2)}
        </span>
      </div>

      {/* Description */}
      <div className="mb-4">
        <p className="text-gray-700 line-clamp-3">{request.description}</p>
      </div>

      {/* Photos */}
      {request.photo_urls.length > 0 && (
        <div className="mb-4">
          <div className="grid grid-cols-4 gap-2">
            {request.photo_urls.slice(0, 4).map((url, index) => (
              <button
                key={index}
                type="button"
                onClick={() => set_selected_image(url)}
                className="aspect-square rounded-lg overflow-hidden hover:opacity-80 transition-opacity"
              >
                <img
                  src={url}
                  alt={`Issue photo ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
          {request.photo_urls.length > 4 && (
            <p className="text-sm text-gray-500 mt-1">
              +{request.photo_urls.length - 4} more photos
            </p>
          )}
        </div>
      )}

      {/* Claim Button */}
      <button
        onClick={handle_claim}
        disabled={is_claiming}
        className="btn-primary w-full"
      >
        {is_claiming ? 'Claiming...' : 'Claim This Job'}
      </button>

      {/* Image Modal */}
      {selected_image && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4"
          onClick={() => set_selected_image(null)}
        >
          <div className="max-w-4xl max-h-[90vh]">
            <img
              src={selected_image}
              alt="Full size"
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
            />
          </div>
          <button
            onClick={() => set_selected_image(null)}
            className="absolute top-4 right-4 text-white text-4xl hover:text-gray-300"
          >
            x
          </button>
        </div>
      )}
    </div>
  );
}
```

### Task 4.3: Create Availability Toggle Component

Create `src/components/helper/AvailabilityToggle.tsx`:

```typescript
import { useState } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase_client';
import { useAuth } from '../../hooks/use_auth';

export function AvailabilityToggle() {
  const { user } = useAuth();
  const [is_updating, set_is_updating] = useState(false);

  if (!user) return null;

  const is_available = user.is_available ?? false;

  const toggle_availability = async () => {
    set_is_updating(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        is_available: !is_available,
        updated_at: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating availability:', error);
    } finally {
      set_is_updating(false);
    }
  };

  return (
    <div className="flex items-center space-x-3">
      <span className="text-sm text-gray-600">
        {is_available ? 'Available for jobs' : 'Not available'}
      </span>
      <button
        onClick={toggle_availability}
        disabled={is_updating}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors
          focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
          ${is_available ? 'bg-green-500' : 'bg-gray-300'}
          ${is_updating ? 'opacity-50' : ''}`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform
            ${is_available ? 'translate-x-6' : 'translate-x-1'}`}
        />
      </button>
    </div>
  );
}
```

### Task 4.4: Create Claimed Jobs Component

Create `src/components/helper/ClaimedJobs.tsx`:

```typescript
import { Request } from '../../types';
import { format_distance_to_now } from '../../utils/date_utils';
import { app_config } from '../../config/app_config';

interface ClaimedJobsProps {
  requests: Request[];
  on_start_session: (request: Request) => void;
}

export function ClaimedJobs({ requests, on_start_session }: ClaimedJobsProps) {
  if (requests.length === 0) {
    return null;
  }

  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Your Claimed Jobs ({requests.length})
      </h2>
      <div className="space-y-4">
        {requests.map((request) => {
          const category = app_config.categories.find(
            (c) => c.value === request.category
          );
          return (
            <div
              key={request.id}
              className="card bg-blue-50 border-blue-200"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="inline-block px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded mb-2">
                    Claimed {format_distance_to_now(request.claimed_at)}
                  </span>
                  <h3 className="font-medium text-gray-900 flex items-center">
                    <span className="mr-2">{category?.icon}</span>
                    {category?.label}
                  </h3>
                  <p className="text-sm text-gray-600 line-clamp-2 mt-1">
                    {request.description}
                  </p>
                </div>
                <button
                  onClick={() => on_start_session(request)}
                  className="btn-primary whitespace-nowrap ml-4"
                >
                  Start Session
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

### Task 4.5: Create Helper Dashboard Page

Create `src/pages/helper/HelperDashboard.tsx`:

```typescript
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
  addDoc,
} from 'firebase/firestore';
import { db } from '../../services/firebase_client';
import { useAuth } from '../../hooks/use_auth';
import { Header } from '../../components/common/Header';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { RequestCard } from '../../components/helper/RequestCard';
import { AvailabilityToggle } from '../../components/helper/AvailabilityToggle';
import { ClaimedJobs } from '../../components/helper/ClaimedJobs';
import { Request } from '../../types';

export function HelperDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [pending_requests, set_pending_requests] = useState<Request[]>([]);
  const [claimed_requests, set_claimed_requests] = useState<Request[]>([]);
  const [loading, set_loading] = useState(true);
  const [claiming_id, set_claiming_id] = useState<string | null>(null);
  const [error, set_error] = useState<string | null>(null);

  // Subscribe to pending requests (available jobs)
  useEffect(() => {
    const q = query(
      collection(db, 'requests'),
      where('status', '==', 'pending'),
      orderBy('created_at', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const requests = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Request[];
        set_pending_requests(requests);
        set_loading(false);
      },
      (err) => {
        console.error('Error fetching pending requests:', err);
        set_error('Failed to load requests');
        set_loading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Subscribe to claimed requests (my jobs)
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'requests'),
      where('helper_id', '==', user.uid),
      where('status', '==', 'claimed'),
      orderBy('claimed_at', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const requests = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Request[];
        set_claimed_requests(requests);
      },
      (err) => {
        console.error('Error fetching claimed requests:', err);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const handle_claim_request = async (request_id: string) => {
    if (!user) return;

    set_claiming_id(request_id);
    set_error(null);

    try {
      await updateDoc(doc(db, 'requests', request_id), {
        status: 'claimed',
        helper_id: user.uid,
        claimed_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });
    } catch (err: any) {
      console.error('Error claiming request:', err);
      set_error('Failed to claim request. It may have been claimed by another Helper.');
    } finally {
      set_claiming_id(null);
    }
  };

  const handle_start_session = async (request: Request) => {
    if (!user) return;

    try {
      // Create a new session
      const session_data = {
        request_id: request.id,
        customer_id: request.customer_id,
        helper_id: user.uid,
        status: 'created',
        safety_checklist_completed: false,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      };

      const session_ref = await addDoc(collection(db, 'sessions'), session_data);

      // Update the request
      await updateDoc(doc(db, 'requests', request.id), {
        session_id: session_ref.id,
        status: 'in_session',
        updated_at: serverTimestamp(),
      });

      // Navigate to the session page
      navigate(`/helper/session/${session_ref.id}`);
    } catch (err) {
      console.error('Error starting session:', err);
      set_error('Failed to start session');
    }
  };

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

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Top Bar */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Helper Dashboard</h1>
            <p className="text-gray-600">
              {pending_requests.length} job{pending_requests.length === 1 ? '' : 's'} available
            </p>
          </div>
          <AvailabilityToggle />
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Claimed Jobs Section */}
        <ClaimedJobs
          requests={claimed_requests}
          on_start_session={handle_start_session}
        />

        {/* Available Jobs Section */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Available Jobs
          </h2>

          {pending_requests.length === 0 ? (
            <div className="card text-center py-12">
              <div className="text-4xl mb-4">📭</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No jobs available right now
              </h3>
              <p className="text-gray-600">
                New requests will appear here automatically.
                {!user?.is_available && (
                  <span className="block mt-2 text-amber-600">
                    Toggle your availability to receive notifications.
                  </span>
                )}
              </p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {pending_requests.map((request) => (
                <RequestCard
                  key={request.id}
                  request={request}
                  on_claim={handle_claim_request}
                  is_claiming={claiming_id === request.id}
                />
              ))}
            </div>
          )}
        </div>

        {/* Stats Section */}
        <div className="mt-12 pt-8 border-t border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Stats</h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="card text-center">
              <p className="text-3xl font-bold text-primary-600">
                {user?.completed_sessions || 0}
              </p>
              <p className="text-sm text-gray-600">Sessions Completed</p>
            </div>
            <div className="card text-center">
              <p className="text-3xl font-bold text-green-600">--</p>
              <p className="text-sm text-gray-600">Avg. Rating</p>
            </div>
            <div className="card text-center">
              <p className="text-3xl font-bold text-gray-600">--</p>
              <p className="text-sm text-gray-600">This Week</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
```

### Task 4.6: Update Routes

Update `src/App.tsx`:

```typescript
// Add import
import { HelperDashboard } from './pages/helper/HelperDashboard';

// Update helper dashboard route
<Route
  path="dashboard"
  element={
    <ProtectedRoute allowed_role="helper">
      <HelperDashboard />
    </ProtectedRoute>
  }
/>
```

---

## Verification Tests

### Test 1: Dashboard Loads

1. Sign in as Helper
2. Navigate to `/helper/dashboard`

**Expected:** Dashboard loads with "Available Jobs" section

### Test 2: Availability Toggle

1. Click the availability toggle

**Expected:** Toggle switches between green/gray, Firestore user.is_available updates

### Test 3: View Pending Requests

1. Create a request as Customer
2. Sign in as Helper

**Expected:** Request appears in "Available Jobs" with category, description, photos, price

### Test 4: Photo Preview

1. Click on a photo thumbnail

**Expected:** Full-size image modal opens

### Test 5: Claim Request

1. Click "Claim This Job"

**Expected:**
- Button shows "Claiming..."
- Request moves to "Your Claimed Jobs"
- Request disappears from Available Jobs

### Test 6: Real-time Updates

1. Open Helper dashboard
2. Submit a new request as Customer (another browser/tab)

**Expected:** Request appears in Helper dashboard without refresh

### Test 7: Start Session

1. Claim a request
2. Click "Start Session"

**Expected:**
- Session document created in Firestore
- Request status changes to 'in_session'
- Redirected to `/helper/session/{id}`

### Test 8: Empty State

1. Ensure no pending requests

**Expected:** "No jobs available right now" message

---

## Deliverables Checklist

- [ ] Date utility functions
- [ ] RequestCard component with photo modal
- [ ] AvailabilityToggle component
- [ ] ClaimedJobs component
- [ ] HelperDashboard page with real-time queries
- [ ] Claim functionality
- [ ] Start Session creates session document
- [ ] Routes updated
- [ ] Real-time updates working
- [ ] Empty states displayed

---

## Next Phase

Once all tests pass, proceed to **Phase 5: Zoho Lens Integration** to implement video sessions with AR annotation.
