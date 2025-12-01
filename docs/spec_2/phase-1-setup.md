# Phase 1: Project Setup

## Purpose

Initialize the development environment with React, TypeScript, Tailwind CSS, and Firebase. Establish the folder structure, routing, and basic configuration that all subsequent phases will build upon.

---

## Why We Need This Phase

1. **Foundation** - All features depend on a properly configured project structure
2. **Consistency** - Establish patterns and conventions from the start
3. **Developer Experience** - Set up tooling for efficient development
4. **Firebase Integration** - Configure authentication and database early
5. **Routing** - Define the URL structure for Customer and Helper flows

---

## Benefits

- Clean, organized codebase from day one
- Type safety with TypeScript catches errors early
- Tailwind CSS enables rapid UI development
- Firebase emulators allow offline development
- Hot module replacement for fast iteration

---

## Prerequisites

- Node.js 18+ installed
- Firebase CLI installed (`npm install -g firebase-tools`)
- Firebase project created at [console.firebase.google.com](https://console.firebase.google.com)
- Code editor (VS Code recommended)

---

## Implementation Tasks

### Task 1.1: Create React Project with Vite

```bash
cd /home/markly2/claude_code/diyyid_website

# Create Vite React TypeScript project
npm create vite@latest . -- --template react-ts

# Install dependencies
npm install

# Install additional dependencies
npm install react-router-dom firebase tailwindcss postcss autoprefixer
npm install -D @types/react-router-dom
```

### Task 1.2: Configure Tailwind CSS

```bash
npx tailwindcss init -p
```

Update `tailwind.config.js`:

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
      },
    },
  },
  plugins: [],
}
```

Update `src/index.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer components {
  .btn-primary {
    @apply px-4 py-2 bg-primary-600 text-white font-medium rounded-lg
           hover:bg-primary-700 focus:outline-none focus:ring-2
           focus:ring-primary-500 focus:ring-offset-2
           disabled:opacity-50 disabled:cursor-not-allowed
           transition-colors;
  }

  .btn-secondary {
    @apply px-4 py-2 border border-gray-300 text-gray-700 font-medium
           rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2
           focus:ring-primary-500 focus:ring-offset-2
           disabled:opacity-50 disabled:cursor-not-allowed
           transition-colors;
  }

  .input-field {
    @apply w-full px-3 py-2 border border-gray-300 rounded-lg
           focus:outline-none focus:ring-2 focus:ring-primary-500
           focus:border-primary-500 transition-colors;
  }

  .card {
    @apply bg-white rounded-xl shadow-sm border border-gray-200 p-6;
  }

  .error-text {
    @apply text-sm text-red-600 mt-1;
  }

  .label {
    @apply block text-sm font-medium text-gray-700 mb-1;
  }
}
```

### Task 1.3: Create Folder Structure

```bash
mkdir -p src/components/common
mkdir -p src/components/customer
mkdir -p src/components/helper
mkdir -p src/pages/customer
mkdir -p src/pages/helper
mkdir -p src/pages/shared
mkdir -p src/hooks
mkdir -p src/services
mkdir -p src/types
mkdir -p src/config
mkdir -p src/utils
```

### Task 1.4: Create Configuration File

Create `src/config/app_config.ts`:

```typescript
// Application configuration
// All configurable values should be defined here

export const app_config = {
  app_name: 'HomePro Assist',

  // Session settings
  session: {
    default_price_cents: 4999,  // $49.99
    max_duration_minutes: 60,
  },

  // Request categories
  categories: [
    { value: 'plumbing', label: 'Plumbing', icon: '🚿' },
    { value: 'electrical', label: 'Electrical', icon: '⚡' },
    { value: 'hvac', label: 'HVAC', icon: '❄️' },
    { value: 'appliance', label: 'Appliance', icon: '🔧' },
    { value: 'other', label: 'Other', icon: '🏠' },
  ] as const,

  // Photo upload limits
  photos: {
    max_count: 5,
    max_size_mb: 10,
    allowed_types: ['image/jpeg', 'image/png', 'image/webp'],
  },

  // Validation
  validation: {
    min_description_length: 20,
    phone_regex: /^\+?[1-9]\d{9,14}$/,
  },
};

export type CategoryValue = typeof app_config.categories[number]['value'];
```

### Task 1.5: Create Firebase Configuration

Create `src/services/firebase_client.ts`:

```typescript
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

const firebase_cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebase_cfg);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

// Connect to emulators in development
if (import.meta.env.DEV && import.meta.env.VITE_USE_EMULATORS === 'true') {
  connectAuthEmulator(auth, 'http://localhost:9099');
  connectFirestoreEmulator(db, 'localhost', 8080);
  connectStorageEmulator(storage, 'localhost', 9199);
  connectFunctionsEmulator(functions, 'localhost', 5001);
}
```

### Task 1.6: Create Type Definitions

Create `src/types/user_types.ts`:

```typescript
import { Timestamp } from 'firebase/firestore';

export type UserRole = 'customer' | 'helper';

export interface User {
  uid: string;
  email: string;
  phone: string;
  display_name: string;
  role: UserRole;
  created_at: Timestamp;
  updated_at: Timestamp;

  // Helper-specific
  is_available?: boolean;
  specialties?: string[];
  completed_sessions?: number;
}

export interface AuthState {
  user: User | null;
  is_loading: boolean;
  error: string | null;
}
```

Create `src/types/request_types.ts`:

```typescript
import { Timestamp } from 'firebase/firestore';
import { CategoryValue } from '../config/app_config';

export type RequestStatus = 'pending' | 'claimed' | 'in_session' | 'completed' | 'cancelled';
export type PaymentStatus = 'pending' | 'authorized' | 'captured' | 'refunded';

export interface Request {
  id: string;
  customer_id: string;
  customer_phone: string;

  description: string;
  category: CategoryValue;
  photo_urls: string[];

  status: RequestStatus;

  helper_id?: string;
  claimed_at?: Timestamp;
  session_id?: string;

  payment_intent_id?: string;
  payment_status: PaymentStatus;
  amount: number;

  created_at: Timestamp;
  updated_at: Timestamp;
}
```

Create `src/types/session_types.ts`:

```typescript
import { Timestamp } from 'firebase/firestore';

export type SessionStatus = 'created' | 'waiting' | 'active' | 'ended';
export type SessionOutcome = 'resolved' | 'unresolved' | 'escalated';

export interface Session {
  id: string;
  request_id: string;
  customer_id: string;
  helper_id: string;

  zoho_session_id?: string;
  technician_url?: string;
  customer_join_url?: string;

  status: SessionStatus;
  safety_checklist_completed: boolean;

  sms_sent_at?: Timestamp;
  started_at?: Timestamp;
  ended_at?: Timestamp;
  duration?: number;

  outcome?: SessionOutcome;
  notes?: string;

  created_at: Timestamp;
  updated_at: Timestamp;
}
```

Create `src/types/index.ts`:

```typescript
export * from './user_types';
export * from './request_types';
export * from './session_types';
```

### Task 1.7: Create Common Components

Create `src/components/common/LoadingSpinner.tsx`:

```typescript
interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES = {
  sm: 'h-4 w-4',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
};

export function LoadingSpinner({ size = 'md', className = '' }: LoadingSpinnerProps) {
  return (
    <div className={`flex justify-center items-center ${className}`}>
      <div
        className={`${SIZE_CLASSES[size]} animate-spin rounded-full border-2 border-gray-300 border-t-primary-600`}
      />
    </div>
  );
}
```

Create `src/components/common/Header.tsx`:

```typescript
import { Link, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../../services/firebase_client';
import { useAuth } from '../../hooks/use_auth';
import { app_config } from '../../config/app_config';

export function Header() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handle_sign_out = async () => {
    await signOut(auth);
    navigate('/');
  };

  const dashboard_link = user?.role === 'helper'
    ? '/helper/dashboard'
    : '/customer/request';

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

### Task 1.8: Create Basic Auth Hook Placeholder

Create `src/hooks/use_auth.tsx`:

```typescript
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase_client';
import { User } from '../types';

interface AuthContextType {
  firebase_user: FirebaseUser | null;
  user: User | null;
  is_loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  firebase_user: null,
  user: null,
  is_loading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebase_user, set_firebase_user] = useState<FirebaseUser | null>(null);
  const [user, set_user] = useState<User | null>(null);
  const [is_loading, set_is_loading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fb_user) => {
      set_firebase_user(fb_user);

      if (fb_user) {
        // Fetch user profile from Firestore
        const user_doc = await getDoc(doc(db, 'users', fb_user.uid));
        if (user_doc.exists()) {
          set_user({ uid: fb_user.uid, ...user_doc.data() } as User);
        } else {
          set_user(null);
        }
      } else {
        set_user(null);
      }

      set_is_loading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ firebase_user, user, is_loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
```

### Task 1.9: Create Route Structure

Create `src/pages/shared/NotFound.tsx`:

```typescript
import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-300">404</h1>
        <p className="text-xl text-gray-600 mt-4">Page not found</p>
        <Link to="/" className="btn-primary inline-block mt-6">
          Go Home
        </Link>
      </div>
    </div>
  );
}
```

Create `src/pages/shared/Home.tsx`:

```typescript
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/use_auth';
import { app_config } from '../../config/app_config';

export function Home() {
  const { user, is_loading } = useAuth();

  if (is_loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-primary-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  // Redirect logged-in users
  if (user) {
    const redirect = user.role === 'helper' ? '/helper/dashboard' : '/customer/request';
    window.location.href = redirect;
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50 to-white">
      <div className="max-w-4xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            {app_config.app_name}
          </h1>
          <p className="text-xl text-gray-600">
            Get expert help with your home repairs via live AR-guided video calls
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-2xl mx-auto">
          {/* Customer Card */}
          <div className="card text-center">
            <div className="text-4xl mb-4">🏠</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              I Need Help
            </h2>
            <p className="text-gray-600 mb-6">
              Get guided through your home repair by a professional
            </p>
            <Link to="/customer/login" className="btn-primary w-full block">
              Get Started
            </Link>
          </div>

          {/* Helper Card */}
          <div className="card text-center">
            <div className="text-4xl mb-4">🔧</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              I'm a Professional
            </h2>
            <p className="text-gray-600 mb-6">
              Help homeowners and earn money from anywhere
            </p>
            <Link to="/helper/login" className="btn-secondary w-full block">
              Helper Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### Task 1.10: Create App Router

Update `src/App.tsx`:

```typescript
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/use_auth';
import { Home } from './pages/shared/Home';
import { NotFound } from './pages/shared/NotFound';
import { LoadingSpinner } from './components/common/LoadingSpinner';
import { ReactNode } from 'react';

// Protected route wrapper
function ProtectedRoute({
  children,
  allowed_role
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
    const redirect = user.role === 'helper' ? '/helper/dashboard' : '/customer/request';
    return <Navigate to={redirect} replace />;
  }

  return <>{children}</>;
}

// Placeholder components (will be implemented in later phases)
function CustomerLogin() {
  return <div className="p-8">Customer Login - Phase 2</div>;
}
function CustomerRequest() {
  return <div className="p-8">Customer Request Form - Phase 3</div>;
}
function CustomerSession() {
  return <div className="p-8">Customer Session - Phase 5</div>;
}
function HelperLogin() {
  return <div className="p-8">Helper Login - Phase 2</div>;
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
      {/* Public routes */}
      <Route path="/" element={<Home />} />

      {/* Customer routes */}
      <Route path="/customer">
        <Route path="login" element={<CustomerLogin />} />
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

      {/* Helper routes */}
      <Route path="/helper">
        <Route path="login" element={<HelperLogin />} />
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

### Task 1.11: Create Environment File Template

Create `.env.example`:

```bash
# Firebase Configuration
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id

# Stripe
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_xxx

# Development
VITE_USE_EMULATORS=false
```

### Task 1.12: Initialize Firebase

Create `firebase.json`:

```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "functions": {
    "source": "functions",
    "predeploy": [
      "npm --prefix \"$RESOURCE_DIR\" run build"
    ]
  },
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  },
  "storage": {
    "rules": "storage.rules"
  },
  "emulators": {
    "auth": { "port": 9099 },
    "functions": { "port": 5001 },
    "firestore": { "port": 8080 },
    "hosting": { "port": 5000 },
    "storage": { "port": 9199 },
    "ui": { "enabled": true }
  }
}
```

Create `firestore.rules`:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == userId;
    }

    // Requests collection
    match /requests/{requestId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null
        && request.resource.data.customer_id == request.auth.uid;
      allow update: if request.auth != null;
    }

    // Sessions collection
    match /sessions/{sessionId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update: if request.auth != null;
    }
  }
}
```

Create `firestore.indexes.json`:

```json
{
  "indexes": [
    {
      "collectionGroup": "requests",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "created_at", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "requests",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "helper_id", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "claimed_at", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

Create `storage.rules`:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /requests/{userId}/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == userId
        && request.resource.size < 10 * 1024 * 1024
        && request.resource.contentType.matches('image/.*');
    }
  }
}
```

---

## Verification Tests

### Test 1: Project Builds

```bash
npm run build
```

**Expected:** Build completes without errors

### Test 2: Dev Server Starts

```bash
npm run dev
```

**Expected:** Server starts at http://localhost:5173

### Test 3: Home Page Loads

1. Open http://localhost:5173

**Expected:** Home page displays with "HomePro Assist" title and two cards

### Test 4: Routes Work

1. Navigate to `/customer/login`
2. Navigate to `/helper/login`
3. Navigate to `/invalid-page`

**Expected:**
- Login pages show placeholder text
- Invalid page shows 404

### Test 5: Tailwind Styles Applied

1. Inspect the "Get Started" button

**Expected:** Button has primary blue color and hover effects

### Test 6: TypeScript Compiles

```bash
npx tsc --noEmit
```

**Expected:** No type errors

---

## Deliverables Checklist

- [ ] Vite + React + TypeScript project initialized
- [ ] Tailwind CSS configured with custom theme
- [ ] Folder structure created per spec
- [ ] Firebase client SDK configured
- [ ] Type definitions for User, Request, Session
- [ ] App config with constants
- [ ] Basic auth hook placeholder
- [ ] Common components (Header, LoadingSpinner)
- [ ] Route structure with placeholders
- [ ] Firebase configuration files
- [ ] Environment variable template
- [ ] Project builds and runs

---

## Next Phase

Once all tests pass, proceed to **Phase 2: Authentication** to implement Customer and Helper login flows.
