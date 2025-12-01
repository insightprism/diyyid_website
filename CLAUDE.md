# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

HomePro Assist (diyyid.io) - Remote DIY guidance platform connecting homeowners with professional tradespeople via AR-enhanced video calls using Zoho Lens.

## Commands

### Frontend Development
```bash
npm run dev          # Start Vite dev server on port 18885
npm run build        # Build for production (outputs to dist/)
npm run lint         # ESLint check
```

### Firebase Functions
```bash
cd functions
npm run build        # Compile TypeScript
npm run lint         # ESLint check
npm run deploy       # Deploy to Firebase
```

### Firebase Emulators
```bash
firebase emulators:start  # Start all emulators (see ports below)
```

Emulator ports:
- Auth: 18899
- Functions: 18884
- Firestore: 18880
- Storage: 18898
- Hosting: 18886
- UI: 18800

Set `VITE_USE_EMULATORS=true` in `.env.local` to connect frontend to emulators.

## Architecture

### Two-User-Type System
- **Customers**: Submit repair requests, join AR video sessions, make payments
- **Helpers**: Claim jobs from queue, conduct AR-guided video sessions

Routes are role-protected. Customer routes under `/customer/*`, helper routes under `/helper/*`.

### Data Flow
1. Customer submits request → Firestore `requests` collection
2. Available helpers get notified (Cloud Function trigger)
3. Helper claims request → status changes to `claimed`
4. Helper creates Zoho Lens session → customer receives SMS link
5. AR video session conducted
6. Payment captured via Stripe on session completion

### Key Integrations
- **Firebase Auth**: Email/password authentication with custom claims for role (`customer` | `helper`)
- **Firestore**: Real-time data with `onSnapshot` listeners for live updates
- **Zoho Lens**: AR video sessions created via Cloud Functions
- **Stripe**: Pre-authorization flow - authorize on request creation, capture on session completion
- **Twilio**: SMS notifications for session invites

### Frontend Structure
- `src/hooks/use_auth.tsx` - AuthProvider context, handles auth state and Firestore user profile sync
- `src/services/firebase_client.ts` - Firebase initialization with emulator support
- `src/pages/customer/` and `src/pages/helper/` - Role-specific page components
- `src/components/common/` - Shared UI (ErrorBoundary, LoadingSpinner, Header)

### Cloud Functions (`functions/src/`)
- `stripe_functions.ts` - Payment intents, capture, webhooks
- `zoho_lens.ts` - Session creation/termination
- `notifications.ts` - Firestore triggers for request events, SMS sending
- `auth.ts` - User creation triggers, role management

### Firestore Collections
- `users` - User profiles with role and availability (for helpers)
- `requests` - Job requests with status workflow: `pending` → `claimed` → `in_session` → `completed`
- `sessions` - Zoho Lens session metadata
- `notifications` - User notification queue
- `payments` - Stripe payment records (managed by functions only)

## Conventions

- TypeScript with strict mode enabled
- Use snake_case for variables and functions (not camelCase)
- Firestore security rules use custom claims (`request.auth.token.role`)
- Environment variables prefixed with `VITE_` for client-side access
