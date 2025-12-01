import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import twilio from 'twilio';
import { app_config } from './config';

const db = admin.firestore();

function get_twilio_client() {
  if (!app_config.twilio.account_sid || !app_config.twilio.auth_token) {
    return null;
  }
  return twilio(app_config.twilio.account_sid, app_config.twilio.auth_token);
}

export const on_request_created = functions.firestore
  .document('requests/{request_id}')
  .onCreate(async (snapshot, context) => {
    const request_data = snapshot.data();
    const request_id = context.params.request_id;

    const helpers_query = await db
      .collection('users')
      .where('role', '==', 'helper')
      .where('is_available', '==', true)
      .get();

    const batch = db.batch();

    helpers_query.docs.forEach((helper_doc) => {
      const notification_ref = db.collection('notifications').doc();
      batch.set(notification_ref, {
        user_id: helper_doc.id,
        type: 'new_request',
        request_id,
        category: request_data.category,
        description: request_data.description,
        amount: request_data.amount,
        read: false,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    await batch.commit();

    console.log(`Created notifications for ${helpers_query.size} helpers`);
  });

export const on_request_claimed = functions.firestore
  .document('requests/{request_id}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const request_id = context.params.request_id;

    if (before.status !== 'claimed' && after.status === 'claimed') {
      await db.collection('notifications').add({
        user_id: after.customer_id,
        type: 'request_claimed',
        request_id,
        helper_name: after.helper_name,
        message: `Your request has been claimed by ${after.helper_name}`,
        read: false,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      });

      const customer_doc = await db.collection('users').doc(after.customer_id).get();
      const customer_data = customer_doc.data();

      if (customer_data?.phone) {
        const twilio_client = get_twilio_client();

        if (twilio_client) {
          try {
            await twilio_client.messages.create({
              body: `Good news! ${after.helper_name} has claimed your help request. Please complete payment to start your session: ${app_config.app.base_url}/customer/payment/${request_id}`,
              from: app_config.twilio.phone_number,
              to: customer_data.phone,
            });
          } catch (error) {
            console.error('Error sending SMS:', error);
          }
        }
      }
    }

    if (before.status !== 'in_session' && after.status === 'in_session') {
      await db.collection('notifications').add({
        user_id: after.customer_id,
        type: 'session_ready',
        request_id,
        session_id: after.session_id,
        message: 'Your session is ready! Click to join.',
        read: false,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      });

      const customer_doc = await db.collection('users').doc(after.customer_id).get();
      const customer_data = customer_doc.data();

      if (customer_data?.phone) {
        const twilio_client = get_twilio_client();

        if (twilio_client) {
          try {
            await twilio_client.messages.create({
              body: `Your HomePro session is ready! Join now: ${app_config.app.base_url}/customer/session/${after.session_id}`,
              from: app_config.twilio.phone_number,
              to: customer_data.phone,
            });
          } catch (error) {
            console.error('Error sending SMS:', error);
          }
        }
      }
    }

    if (before.status !== 'completed' && after.status === 'completed') {
      await db.collection('notifications').add({
        user_id: after.customer_id,
        type: 'session_completed',
        request_id,
        outcome: after.outcome,
        message: 'Your session has been completed. Thank you for using HomePro!',
        read: false,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      });

      await db.collection('notifications').add({
        user_id: after.helper_id,
        type: 'session_completed',
        request_id,
        outcome: after.outcome,
        amount: after.amount,
        message: `Session completed. You earned $${(after.amount / 100).toFixed(2)}`,
        read: false,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  });

export const send_session_invite = functions.https.onCall(
  async (data: { session_id: string; phone: string }, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { session_id, phone } = data;

    if (!session_id || !phone) {
      throw new functions.https.HttpsError('invalid-argument', 'Session ID and phone are required');
    }

    const session_doc = await db.collection('sessions').doc(session_id).get();

    if (!session_doc.exists) {
      throw new functions.https.HttpsError('not-found', 'Session not found');
    }

    const session_data = session_doc.data()!;

    if (session_data.helper_id !== context.auth.uid) {
      throw new functions.https.HttpsError('permission-denied', 'Only the helper can send invites');
    }

    const twilio_client = get_twilio_client();

    if (!twilio_client) {
      throw new functions.https.HttpsError('failed-precondition', 'SMS service not configured');
    }

    try {
      await twilio_client.messages.create({
        body: `Join your HomePro help session: ${app_config.app.base_url}/customer/session/${session_id}`,
        from: app_config.twilio.phone_number,
        to: phone,
      });

      return { success: true };
    } catch (error) {
      console.error('Error sending SMS:', error);
      throw new functions.https.HttpsError('internal', 'Failed to send SMS');
    }
  }
);
