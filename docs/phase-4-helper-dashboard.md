# Phase 4: Helper Dashboard

## Purpose

Create the Helper Console where professional tradespeople can view incoming requests, review customer issues, claim jobs, and manage their availability status. This is the primary interface for Helpers to receive and accept work.

---

## Why We Need This Phase

1. **Job Discovery** - Helpers need to see available requests in real-time
2. **Informed Decisions** - Viewing photos and descriptions helps Helpers accept appropriate jobs
3. **Availability Management** - Helpers can toggle online/offline status
4. **Claim Process** - Clear workflow for accepting a job before starting a session
5. **Queue Management** - Prevents multiple Helpers from claiming the same job

---

## Benefits

- Real-time request notifications
- Rich context (photos, description) before accepting
- Clear job queue with status indicators
- Availability toggle for work-life balance
- Foundation for automated dispatch notifications (Phase 7)
- Desktop-optimized interface for efficient workflow

---

## Prerequisites

- Phase 3 completed (customers can submit requests)
- At least one test request in Firestore
- Helper account created and logged in

---

## Implementation Tasks

### Task 4.1: Create Request Card Component

Create `src/components/helper/RequestCard.tsx`:

```typescript
import { useState } from 'react';
import { Request } from '../../types';
import { formatDistanceToNow } from '../../utils/dateUtils';

interface RequestCardProps {
  request: Request;
  onClaim: (requestId: string) => Promise<void>;
  isClaiming: boolean;
}

const CATEGORY_LABELS: Record<string, { label: string; icon: string }> = {
  plumbing: { label: 'Plumbing', icon: '🚿' },
  electrical: { label: 'Electrical', icon: '⚡' },
  hvac: { label: 'HVAC', icon: '❄️' },
  appliance: { label: 'Appliance', icon: '🔧' },
  other: { label: 'Other', icon: '🏠' },
};

export function RequestCard({ request, onClaim, isClaiming }: RequestCardProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const category = CATEGORY_LABELS[request.category] || CATEGORY_LABELS.other;

  const handleClaim = async () => {
    await onClaim(request.id);
  };

  return (
    <div className="card hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-2">
          <span className="text-2xl">{category.icon}</span>
          <div>
            <span className="font-medium text-gray-900">{category.label}</span>
            <p className="text-sm text-gray-500">
              {formatDistanceToNow(request.createdAt)}
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
      {request.photoUrls.length > 0 && (
        <div className="mb-4">
          <div className="grid grid-cols-4 gap-2">
            {request.photoUrls.slice(0, 4).map((url, index) => (
              <button
                key={index}
                onClick={() => setSelectedImage(url)}
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
          {request.photoUrls.length > 4 && (
            <p className="text-sm text-gray-500 mt-1">
              +{request.photoUrls.length - 4} more photos
            </p>
          )}
        </div>
      )}

      {/* Claim Button */}
      <button
        onClick={handleClaim}
        disabled={isClaiming}
        className="btn-primary w-full"
      >
        {isClaiming ? 'Claiming...' : 'Claim This Job'}
      </button>

      {/* Image Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="max-w-4xl max-h-[90vh]">
            <img
              src={selectedImage}
              alt="Full size"
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
            />
          </div>
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute top-4 right-4 text-white text-4xl hover:text-gray-300"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
```

### Task 4.2: Create Date Utility

Create `src/utils/dateUtils.ts`:

```typescript
import { Timestamp } from 'firebase/firestore';

export function formatDistanceToNow(timestamp: Timestamp | undefined): string {
  if (!timestamp) return 'Unknown';

  const date = timestamp.toDate();
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return 'Just now';
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} minute${diffInMinutes === 1 ? '' : 's'} ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} hour${diffInHours === 1 ? '' : 's'} ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays} day${diffInDays === 1 ? '' : 's'} ago`;
}

export function formatTime(timestamp: Timestamp | undefined): string {
  if (!timestamp) return '';
  return timestamp.toDate().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDate(timestamp: Timestamp | undefined): string {
  if (!timestamp) return '';
  return timestamp.toDate().toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
```

### Task 4.3: Create Availability Toggle Component

Create `src/components/helper/AvailabilityToggle.tsx`:

```typescript
import { useState } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuth } from '../../hooks/useAuth';

export function AvailabilityToggle() {
  const { user } = useAuth();
  const [isUpdating, setIsUpdating] = useState(false);

  if (!user) return null;

  const isAvailable = user.isAvailable ?? false;

  const toggleAvailability = async () => {
    setIsUpdating(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        isAvailable: !isAvailable,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating availability:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="flex items-center space-x-3">
      <span className="text-sm text-gray-600">
        {isAvailable ? 'Available for jobs' : 'Not available'}
      </span>
      <button
        onClick={toggleAvailability}
        disabled={isUpdating}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
          isAvailable ? 'bg-green-500' : 'bg-gray-300'
        } ${isUpdating ? 'opacity-50' : ''}`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            isAvailable ? 'translate-x-6' : 'translate-x-1'
          }`}
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
import { formatDistanceToNow } from '../../utils/dateUtils';

interface ClaimedJobsProps {
  requests: Request[];
  onStartSession: (request: Request) => void;
}

export function ClaimedJobs({ requests, onStartSession }: ClaimedJobsProps) {
  if (requests.length === 0) {
    return null;
  }

  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Your Claimed Jobs ({requests.length})
      </h2>
      <div className="space-y-4">
        {requests.map(request => (
          <div key={request.id} className="card bg-blue-50 border-blue-200">
            <div className="flex items-start justify-between">
              <div>
                <span className="inline-block px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded mb-2">
                  Claimed {formatDistanceToNow(request.claimedAt)}
                </span>
                <h3 className="font-medium text-gray-900 capitalize">
                  {request.category}
                </h3>
                <p className="text-sm text-gray-600 line-clamp-2 mt-1">
                  {request.description}
                </p>
              </div>
              <button
                onClick={() => onStartSession(request)}
                className="btn-primary whitespace-nowrap ml-4"
              >
                Start Session
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Task 4.5: Create Helper Dashboard Page

Create `src/pages/helper/Dashboard.tsx`:

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
import { db } from '../../services/firebase';
import { useAuth } from '../../hooks/useAuth';
import { Header } from '../../components/common/Header';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { RequestCard } from '../../components/helper/RequestCard';
import { AvailabilityToggle } from '../../components/helper/AvailabilityToggle';
import { ClaimedJobs } from '../../components/helper/ClaimedJobs';
import { Request } from '../../types';

export function HelperDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [pendingRequests, setPendingRequests] = useState<Request[]>([]);
  const [claimedRequests, setClaimedRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Subscribe to pending requests (available jobs)
  useEffect(() => {
    const q = query(
      collection(db, 'requests'),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const requests = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as Request[];
        setPendingRequests(requests);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching pending requests:', err);
        setError('Failed to load requests');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Subscribe to claimed requests (my jobs)
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'requests'),
      where('helperId', '==', user.uid),
      where('status', '==', 'claimed'),
      orderBy('claimedAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const requests = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as Request[];
        setClaimedRequests(requests);
      },
      (err) => {
        console.error('Error fetching claimed requests:', err);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const handleClaimRequest = async (requestId: string) => {
    if (!user) return;

    setClaimingId(requestId);
    setError(null);

    try {
      // Update request status
      await updateDoc(doc(db, 'requests', requestId), {
        status: 'claimed',
        helperId: user.uid,
        claimedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Play notification sound (optional)
      // new Audio('/sounds/claim.mp3').play();
    } catch (err: any) {
      console.error('Error claiming request:', err);
      setError('Failed to claim request. It may have been claimed by another Helper.');
    } finally {
      setClaimingId(null);
    }
  };

  const handleStartSession = async (request: Request) => {
    if (!user) return;

    try {
      // Create a new session
      const sessionData = {
        requestId: request.id,
        customerId: request.customerId,
        helperId: user.uid,
        status: 'created',
        safetyChecklistCompleted: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const sessionRef = await addDoc(collection(db, 'sessions'), sessionData);

      // Update the request with sessionId
      await updateDoc(doc(db, 'requests', request.id), {
        sessionId: sessionRef.id,
        updatedAt: serverTimestamp(),
      });

      // Navigate to the session page
      navigate(`/helper/session/${sessionRef.id}`);
    } catch (err) {
      console.error('Error starting session:', err);
      setError('Failed to start session');
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
              {pendingRequests.length} job{pendingRequests.length === 1 ? '' : 's'} available
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
          requests={claimedRequests}
          onStartSession={handleStartSession}
        />

        {/* Available Jobs Section */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Available Jobs
          </h2>

          {pendingRequests.length === 0 ? (
            <div className="card text-center py-12">
              <div className="text-4xl mb-4">📭</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No jobs available right now
              </h3>
              <p className="text-gray-600">
                New requests will appear here automatically.
                {!user?.isAvailable && (
                  <span className="block mt-2 text-yellow-600">
                    Toggle your availability to receive notifications.
                  </span>
                )}
              </p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {pendingRequests.map(request => (
                <RequestCard
                  key={request.id}
                  request={request}
                  onClaim={handleClaimRequest}
                  isClaiming={claimingId === request.id}
                />
              ))}
            </div>
          )}
        </div>

        {/* Stats Section (placeholder for future) */}
        <div className="mt-12 pt-8 border-t border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Stats</h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="card text-center">
              <p className="text-3xl font-bold text-primary-600">
                {user?.completedSessions || 0}
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

### Task 4.6: Update App Routes

Update `src/App.tsx` imports and routes:

```typescript
// Add import
import { HelperDashboard } from './pages/helper/Dashboard';

// Update the helper dashboard route (replace the placeholder):
<Route
  path="dashboard"
  element={
    <ProtectedRoute allowedRole="helper">
      <HelperDashboard />
    </ProtectedRoute>
  }
/>
```

### Task 4.7: Update useAuth Hook for Real-time User Updates

Update `src/hooks/useAuth.tsx` to listen for user profile changes.

**Important:** The original pattern had a bug where the inner Firestore listener couldn't be properly cleaned up. This corrected version manages both listeners properly.

Replace the entire `AuthProvider` component with this corrected version:

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
  signOut as firebaseSignOut,
  updateProfile,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { User, UserRole } from '../types';

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  user: User | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    displayName: string,
    phone: string,
    role: UserRole
  ) => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Ref to store the Firestore user listener for cleanup
  const userListenerRef = useRef<Unsubscribe | null>(null);

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      setFirebaseUser(firebaseUser);

      // Clean up any existing user listener
      if (userListenerRef.current) {
        userListenerRef.current();
        userListenerRef.current = null;
      }

      if (firebaseUser) {
        // Set up real-time listener for user profile
        const userDocRef = doc(db, 'users', firebaseUser.uid);

        userListenerRef.current = onSnapshot(
          userDocRef,
          (docSnapshot) => {
            if (docSnapshot.exists()) {
              setUser({ uid: firebaseUser.uid, ...docSnapshot.data() } as User);
            } else {
              setUser(null);
            }
            setLoading(false);
          },
          (error) => {
            console.error('Error listening to user profile:', error);
            setUser(null);
            setLoading(false);
          }
        );
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    // Cleanup function
    return () => {
      unsubscribeAuth();
      if (userListenerRef.current) {
        userListenerRef.current();
        userListenerRef.current = null;
      }
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      setError(null);
      setLoading(true);
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      setError(getErrorMessage(err.code));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (
    email: string,
    password: string,
    displayName: string,
    phone: string,
    role: UserRole
  ) => {
    try {
      setError(null);
      setLoading(true);

      // Create Firebase auth user
      const credential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      // Update display name in Firebase Auth
      await updateProfile(credential.user, { displayName });

      // Create user profile in Firestore
      const userProfile: Omit<User, 'uid'> = {
        email,
        phone,
        displayName,
        role,
        createdAt: serverTimestamp() as any,
        updatedAt: serverTimestamp() as any,
        ...(role === 'helper' && {
          isAvailable: false,
          specialties: [],
          completedSessions: 0,
        }),
      };

      await setDoc(doc(db, 'users', credential.user.uid), userProfile);
    } catch (err: any) {
      setError(getErrorMessage(err.code));
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (err: any) {
      setError(getErrorMessage(err.code));
      throw err;
    }
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        user,
        loading,
        error,
        signIn,
        signUp,
        signOut,
        clearError,
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

// Helper function to convert Firebase error codes to user-friendly messages
function getErrorMessage(errorCode: string): string {
  switch (errorCode) {
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

**Key fix:** The corrected version uses a `useRef` to store the Firestore listener unsubscribe function, allowing proper cleanup when:
- The auth state changes (user signs out)
- The component unmounts

This prevents memory leaks and stale listener issues.

### Task 4.8: Create Firestore Indexes

Some queries require composite indexes. Create `firestore.indexes.json`:

```json
{
  "indexes": [
    {
      "collectionGroup": "requests",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "requests",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "helperId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "claimedAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "sessions",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "helperId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

Deploy indexes:
```bash
firebase deploy --only firestore:indexes
```

---

## Verification Tests

### Test 1: Dashboard Loads

1. Sign in as a Helper
2. Navigate to `/helper/dashboard`

**Expected:** Dashboard loads with "Available Jobs" section and stats

### Test 2: Availability Toggle

1. Click the availability toggle

**Expected:** Toggle switches between green (available) and gray (not available)

### Test 3: View Pending Requests

1. Create a test request as a Customer
2. Sign in as a Helper

**Expected:** Request appears in "Available Jobs" section with category, description, photos, and price

### Test 4: Photo Preview

1. Click on a photo in a request card

**Expected:** Full-size image modal opens

### Test 5: Claim Request

1. Click "Claim This Job" on a request

**Expected:**
- Button shows "Claiming..."
- Request moves from "Available Jobs" to "Your Claimed Jobs"
- Request disappears from Available Jobs for other Helpers

### Test 6: Real-time Updates

1. Open two browser windows - one as Helper, one as Customer
2. Submit a new request as Customer

**Expected:** Request appears in Helper dashboard without refresh

### Test 7: Start Session

1. Claim a request
2. Click "Start Session" on the claimed job

**Expected:**
- Session is created in Firestore
- Redirected to `/helper/session/{sessionId}`

### Test 8: Multiple Helper Claim Prevention

1. Open the same request in two Helper accounts
2. Both click "Claim" simultaneously

**Expected:** Only one succeeds; the other sees an error

### Test 9: Empty State

1. Complete or claim all pending requests
2. View dashboard

**Expected:** "No jobs available right now" message displays

---

## Deliverables Checklist

- [ ] RequestCard component displays all request info
- [ ] Photo modal for full-size viewing
- [ ] AvailabilityToggle component working
- [ ] ClaimedJobs component showing Helper's claimed jobs
- [ ] Dashboard page with real-time request list
- [ ] Claim functionality working
- [ ] Start Session creates session and redirects
- [ ] Real-time updates working
- [ ] Firestore indexes deployed
- [ ] Error handling for failed claims
- [ ] Empty state displayed when no jobs

---

## Next Phase

Once all tests pass, proceed to **Phase 5: Zoho Lens Integration** to implement the video session with AR annotation capabilities.
