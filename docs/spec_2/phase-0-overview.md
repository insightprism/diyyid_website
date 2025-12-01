# Phase 0: Project Overview & Architecture

## Document Purpose

This document provides the architectural overview and context for the HomePro Assist MVP - a remote DIY guidance platform connecting homeowners with professional tradespeople via AR-enhanced video calls powered by Zoho Lens.

---

## Why This Document Exists

Before implementing any code, you need to understand:
1. The overall system architecture
2. How all components connect
3. The technology choices and why they were made
4. The folder structure and naming conventions to follow

---

## Project Summary

**HomePro Assist** is an on-demand remote guidance service where:
- **Customers (Homeowners)** submit home repair issues and receive live AR-guided assistance
- **Helpers (Professionals)** claim jobs and guide customers through repairs via video with AR annotations

**Core Value Proposition:** Achieve 60%+ First-Time Fix Rate within 30 minutes.

**Primary MVP Objective:** Validate market demand for remote, AR-enhanced guidance and confirm operational feasibility of < 15-minute Helper dispatch time.

---

## Technology Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| **Frontend** | React 18 + TypeScript | Type safety, component reusability |
| **Styling** | Tailwind CSS | Rapid UI development, consistent design |
| **Backend/Database** | Firebase (Auth + Firestore) | Real-time sync, fast setup, serverless |
| **Serverless Functions** | Firebase Cloud Functions | Handle webhooks, API integrations |
| **Video/AR** | Zoho Lens API | Spatial AR annotation, browser-based, affordable |
| **Payments** | Stripe | Industry standard, pre-authorization support |
| **SMS** | Twilio | Reliable SMS delivery for session invites |
| **Hosting** | Firebase Hosting | Simple deployment, CDN, SSL included |

---

## System Architecture

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
│  │  - Payment      │  │  - Session View │  │                     │ │
│  └────────┬────────┘  └────────┬────────┘  └─────────────────────┘ │
│           │                    │                                    │
└───────────┼────────────────────┼────────────────────────────────────┘
            │                    │
            ▼                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      FIREBASE SERVICES                              │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐ │
│  │  Firebase Auth  │  │    Firestore    │  │  Cloud Functions    │ │
│  │  - Email/Pass   │  │  - users        │  │  - createLensSession│ │
│  │  - Phone (SMS)  │  │  - requests     │  │  - stripeWebhook    │ │
│  │                 │  │  - sessions     │  │  - sendInviteSMS    │ │
│  │                 │  │  - payments     │  │  - helperDispatch   │ │
│  └─────────────────┘  └─────────────────┘  └──────────┬──────────┘ │
└───────────────────────────────────────────────────────┼────────────┘
                                                        │
                    ┌───────────────────────────────────┼───────────┐
                    │                                   │           │
                    ▼                                   ▼           ▼
          ┌─────────────────┐              ┌───────────────────────────┐
          │   Stripe API    │              │       Zoho Lens API       │
          │  - Pre-auth     │              │  - Create Session         │
          │  - Capture      │              │  - Get Join URLs          │
          └─────────────────┘              │  - AR Video Stream        │
                                           └───────────────────────────┘
                                                        │
                                                        ▼
                                           ┌───────────────────────────┐
                                           │       Twilio API          │
                                           │  - Send SMS Invite        │
                                           └───────────────────────────┘
```

---

## Folder Structure

```
diyyid_website/
├── docs/
│   └── spec_2/                    # This specification
│       ├── phase-0-overview.md
│       ├── phase-1-setup.md
│       └── ...
├── src/
│   ├── components/                # Reusable UI components
│   │   ├── common/               # Shared (Button, Input, Header, etc.)
│   │   ├── customer/             # Customer-specific components
│   │   └── helper/               # Helper-specific components
│   ├── pages/                    # Page-level components (routes)
│   │   ├── customer/
│   │   │   ├── CustomerLogin.tsx
│   │   │   ├── RequestForm.tsx
│   │   │   └── CustomerSession.tsx
│   │   ├── helper/
│   │   │   ├── HelperLogin.tsx
│   │   │   ├── HelperDashboard.tsx
│   │   │   └── HelperSession.tsx
│   │   └── shared/
│   │       └── NotFound.tsx
│   ├── hooks/                    # Custom React hooks
│   │   ├── use_auth.ts
│   │   ├── use_firestore.ts
│   │   └── use_zoho_lens.ts
│   ├── services/                 # External service integrations
│   │   ├── firebase_client.ts
│   │   ├── stripe_client.ts
│   │   └── zoho_lens_client.ts
│   ├── types/                    # TypeScript type definitions
│   │   ├── user_types.ts
│   │   ├── request_types.ts
│   │   └── session_types.ts
│   ├── config/                   # Configuration objects
│   │   └── app_config.ts
│   ├── utils/                    # Utility functions
│   │   ├── date_utils.ts
│   │   └── validation_utils.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── functions/                    # Firebase Cloud Functions
│   ├── src/
│   │   ├── index.ts
│   │   ├── zoho_lens_service.ts
│   │   ├── stripe_service.ts
│   │   ├── sms_service.ts
│   │   └── helper_dispatch.ts
│   ├── package.json
│   └── tsconfig.json
├── public/
├── .env.example
├── firebase.json
├── firestore.rules
├── package.json
├── tsconfig.json
├── tailwind.config.js
└── vite.config.ts
```

---

## Naming Conventions

Follow these naming patterns throughout the codebase:

| Type | Convention | Examples |
|------|------------|----------|
| Config objects | `{scope}_cfg` | `firebase_cfg`, `stripe_cfg`, `zoho_lens_cfg` |
| Service functions | `{verb}_{noun}` | `create_lens_session()`, `send_invite_sms()` |
| Hooks | `use_{feature}` | `use_auth`, `use_zoho_lens` |
| Types | `{Entity}` or `{Entity}Data` | `User`, `Request`, `SessionData` |
| Components | PascalCase descriptive | `SafetyChecklist`, `RequestCard` |
| Utilities | `{verb}_{noun}` | `format_distance_to_now()`, `validate_phone()` |

---

## Firestore Data Models

### Collection: `users`

```typescript
interface User {
  uid: string;                    // Firebase Auth UID
  email: string;
  phone: string;
  display_name: string;
  role: 'customer' | 'helper';
  created_at: Timestamp;
  updated_at: Timestamp;

  // Helper-specific fields
  is_available?: boolean;
  specialties?: string[];
  completed_sessions?: number;
}
```

### Collection: `requests`

```typescript
interface Request {
  id: string;
  customer_id: string;
  customer_phone: string;

  // Problem details
  description: string;
  category: 'plumbing' | 'electrical' | 'hvac' | 'appliance' | 'other';
  photo_urls: string[];

  // Status tracking
  status: 'pending' | 'claimed' | 'in_session' | 'completed' | 'cancelled';

  // Assignment
  helper_id?: string;
  claimed_at?: Timestamp;

  // Payment
  payment_intent_id?: string;
  payment_status: 'pending' | 'authorized' | 'captured' | 'refunded';
  amount: number;                 // In cents

  created_at: Timestamp;
  updated_at: Timestamp;
}
```

### Collection: `sessions`

```typescript
interface Session {
  id: string;
  request_id: string;
  customer_id: string;
  helper_id: string;

  // Zoho Lens integration
  zoho_session_id?: string;
  technician_url?: string;
  customer_join_url?: string;

  // Session state
  status: 'created' | 'waiting' | 'active' | 'ended';
  safety_checklist_completed: boolean;

  // SMS tracking
  sms_sent_at?: Timestamp;

  // Timing
  started_at?: Timestamp;
  ended_at?: Timestamp;
  duration?: number;              // In seconds

  // Outcome
  outcome?: 'resolved' | 'unresolved' | 'escalated';
  notes?: string;

  created_at: Timestamp;
  updated_at: Timestamp;
}
```

---

## Environment Variables

### Frontend (`.env.local`)

```bash
# Firebase
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=

# Stripe (publishable key only)
VITE_STRIPE_PUBLISHABLE_KEY=

# Development
VITE_USE_EMULATORS=false
```

### Cloud Functions (`functions/.env`)

```bash
# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Zoho Lens
ZOHO_CLIENT_ID=
ZOHO_CLIENT_SECRET=
ZOHO_REFRESH_TOKEN=
ZOHO_API_DOMAIN=https://lens.zoho.com
ZOHO_ACCOUNTS_URL=https://accounts.zoho.com

# Twilio
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
| 3 | Customer Request | Request submission with photo upload |
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
5. **Function-First Code** - Prefer functions over classes unless shared state needed
6. **Config-Driven** - No hardcoded values; use config objects
7. **Descriptive Naming** - Scoped identifiers (e.g., `zoho_lens_cfg`, not `config`)

---

## Success Criteria for MVP

- [ ] Customer can submit a request in under 2 minutes
- [ ] Helper receives alert within 30 seconds of request submission
- [ ] Helper can claim and start session within 15 minutes
- [ ] Customer joins video session with single SMS link click (no app install)
- [ ] AR annotation works during video call (spatial, locks to objects)
- [ ] Payment is captured only after session completion
- [ ] System handles edge cases gracefully

---

## Next Step

Proceed to **Phase 1: Project Setup** to initialize the development environment.
