# Phase 1: Project Setup & Foundation

## Purpose

Establish the foundational project structure with React, TypeScript, Tailwind CSS, and Firebase configuration. This phase creates the development environment and basic application shell that all subsequent phases will build upon.

---

## Why We Need This Phase

1. **Consistent Foundation** - A properly configured project prevents technical debt and inconsistencies later
2. **Type Safety** - TypeScript catches errors at compile time, reducing bugs
3. **Rapid Styling** - Tailwind CSS enables fast, consistent UI development
4. **Firebase Integration** - Early setup ensures smooth backend integration
5. **Developer Experience** - Good tooling setup makes development faster and more enjoyable

---

## Benefits

- Standardized project structure that scales
- Hot module reloading for fast development
- Type checking prevents common errors
- Environment variable management for secure configuration
- Ready-to-use routing structure
- Firebase SDK initialized and tested

---

## Prerequisites

Before starting this phase, ensure you have:
- Node.js 18+ installed
- npm or yarn package manager
- Firebase account with a new project created
- Firebase CLI installed (`npm install -g firebase-tools`)
- Git initialized (already done)

---

## Implementation Tasks

### Task 1.1: Initialize Vite + React + TypeScript Project

Create a new Vite project with React and TypeScript template.

```bash
cd /home/markly2/claude_code/diyyid_website
npm create vite@latest . -- --template react-ts
```

If the directory is not empty, you may need to use:
```bash
npm create vite@latest temp-app -- --template react-ts
# Then move contents from temp-app to current directory
```

**Expected files created:**
- `package.json`
- `tsconfig.json`
- `vite.config.ts`
- `src/main.tsx`
- `src/App.tsx`
- `index.html`

### Task 1.2: Install Dependencies

Install all required dependencies:

```bash
# Core dependencies
npm install react-router-dom firebase

# Development dependencies
npm install -D tailwindcss postcss autoprefixer @types/react-router-dom

# Initialize Tailwind
npx tailwindcss init -p
```

**Final package.json dependencies should include:**
```json
{
  "dependencies": {
    "react": "^18.x",
    "react-dom": "^18.x",
    "react-router-dom": "^6.x",
    "firebase": "^10.x"
  },
  "devDependencies": {
    "@types/react": "^18.x",
    "@types/react-dom": "^18.x",
    "@vitejs/plugin-react": "^4.x",
    "autoprefixer": "^10.x",
    "postcss": "^8.x",
    "tailwindcss": "^3.x",
    "typescript": "^5.x",
    "vite": "^5.x"
  }
}
```

### Task 1.3: Configure Tailwind CSS

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
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
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

@layer base {
  body {
    @apply bg-gray-50 text-gray-900 antialiased;
  }
}

@layer components {
  .btn-primary {
    @apply bg-primary-600 text-white px-4 py-2 rounded-lg font-medium
           hover:bg-primary-700 focus:outline-none focus:ring-2
           focus:ring-primary-500 focus:ring-offset-2
           disabled:opacity-50 disabled:cursor-not-allowed
           transition-colors duration-200;
  }

  .btn-secondary {
    @apply bg-white text-gray-700 px-4 py-2 rounded-lg font-medium
           border border-gray-300 hover:bg-gray-50
           focus:outline-none focus:ring-2 focus:ring-primary-500
           focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed
           transition-colors duration-200;
  }

  .input-field {
    @apply w-full px-3 py-2 border border-gray-300 rounded-lg
           focus:outline-none focus:ring-2 focus:ring-primary-500
           focus:border-transparent placeholder-gray-400;
  }

  .card {
    @apply bg-white rounded-xl shadow-sm border border-gray-200 p-6;
  }
}
```

### Task 1.4: Create Folder Structure

Create the following folder structure:

```
src/
├── components/
│   ├── common/
│   │   └── .gitkeep
│   ├── customer/
│   │   └── .gitkeep
│   └── helper/
│       └── .gitkeep
├── pages/
│   ├── customer/
│   │   └── .gitkeep
│   ├── helper/
│   │   └── .gitkeep
│   └── shared/
│       └── .gitkeep
├── hooks/
│   └── .gitkeep
├── services/
│   └── .gitkeep
├── types/
│   └── .gitkeep
├── utils/
│   └── .gitkeep
├── App.tsx
├── main.tsx
└── index.css
```

Create placeholder files to preserve folder structure in git.

### Task 1.5: Set Up Environment Variables

Create `.env.example` in project root:

```bash
# Firebase Configuration
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id

# Stripe (Client-side publishable key only)
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here

# App Configuration
VITE_APP_NAME=HomePro Assist
VITE_SESSION_PRICE_CENTS=2500

# Firebase Cloud Messaging (for push notifications - Phase 7)
VITE_FIREBASE_VAPID_KEY=your_vapid_key_here
```

Create `.env.local` with actual values (this file should be git-ignored).

Update `.gitignore` to include:
```
# Environment files
.env.local
.env.*.local

# Firebase
.firebase/
firebase-debug.log
```

### Task 1.6: Configure Firebase

Create `src/services/firebase.ts`:

```typescript
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
```

### Task 1.7: Create Type Definitions

Create `src/types/index.ts`:

```typescript
import { Timestamp } from 'firebase/firestore';

export type UserRole = 'customer' | 'helper';

export type RequestStatus = 'pending' | 'claimed' | 'in_session' | 'completed' | 'cancelled';

export type PaymentStatus = 'pending' | 'authorized' | 'captured' | 'refunded';

export type SessionStatus = 'created' | 'waiting' | 'active' | 'ended';

export type RequestCategory = 'plumbing' | 'electrical' | 'hvac' | 'appliance' | 'other';

export interface User {
  uid: string;
  email: string;
  phone: string;
  displayName: string;
  role: UserRole;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  // Helper-specific
  isAvailable?: boolean;
  specialties?: string[];
  completedSessions?: number;
}

export interface Request {
  id: string;
  customerId: string;
  customerPhone: string;
  description: string;
  category: RequestCategory;
  photoUrls: string[];
  status: RequestStatus;
  helperId?: string;
  claimedAt?: Timestamp;
  paymentIntentId?: string;
  paymentStatus: PaymentStatus;
  amount: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Session {
  id: string;
  requestId: string;
  customerId: string;
  helperId: string;

  // Zoho Lens integration
  zohoSessionId?: string;
  zohoSessionUrl?: string;        // Legacy - use zohoCustomerUrl instead
  zohoTechnicianUrl?: string;     // URL for Helper to access Zoho console
  zohoCustomerUrl?: string;       // URL for Customer to join session

  // SMS invite tracking
  smsInviteSent?: boolean;
  smsInviteSentAt?: Timestamp;

  // Session state
  status: SessionStatus;
  safetyChecklistCompleted: boolean;

  // Timing
  startedAt?: Timestamp;
  endedAt?: Timestamp;
  duration?: number;              // In seconds

  // Outcome
  outcome?: 'resolved' | 'unresolved' | 'escalated';
  notes?: string;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### Task 1.8: Set Up Routing

Create `src/App.tsx`:

```typescript
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Placeholder pages - will be replaced in later phases
const CustomerLogin = () => <div className="p-8">Customer Login (Phase 2)</div>;
const CustomerRequestForm = () => <div className="p-8">Request Form (Phase 3)</div>;
const CustomerSession = () => <div className="p-8">Customer Session (Phase 5)</div>;

const HelperLogin = () => <div className="p-8">Helper Login (Phase 2)</div>;
const HelperDashboard = () => <div className="p-8">Helper Dashboard (Phase 4)</div>;
const HelperSession = () => <div className="p-8">Helper Session (Phase 5)</div>;

const NotFound = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="text-center">
      <h1 className="text-4xl font-bold text-gray-900 mb-4">404</h1>
      <p className="text-gray-600">Page not found</p>
    </div>
  </div>
);

// Simple landing page
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
    <BrowserRouter>
      <Routes>
        {/* Landing */}
        <Route path="/" element={<Landing />} />

        {/* Customer Routes */}
        <Route path="/customer">
          <Route path="login" element={<CustomerLogin />} />
          <Route path="request" element={<CustomerRequestForm />} />
          <Route path="session/:sessionId" element={<CustomerSession />} />
          <Route index element={<Navigate to="/customer/login" replace />} />
        </Route>

        {/* Helper Routes */}
        <Route path="/helper">
          <Route path="login" element={<HelperLogin />} />
          <Route path="dashboard" element={<HelperDashboard />} />
          <Route path="session/:sessionId" element={<HelperSession />} />
          <Route index element={<Navigate to="/helper/login" replace />} />
        </Route>

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
```

### Task 1.9: Update main.tsx

Ensure `src/main.tsx` is properly configured:

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Import Firebase to initialize it
import './services/firebase';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

### Task 1.10: Update index.html

Update `index.html`:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="HomePro Assist - Expert remote guidance for home repairs" />
    <title>HomePro Assist</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

### Task 1.11: Initialize Firebase Hosting

```bash
firebase login
firebase init hosting
```

When prompted:
- Select your Firebase project
- Set public directory to `dist`
- Configure as single-page app: Yes
- Don't overwrite index.html

This creates `firebase.json`:

```json
{
  "hosting": {
    "public": "dist",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```

---

## Verification Tests

### Test 1: Development Server Runs

```bash
npm run dev
```

**Expected:** Server starts on http://localhost:5173 (or similar port)

### Test 2: Landing Page Renders

Navigate to http://localhost:5173

**Expected:** See the HomePro Assist landing page with two buttons

### Test 3: Routes Work

Click each button and verify navigation:
- "I need help" → `/customer/login`
- "I'm a Helper" → `/helper/login`

### Test 4: Tailwind CSS Works

**Expected:** Buttons are styled with blue color, rounded corners, shadows on cards

### Test 5: TypeScript Compiles

```bash
npm run build
```

**Expected:** Build completes without TypeScript errors

### Test 6: Firebase Initializes

Open browser console on landing page

**Expected:** No Firebase initialization errors

---

## Deliverables Checklist

- [ ] Vite + React + TypeScript project initialized
- [ ] All dependencies installed
- [ ] Tailwind CSS configured and working
- [ ] Folder structure created
- [ ] Environment variables set up
- [ ] Firebase SDK configured
- [ ] Type definitions created
- [ ] React Router configured with all placeholder routes
- [ ] Landing page displays correctly
- [ ] Build completes without errors

---

## Next Phase

Once all tests pass, proceed to **Phase 2: Authentication System** to implement user login and signup functionality.
