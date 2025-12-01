import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Header } from '../../components/common/Header';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { usePayment } from '../../hooks/use_payment';
import { db } from '../../services/firebase_client';
import { doc, getDoc } from 'firebase/firestore';
import { HelpRequest } from '../../types';
import { app_config } from '../../config/app_config';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

export function PaymentPage() {
  const { request_id } = useParams<{ request_id: string }>();
  const navigate = useNavigate();
  const stripe = useStripe();
  const elements = useElements();
  const { create_payment_intent, is_loading: payment_loading } = usePayment();

  const [request, set_request] = useState<HelpRequest | null>(null);
  const [is_loading, set_is_loading] = useState(true);
  const [is_processing, set_is_processing] = useState(false);
  const [error, set_error] = useState('');

  useEffect(() => {
    const fetch_request = async () => {
      if (!request_id) {
        set_error('Invalid request ID');
        set_is_loading(false);
        return;
      }

      try {
        const doc_ref = doc(db, 'requests', request_id);
        const snapshot = await getDoc(doc_ref);

        if (snapshot.exists()) {
          set_request({ id: snapshot.id, ...snapshot.data() } as HelpRequest);
        } else {
          set_error('Request not found');
        }
      } catch (err) {
        console.error('Error fetching request:', err);
        set_error('Failed to load request');
      } finally {
        set_is_loading(false);
      }
    };

    fetch_request();
  }, [request_id]);

  const handle_submit = async (e: React.FormEvent) => {
    e.preventDefault();
    set_error('');

    if (!stripe || !elements || !request) {
      return;
    }

    const card_element = elements.getElement(CardElement);
    if (!card_element) {
      set_error('Card element not found');
      return;
    }

    set_is_processing(true);

    try {
      const { error: pm_error, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: card_element,
      });

      if (pm_error) {
        set_error(pm_error.message || 'Payment method creation failed');
        set_is_processing(false);
        return;
      }

      const client_secret = await create_payment_intent(
        request.id,
        request.amount,
        paymentMethod.id
      );

      if (!client_secret) {
        set_error('Failed to create payment intent');
        set_is_processing(false);
        return;
      }

      const { error: confirm_error } = await stripe.confirmCardPayment(client_secret, {
        payment_method: paymentMethod.id,
      });

      if (confirm_error) {
        set_error(confirm_error.message || 'Payment confirmation failed');
        set_is_processing(false);
        return;
      }

      navigate(`/customer/status/${request.id}`);
    } catch (err) {
      console.error('Payment error:', err);
      set_error('Payment processing failed. Please try again.');
      set_is_processing(false);
    }
  };

  if (is_loading) {
    return <LoadingSpinner fullscreen message="Loading payment..." />;
  }

  if (error && !request) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-md mx-auto px-4 py-16 text-center">
          <div className="text-4xl mb-4">😕</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">{error}</h2>
          <button
            onClick={() => navigate('/customer/request')}
            className="btn-primary mt-4"
          >
            Create New Request
          </button>
        </div>
      </div>
    );
  }

  if (!request) return null;

  const category = app_config.categories.find(c => c.value === request.category);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-md mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          Complete Payment
        </h1>

        <div className="card mb-6">
          <h3 className="font-semibold text-gray-900 mb-4">Order Summary</h3>
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <span className="text-2xl mr-2">{category?.icon}</span>
              <span>{category?.label} Help Session</span>
            </div>
            <span className="font-bold text-lg">
              ${(request.amount / 100).toFixed(2)}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Your card will be pre-authorized. Payment is only captured after
            your session is completed.
          </p>
        </div>

        <form onSubmit={handle_submit} className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Payment Details</h3>

          <div className="mb-4">
            <label className="label">Card Information</label>
            <div className="input-field">
              <CardElement
                options={{
                  style: {
                    base: {
                      fontSize: '16px',
                      color: '#1f2937',
                      '::placeholder': {
                        color: '#9ca3af',
                      },
                    },
                    invalid: {
                      color: '#dc2626',
                    },
                  },
                }}
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!stripe || is_processing || payment_loading}
            className="btn-primary w-full"
          >
            {is_processing ? 'Processing...' : `Pre-authorize $${(request.amount / 100).toFixed(2)}`}
          </button>

          <p className="text-xs text-gray-500 text-center mt-4">
            🔒 Secured by Stripe. Your payment information is encrypted.
          </p>
        </form>

        <div className="mt-6 bg-blue-50 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-2">How it works</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Your card is pre-authorized, not charged</li>
            <li>• If the session doesn't happen, you won't be charged</li>
            <li>• Payment is only captured after session completion</li>
            <li>• Full refund available if issue isn't resolved</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
