import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import axios from 'axios';
import { app_config } from './config';

const db = admin.firestore();

interface ZohoTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface ZohoSessionResponse {
  session_id: string;
  session_url: string;
  technician_url: string;
  customer_url: string;
}

async function get_access_token(): Promise<string> {
  const token_doc = await db.collection('system').doc('zoho_token').get();
  const token_data = token_doc.data();

  if (token_data && token_data.expires_at > Date.now()) {
    return token_data.access_token;
  }

  const response = await axios.post<ZohoTokenResponse>(
    'https://accounts.zoho.com/oauth/v2/token',
    null,
    {
      params: {
        refresh_token: app_config.zoho.refresh_token,
        client_id: app_config.zoho.client_id,
        client_secret: app_config.zoho.client_secret,
        grant_type: 'refresh_token',
      },
    }
  );

  const { access_token, expires_in } = response.data;

  await db.collection('system').doc('zoho_token').set({
    access_token,
    expires_at: Date.now() + (expires_in - 300) * 1000,
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
  });

  return access_token;
}

export const create_zoho_session = functions.https.onCall(
  async (data: { request_id: string }, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { request_id } = data;

    if (!request_id) {
      throw new functions.https.HttpsError('invalid-argument', 'Request ID is required');
    }

    const request_doc = await db.collection('requests').doc(request_id).get();

    if (!request_doc.exists) {
      throw new functions.https.HttpsError('not-found', 'Request not found');
    }

    const request_data = request_doc.data()!;

    if (request_data.helper_id !== context.auth.uid) {
      throw new functions.https.HttpsError('permission-denied', 'Only the assigned helper can create a session');
    }

    try {
      const access_token = await get_access_token();

      const response = await axios.post<ZohoSessionResponse>(
        `https://lens.zoho.com/api/v1/organizations/${app_config.zoho.org_id}/sessions`,
        {
          title: `Help Request: ${request_data.category}`,
          customer_name: request_data.customer_name,
          description: request_data.description,
        },
        {
          headers: {
            Authorization: `Bearer ${access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const session_data = response.data;

      await db.collection('requests').doc(request_id).update({
        zoho_session_id: session_data.session_id,
        zoho_technician_url: session_data.technician_url,
        zoho_customer_url: session_data.customer_url,
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        session_id: session_data.session_id,
        session_url: session_data.customer_url,
        technician_url: session_data.technician_url,
      };
    } catch (error) {
      console.error('Error creating Zoho session:', error);
      throw new functions.https.HttpsError('internal', 'Failed to create Zoho Lens session');
    }
  }
);

export const end_zoho_session = functions.https.onCall(
  async (data: { session_id: string }, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { session_id } = data;

    if (!session_id) {
      throw new functions.https.HttpsError('invalid-argument', 'Session ID is required');
    }

    const session_doc = await db.collection('sessions').doc(session_id).get();

    if (!session_doc.exists) {
      throw new functions.https.HttpsError('not-found', 'Session not found');
    }

    const session_data = session_doc.data()!;

    if (session_data.helper_id !== context.auth.uid && session_data.customer_id !== context.auth.uid) {
      throw new functions.https.HttpsError('permission-denied', 'Only session participants can end the session');
    }

    try {
      if (session_data.zoho_session_id) {
        const access_token = await get_access_token();

        await axios.post(
          `https://lens.zoho.com/api/v1/organizations/${app_config.zoho.org_id}/sessions/${session_data.zoho_session_id}/end`,
          {},
          {
            headers: {
              Authorization: `Bearer ${access_token}`,
            },
          }
        );
      }

      return { success: true };
    } catch (error) {
      console.error('Error ending Zoho session:', error);
      return { success: true };
    }
  }
);
