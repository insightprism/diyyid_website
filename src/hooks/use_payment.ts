import { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../services/firebase_client';
import { get_stripe } from '../services/stripe_client';
import { StripeCardElement } from '@stripe/stripe-js';

export function usePayment() {
  const [is_loading, set_is_loading] = useState(false);
  const [error, set_error] = useState<string | null>(null);

  const create_payment = async (request_id: string) => {
    set_is_loading(true);
    set_error(null);

    try {
      const fn = httpsCallable(functions, 'createPaymentIntent');
      const result = await fn({ request_id });
      return (result.data as { client_secret: string }).client_secret;
    } catch (err: unknown) {
      const error_obj = err as { message?: string };
      set_error(error_obj.message || 'Failed to create payment');
      throw err;
    } finally {
      set_is_loading(false);
    }
  };

  const confirm_payment = async (client_secret: string, card_element: StripeCardElement) => {
    set_is_loading(true);
    set_error(null);

    try {
      const stripe = await get_stripe();
      if (!stripe) throw new Error('Stripe not loaded');

      const result = await stripe.confirmCardPayment(client_secret, {
        payment_method: { card: card_element },
      });

      if (result.error) {
        throw new Error(result.error.message);
      }

      return result.paymentIntent;
    } catch (err: unknown) {
      const error_obj = err as { message?: string };
      set_error(error_obj.message || 'Payment failed');
      throw err;
    } finally {
      set_is_loading(false);
    }
  };

  const cancel_request = async (request_id: string) => {
    set_is_loading(true);
    try {
      const fn = httpsCallable(functions, 'cancelRequestPayment');
      await fn({ request_id });
    } catch (err: unknown) {
      const error_obj = err as { message?: string };
      set_error(error_obj.message || 'Failed to cancel');
      throw err;
    } finally {
      set_is_loading(false);
    }
  };

  return { create_payment, confirm_payment, cancel_request, is_loading, error };
}
