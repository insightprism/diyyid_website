import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();
const auth = admin.auth();

export const on_user_created = functions.auth.user().onCreate(async (user) => {
  await db.collection('users').doc(user.uid).set({
    email: user.email,
    display_name: user.displayName || '',
    photo_url: user.photoURL || '',
    role: 'customer',
    is_available: false,
    created_at: admin.firestore.FieldValue.serverTimestamp(),
    updated_at: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log(`Created user document for ${user.uid}`);
});

export const set_user_role = functions.https.onCall(
  async (data: { role: 'customer' | 'helper' }, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { role } = data;

    if (role !== 'customer' && role !== 'helper') {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid role');
    }

    try {
      await auth.setCustomUserClaims(context.auth.uid, { role });

      await db.collection('users').doc(context.auth.uid).update({
        role,
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { success: true, role };
    } catch (error) {
      console.error('Error setting user role:', error);
      throw new functions.https.HttpsError('internal', 'Failed to set user role');
    }
  }
);

export const update_availability = functions.https.onCall(
  async (data: { is_available: boolean }, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }

    const user_doc = await db.collection('users').doc(context.auth.uid).get();

    if (!user_doc.exists) {
      throw new functions.https.HttpsError('not-found', 'User not found');
    }

    const user_data = user_doc.data()!;

    if (user_data.role !== 'helper') {
      throw new functions.https.HttpsError('permission-denied', 'Only helpers can update availability');
    }

    try {
      await db.collection('users').doc(context.auth.uid).update({
        is_available: data.is_available,
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { success: true, is_available: data.is_available };
    } catch (error) {
      console.error('Error updating availability:', error);
      throw new functions.https.HttpsError('internal', 'Failed to update availability');
    }
  }
);
