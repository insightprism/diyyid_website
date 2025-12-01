import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Header } from '../../components/common/Header';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { db } from '../../services/firebase_client';
import { doc, onSnapshot } from 'firebase/firestore';
import { HelpRequest } from '../../types';
import { app_config } from '../../config/app_config';
import { format_distance_to_now } from '../../utils/date_utils';

const STATUS_CONFIG = {
  pending: {
    label: 'Finding a Helper',
    description: 'Your request is in the queue. A professional will claim it shortly.',
    color: 'text-yellow-600',
    bg: 'bg-yellow-50',
    icon: '⏳',
  },
  claimed: {
    label: 'Helper Assigned',
    description: 'A professional has claimed your request and will contact you soon.',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    icon: '✓',
  },
  payment_pending: {
    label: 'Payment Required',
    description: 'Please complete payment to start your session.',
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    icon: '💳',
  },
  in_session: {
    label: 'Session Active',
    description: 'Your session is in progress.',
    color: 'text-green-600',
    bg: 'bg-green-50',
    icon: '📹',
  },
  completed: {
    label: 'Completed',
    description: 'Your session has been completed.',
    color: 'text-gray-600',
    bg: 'bg-gray-50',
    icon: '✅',
  },
  cancelled: {
    label: 'Cancelled',
    description: 'This request has been cancelled.',
    color: 'text-red-600',
    bg: 'bg-red-50',
    icon: '✗',
  },
};

export function RequestStatus() {
  const { request_id } = useParams<{ request_id: string }>();
  const navigate = useNavigate();
  const [request, set_request] = useState<HelpRequest | null>(null);
  const [is_loading, set_is_loading] = useState(true);
  const [error, set_error] = useState('');

  useEffect(() => {
    if (!request_id) {
      set_error('Invalid request ID');
      set_is_loading(false);
      return;
    }

    const unsubscribe = onSnapshot(
      doc(db, 'requests', request_id),
      (snapshot) => {
        if (snapshot.exists()) {
          set_request({ id: snapshot.id, ...snapshot.data() } as HelpRequest);
        } else {
          set_error('Request not found');
        }
        set_is_loading(false);
      },
      (err) => {
        console.error('Error fetching request:', err);
        set_error('Failed to load request');
        set_is_loading(false);
      }
    );

    return () => unsubscribe();
  }, [request_id]);

  useEffect(() => {
    if (request?.status === 'in_session' && request.session_id) {
      navigate(`/customer/session/${request.session_id}`);
    }
  }, [request, navigate]);

  if (is_loading) {
    return <LoadingSpinner fullscreen message="Loading request..." />;
  }

  if (error || !request) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-md mx-auto px-4 py-16 text-center">
          <div className="text-4xl mb-4">😕</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {error || 'Request not found'}
          </h2>
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

  const status_info = STATUS_CONFIG[request.status] || STATUS_CONFIG.pending;
  const category = app_config.categories.find(c => c.value === request.category);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-md mx-auto px-4 py-8">
        <div className={`${status_info.bg} rounded-lg p-6 text-center mb-6`}>
          <span className="text-4xl block mb-2">{status_info.icon}</span>
          <h2 className={`text-xl font-semibold ${status_info.color}`}>
            {status_info.label}
          </h2>
          <p className="text-gray-600 text-sm mt-1">
            {status_info.description}
          </p>
        </div>

        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Request Details</h3>

          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-500">Category</span>
              <span className="font-medium flex items-center">
                <span className="mr-1">{category?.icon}</span>
                {category?.label}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-500">Price</span>
              <span className="font-medium text-green-600">
                ${(request.amount / 100).toFixed(2)}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-gray-500">Created</span>
              <span className="font-medium">
                {format_distance_to_now(request.created_at)}
              </span>
            </div>

            {request.helper_name && (
              <div className="flex justify-between">
                <span className="text-gray-500">Helper</span>
                <span className="font-medium">{request.helper_name}</span>
              </div>
            )}
          </div>

          <div className="mt-4 pt-4 border-t">
            <p className="text-gray-500 text-sm mb-1">Description</p>
            <p className="text-gray-900">{request.description}</p>
          </div>

          {request.photo_urls && request.photo_urls.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-gray-500 text-sm mb-2">Photos</p>
              <div className="grid grid-cols-3 gap-2">
                {request.photo_urls.map((url, index) => (
                  <img
                    key={index}
                    src={url}
                    alt={`Photo ${index + 1}`}
                    className="w-full h-20 object-cover rounded"
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {request.status === 'claimed' && (
          <button
            onClick={() => navigate(`/customer/payment/${request.id}`)}
            className="btn-primary w-full mt-6"
          >
            Proceed to Payment
          </button>
        )}

        {request.status === 'pending' && (
          <div className="mt-6 text-center">
            <div className="animate-pulse flex justify-center space-x-1">
              <div className="w-2 h-2 bg-primary-400 rounded-full"></div>
              <div className="w-2 h-2 bg-primary-400 rounded-full animation-delay-200"></div>
              <div className="w-2 h-2 bg-primary-400 rounded-full animation-delay-400"></div>
            </div>
            <p className="text-sm text-gray-500 mt-2">
              Waiting for a helper to claim your request...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
