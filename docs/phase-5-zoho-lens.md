# Phase 5: Zoho Lens Integration

## Purpose

Integrate Zoho Lens API to enable real-time video sessions with AR annotation capabilities between Helpers and Customers. This is the core feature that differentiates HomePro Assist from a simple video call - Helpers can draw annotations that "stick" to physical objects in the Customer's camera view.

---

## ⚠️ IMPORTANT: API Verification Required

**The Zoho Lens API code in this phase is based on documented patterns but MUST be verified against the actual API before implementation.**

Before coding, complete these verification steps:

1. **Create Zoho Lens Account**: Sign up at https://www.zoho.com/lens/
2. **Review Official API Docs**: https://www.zoho.com/lens/resources/api/introduction.html
3. **Generate OAuth Credentials**:
   - Create a "Server-based Application" in Zoho API Console
   - Get Client ID and Client Secret
   - Generate Refresh Token with appropriate scopes
4. **Test in Sandbox**: Manually test these API calls before integrating:
   - Token refresh
   - Session creation
   - SMS invite sending
   - Session termination
5. **Confirm Response Formats**: The actual response field names may differ from this spec

**Recommended**: Create a standalone test script to validate the API before full integration.

---

## Why We Need This Phase

1. **Core Value Proposition** - AR-guided assistance is the main product feature
2. **Spatial Annotation** - Drawings lock to physical objects, not just screen overlay
3. **No App Download** - Customer joins via SMS link in mobile browser
4. **Professional Tools** - Helper has desktop console with annotation toolbar
5. **Low Latency** - Real-time video essential for effective guidance

---

## Benefits

- Seamless video sessions without app installation
- AR annotations help customers locate exact components
- SMS-based joining reduces friction
- Built-in session management via Zoho Lens
- Reliable infrastructure (not building WebRTC from scratch)

---

## Prerequisites

- Phase 4 completed (Helpers can claim requests and start sessions)
- Zoho Lens account created:
  1. Sign up at https://www.zoho.com/lens/
  2. Get API credentials (Client ID, Client Secret)
  3. Generate OAuth refresh token
  4. Note your Organization ID
- Twilio account for SMS (optional - can use Zoho's built-in SMS initially)
- Firebase Cloud Functions set up

---

## Zoho Lens API Overview

### Authentication
Zoho Lens uses OAuth 2.0. You need:
- Client ID
- Client Secret
- Refresh Token (generated once, used to get access tokens)

### Key API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/sessions` | POST | Create a new AR session |
| `/api/v1/sessions/{id}` | GET | Get session details |
| `/api/v1/sessions/{id}/invite` | POST | Send SMS/email invite to customer |
| `/api/v1/sessions/{id}` | DELETE | End a session |

### Session Flow
1. Helper clicks "Start Session" → Create Zoho session via API
2. API returns session URL for Helper console
3. Send SMS invite to Customer with join link
4. Customer clicks link → joins in mobile browser
5. Helper annotates on Customer's live video feed
6. Either party ends the session

---

## Implementation Tasks

### Task 5.1: Set Up Firebase Cloud Functions

Initialize Cloud Functions if not already done:

```bash
cd /home/markly2/claude_code/diyyid_website
firebase init functions
```

Choose:
- TypeScript
- ESLint: Yes
- Install dependencies: Yes

### Task 5.2: Create Zoho Lens Service (Cloud Functions)

Create `functions/src/zohoLens.ts`:

```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import axios from 'axios';

// Initialize admin if not already
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Zoho API configuration
const ZOHO_ACCOUNTS_URL = 'https://accounts.zoho.com';
const ZOHO_LENS_API_URL = 'https://lens.zoho.com/api/v1';

interface ZohoTokens {
  accessToken: string;
  expiresAt: number;
}

let cachedTokens: ZohoTokens | null = null;

/**
 * Get a valid access token, refreshing if necessary
 */
async function getAccessToken(): Promise<string> {
  const now = Date.now();

  // Return cached token if still valid (with 5 min buffer)
  if (cachedTokens && cachedTokens.expiresAt > now + 300000) {
    return cachedTokens.accessToken;
  }

  const clientId = functions.config().zoho.client_id;
  const clientSecret = functions.config().zoho.client_secret;
  const refreshToken = functions.config().zoho.refresh_token;

  try {
    const response = await axios.post(
      `${ZOHO_ACCOUNTS_URL}/oauth/v2/token`,
      null,
      {
        params: {
          refresh_token: refreshToken,
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'refresh_token',
        },
      }
    );

    cachedTokens = {
      accessToken: response.data.access_token,
      expiresAt: now + (response.data.expires_in * 1000),
    };

    return cachedTokens.accessToken;
  } catch (error: any) {
    console.error('Error refreshing Zoho token:', error.response?.data || error);
    throw new functions.https.HttpsError('internal', 'Failed to authenticate with Zoho');
  }
}

/**
 * Create a new Zoho Lens session
 */
export const createZohoSession = functions.https.onCall(async (data, context) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  }

  const { sessionId, customerPhone, customerName, requestDescription } = data;

  if (!sessionId) {
    throw new functions.https.HttpsError('invalid-argument', 'Session ID required');
  }

  try {
    const accessToken = await getAccessToken();
    const orgId = functions.config().zoho.org_id;

    // Create session in Zoho Lens
    const response = await axios.post(
      `${ZOHO_LENS_API_URL}/sessions`,
      {
        session_name: `HomePro Session - ${customerName || 'Customer'}`,
        description: requestDescription || 'Home repair assistance session',
        customer_name: customerName || 'Customer',
        customer_phone: customerPhone,
      },
      {
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`,
          'orgId': orgId,
          'Content-Type': 'application/json',
        },
      }
    );

    const zohoSession = response.data;

    // Update our session document with Zoho details
    await db.collection('sessions').doc(sessionId).update({
      zohoSessionId: zohoSession.session_id,
      zohoTechnicianUrl: zohoSession.technician_url,
      zohoCustomerUrl: zohoSession.customer_url,
      status: 'waiting',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      technicianUrl: zohoSession.technician_url,
      customerUrl: zohoSession.customer_url,
      zohoSessionId: zohoSession.session_id,
    };
  } catch (error: any) {
    console.error('Error creating Zoho session:', error.response?.data || error);
    throw new functions.https.HttpsError(
      'internal',
      'Failed to create video session'
    );
  }
});

/**
 * Send SMS invite to customer
 */
export const sendSessionInvite = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  }

  const { sessionId, zohoSessionId, customerPhone } = data;

  if (!zohoSessionId || !customerPhone) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Session ID and customer phone required'
    );
  }

  try {
    const accessToken = await getAccessToken();
    const orgId = functions.config().zoho.org_id;

    // Use Zoho Lens built-in SMS invite
    await axios.post(
      `${ZOHO_LENS_API_URL}/sessions/${zohoSessionId}/invite`,
      {
        invite_type: 'sms',
        phone_number: customerPhone,
        message: 'Your HomePro Assist session is ready! Click the link to connect with your expert.',
      },
      {
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`,
          'orgId': orgId,
          'Content-Type': 'application/json',
        },
      }
    );

    // Update session status
    await db.collection('sessions').doc(sessionId).update({
      smsInviteSent: true,
      smsInviteSentAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true };
  } catch (error: any) {
    console.error('Error sending SMS invite:', error.response?.data || error);
    throw new functions.https.HttpsError('internal', 'Failed to send SMS invite');
  }
});

/**
 * End a Zoho Lens session
 */
export const endZohoSession = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  }

  const { sessionId, zohoSessionId, outcome, notes, duration } = data;

  try {
    const accessToken = await getAccessToken();
    const orgId = functions.config().zoho.org_id;

    // End session in Zoho Lens
    await axios.delete(
      `${ZOHO_LENS_API_URL}/sessions/${zohoSessionId}`,
      {
        headers: {
          'Authorization': `Zoho-oauthtoken ${accessToken}`,
          'orgId': orgId,
        },
      }
    );

    // Update our session document
    await db.collection('sessions').doc(sessionId).update({
      status: 'ended',
      outcome: outcome || 'resolved',
      notes: notes || '',
      duration: duration || 0,
      endedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Update the associated request
    const sessionDoc = await db.collection('sessions').doc(sessionId).get();
    const sessionData = sessionDoc.data();

    if (sessionData?.requestId) {
      await db.collection('requests').doc(sessionData.requestId).update({
        status: 'completed',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error ending Zoho session:', error.response?.data || error);
    throw new functions.https.HttpsError('internal', 'Failed to end session');
  }
});
```

### Task 5.3: Update Cloud Functions Index

Update `functions/src/index.ts`:

```typescript
import * as admin from 'firebase-admin';

admin.initializeApp();

// Export Zoho Lens functions
export { createZohoSession, sendSessionInvite, endZohoSession } from './zohoLens';
```

### Task 5.4: Install Cloud Functions Dependencies

Update `functions/package.json`:

```json
{
  "name": "functions",
  "scripts": {
    "build": "tsc",
    "serve": "npm run build && firebase emulators:start --only functions",
    "shell": "npm run build && firebase functions:shell",
    "start": "npm run shell",
    "deploy": "firebase deploy --only functions",
    "logs": "firebase functions:log"
  },
  "engines": {
    "node": "18"
  },
  "main": "lib/index.js",
  "dependencies": {
    "firebase-admin": "^11.11.0",
    "firebase-functions": "^4.5.0",
    "axios": "^1.6.0"
  },
  "devDependencies": {
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0",
    "eslint": "^8.0.0",
    "typescript": "^5.0.0"
  }
}
```

Run:
```bash
cd functions && npm install
```

### Task 5.5: Set Zoho Configuration

Set the Zoho configuration using Firebase CLI:

```bash
firebase functions:config:set \
  zoho.client_id="YOUR_CLIENT_ID" \
  zoho.client_secret="YOUR_CLIENT_SECRET" \
  zoho.refresh_token="YOUR_REFRESH_TOKEN" \
  zoho.org_id="YOUR_ORG_ID"
```

### Task 5.6: Create Safety Checklist Component

Create `src/components/helper/SafetyChecklist.tsx`:

```typescript
import { useState } from 'react';

interface SafetyChecklistProps {
  onComplete: () => void;
}

const SAFETY_ITEMS = [
  'Customer has turned off relevant power/water supply',
  'Work area is clear of hazards',
  'Customer has appropriate safety equipment if needed',
  'I understand the scope of remote guidance limitations',
];

export function SafetyChecklist({ onComplete }: SafetyChecklistProps) {
  const [checkedItems, setCheckedItems] = useState<boolean[]>(
    new Array(SAFETY_ITEMS.length).fill(false)
  );

  const allChecked = checkedItems.every(Boolean);

  const toggleItem = (index: number) => {
    setCheckedItems(prev => {
      const newItems = [...prev];
      newItems[index] = !newItems[index];
      return newItems;
    });
  };

  return (
    <div className="card bg-yellow-50 border-yellow-200">
      <h2 className="text-lg font-semibold text-yellow-800 mb-4">
        ⚠️ Safety Checklist
      </h2>
      <p className="text-sm text-yellow-700 mb-4">
        Before starting the session, confirm the following with the customer:
      </p>

      <div className="space-y-3 mb-6">
        {SAFETY_ITEMS.map((item, index) => (
          <label
            key={index}
            className="flex items-start space-x-3 cursor-pointer"
          >
            <input
              type="checkbox"
              checked={checkedItems[index]}
              onChange={() => toggleItem(index)}
              className="mt-1 h-4 w-4 rounded border-yellow-400 text-yellow-600 focus:ring-yellow-500"
            />
            <span className="text-sm text-yellow-800">{item}</span>
          </label>
        ))}
      </div>

      <button
        onClick={onComplete}
        disabled={!allChecked}
        className={`w-full py-3 rounded-lg font-medium transition-colors ${
          allChecked
            ? 'bg-yellow-600 text-white hover:bg-yellow-700'
            : 'bg-yellow-100 text-yellow-400 cursor-not-allowed'
        }`}
      >
        {allChecked ? 'Continue to Session' : 'Complete all items to continue'}
      </button>
    </div>
  );
}
```

### Task 5.7: Create Helper Session Page

Create `src/pages/helper/Session.tsx`:

```typescript
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../services/firebase';
import { useAuth } from '../../hooks/useAuth';
import { Header } from '../../components/common/Header';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { SafetyChecklist } from '../../components/helper/SafetyChecklist';
import { Session, Request } from '../../types';

type SessionStep = 'loading' | 'safety' | 'creating' | 'waiting' | 'active' | 'ending' | 'ended';

export function HelperSession() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [session, setSession] = useState<Session | null>(null);
  const [request, setRequest] = useState<Request | null>(null);
  const [step, setStep] = useState<SessionStep>('loading');
  const [error, setError] = useState<string | null>(null);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);

  // Subscribe to session updates
  useEffect(() => {
    if (!sessionId) return;

    const unsubscribe = onSnapshot(
      doc(db, 'sessions', sessionId),
      async (docSnapshot) => {
        if (docSnapshot.exists()) {
          const sessionData = { id: docSnapshot.id, ...docSnapshot.data() } as Session;
          setSession(sessionData);

          // Determine current step
          if (!sessionData.safetyChecklistCompleted) {
            setStep('safety');
          } else if (sessionData.status === 'created') {
            setStep('creating');
          } else if (sessionData.status === 'waiting') {
            setStep('waiting');
          } else if (sessionData.status === 'active') {
            setStep('active');
            if (!sessionStartTime) {
              setSessionStartTime(new Date());
            }
          } else if (sessionData.status === 'ended') {
            setStep('ended');
          }

          // Fetch associated request using proper Firestore pattern
          if (sessionData.requestId && !request) {
            try {
              const requestDocRef = doc(db, 'requests', sessionData.requestId);
              const requestDoc = await getDoc(requestDocRef);
              if (requestDoc.exists()) {
                setRequest({ id: requestDoc.id, ...requestDoc.data() } as Request);
              }
            } catch (err) {
              console.error('Error fetching request:', err);
            }
          }
        }
      },
      (err) => {
        console.error('Error fetching session:', err);
        setError('Failed to load session');
      }
    );

    return () => unsubscribe();
  }, [sessionId, request]);

  const handleSafetyComplete = async () => {
    if (!sessionId) return;

    try {
      await updateDoc(doc(db, 'sessions', sessionId), {
        safetyChecklistCompleted: true,
        updatedAt: serverTimestamp(),
      });

      // Create Zoho session
      setStep('creating');
      const createSession = httpsCallable(functions, 'createZohoSession');
      const result = await createSession({
        sessionId,
        customerPhone: request?.customerPhone,
        customerName: 'Customer',
        requestDescription: request?.description,
      });

      console.log('Zoho session created:', result.data);
    } catch (err: any) {
      console.error('Error:', err);
      setError(err.message || 'Failed to create session');
      setStep('safety');
    }
  };

  const handleSendSMS = async () => {
    if (!session?.zohoSessionId || !request?.customerPhone) return;

    try {
      const sendInvite = httpsCallable(functions, 'sendSessionInvite');
      await sendInvite({
        sessionId,
        zohoSessionId: session.zohoSessionId,
        customerPhone: request.customerPhone,
      });

      // Update request status
      if (request?.id) {
        await updateDoc(doc(db, 'requests', request.id), {
          status: 'in_session',
          updatedAt: serverTimestamp(),
        });
      }
    } catch (err: any) {
      console.error('Error sending SMS:', err);
      setError('Failed to send SMS invite');
    }
  };

  const handleEndSession = async (outcome: 'resolved' | 'unresolved' | 'escalated') => {
    if (!session?.zohoSessionId) return;

    setStep('ending');

    try {
      const duration = sessionStartTime
        ? Math.floor((Date.now() - sessionStartTime.getTime()) / 1000)
        : 0;

      const endSession = httpsCallable(functions, 'endZohoSession');
      await endSession({
        sessionId,
        zohoSessionId: session.zohoSessionId,
        outcome,
        duration,
        notes: '',
      });

      setStep('ended');
    } catch (err: any) {
      console.error('Error ending session:', err);
      setError('Failed to end session');
      setStep('active');
    }
  };

  if (step === 'loading') {
    return (
      <div className="min-h-screen bg-gray-900">
        <Header />
        <div className="flex items-center justify-center min-h-[60vh]">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <Header />

      <main className="max-w-6xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-4 p-4 bg-red-900 border border-red-700 rounded-lg text-red-200">
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-4 text-red-400 hover:text-red-300"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Safety Checklist Step */}
        {step === 'safety' && (
          <div className="max-w-xl mx-auto">
            <SafetyChecklist onComplete={handleSafetyComplete} />

            {/* Request Info */}
            {request && (
              <div className="card mt-6">
                <h3 className="font-medium text-gray-900 mb-2">Request Details</h3>
                <p className="text-sm text-gray-600 capitalize mb-1">
                  Category: {request.category}
                </p>
                <p className="text-sm text-gray-600">{request.description}</p>
                {request.photoUrls.length > 0 && (
                  <div className="grid grid-cols-4 gap-2 mt-3">
                    {request.photoUrls.map((url, i) => (
                      <img
                        key={i}
                        src={url}
                        alt={`Photo ${i + 1}`}
                        className="w-full aspect-square object-cover rounded"
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Creating Session Step */}
        {step === 'creating' && (
          <div className="max-w-xl mx-auto text-center">
            <div className="card">
              <LoadingSpinner size="lg" className="mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900">
                Setting up video session...
              </h2>
              <p className="text-gray-600 mt-2">
                This may take a few seconds
              </p>
            </div>
          </div>
        )}

        {/* Waiting for Customer Step */}
        {step === 'waiting' && session && (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Main Panel */}
            <div className="lg:col-span-2">
              <div className="card bg-gray-800 border-gray-700">
                <h2 className="text-xl font-semibold text-white mb-4">
                  Ready to Connect
                </h2>

                {/* Zoho Lens Embed or Link */}
                {session.zohoTechnicianUrl ? (
                  <div className="aspect-video bg-gray-900 rounded-lg flex items-center justify-center mb-4">
                    <div className="text-center">
                      <p className="text-gray-400 mb-4">
                        Click below to open the video console
                      </p>
                      <a
                        href={session.zohoTechnicianUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-primary inline-block"
                      >
                        Open Video Console
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="aspect-video bg-gray-900 rounded-lg flex items-center justify-center mb-4">
                    <LoadingSpinner size="lg" />
                  </div>
                )}

                {/* Send SMS Button */}
                {!session.smsInviteSent && (
                  <button
                    onClick={handleSendSMS}
                    className="btn-primary w-full py-3"
                  >
                    Send SMS Invite to Customer
                  </button>
                )}

                {session.smsInviteSent && (
                  <div className="text-center text-green-400 py-4">
                    ✓ SMS invite sent to {request?.customerPhone}
                  </div>
                )}
              </div>
            </div>

            {/* Side Panel */}
            <div className="space-y-4">
              <div className="card">
                <h3 className="font-medium text-gray-900 mb-2">Session Status</h3>
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></span>
                  <span className="text-gray-600">Waiting for customer...</span>
                </div>
              </div>

              <div className="card">
                <h3 className="font-medium text-gray-900 mb-2">Instructions</h3>
                <ol className="text-sm text-gray-600 space-y-2">
                  <li>1. Click "Open Video Console" above</li>
                  <li>2. Send SMS invite to customer</li>
                  <li>3. Wait for customer to join</li>
                  <li>4. Guide using AR annotations</li>
                </ol>
              </div>
            </div>
          </div>
        )}

        {/* Active Session Step */}
        {step === 'active' && session && (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <div className="card bg-gray-800 border-gray-700">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-white">
                    Session Active
                  </h2>
                  <span className="flex items-center text-green-400">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-2"></span>
                    Live
                  </span>
                </div>

                {session.zohoTechnicianUrl && (
                  <a
                    href={session.zohoTechnicianUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary block text-center mb-4"
                  >
                    Open Video Console (New Tab)
                  </a>
                )}

                <div className="flex space-x-4">
                  <button
                    onClick={() => handleEndSession('resolved')}
                    className="flex-1 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    ✓ Issue Resolved
                  </button>
                  <button
                    onClick={() => handleEndSession('unresolved')}
                    className="flex-1 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                  >
                    Could Not Resolve
                  </button>
                </div>
              </div>
            </div>

            <div className="card">
              <h3 className="font-medium text-gray-900 mb-2">Quick Tips</h3>
              <ul className="text-sm text-gray-600 space-y-2">
                <li>• Use arrows to point to specific parts</li>
                <li>• Circle important areas</li>
                <li>• Draw step numbers if needed</li>
                <li>• Use text chat for part numbers</li>
              </ul>
            </div>
          </div>
        )}

        {/* Ending Session Step */}
        {step === 'ending' && (
          <div className="max-w-xl mx-auto text-center">
            <div className="card">
              <LoadingSpinner size="lg" className="mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900">
                Ending session...
              </h2>
            </div>
          </div>
        )}

        {/* Session Ended Step */}
        {step === 'ended' && (
          <div className="max-w-xl mx-auto text-center">
            <div className="card">
              <div className="text-4xl mb-4">✅</div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Session Completed
              </h2>
              <p className="text-gray-600 mb-6">
                Great work! The session has been recorded.
              </p>
              <button
                onClick={() => navigate('/helper/dashboard')}
                className="btn-primary"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
```

### Task 5.8: Update Firebase Service to Include Functions

Update `src/services/firebase.ts`:

```typescript
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

export default app;
```

### Task 5.9: Create Customer Session Page

Create `src/pages/customer/Session.tsx`:

```typescript
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { Header } from '../../components/common/Header';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { Session } from '../../types';

export function CustomerSession() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) return;

    const unsubscribe = onSnapshot(
      doc(db, 'sessions', sessionId),
      (doc) => {
        if (doc.exists()) {
          setSession({ id: doc.id, ...doc.data() } as Session);
        }
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [sessionId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center min-h-[60vh]">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-md mx-auto px-4 py-8 text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-2">Session Not Found</h1>
          <p className="text-gray-600 mb-4">This session may have ended or doesn't exist.</p>
          <button
            onClick={() => navigate('/customer/request')}
            className="btn-primary"
          >
            Submit New Request
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-2xl mx-auto px-4 py-8">
        {session.status === 'waiting' && (
          <div className="card text-center">
            <div className="animate-pulse text-4xl mb-4">📱</div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">
              Check Your Phone
            </h1>
            <p className="text-gray-600 mb-4">
              You should receive an SMS with a link to join the video session.
              Click the link to connect with your expert.
            </p>
            {session.zohoCustomerUrl && (
              <a
                href={session.zohoCustomerUrl}
                className="btn-primary inline-block"
              >
                Join Session Now
              </a>
            )}
          </div>
        )}

        {session.status === 'active' && (
          <div className="card text-center">
            <div className="text-4xl mb-4">🎥</div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">
              Session In Progress
            </h1>
            <p className="text-gray-600 mb-4">
              Your video session is active. If you closed the video window,
              click below to rejoin.
            </p>
            {session.zohoCustomerUrl && (
              <a
                href={session.zohoCustomerUrl}
                className="btn-primary inline-block"
              >
                Rejoin Session
              </a>
            )}
          </div>
        )}

        {session.status === 'ended' && (
          <div className="card text-center">
            <div className="text-4xl mb-4">✅</div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">
              Session Completed
            </h1>
            <p className="text-gray-600 mb-4">
              Thank you for using HomePro Assist!
            </p>
            <button
              onClick={() => navigate('/customer/request')}
              className="btn-primary"
            >
              Submit Another Request
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
```

### Task 5.10: Update App Routes

Update `src/App.tsx` to include the session pages:

```typescript
// Add imports
import { HelperSession } from './pages/helper/Session';
import { CustomerSession } from './pages/customer/Session';

// Update routes...
```

### Task 5.11: Deploy Cloud Functions

```bash
cd functions
npm run build
firebase deploy --only functions
```

---

## Verification Tests

### Test 1: Cloud Functions Deploy

```bash
firebase deploy --only functions
```

**Expected:** Functions deploy successfully

### Test 2: Safety Checklist

1. Sign in as Helper
2. Claim a request
3. Click "Start Session"

**Expected:** Safety checklist page appears with 4 items

### Test 3: Complete Safety Checklist

1. Check all safety items
2. Click "Continue to Session"

**Expected:** "Setting up video session..." appears

### Test 4: Zoho Session Creation

1. Complete safety checklist

**Expected:**
- Session document updated with `zohoSessionId`, `zohoTechnicianUrl`, `zohoCustomerUrl`
- "Ready to Connect" page appears with "Open Video Console" button

### Test 5: Open Video Console

1. Click "Open Video Console"

**Expected:** Zoho Lens technician console opens in new tab

### Test 6: Send SMS Invite

1. Click "Send SMS Invite to Customer"

**Expected:**
- Button changes to "✓ SMS invite sent"
- Customer receives SMS with join link

### Test 7: Customer Joins

1. Customer clicks SMS link

**Expected:** Customer joins Zoho Lens session in mobile browser

### Test 8: End Session

1. Click "Issue Resolved" button

**Expected:**
- Session status changes to "ended"
- Request status changes to "completed"
- Success screen appears

### Test 9: Customer Session Page

1. Navigate to `/customer/session/{sessionId}`

**Expected:** Shows appropriate status and join link if available

---

## Deliverables Checklist

- [ ] Cloud Functions set up and deployed
- [ ] Zoho Lens API integration working
- [ ] Safety checklist component created
- [ ] Helper session page with all steps
- [ ] Customer session page
- [ ] SMS invite functionality
- [ ] Session creation in Zoho Lens
- [ ] Session ending and cleanup
- [ ] Error handling throughout

---

## Troubleshooting

### Zoho API Errors
- Verify OAuth credentials are correct
- Check refresh token hasn't expired
- Ensure org_id is correct

### SMS Not Sending
- Verify phone number format (include country code)
- Check Zoho Lens SMS credits
- Consider using Twilio as backup

### Video Console Not Opening
- Check popup blockers
- Verify URL is being returned from API
- Check browser console for errors

---

## Next Phase

Once all tests pass, proceed to **Phase 6: Payment Integration** to implement Stripe pre-authorization and payment capture.
