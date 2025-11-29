# Phase 0: Project Overview & Architecture

## Document Purpose

This document provides the architectural overview and context for the HomePro Assist MVP - a remote DIY guidance platform connecting homeowners with professional tradespeople via AR-enhanced video calls.

---

## Why This Document Exists

Before implementing any code, Claude Code (or any developer) needs to understand:
1. The overall system architecture
2. How all components connect
3. The technology choices and why they were made
4. The folder structure and conventions to follow

---

## Project Summary

**HomePro Assist** is an on-demand remote guidance service where:
- **Customers (Homeowners)** submit home repair issues and receive live AR-guided assistance
- **Helpers (Professionals)** claim jobs and guide customers through repairs via video with AR annotations

**Core Value Proposition:** Achieve 60%+ First-Time Fix Rate within 30 minutes.

---

## Technology Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| **Frontend** | React 18 + TypeScript | Type safety, component reusability, large ecosystem |
| **Styling** | Tailwind CSS | Rapid UI development, consistent design system |
| **Backend/Database** | Firebase (Auth + Firestore) | Real-time sync, fast setup, serverless |
| **Serverless Functions** | Firebase Cloud Functions | Handle webhooks, API integrations |
| **Video/AR** | Zoho Lens API | Spatial AR annotation, SMS link joining, affordable |
| **Payments** | Stripe | Industry standard, pre-authorization support |
| **Hosting** | Firebase Hosting | Simple deployment, CDN, SSL included |

---

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React SPA)                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐ │
│  │  Customer Views │  │  Helper Views   │  │   Shared Components │ │
│  │  - Login        │  │  - Login        │  │   - Header          │ │
│  │  - Request Form │  │  - Dashboard    │  │   - Loading States  │ │
│  │  - Session View │  │  - Job Queue    │  │   - Error Handling  │ │
│  │  - Payment      │  │  - Session View │  │   - Notifications   │ │
│  └────────┬────────┘  └────────┬────────┘  └─────────────────────┘ │
│           │                    │                                    │
└───────────┼────────────────────┼────────────────────────────────────┘
            │                    │
            ▼                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      FIREBASE SERVICES                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐ │
│  │  Firebase Auth  │  │    Firestore    │  │  Cloud Functions    │ │
│  │  - Email/Pass   │  │  - users        │  │  - onRequestCreate  │ │
│  │  - Phone (SMS)  │  │  - requests     │  │  - stripeWebhook    │ │
│  │                 │  │  - sessions     │  │  - zohoLensAPI      │ │
│  │                 │  │  - payments     │  │  - sendSMS          │ │
│  └─────────────────┘  └─────────────────┘  └──────────┬──────────┘ │
│                                                       │            │
└───────────────────────────────────────────────────────┼────────────┘
                                                        │
                    ┌───────────────────────────────────┼───────────┐
                    │                                   │           │
                    ▼                                   ▼           ▼
          ┌─────────────────┐              ┌─────────────────────────┐
          │   Stripe API    │              │     Zoho Lens API       │
          │  - Pre-auth     │              │  - Create Session       │
          │  - Capture      │              │  - Generate SMS Link    │
          │  - Refund       │              │  - AR Video Stream      │
          └─────────────────┘              └─────────────────────────┘
```

---

## Folder Structure

```
diyyid_website/
├── docs/                          # Documentation and specs
│   ├── phase-0-overview.md
│   ├── phase-1-setup.md
│   └── ...
├── src/
│   ├── components/                # Reusable UI components
│   │   ├── common/               # Shared components (Button, Input, etc.)
│   │   ├── customer/             # Customer-specific components
│   │   └── helper/               # Helper-specific components
│   ├── pages/                    # Page-level components (routes)
│   │   ├── customer/
│   │   │   ├── Login.tsx
│   │   │   ├── RequestForm.tsx
│   │   │   └── Session.tsx
│   │   ├── helper/
│   │   │   ├── Login.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   └── Session.tsx
│   │   └── shared/
│   │       └── NotFound.tsx
│   ├── hooks/                    # Custom React hooks
│   │   ├── useAuth.ts
│   │   ├── useFirestore.ts
│   │   └── useZohoLens.ts
│   ├── services/                 # External service integrations
│   │   ├── firebase.ts           # Firebase config and utilities
│   │   ├── stripe.ts             # Stripe client-side utilities
│   │   └── zohoLens.ts           # Zoho Lens API client
│   ├── types/                    # TypeScript type definitions
│   │   ├── user.ts
│   │   ├── request.ts
│   │   └── session.ts
│   ├── utils/                    # Utility functions
│   ├── App.tsx                   # Main app component with routing
│   ├── main.tsx                  # Entry point
│   └── index.css                 # Global styles (Tailwind)
├── functions/                    # Firebase Cloud Functions
│   ├── src/
│   │   ├── index.ts              # Function exports
│   │   ├── stripe.ts             # Stripe webhook handlers
│   │   ├── zohoLens.ts           # Zoho Lens API handlers
│   │   └── notifications.ts      # SMS/Push notification handlers
│   ├── package.json
│   └── tsconfig.json
├── public/                       # Static assets
├── .env.example                  # Environment variable template
├── .env.local                    # Local environment variables (git-ignored)
├── firebase.json                 # Firebase configuration
├── firestore.rules               # Firestore security rules
├── package.json
├── tsconfig.json
├── tailwind.config.js
└── vite.config.ts
```

---

## Firestore Data Models

### Collection: `users`

```typescript
interface User {
  uid: string;                    // Firebase Auth UID
  email: string;
  phone: string;
  displayName: string;
  role: 'customer' | 'helper';
  createdAt: Timestamp;
  updatedAt: Timestamp;

  // Helper-specific fields
  isAvailable?: boolean;          // Helper availability status
  specialties?: string[];         // e.g., ['plumbing', 'electrical']
  rating?: number;                // Average rating (future feature)
  completedSessions?: number;
}
```

### Collection: `requests`

```typescript
interface Request {
  id: string;                     // Auto-generated
  customerId: string;             // Reference to user
  customerPhone: string;          // For SMS notification

  // Problem details
  description: string;
  category: 'plumbing' | 'electrical' | 'hvac' | 'appliance' | 'other';
  photoUrls: string[];            // Firebase Storage URLs

  // Status tracking
  status: 'pending' | 'claimed' | 'in_session' | 'completed' | 'cancelled';

  // Assignment
  helperId?: string;              // Assigned helper
  claimedAt?: Timestamp;

  // Payment
  paymentIntentId?: string;       // Stripe payment intent
  paymentStatus: 'pending' | 'authorized' | 'captured' | 'refunded';
  amount: number;                 // In cents

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### Collection: `sessions`

```typescript
interface Session {
  id: string;
  requestId: string;              // Reference to request
  customerId: string;
  helperId: string;

  // Zoho Lens integration
  zohoSessionId?: string;         // Zoho Lens session ID
  zohoSessionUrl?: string;        // URL for customer to join

  // Session state
  status: 'created' | 'waiting' | 'active' | 'ended';
  safetyChecklistCompleted: boolean;

  // Timing
  startedAt?: Timestamp;
  endedAt?: Timestamp;
  duration?: number;              // In seconds

  // Outcome
  outcome?: 'resolved' | 'unresolved' | 'escalated';
  notes?: string;                 // Helper notes

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

## API Endpoints (Cloud Functions)

| Function | Trigger | Purpose |
|----------|---------|---------|
| `onRequestCreate` | Firestore onCreate | Alert available helpers when new request is created |
| `createPaymentIntent` | HTTP callable | Create Stripe payment intent for pre-authorization |
| `capturePayment` | HTTP callable | Capture payment after successful session |
| `createZohoSession` | HTTP callable | Create Zoho Lens session and return join URL |
| `sendSessionSMS` | HTTP callable | Send SMS to customer with session join link |
| `stripeWebhook` | HTTP | Handle Stripe webhook events |

---

## Environment Variables Required

```bash
# Firebase
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=

# Stripe (Client-side)
VITE_STRIPE_PUBLISHABLE_KEY=

# Stripe (Server-side - in functions/.env)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Zoho Lens (Server-side - in functions/.env)
ZOHO_CLIENT_ID=
ZOHO_CLIENT_SECRET=
ZOHO_REFRESH_TOKEN=
ZOHO_ORG_ID=

# Twilio (for SMS - in functions/.env)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
```

---

## Development Phases Summary

| Phase | Name | Primary Deliverable |
|-------|------|---------------------|
| 1 | Project Setup | Working React + Firebase project with routing |
| 2 | Authentication | Customer and Helper login/signup flows |
| 3 | Customer Request Flow | Request submission with photo upload |
| 4 | Helper Dashboard | Job queue and claim functionality |
| 5 | Zoho Lens Integration | Video session with AR annotation |
| 6 | Payment Integration | Stripe pre-authorization and capture |
| 7 | Session Management | End-to-end dispatch and session flow |
| 8 | Testing & Polish | E2E tests, error handling, UI polish |

---

## Key Design Principles

1. **Simplicity First** - Minimal UI, clear user flows, no unnecessary features
2. **Mobile-First for Customers** - Customer interface must work flawlessly on mobile browsers
3. **Desktop-Optimized for Helpers** - Helper console designed for larger screens
4. **Real-time Updates** - Use Firestore listeners for live status updates
5. **Graceful Degradation** - Handle network issues, API failures gracefully
6. **Security by Default** - Firestore rules, input validation, secure API calls

---

## Success Criteria for MVP

- [ ] Customer can submit a request in under 2 minutes
- [ ] Helper receives alert within 30 seconds of request submission
- [ ] Helper can claim and start session within 15 minutes
- [ ] Customer joins video session with single SMS link click
- [ ] AR annotation works during video call
- [ ] Payment is captured only after session completion
- [ ] System handles edge cases (no available helpers, payment failures, etc.)
