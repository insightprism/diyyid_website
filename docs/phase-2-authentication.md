# Phase 2: Authentication System

## Purpose

Implement user authentication for both Customers and Helpers using Firebase Authentication. This phase creates the login, signup, and user profile management functionality that secures the application and differentiates user roles.

---

## Why We Need This Phase

1. **Security** - Only authenticated users can access protected features
2. **Role Differentiation** - Customers and Helpers have different interfaces and permissions
3. **User Data** - Need to store phone numbers for SMS notifications
4. **Session Tracking** - Authentication links requests and sessions to specific users
5. **Trust** - Helpers need verified accounts before receiving job alerts

---

## Benefits

- Secure access to all application features
- Role-based routing (customers to customer pages, helpers to helper pages)
- User profile data stored in Firestore for use in sessions
- Phone number collection for SMS session links
- Foundation for Firestore security rules

---

## Prerequisites

- Phase 1 completed (project setup, Firebase configured)
- Firebase Authentication enabled in Firebase Console:
  - Enable Email/Password sign-in method
  - Enable Phone sign-in method (for future SMS verification)

---

## Implementation Tasks

### Task 2.1: Create Auth Context and Hook

Create `src/hooks/useAuth.tsx`:

```typescript
import {
  createContext,
  useContext,
  useEffect,
  useState,
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

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setFirebaseUser(firebaseUser);

      if (firebaseUser) {
        // Fetch user profile from Firestore
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            setUser({ uid: firebaseUser.uid, ...userDoc.data() } as User);
          } else {
            setUser(null);
          }
        } catch (err) {
          console.error('Error fetching user profile:', err);
          setUser(null);
        }
      } else {
        setUser(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
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

### Task 2.2: Create Protected Route Component

Create `src/components/common/ProtectedRoute.tsx`:

```typescript
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { UserRole } from '../../types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRole: UserRole;
}

export function ProtectedRoute({ children, allowedRole }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!user) {
    // Redirect to appropriate login page
    const loginPath = allowedRole === 'customer' ? '/customer/login' : '/helper/login';
    return <Navigate to={loginPath} state={{ from: location }} replace />;
  }

  if (user.role !== allowedRole) {
    // Redirect to their correct dashboard
    const dashboardPath = user.role === 'customer' ? '/customer/request' : '/helper/dashboard';
    return <Navigate to={dashboardPath} replace />;
  }

  return <>{children}</>;
}
```

### Task 2.3: Create Loading Spinner Component

Create `src/components/common/LoadingSpinner.tsx`:

```typescript
interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LoadingSpinner({ size = 'md', className = '' }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  };

  return (
    <div
      className={`animate-spin rounded-full border-t-2 border-b-2 border-primary-600 ${sizeClasses[size]} ${className}`}
    />
  );
}
```

### Task 2.4: Create Customer Login Page

Create `src/pages/customer/Login.tsx`:

```typescript
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';

export function CustomerLogin() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { signIn, signUp, error, clearError } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setIsSubmitting(true);

    try {
      if (isSignUp) {
        await signUp(email, password, displayName, phone, 'customer');
      } else {
        await signIn(email, password);
      }
      navigate('/customer/request');
    } catch (err) {
      // Error is handled by the auth context
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    clearError();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 p-4">
      <div className="card max-w-md w-full">
        <div className="text-center mb-8">
          <Link to="/" className="text-2xl font-bold text-primary-600">
            HomePro Assist
          </Link>
          <h1 className="text-xl font-semibold text-gray-900 mt-4">
            {isSignUp ? 'Create Account' : 'Welcome Back'}
          </h1>
          <p className="text-gray-600 mt-2">
            {isSignUp
              ? 'Sign up to get help with your home repairs'
              : 'Sign in to continue'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <>
              <div>
                <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="input-field"
                  placeholder="John Doe"
                  required
                />
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="input-field"
                  placeholder="+1 (555) 123-4567"
                  required
                />
                <p className="mt-1 text-xs text-gray-500">
                  We'll send you a link to join video sessions
                </p>
              </div>
            </>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              placeholder="At least 6 characters"
              minLength={6}
              required
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary w-full flex items-center justify-center"
          >
            {isSubmitting ? (
              <LoadingSpinner size="sm" />
            ) : isSignUp ? (
              'Create Account'
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={toggleMode}
            className="text-sm text-primary-600 hover:text-primary-700"
          >
            {isSignUp
              ? 'Already have an account? Sign in'
              : "Don't have an account? Sign up"}
          </button>
        </div>

        <div className="mt-4 text-center">
          <Link to="/helper/login" className="text-sm text-gray-500 hover:text-gray-700">
            Are you a Helper? Sign in here
          </Link>
        </div>
      </div>
    </div>
  );
}
```

### Task 2.5: Create Helper Login Page

Create `src/pages/helper/Login.tsx`:

```typescript
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';

export function HelperLogin() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { signIn, signUp, error, clearError } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setIsSubmitting(true);

    try {
      if (isSignUp) {
        await signUp(email, password, displayName, phone, 'helper');
      } else {
        await signIn(email, password);
      }
      navigate('/helper/dashboard');
    } catch (err) {
      // Error is handled by the auth context
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    clearError();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900 p-4">
      <div className="card max-w-md w-full">
        <div className="text-center mb-8">
          <Link to="/" className="text-2xl font-bold text-primary-600">
            HomePro Assist
          </Link>
          <div className="inline-block ml-2 px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded">
            HELPER
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mt-4">
            {isSignUp ? 'Join as a Helper' : 'Helper Sign In'}
          </h1>
          <p className="text-gray-600 mt-2">
            {isSignUp
              ? 'Register to help homeowners with repairs'
              : 'Sign in to your helper console'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <>
              <div>
                <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="input-field"
                  placeholder="John Doe"
                  required
                />
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="input-field"
                  placeholder="+1 (555) 123-4567"
                  required
                />
              </div>
            </>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              placeholder="At least 6 characters"
              minLength={6}
              required
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary w-full flex items-center justify-center"
          >
            {isSubmitting ? (
              <LoadingSpinner size="sm" />
            ) : isSignUp ? (
              'Create Helper Account'
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={toggleMode}
            className="text-sm text-primary-600 hover:text-primary-700"
          >
            {isSignUp
              ? 'Already registered? Sign in'
              : 'New helper? Register here'}
          </button>
        </div>

        <div className="mt-4 text-center">
          <Link to="/customer/login" className="text-sm text-gray-500 hover:text-gray-700">
            Need help with repairs? Customer sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
```

### Task 2.6: Create Common Header Component

Create `src/components/common/Header.tsx`:

```typescript
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export function Header() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  if (!user) return null;

  const dashboardLink = user.role === 'customer' ? '/customer/request' : '/helper/dashboard';

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to={dashboardLink} className="flex items-center">
            <span className="text-xl font-bold text-primary-600">HomePro Assist</span>
            {user.role === 'helper' && (
              <span className="ml-2 px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded">
                HELPER
              </span>
            )}
          </Link>

          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">
              {user.displayName}
            </span>
            <button
              onClick={handleSignOut}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
```

### Task 2.7: Update App.tsx with Auth Provider and Protected Routes

Update `src/App.tsx`:

```typescript
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { ProtectedRoute } from './components/common/ProtectedRoute';

// Pages
import { CustomerLogin } from './pages/customer/Login';
import { HelperLogin } from './pages/helper/Login';

// Placeholder pages - will be replaced in later phases
const CustomerRequestForm = () => (
  <div className="p-8">
    <h1 className="text-2xl font-bold">Request Form</h1>
    <p className="text-gray-600 mt-2">Coming in Phase 3</p>
  </div>
);
const CustomerSession = () => <div className="p-8">Customer Session (Phase 5)</div>;

const HelperDashboard = () => (
  <div className="p-8">
    <h1 className="text-2xl font-bold">Helper Dashboard</h1>
    <p className="text-gray-600 mt-2">Coming in Phase 4</p>
  </div>
);
const HelperSession = () => <div className="p-8">Helper Session (Phase 5)</div>;

const NotFound = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="text-center">
      <h1 className="text-4xl font-bold text-gray-900 mb-4">404</h1>
      <p className="text-gray-600">Page not found</p>
    </div>
  </div>
);

// Landing page
const Landing = () => (
  <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100">
    <div className="card max-w-md w-full mx-4">
      <h1 className="text-2xl font-bold text-center text-gray-900 mb-6">
        HomePro Assist
      </h1>
      <p className="text-gray-600 text-center mb-8">
        Get expert guidance for your home repairs
      </p>
      <div className="space-y-4">
        <a href="/customer/login" className="btn-primary block text-center">
          I need help (Customer)
        </a>
        <a href="/helper/login" className="btn-secondary block text-center">
          I'm a Helper (Professional)
        </a>
      </div>
    </div>
  </div>
);

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Landing */}
          <Route path="/" element={<Landing />} />

          {/* Customer Routes */}
          <Route path="/customer">
            <Route path="login" element={<CustomerLogin />} />
            <Route
              path="request"
              element={
                <ProtectedRoute allowedRole="customer">
                  <CustomerRequestForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="session/:sessionId"
              element={
                <ProtectedRoute allowedRole="customer">
                  <CustomerSession />
                </ProtectedRoute>
              }
            />
            <Route index element={<Navigate to="/customer/login" replace />} />
          </Route>

          {/* Helper Routes */}
          <Route path="/helper">
            <Route path="login" element={<HelperLogin />} />
            <Route
              path="dashboard"
              element={
                <ProtectedRoute allowedRole="helper">
                  <HelperDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="session/:sessionId"
              element={
                <ProtectedRoute allowedRole="helper">
                  <HelperSession />
                </ProtectedRoute>
              }
            />
            <Route index element={<Navigate to="/helper/login" replace />} />
          </Route>

          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
```

### Task 2.8: Create Firestore Security Rules

Create `firestore.rules`:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return request.auth.uid == userId;
    }

    function getUserRole() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role;
    }

    function isCustomer() {
      return isAuthenticated() && getUserRole() == 'customer';
    }

    function isHelper() {
      return isAuthenticated() && getUserRole() == 'helper';
    }

    // Users collection
    match /users/{userId} {
      // Users can read their own profile
      allow read: if isAuthenticated() && isOwner(userId);

      // Users can create their own profile during signup
      allow create: if isAuthenticated() && isOwner(userId);

      // Users can update their own profile (limited fields)
      allow update: if isAuthenticated() && isOwner(userId);

      // Helpers can read other users' basic info for session display
      allow read: if isHelper();
    }

    // Requests collection
    match /requests/{requestId} {
      // Customers can read their own requests
      allow read: if isAuthenticated() &&
        (resource.data.customerId == request.auth.uid || isHelper());

      // Customers can create requests
      allow create: if isCustomer() &&
        request.resource.data.customerId == request.auth.uid;

      // Helpers can update requests (to claim them)
      allow update: if isHelper() ||
        (isCustomer() && resource.data.customerId == request.auth.uid);
    }

    // Sessions collection
    match /sessions/{sessionId} {
      // Participants can read their sessions
      allow read: if isAuthenticated() &&
        (resource.data.customerId == request.auth.uid ||
         resource.data.helperId == request.auth.uid);

      // Helpers can create sessions
      allow create: if isHelper();

      // Participants can update sessions
      allow update: if isAuthenticated() &&
        (resource.data.customerId == request.auth.uid ||
         resource.data.helperId == request.auth.uid);
    }
  }
}
```

Deploy rules:
```bash
firebase deploy --only firestore:rules
```

---

## Verification Tests

### Test 1: Customer Sign Up

1. Navigate to `/customer/login`
2. Click "Don't have an account? Sign up"
3. Fill in: name, phone, email, password
4. Click "Create Account"

**Expected:** User is created and redirected to `/customer/request`

### Test 2: Customer Sign In

1. Sign out (if signed in)
2. Navigate to `/customer/login`
3. Enter email and password
4. Click "Sign In"

**Expected:** User is authenticated and redirected to `/customer/request`

### Test 3: Helper Sign Up

1. Navigate to `/helper/login`
2. Click "New helper? Register here"
3. Fill in: name, phone, email, password
4. Click "Create Helper Account"

**Expected:** User is created with role "helper" and redirected to `/helper/dashboard`

### Test 4: Role-Based Routing

1. Sign in as a Customer
2. Try to navigate to `/helper/dashboard`

**Expected:** Redirected to `/customer/request`

### Test 5: Protected Route Redirect

1. Sign out
2. Try to navigate to `/customer/request`

**Expected:** Redirected to `/customer/login`

### Test 6: Error Handling

1. Try to sign in with wrong password

**Expected:** Error message "Incorrect password. Please try again."

### Test 7: Firestore User Document

1. Sign up a new user
2. Check Firebase Console > Firestore

**Expected:** User document exists in `users` collection with correct fields

---

## Deliverables Checklist

- [ ] AuthContext and useAuth hook created
- [ ] ProtectedRoute component working
- [ ] Customer login/signup page functional
- [ ] Helper login/signup page functional
- [ ] Header component with sign out
- [ ] User profiles stored in Firestore
- [ ] Firestore security rules deployed
- [ ] Role-based routing working
- [ ] Error messages displayed correctly
- [ ] Loading states shown during auth operations

---

## Next Phase

Once all tests pass, proceed to **Phase 3: Customer Request Flow** to implement the request submission form with photo upload.
