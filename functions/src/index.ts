import * as admin from 'firebase-admin';

admin.initializeApp();

export { create_zoho_session, end_zoho_session } from './zoho_lens';

export {
  create_payment_intent,
  capture_payment,
  cancel_payment,
  stripe_webhook,
} from './stripe_functions';

export {
  on_request_created,
  on_request_claimed,
  send_session_invite,
} from './notifications';

export {
  on_user_created,
  set_user_role,
  update_availability,
} from './auth';
