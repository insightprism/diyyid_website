# Phase 2: Authentication

## Purpose

Implement user authentication for both Customers and Helpers using Firebase Auth. Create login/signup flows with email/password, store user profiles in Firestore, and establish role-based access control.

---

## Why We Need This Phase

1. **User Identity** - Know who is making requests and who is providing help
2. **Role Separation** - Customers and Helpers have different interfaces and permissions
3. **Data Security** - Protect user data with proper authentication
4. **Session Tracking** - Link requests and sessions to specific users
5. **Payment Association** - Payments must be tied to authenticated users

---

## Benefits

- Secure access to application features
- Persistent user sessions across browser refreshes
- Role-based routing (customers vs helpers)
- User profile data for personalization
- Foundation for notifications and history

---

## Prerequisites

- Phase 1 completed
- Firebase project with Authentication enabled
- Email/Password sign-in method enabled in Firebase Console

---

## Implementation Tasks

### Task 2.1: Update Auth Hook with Full Functionality

Update `src/hooks/use_auth.tsx`:

```typescript
import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../services/firebase_client';
import { User, UserRole } from '../types';

interface AuthContextType {
  firebase_user: FirebaseUser | null;
  user: User | null;
  is_loading: boolean;
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

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebase_user, set_firebase_user] = useState<FirebaseUser | null>(null);
  const [user, set_user] = useState<User | null>(null);
  const [is_loading, set_is_loading] = useState(true);
  const [error, set_error] = useState<string | null>(null);

  // Listen for auth state changes and user profile updates
  useEffect(() => {
    let unsubscribe_profile: (() => void) | null = null;

    const unsubscribe_auth = onAuthStateChanged(auth, async (fb_user) => {
      set_firebase_user(fb_user);

      // Clean up previous profile listener
      if (unsubscribe_profile) {
        unsubscribe_profile();
        unsubscribe_profile = null;
      }

      if (fb_user) {
        // Set up real-time listener for user profile
        unsubscribe_profile = onSnapshot(
          doc(db, 'users', fb_user.uid),
          (doc_snapshot) => {
            if (doc_snapshot.exists()) {
              set_user({
                uid: fb_user.uid,
                ...doc_snapshot.data(),
              } as User);
            } else {
              set_user(null);
            }
            set_is_loading(false);
          },
          (err) => {
            console.error('Error listening to user profile:', err);
            set_is_loading(false);
          }
        );
      } else {
        set_user(null);
        set_is_loading(false);
      }
    });

    return () => {
      unsubscribe_auth();
      if (unsubscribe_profile) {
        unsubscribe_profile();
      }
    };
  }, []);

  const sign_in = async (email: string, password: string) => {
    set_error(null);
    set_is_loading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      const message = get_auth_error_message(err.code);
      set_error(message);
      set_is_loading(false);
      throw new Error(message);
    }
  };

  const sign_up = async (
    email: string,
    password: string,
    display_name: string,
    phone: string,
    role: UserRole
  ) => {
    set_error(null);
    set_is_loading(true);

    try {
      const credential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      // Create user profile in Firestore
      await setDoc(doc(db, 'users', credential.user.uid), {
        email,
        display_name,
        phone,
        role,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
        ...(role === 'helper' && {
          is_available: false,
          specialties: [],
          completed_sessions: 0,
        }),
      });
    } catch (err: any) {
      const message = get_auth_error_message(err.code);
      set_error(message);
      set_is_loading(false);
      throw new Error(message);
    }
  };

  const sign_out = async () => {
    await firebaseSignOut(auth);
  };

  const clear_error = () => set_error(null);

  return (
    <AuthContext.Provider
      value={{
        firebase_user,
        user,
        is_loading,
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
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

// Helper to convert Firebase error codes to user-friendly messages
function get_auth_error_message(code: string): string {
  const messages: Record<string, string> = {
    'auth/email-already-in-use': 'An account with this email already exists',
    'auth/invalid-email': 'Invalid email address',
    'auth/operation-not-allowed': 'Email/password sign-in is not enabled',
    'auth/weak-password': 'Password must be at least 6 characters',
    'auth/user-disabled': 'This account has been disabled',
    'auth/user-not-found': 'No account found with this email',
    'auth/wrong-password': 'Incorrect password',
    'auth/invalid-credential': 'Invalid email or password',
    'auth/too-many-requests': 'Too many attempts. Please try again later',
  };

  return messages[code] || 'An error occurred. Please try again.';
}
```

### Task 2.2: Create Validation Utilities

Create `src/utils/validation_utils.ts`:

```typescript
import { app_config } from '../config/app_config';

export interface ValidationResult {
  is_valid: boolean;
  error?: string;
}

export function validate_email(email: string): ValidationResult {
  const email_regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!email.trim()) {
    return { is_valid: false, error: 'Email is required' };
  }

  if (!email_regex.test(email)) {
    return { is_valid: false, error: 'Please enter a valid email address' };
  }

  return { is_valid: true };
}

export function validate_password(password: string): ValidationResult {
  if (!password) {
    return { is_valid: false, error: 'Password is required' };
  }

  if (password.length < 6) {
    return { is_valid: false, error: 'Password must be at least 6 characters' };
  }

  return { is_valid: true };
}

export function validate_phone(phone: string): ValidationResult {
  if (!phone.trim()) {
    return { is_valid: false, error: 'Phone number is required' };
  }

  // Remove spaces, dashes, parentheses for validation
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');

  if (!app_config.validation.phone_regex.test(cleaned)) {
    return { is_valid: false, error: 'Please enter a valid phone number' };
  }

  return { is_valid: true };
}

export function validate_display_name(name: string): ValidationResult {
  if (!name.trim()) {
    return { is_valid: false, error: 'Name is required' };
  }

  if (name.trim().length < 2) {
    return { is_valid: false, error: 'Name must be at least 2 characters' };
  }

  return { is_valid: true };
}

// Format phone to E.164 format
export function format_phone_e164(phone: string): string {
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');

  // If doesn't start with +, assume US and add +1
  if (!cleaned.startsWith('+')) {
    return '+1' + cleaned;
  }

  return cleaned;
}
```

### Task 2.3: Create Auth Form Component

Create `src/components/common/AuthForm.tsx`:

```typescript
import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { LoadingSpinner } from './LoadingSpinner';
import {
  validate_email,
  validate_password,
  validate_phone,
  validate_display_name,
} from '../../utils/validation_utils';
import { UserRole } from '../../types';

interface AuthFormProps {
  mode: 'login' | 'signup';
  role: UserRole;
  on_submit: (data: AuthFormData) => Promise<void>;
  is_loading: boolean;
  error: string | null;
}

export interface AuthFormData {
  email: string;
  password: string;
  display_name?: string;
  phone?: string;
}

export function AuthForm({
  mode,
  role,
  on_submit,
  is_loading,
  error,
}: AuthFormProps) {
  const [email, set_email] = useState('');
  const [password, set_password] = useState('');
  const [display_name, set_display_name] = useState('');
  const [phone, set_phone] = useState('');
  const [validation_errors, set_validation_errors] = useState<
    Record<string, string>
  >({});

  const is_signup = mode === 'signup';
  const other_role_link =
    role === 'customer' ? '/helper/login' : '/customer/login';
  const other_role_label = role === 'customer' ? 'Helper' : 'Customer';

  const validate_form = (): boolean => {
    const errors: Record<string, string> = {};

    const email_result = validate_email(email);
    if (!email_result.is_valid) {
      errors.email = email_result.error!;
    }

    const password_result = validate_password(password);
    if (!password_result.is_valid) {
      errors.password = password_result.error!;
    }

    if (is_signup) {
      const name_result = validate_display_name(display_name);
      if (!name_result.is_valid) {
        errors.display_name = name_result.error!;
      }

      const phone_result = validate_phone(phone);
      if (!phone_result.is_valid) {
        errors.phone = phone_result.error!;
      }
    }

    set_validation_errors(errors);
    return Object.keys(errors).length === 0;
  };

  const handle_submit = async (e: FormEvent) => {
    e.preventDefault();

    if (!validate_form()) return;

    await on_submit({
      email,
      password,
      ...(is_signup && { display_name, phone }),
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center space-x-2">
            <span className="text-3xl">🏠</span>
            <span className="text-2xl font-bold text-gray-900">
              HomePro Assist
            </span>
          </Link>
          <h1 className="mt-4 text-xl text-gray-600">
            {is_signup ? 'Create Account' : 'Sign In'} as {role === 'customer' ? 'Customer' : 'Helper'}
          </h1>
        </div>

        <div className="card">
          <form onSubmit={handle_submit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            {is_signup && (
              <div>
                <label htmlFor="display_name" className="label">
                  Full Name
                </label>
                <input
                  id="display_name"
                  type="text"
                  value={display_name}
                  onChange={(e) => set_display_name(e.target.value)}
                  className="input-field"
                  placeholder="John Smith"
                  disabled={is_loading}
                />
                {validation_errors.display_name && (
                  <p className="error-text">{validation_errors.display_name}</p>
                )}
              </div>
            )}

            <div>
              <label htmlFor="email" className="label">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => set_email(e.target.value)}
                className="input-field"
                placeholder="you@example.com"
                disabled={is_loading}
              />
              {validation_errors.email && (
                <p className="error-text">{validation_errors.email}</p>
              )}
            </div>

            {is_signup && (
              <div>
                <label htmlFor="phone" className="label">
                  Phone Number
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => set_phone(e.target.value)}
                  className="input-field"
                  placeholder="+1 (555) 123-4567"
                  disabled={is_loading}
                />
                {validation_errors.phone && (
                  <p className="error-text">{validation_errors.phone}</p>
                )}
              </div>
            )}

            <div>
              <label htmlFor="password" className="label">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => set_password(e.target.value)}
                className="input-field"
                placeholder={is_signup ? 'At least 6 characters' : 'Your password'}
                disabled={is_loading}
              />
              {validation_errors.password && (
                <p className="error-text">{validation_errors.password}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={is_loading}
              className="btn-primary w-full flex items-center justify-center"
            >
              {is_loading ? (
                <LoadingSpinner size="sm" />
              ) : is_signup ? (
                'Create Account'
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-200 text-center text-sm">
            {is_signup ? (
              <p className="text-gray-600">
                Already have an account?{' '}
                <Link
                  to={`/${role}/login`}
                  className="text-primary-600 hover:underline"
                >
                  Sign in
                </Link>
              </p>
            ) : (
              <p className="text-gray-600">
                Don't have an account?{' '}
                <Link
                  to={`/${role}/signup`}
                  className="text-primary-600 hover:underline"
                >
                  Create one
                </Link>
              </p>
            )}
          </div>
        </div>

        <p className="mt-4 text-center text-sm text-gray-500">
          Are you a {other_role_label}?{' '}
          <Link to={other_role_link} className="text-primary-600 hover:underline">
            Sign in here
          </Link>
        </p>
      </div>
    </div>
  );
}
```

### Task 2.4: Create Customer Login Page

Create `src/pages/customer/CustomerLogin.tsx`:

```typescript
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/use_auth';
import { AuthForm, AuthFormData } from '../../components/common/AuthForm';
import { format_phone_e164 } from '../../utils/validation_utils';
import { useEffect } from 'react';

export function CustomerLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, is_loading, error, sign_in, clear_error } = useAuth();

  const is_signup = location.pathname.includes('signup');

  // Redirect if already logged in
  useEffect(() => {
    if (user && !is_loading) {
      navigate('/customer/request');
    }
  }, [user, is_loading, navigate]);

  // Clear errors on mount
  useEffect(() => {
    clear_error();
  }, []);

  const handle_submit = async (data: AuthFormData) => {
    await sign_in(data.email, data.password);
    navigate('/customer/request');
  };

  return (
    <AuthForm
      mode={is_signup ? 'signup' : 'login'}
      role="customer"
      on_submit={handle_submit}
      is_loading={is_loading}
      error={error}
    />
  );
}
```

Create `src/pages/customer/CustomerSignup.tsx`:

```typescript
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/use_auth';
import { AuthForm, AuthFormData } from '../../components/common/AuthForm';
import { format_phone_e164 } from '../../utils/validation_utils';
import { useEffect } from 'react';

export function CustomerSignup() {
  const navigate = useNavigate();
  const { user, is_loading, error, sign_up, clear_error } = useAuth();

  // Redirect if already logged in
  useEffect(() => {
    if (user && !is_loading) {
      navigate('/customer/request');
    }
  }, [user, is_loading, navigate]);

  // Clear errors on mount
  useEffect(() => {
    clear_error();
  }, []);

  const handle_submit = async (data: AuthFormData) => {
    const phone = format_phone_e164(data.phone!);
    await sign_up(data.email, data.password, data.display_name!, phone, 'customer');
    navigate('/customer/request');
  };

  return (
    <AuthForm
      mode="signup"
      role="customer"
      on_submit={handle_submit}
      is_loading={is_loading}
      error={error}
    />
  );
}
```

### Task 2.5: Create Helper Login Page

Create `src/pages/helper/HelperLogin.tsx`:

```typescript
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/use_auth';
import { AuthForm, AuthFormData } from '../../components/common/AuthForm';
import { useEffect } from 'react';

export function HelperLogin() {
  const navigate = useNavigate();
  const { user, is_loading, error, sign_in, clear_error } = useAuth();

  // Redirect if already logged in
  useEffect(() => {
    if (user && !is_loading) {
      navigate('/helper/dashboard');
    }
  }, [user, is_loading, navigate]);

  // Clear errors on mount
  useEffect(() => {
    clear_error();
  }, []);

  const handle_submit = async (data: AuthFormData) => {
    await sign_in(data.email, data.password);
    navigate('/helper/dashboard');
  };

  return (
    <AuthForm
      mode="login"
      role="helper"
      on_submit={handle_submit}
      is_loading={is_loading}
      error={error}
    />
  );
}
```

Create `src/pages/helper/HelperSignup.tsx`:

```typescript
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/use_auth';
import { AuthForm, AuthFormData } from '../../components/common/AuthForm';
import { format_phone_e164 } from '../../utils/validation_utils';
import { useEffect } from 'react';

export function HelperSignup() {
  const navigate = useNavigate();
  const { user, is_loading, error, sign_up, clear_error } = useAuth();

  // Redirect if already logged in
  useEffect(() => {
    if (user && !is_loading) {
      navigate('/helper/dashboard');
    }
  }, [user, is_loading, navigate]);

  // Clear errors on mount
  useEffect(() => {
    clear_error();
  }, []);

  const handle_submit = async (data: AuthFormData) => {
    const phone = format_phone_e164(data.phone!);
    await sign_up(data.email, data.password, data.display_name!, phone, 'helper');
    navigate('/helper/dashboard');
  };

  return (
    <AuthForm
      mode="signup"
      role="helper"
      on_submit={handle_submit}
      is_loading={is_loading}
      error={error}
    />
  );
}
```

### Task 2.6: Update App Routes

Update `src/App.tsx` to use the new auth pages:

```typescript
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/use_auth';
import { Home } from './pages/shared/Home';
import { NotFound } from './pages/shared/NotFound';
import { CustomerLogin } from './pages/customer/CustomerLogin';
import { CustomerSignup } from './pages/customer/CustomerSignup';
import { HelperLogin } from './pages/helper/HelperLogin';
import { HelperSignup } from './pages/helper/HelperSignup';
import { LoadingSpinner } from './components/common/LoadingSpinner';
import { ReactNode } from 'react';

function ProtectedRoute({
  children,
  allowed_role,
}: {
  children: ReactNode;
  allowed_role?: 'customer' | 'helper';
}) {
  const { user, is_loading } = useAuth();

  if (is_loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (allowed_role && user.role !== allowed_role) {
    const redirect =
      user.role === 'helper' ? '/helper/dashboard' : '/customer/request';
    return <Navigate to={redirect} replace />;
  }

  return <>{children}</>;
}

// Placeholder components for future phases
function CustomerRequest() {
  return <div className="p-8">Customer Request Form - Phase 3</div>;
}
function CustomerSession() {
  return <div className="p-8">Customer Session - Phase 5</div>;
}
function HelperDashboard() {
  return <div className="p-8">Helper Dashboard - Phase 4</div>;
}
function HelperSession() {
  return <div className="p-8">Helper Session - Phase 5</div>;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<Home />} />

      {/* Customer */}
      <Route path="/customer">
        <Route path="login" element={<CustomerLogin />} />
        <Route path="signup" element={<CustomerSignup />} />
        <Route
          path="request"
          element={
            <ProtectedRoute allowed_role="customer">
              <CustomerRequest />
            </ProtectedRoute>
          }
        />
        <Route
          path="session/:session_id"
          element={
            <ProtectedRoute allowed_role="customer">
              <CustomerSession />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* Helper */}
      <Route path="/helper">
        <Route path="login" element={<HelperLogin />} />
        <Route path="signup" element={<HelperSignup />} />
        <Route
          path="dashboard"
          element={
            <ProtectedRoute allowed_role="helper">
              <HelperDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="session/:session_id"
          element={
            <ProtectedRoute allowed_role="helper">
              <HelperSession />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
```

---

## Verification Tests

### Test 1: Customer Signup

1. Navigate to `/customer/signup`
2. Fill out form with valid data
3. Click "Create Account"

**Expected:**
- User created in Firebase Auth
- User profile created in Firestore with `role: 'customer'`
- Redirected to `/customer/request`

### Test 2: Customer Login

1. Navigate to `/customer/login`
2. Enter credentials from Test 1
3. Click "Sign In"

**Expected:**
- Successful login
- Redirected to `/customer/request`
- Header shows user name and "customer" badge

### Test 3: Helper Signup

1. Navigate to `/helper/signup`
2. Fill out form with valid data
3. Click "Create Account"

**Expected:**
- User created in Firebase Auth
- User profile created in Firestore with `role: 'helper'`
- Profile includes `is_available: false`, `completed_sessions: 0`
- Redirected to `/helper/dashboard`

### Test 4: Helper Login

1. Navigate to `/helper/login`
2. Enter credentials from Test 3
3. Click "Sign In"

**Expected:**
- Successful login
- Redirected to `/helper/dashboard`
- Header shows user name and "helper" badge

### Test 5: Role-Based Routing

1. Login as Customer
2. Navigate to `/helper/dashboard`

**Expected:** Redirected to `/customer/request`

### Test 6: Sign Out

1. Click "Sign Out" in header

**Expected:**
- Logged out
- Redirected to home page

### Test 7: Validation Errors

1. Submit signup form with empty fields

**Expected:** Validation errors shown under each field

### Test 8: Auth Error Messages

1. Try to login with wrong password

**Expected:** "Incorrect password" error displayed

### Test 9: Protected Routes

1. Log out
2. Navigate to `/customer/request`

**Expected:** Redirected to home page

### Test 10: Firestore Data

1. Check Firebase Console > Firestore

**Expected:** `users` collection contains user documents with correct structure

---

## Deliverables Checklist

- [ ] `use_auth` hook with sign_in, sign_up, sign_out
- [ ] Validation utilities for email, password, phone, name
- [ ] AuthForm reusable component
- [ ] CustomerLogin and CustomerSignup pages
- [ ] HelperLogin and HelperSignup pages
- [ ] Routes updated with signup paths
- [ ] Real-time user profile listener
- [ ] User-friendly error messages
- [ ] Role-based redirect after login
- [ ] Protected route enforcement
- [ ] User documents in Firestore

---

## Next Phase

Once all tests pass, proceed to **Phase 3: Customer Request Flow** to implement the request submission with photo upload.
