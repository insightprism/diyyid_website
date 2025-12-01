# Phase 5: Zoho Lens Integration

## Purpose

Integrate Zoho Lens AR remote assistance platform to enable live video sessions between Helpers and Customers with spatial AR annotation capabilities. This is the core differentiating feature of HomePro Assist.

---

## Why We Need This Phase

1. **AR Annotation** - Helpers can draw arrows and shapes that lock to physical objects in the customer's camera view
2. **Browser-Based** - Customers join via SMS link without downloading an app
3. **Professional Tooling** - Purpose-built for remote assistance scenarios
4. **VoIP + Text Chat** - Built-in communication for noisy environments
5. **Core Value** - This enables the 60%+ First-Time Fix Rate goal

---

## Benefits

- Spatial AR annotations that persist as camera moves
- One-click session join for customers (no app install)
- Built-in voice and text chat
- Audio-only fallback for hands-busy scenarios
- Professional-grade video quality

---

## Prerequisites

- Phase 4 completed (Helper can claim and start sessions)
- Zoho Lens account created (Professional plan for API access)
- Zoho OAuth credentials obtained
- Twilio account for SMS

---

## Zoho Lens Setup

### Step 1: Create Zoho API Application

1. Go to [Zoho API Console](https://api-console.zoho.com/)
2. Create a "Server-based Application"
3. Note your `Client ID` and `Client Secret`
4. Set Redirect URI: `https://your-domain.com/oauth/callback`
5. Add scopes: `ZohoLens.sessionapi.CREATE`, `ZohoLens.sessionapi.READ`

### Step 2: Generate Refresh Token

```bash
# Step 1: Get authorization code (browser)
https://accounts.zoho.com/oauth/v2/auth?scope=ZohoLens.sessionapi.CREATE,ZohoLens.sessionapi.READ&client_id=YOUR_CLIENT_ID&response_type=code&access_type=offline&redirect_uri=YOUR_REDIRECT_URI

# Step 2: Exchange for tokens
curl -X POST https://accounts.zoho.com/oauth/v2/token \
  -d "code=AUTH_CODE&client_id=CLIENT_ID&client_secret=CLIENT_SECRET&redirect_uri=REDIRECT_URI&grant_type=authorization_code"
```

### Step 3: Configure Environment

Add to `functions/.env`:

```bash
ZOHO_CLIENT_ID=your_client_id
ZOHO_CLIENT_SECRET=your_client_secret
ZOHO_REFRESH_TOKEN=your_refresh_token
ZOHO_API_DOMAIN=https://lens.zoho.com
ZOHO_ACCOUNTS_URL=https://accounts.zoho.com

TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890
```

---

## Implementation Tasks

### Task 5.1: Create Zoho Lens Service (Cloud Functions)

Create `functions/src/zoho_lens_service.ts`:

```typescript
const zoho_lens_cfg = {
  client_id: process.env.ZOHO_CLIENT_ID || '',
  client_secret: process.env.ZOHO_CLIENT_SECRET || '',
  refresh_token: process.env.ZOHO_REFRESH_TOKEN || '',
  api_domain: process.env.ZOHO_API_DOMAIN || 'https://lens.zoho.com',
  accounts_url: process.env.ZOHO_ACCOUNTS_URL || 'https://accounts.zoho.com',
};

// Token cache
let token_cache: { token: string; expires_at: number } | null = null;

export async function get_zoho_access_token(): Promise<string> {
  const now = Date.now();

  // Return cached token if valid (5 min buffer)
  if (token_cache && token_cache.expires_at > now + 300000) {
    return token_cache.token;
  }

  const params = new URLSearchParams({
    refresh_token: zoho_lens_cfg.refresh_token,
    client_id: zoho_lens_cfg.client_id,
    client_secret: zoho_lens_cfg.client_secret,
    grant_type: 'refresh_token',
  });

  const response = await fetch(`${zoho_lens_cfg.accounts_url}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) {
    throw new Error(`Token refresh failed: ${await response.text()}`);
  }

  const data = await response.json();

  token_cache = {
    token: data.access_token,
    expires_at: now + data.expires_in * 1000,
  };

  return token_cache.token;
}

export async function create_lens_session(session_name: string): Promise<{
  session_id: string;
  technician_url: string;
  customer_join_url: string;
}> {
  const token = await get_zoho_access_token();

  const response = await fetch(`${zoho_lens_cfg.api_domain}/api/v2/session`, {
    method: 'POST',
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      session_name,
      session_type: 'remote_assistance',
    }),
  });

  if (!response.ok) {
    throw new Error(`Create session failed: ${await response.text()}`);
  }

  const data = await response.json();

  return {
    session_id: data.session_id,
    technician_url: data.technician_url,
    customer_join_url: data.customer_join_url,
  };
}

export async function end_lens_session(session_id: string): Promise<void> {
  const token = await get_zoho_access_token();

  await fetch(`${zoho_lens_cfg.api_domain}/api/v2/session/${session_id}/end`, {
    method: 'POST',
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
  });
}
```

### Task 5.2: Create SMS Service

Create `functions/src/sms_service.ts`:

```typescript
const twilio_cfg = {
  account_sid: process.env.TWILIO_ACCOUNT_SID || '',
  auth_token: process.env.TWILIO_AUTH_TOKEN || '',
  phone_number: process.env.TWILIO_PHONE_NUMBER || '',
};

let twilio_client: any = null;

function get_twilio_client() {
  if (!twilio_client) {
    const twilio = require('twilio');
    twilio_client = twilio(twilio_cfg.account_sid, twilio_cfg.auth_token);
  }
  return twilio_client;
}

export async function send_session_invite_sms(
  customer_phone: string,
  join_url: string,
  helper_name: string
): Promise<string> {
  const client = get_twilio_client();

  const message = await client.messages.create({
    body: `Your HomePro Assist session is ready! ${helper_name} is waiting to help. Click to join: ${join_url}`,
    from: twilio_cfg.phone_number,
    to: customer_phone,
  });

  return message.sid;
}
```

### Task 5.3: Create Cloud Functions

Create `functions/src/index.ts`:

```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { create_lens_session, end_lens_session } from './zoho_lens_service';
import { send_session_invite_sms } from './sms_service';

admin.initializeApp();
const db = admin.firestore();

export const createZohoSession = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  }

  const { session_id } = data;
  if (!session_id) {
    throw new functions.https.HttpsError('invalid-argument', 'session_id required');
  }

  const session_doc = await db.collection('sessions').doc(session_id).get();
  if (!session_doc.exists) {
    throw new functions.https.HttpsError('not-found', 'Session not found');
  }

  const session = session_doc.data()!;
  if (session.helper_id !== context.auth.uid) {
    throw new functions.https.HttpsError('permission-denied', 'Not authorized');
  }

  const request_doc = await db.collection('requests').doc(session.request_id).get();
  const request = request_doc.data();
  const name = `HomePro-${request?.category || 'Session'}-${session_id.slice(0, 6)}`;

  try {
    const lens = await create_lens_session(name);

    await db.collection('sessions').doc(session_id).update({
      zoho_session_id: lens.session_id,
      technician_url: lens.technician_url,
      customer_join_url: lens.customer_join_url,
      status: 'waiting',
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      technician_url: lens.technician_url,
      customer_join_url: lens.customer_join_url,
    };
  } catch (error: any) {
    console.error('Zoho error:', error);
    throw new functions.https.HttpsError('internal', 'Failed to create session');
  }
});

export const sendSessionSMS = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  }

  const { session_id } = data;
  const session_doc = await db.collection('sessions').doc(session_id).get();
  if (!session_doc.exists) {
    throw new functions.https.HttpsError('not-found', 'Session not found');
  }

  const session = session_doc.data()!;
  if (session.helper_id !== context.auth.uid) {
    throw new functions.https.HttpsError('permission-denied', 'Not authorized');
  }

  if (!session.customer_join_url) {
    throw new functions.https.HttpsError('failed-precondition', 'Session not initialized');
  }

  const request_doc = await db.collection('requests').doc(session.request_id).get();
  const customer_phone = request_doc.data()?.customer_phone;

  const helper_doc = await db.collection('users').doc(context.auth.uid).get();
  const helper_name = helper_doc.data()?.display_name || 'Your Helper';

  const message_sid = await send_session_invite_sms(
    customer_phone,
    session.customer_join_url,
    helper_name
  );

  await db.collection('sessions').doc(session_id).update({
    sms_sent_at: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { message_sid };
});

export const endZohoSession = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  }

  const { session_id } = data;
  const session_doc = await db.collection('sessions').doc(session_id).get();
  const session = session_doc.data()!;

  if (session.helper_id !== context.auth.uid) {
    throw new functions.https.HttpsError('permission-denied', 'Not authorized');
  }

  if (session.zoho_session_id) {
    await end_lens_session(session.zoho_session_id);
  }

  await db.collection('sessions').doc(session_id).update({
    status: 'ended',
    ended_at: admin.firestore.FieldValue.serverTimestamp(),
  });

  await db.collection('requests').doc(session.request_id).update({
    status: 'completed',
  });

  return { success: true };
});
```

### Task 5.4: Create Frontend Hook

Create `src/hooks/use_zoho_lens.ts`:

```typescript
import { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../services/firebase_client';

export function useZohoLens() {
  const [is_loading, set_is_loading] = useState(false);
  const [error, set_error] = useState<string | null>(null);

  const create_session = async (session_id: string) => {
    set_is_loading(true);
    set_error(null);

    try {
      const fn = httpsCallable(functions, 'createZohoSession');
      const result = await fn({ session_id });
      return result.data as { technician_url: string; customer_join_url: string };
    } catch (err: any) {
      set_error(err.message);
      throw err;
    } finally {
      set_is_loading(false);
    }
  };

  const send_sms = async (session_id: string) => {
    set_is_loading(true);
    try {
      const fn = httpsCallable(functions, 'sendSessionSMS');
      await fn({ session_id });
    } catch (err: any) {
      set_error(err.message);
      throw err;
    } finally {
      set_is_loading(false);
    }
  };

  const end_session = async (session_id: string) => {
    set_is_loading(true);
    try {
      const fn = httpsCallable(functions, 'endZohoSession');
      await fn({ session_id });
    } catch (err: any) {
      set_error(err.message);
      throw err;
    } finally {
      set_is_loading(false);
    }
  };

  return { create_session, send_sms, end_session, is_loading, error };
}
```

### Task 5.5: Create Safety Checklist Component

Create `src/components/helper/SafetyChecklist.tsx`:

```typescript
import { useState } from 'react';

interface SafetyChecklistProps {
  on_complete: () => void;
  on_cancel: () => void;
}

const SAFETY_ITEMS = [
  { id: 'power', label: 'Is the power turned OFF at the breaker?' },
  { id: 'water', label: 'Is the water supply shut off (if applicable)?' },
  { id: 'ventilation', label: 'Is the area well-ventilated?' },
  { id: 'ppe', label: 'Is the customer wearing safety gear if needed?' },
  { id: 'stable', label: 'Is the customer on stable footing?' },
];

export function SafetyChecklist({ on_complete, on_cancel }: SafetyChecklistProps) {
  const [checked, set_checked] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    const next = new Set(checked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    set_checked(next);
  };

  const all_checked = checked.size === SAFETY_ITEMS.length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <div className="flex items-center space-x-3 mb-6">
          <span className="text-3xl">&#9888;</span>
          <div>
            <h2 className="text-xl font-bold">Safety Checklist</h2>
            <p className="text-sm text-gray-600">Confirm with customer before proceeding</p>
          </div>
        </div>

        <div className="space-y-3 mb-6">
          {SAFETY_ITEMS.map((item) => (
            <label
              key={item.id}
              className={`flex items-center space-x-3 p-3 rounded-lg cursor-pointer border ${
                checked.has(item.id)
                  ? 'bg-green-50 border-green-200'
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              <input
                type="checkbox"
                checked={checked.has(item.id)}
                onChange={() => toggle(item.id)}
                className="h-5 w-5"
              />
              <span>{item.label}</span>
            </label>
          ))}
        </div>

        <div className="flex space-x-3">
          <button onClick={on_cancel} className="btn-secondary flex-1">
            Cancel
          </button>
          <button
            onClick={on_complete}
            disabled={!all_checked}
            className={`flex-1 py-2 rounded-lg font-medium ${
              all_checked
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-gray-200 text-gray-500 cursor-not-allowed'
            }`}
          >
            Proceed
          </button>
        </div>
      </div>
    </div>
  );
}
```

### Task 5.6: Create Helper Session Page

Create `src/pages/helper/HelperSession.tsx`:

```typescript
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase_client';
import { useAuth } from '../../hooks/use_auth';
import { useZohoLens } from '../../hooks/use_zoho_lens';
import { Header } from '../../components/common/Header';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { SafetyChecklist } from '../../components/helper/SafetyChecklist';
import { Session, Request } from '../../types';

type Stage = 'loading' | 'safety' | 'initializing' | 'waiting' | 'active' | 'ended';

export function HelperSession() {
  const { session_id } = useParams<{ session_id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { create_session, send_sms, end_session, is_loading, error } = useZohoLens();

  const [session, set_session] = useState<Session | null>(null);
  const [request, set_request] = useState<Request | null>(null);
  const [stage, set_stage] = useState<Stage>('loading');
  const [technician_url, set_technician_url] = useState<string | null>(null);
  const [sms_sent, set_sms_sent] = useState(false);

  // Subscribe to session
  useEffect(() => {
    if (!session_id) return;

    return onSnapshot(doc(db, 'sessions', session_id), (snap) => {
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() } as Session;
        set_session(data);

        if (data.status === 'ended') set_stage('ended');
        else if (data.status === 'active') set_stage('active');
        else if (data.technician_url) {
          set_technician_url(data.technician_url);
          set_stage('waiting');
        } else if (data.safety_checklist_completed) set_stage('initializing');
        else set_stage('safety');
      }
    });
  }, [session_id]);

  // Fetch request
  useEffect(() => {
    if (!session?.request_id) return;
    return onSnapshot(doc(db, 'requests', session.request_id), (snap) => {
      if (snap.exists()) set_request({ id: snap.id, ...snap.data() } as Request);
    });
  }, [session?.request_id]);

  const handle_safety_complete = async () => {
    if (!session_id) return;
    await updateDoc(doc(db, 'sessions', session_id), {
      safety_checklist_completed: true,
      updated_at: serverTimestamp(),
    });
    set_stage('initializing');
    init_zoho();
  };

  const init_zoho = async () => {
    if (!session_id) return;
    try {
      const result = await create_session(session_id);
      set_technician_url(result.technician_url);
      set_stage('waiting');
    } catch (err) {
      console.error(err);
    }
  };

  const handle_send_sms = async () => {
    if (!session_id) return;
    await send_sms(session_id);
    set_sms_sent(true);
  };

  const handle_join = () => {
    if (technician_url) {
      window.open(technician_url, '_blank');
      if (session_id) {
        updateDoc(doc(db, 'sessions', session_id), {
          status: 'active',
          started_at: serverTimestamp(),
        });
      }
    }
  };

  const handle_end = async () => {
    if (!session_id || !confirm('End this session?')) return;
    await end_session(session_id);
    navigate('/helper/dashboard');
  };

  if (stage === 'loading') {
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

      {stage === 'safety' && (
        <SafetyChecklist
          on_complete={handle_safety_complete}
          on_cancel={() => navigate('/helper/dashboard')}
        />
      )}

      <main className="max-w-2xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Request Info */}
        {request && (
          <div className="card mb-6">
            <h2 className="font-semibold mb-4">Session Details</h2>
            <p className="capitalize mb-2"><strong>Category:</strong> {request.category}</p>
            <p><strong>Description:</strong> {request.description}</p>
          </div>
        )}

        {stage === 'initializing' && (
          <div className="card text-center py-12">
            <LoadingSpinner size="lg" />
            <p className="mt-4">Initializing video session...</p>
          </div>
        )}

        {stage === 'waiting' && (
          <div className="card space-y-4">
            <h2 className="font-semibold">Ready to Start</h2>
            <button
              onClick={handle_send_sms}
              disabled={is_loading || sms_sent}
              className={`btn-primary w-full ${sms_sent ? 'bg-green-600' : ''}`}
            >
              {sms_sent ? 'SMS Sent!' : 'Send SMS Invite'}
            </button>
            <button onClick={handle_join} className="btn-primary w-full bg-green-600">
              Join Video Session
            </button>
          </div>
        )}

        {stage === 'active' && (
          <div className="card">
            <h2 className="font-semibold mb-4">Session Active</h2>
            <div className="flex space-x-4">
              <button onClick={handle_join} className="btn-primary flex-1">
                Open Session
              </button>
              <button onClick={handle_end} className="btn-secondary text-red-600 border-red-300">
                End Session
              </button>
            </div>
          </div>
        )}

        {stage === 'ended' && (
          <div className="card text-center py-12">
            <span className="text-4xl">&#10003;</span>
            <h2 className="text-xl font-semibold mt-4">Session Complete</h2>
            <button onClick={() => navigate('/helper/dashboard')} className="btn-primary mt-6">
              Return to Dashboard
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
```

### Task 5.7: Update Routes

Update `src/App.tsx`:

```typescript
import { HelperSession } from './pages/helper/HelperSession';

// Update route:
<Route
  path="session/:session_id"
  element={
    <ProtectedRoute allowed_role="helper">
      <HelperSession />
    </ProtectedRoute>
  }
/>
```

---

## Verification Tests

### Test 1: Safety Checklist

1. Helper starts session
2. Safety checklist modal appears

**Expected:** All items must be checked before proceeding

### Test 2: Zoho Session Creation

1. Complete safety checklist

**Expected:** Zoho session created, URLs stored in Firestore

### Test 3: SMS Invite

1. Click "Send SMS Invite"

**Expected:** Customer receives SMS with join link

### Test 4: Join Session

1. Click "Join Video Session"

**Expected:** Zoho Lens opens in new tab

### Test 5: Customer Joins

1. Customer clicks SMS link

**Expected:** Zoho Lens customer view opens in browser

### Test 6: AR Annotation

1. Helper uses drawing tools

**Expected:** Annotations visible on customer's view, lock to objects

### Test 7: End Session

1. Click "End Session"

**Expected:** Session status changes, request marked completed

---

## Deliverables Checklist

- [ ] Zoho Lens service with token refresh
- [ ] SMS service with Twilio
- [ ] Cloud functions deployed
- [ ] Frontend hook for Zoho calls
- [ ] Safety checklist component
- [ ] Helper session page with all stages
- [ ] Routes updated

---

## Next Phase

Proceed to **Phase 6: Payment Integration** for Stripe pre-authorization and capture.
