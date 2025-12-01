import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';
import { app_config } from './config';

const db = admin.firestore();
const stripe = new Stripe(app_config.stripe.secret_key, {
  apiVersion: '2023-10-16',
});

export const create_payment_intent = functions.https.onCall(
  async (data: { request_id: string; amount: number; payment_method_id: string }, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { request_id, amount, payment_method_id } = data;

    if (!request_id || !amount || !payment_method_id) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing required parameters');
    }

    const request_doc = await db.collection('requests').doc(request_id).get();

    if (!request_doc.exists) {
      throw new functions.https.HttpsError('not-found', 'Request not found');
    }

    const request_data = request_doc.data()!;

    if (request_data.customer_id !== context.auth.uid) {
      throw new functions.https.HttpsError('permission-denied', 'Only the customer can pay for this request');
    }

    try {
      const payment_intent = await stripe.paymentIntents.create({
        amount,
        currency: 'usd',
        payment_method: payment_method_id,
        capture_method: 'manual',
        metadata: {
          request_id,
          customer_id: context.auth.uid,
          helper_id: request_data.helper_id || '',
        },
      });

      await db.collection('payments').add({
        request_id,
        customer_id: context.auth.uid,
        helper_id: request_data.helper_id,
        payment_intent_id: payment_intent.id,
        amount,
        status: 'authorized',
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      });

      await db.collection('requests').doc(request_id).update({
        payment_intent_id: payment_intent.id,
        payment_status: 'authorized',
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        client_secret: payment_intent.client_secret,
        payment_intent_id: payment_intent.id,
      };
    } catch (error) {
      console.error('Error creating payment intent:', error);
      throw new functions.https.HttpsError('internal', 'Failed to create payment intent');
    }
  }
);

export const capture_payment = functions.https.onCall(
  async (data: { request_id: string }, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { request_id } = data;

    const request_doc = await db.collection('requests').doc(request_id).get();

    if (!request_doc.exists) {
      throw new functions.https.HttpsError('not-found', 'Request not found');
    }

    const request_data = request_doc.data()!;

    if (request_data.helper_id !== context.auth.uid) {
      throw new functions.https.HttpsError('permission-denied', 'Only the helper can capture payment');
    }

    if (!request_data.payment_intent_id) {
      throw new functions.https.HttpsError('failed-precondition', 'No payment intent found');
    }

    try {
      await stripe.paymentIntents.capture(request_data.payment_intent_id);

      const payments_query = await db
        .collection('payments')
        .where('payment_intent_id', '==', request_data.payment_intent_id)
        .limit(1)
        .get();

      if (!payments_query.empty) {
        await payments_query.docs[0].ref.update({
          status: 'captured',
          captured_at: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      await db.collection('requests').doc(request_id).update({
        payment_status: 'captured',
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { success: true };
    } catch (error) {
      console.error('Error capturing payment:', error);
      throw new functions.https.HttpsError('internal', 'Failed to capture payment');
    }
  }
);

export const cancel_payment = functions.https.onCall(
  async (data: { request_id: string }, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { request_id } = data;

    const request_doc = await db.collection('requests').doc(request_id).get();

    if (!request_doc.exists) {
      throw new functions.https.HttpsError('not-found', 'Request not found');
    }

    const request_data = request_doc.data()!;

    if (request_data.customer_id !== context.auth.uid && request_data.helper_id !== context.auth.uid) {
      throw new functions.https.HttpsError('permission-denied', 'Only participants can cancel payment');
    }

    if (!request_data.payment_intent_id) {
      return { success: true };
    }

    try {
      await stripe.paymentIntents.cancel(request_data.payment_intent_id);

      const payments_query = await db
        .collection('payments')
        .where('payment_intent_id', '==', request_data.payment_intent_id)
        .limit(1)
        .get();

      if (!payments_query.empty) {
        await payments_query.docs[0].ref.update({
          status: 'cancelled',
          cancelled_at: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      await db.collection('requests').doc(request_id).update({
        payment_status: 'cancelled',
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { success: true };
    } catch (error) {
      console.error('Error cancelling payment:', error);
      throw new functions.https.HttpsError('internal', 'Failed to cancel payment');
    }
  }
);

export const stripe_webhook = functions.https.onRequest(async (req, res) => {
  const sig = req.headers['stripe-signature'];

  if (!sig) {
    res.status(400).send('Missing signature');
    return;
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      req.rawBody,
      sig,
      app_config.stripe.webhook_secret
    );
  } catch (error) {
    console.error('Webhook signature verification failed:', error);
    res.status(400).send('Invalid signature');
    return;
  }

  switch (event.type) {
    case 'payment_intent.succeeded':
      console.log('Payment succeeded:', event.data.object);
      break;

    case 'payment_intent.payment_failed':
      console.log('Payment failed:', event.data.object);
      break;

    default:
      console.log('Unhandled event type:', event.type);
  }

  res.json({ received: true });
});
