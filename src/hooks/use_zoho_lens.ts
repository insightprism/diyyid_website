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
    } catch (err: unknown) {
      const error_obj = err as { message?: string };
      set_error(error_obj.message || 'Failed to create session');
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
    } catch (err: unknown) {
      const error_obj = err as { message?: string };
      set_error(error_obj.message || 'Failed to send SMS');
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
    } catch (err: unknown) {
      const error_obj = err as { message?: string };
      set_error(error_obj.message || 'Failed to end session');
      throw err;
    } finally {
      set_is_loading(false);
    }
  };

  return { create_session, send_sms, end_session, is_loading, error };
}
