import { loadStripe, Stripe } from '@stripe/stripe-js';

const stripe_cfg = {
  publishable_key: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY,
};

let stripe_promise: Promise<Stripe | null> | null = null;

export function get_stripe(): Promise<Stripe | null> {
  if (!stripe_promise) {
    stripe_promise = loadStripe(stripe_cfg.publishable_key);
  }
  return stripe_promise;
}
