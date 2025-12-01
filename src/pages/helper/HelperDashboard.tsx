import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '../../components/common/Header';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { RequestCard } from '../../components/helper/RequestCard';
import { AvailabilityToggle } from '../../components/helper/AvailabilityToggle';
import { ClaimedJobs } from '../../components/helper/ClaimedJobs';
import { useAuth } from '../../hooks/use_auth';
import { db } from '../../services/firebase_client';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { HelpRequest } from '../../types';

export function HelperDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [pending_requests, set_pending_requests] = useState<HelpRequest[]>([]);
  const [claimed_requests, set_claimed_requests] = useState<HelpRequest[]>([]);
  const [is_loading, set_is_loading] = useState(true);
  const [is_available, set_is_available] = useState(true);
  const [claiming_id, set_claiming_id] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const pending_query = query(
      collection(db, 'requests'),
      where('status', '==', 'pending'),
      orderBy('created_at', 'desc')
    );

    const claimed_query = query(
      collection(db, 'requests'),
      where('helper_id', '==', user.uid),
      where('status', 'in', ['claimed', 'payment_pending', 'in_session']),
      orderBy('created_at', 'desc')
    );

    const unsubscribe_pending = onSnapshot(pending_query, (snapshot) => {
      const requests = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as HelpRequest[];
      set_pending_requests(requests);
      set_is_loading(false);
    });

    const unsubscribe_claimed = onSnapshot(claimed_query, (snapshot) => {
      const requests = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as HelpRequest[];
      set_claimed_requests(requests);
    });

    return () => {
      unsubscribe_pending();
      unsubscribe_claimed();
    };
  }, [user]);

  const handle_claim = async (request_id: string) => {
    if (!user) return;

    set_claiming_id(request_id);

    try {
      const request_ref = doc(db, 'requests', request_id);
      await updateDoc(request_ref, {
        status: 'claimed',
        helper_id: user.uid,
        helper_name: user.display_name || 'Helper',
        claimed_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      });
    } catch (err) {
      console.error('Error claiming request:', err);
    } finally {
      set_claiming_id(null);
    }
  };

  const handle_start_session = async (request: HelpRequest) => {
    navigate(`/helper/session/${request.id}`);
  };

  if (is_loading) {
    return <LoadingSpinner fullscreen message="Loading dashboard..." />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Helper Dashboard</h1>
          <AvailabilityToggle
            is_available={is_available}
            on_toggle={set_is_available}
          />
        </div>

        {claimed_requests.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Your Active Jobs ({claimed_requests.length})
            </h2>
            <ClaimedJobs
              requests={claimed_requests}
              on_start_session={handle_start_session}
            />
          </div>
        )}

        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Available Requests ({pending_requests.length})
          </h2>

          {!is_available && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <p className="text-yellow-800 text-sm">
                You're currently set as unavailable. Toggle your availability to see and claim new requests.
              </p>
            </div>
          )}

          {pending_requests.length === 0 ? (
            <div className="card text-center py-12">
              <div className="text-4xl mb-4">📭</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No pending requests
              </h3>
              <p className="text-gray-500">
                New requests will appear here. Check back soon!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {pending_requests.map((request) => (
                <RequestCard
                  key={request.id}
                  request={request}
                  on_claim={handle_claim}
                  is_claiming={claiming_id === request.id}
                  disabled={!is_available}
                />
              ))}
            </div>
          )}
        </div>

        <div className="mt-8 bg-blue-50 rounded-lg p-4">
          <h3 className="font-medium text-blue-900 mb-2">💡 Tips for Success</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Respond quickly to requests for better ratings</li>
            <li>• Use clear, step-by-step instructions during sessions</li>
            <li>• Take advantage of AR annotations to guide customers</li>
            <li>• Document complex procedures for future reference</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
