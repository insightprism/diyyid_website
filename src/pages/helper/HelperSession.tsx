import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Header } from '../../components/common/Header';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { SafetyChecklist } from '../../components/helper/SafetyChecklist';
import { SessionOutcome } from '../../components/helper/SessionOutcome';
import { useZohoLens } from '../../hooks/use_zoho_lens';
import { db } from '../../services/firebase_client';
import { doc, onSnapshot, updateDoc, serverTimestamp, addDoc, collection } from 'firebase/firestore';
import { HelpRequest, Session, SessionOutcome as OutcomeType } from '../../types';
import { useAuth } from '../../hooks/use_auth';

type SessionStep = 'checklist' | 'session' | 'outcome';

export function HelperSession() {
  const { request_id } = useParams<{ request_id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { create_session, end_session, is_loading: lens_loading, error: lens_error } = useZohoLens();

  const [request, set_request] = useState<HelpRequest | null>(null);
  const [session, set_session] = useState<Session | null>(null);
  const [step, set_step] = useState<SessionStep>('checklist');
  const [is_loading, set_is_loading] = useState(true);
  const [is_processing, set_is_processing] = useState(false);
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
          const request_data = { id: snapshot.id, ...snapshot.data() } as HelpRequest;
          set_request(request_data);

          if (request_data.session_id) {
            const session_unsubscribe = onSnapshot(
              doc(db, 'sessions', request_data.session_id),
              (session_snapshot) => {
                if (session_snapshot.exists()) {
                  set_session({ id: session_snapshot.id, ...session_snapshot.data() } as Session);
                }
              }
            );
            return () => session_unsubscribe();
          }
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

  const handle_checklist_complete = () => {
    set_step('session');
  };

  const handle_start_session = async () => {
    if (!request || !user) return;

    set_is_processing(true);
    set_error('');

    try {
      const zoho_response = await create_session(request.id);

      const session_ref = await addDoc(collection(db, 'sessions'), {
        request_id: request.id,
        helper_id: user.uid,
        helper_name: user.display_name || 'Helper',
        customer_id: request.customer_id,
        customer_name: request.customer_name,
        zoho_session_id: zoho_response.session_id,
        zoho_session_url: zoho_response.session_url,
        status: 'active',
        started_at: serverTimestamp(),
        created_at: serverTimestamp(),
      });

      await updateDoc(doc(db, 'requests', request.id), {
        status: 'in_session',
        session_id: session_ref.id,
        updated_at: serverTimestamp(),
      });

      set_session({
        id: session_ref.id,
        request_id: request.id,
        helper_id: user.uid,
        customer_id: request.customer_id,
        zoho_session_id: zoho_response.session_id,
        zoho_session_url: zoho_response.session_url,
        status: 'active',
      } as Session);
    } catch (err) {
      console.error('Error starting session:', err);
      set_error('Failed to start session. Please try again.');
    } finally {
      set_is_processing(false);
    }
  };

  const handle_end_session = async () => {
    set_step('outcome');
  };

  const handle_outcome_submit = async (outcome: OutcomeType, notes: string) => {
    if (!session || !request) return;

    set_is_processing(true);

    try {
      await end_session(session.id);

      await updateDoc(doc(db, 'sessions', session.id), {
        status: 'completed',
        outcome,
        notes,
        ended_at: serverTimestamp(),
      });

      await updateDoc(doc(db, 'requests', request.id), {
        status: 'completed',
        outcome,
        updated_at: serverTimestamp(),
      });

      navigate('/helper/dashboard');
    } catch (err) {
      console.error('Error completing session:', err);
      set_error('Failed to complete session');
    } finally {
      set_is_processing(false);
    }
  };

  if (is_loading) {
    return <LoadingSpinner fullscreen message="Loading session..." />;
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
            onClick={() => navigate('/helper/dashboard')}
            className="btn-primary mt-4"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (step === 'checklist') {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-md mx-auto px-4 py-8">
          <SafetyChecklist on_complete={handle_checklist_complete} />
        </div>
      </div>
    );
  }

  if (step === 'outcome') {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-md mx-auto px-4 py-8">
          <SessionOutcome
            on_submit={handle_outcome_submit}
            is_loading={is_processing}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="bg-gray-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <span className="text-white font-medium">
            Session with {request.customer_name}
          </span>
          {session?.status === 'active' && (
            <span className="px-2 py-1 bg-green-500 text-white text-xs rounded-full animate-pulse">
              Live
            </span>
          )}
        </div>
        <button
          onClick={handle_end_session}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          End Session
        </button>
      </div>

      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-60px)] px-4">
        {!session ? (
          <div className="text-center">
            <div className="text-6xl mb-6">📹</div>
            <h2 className="text-2xl font-bold text-white mb-4">
              Ready to Start Session?
            </h2>
            <p className="text-gray-400 mb-8 max-w-md">
              This will create a Zoho Lens session and notify the customer to join.
              You'll be able to guide them using live video and AR annotations.
            </p>

            {(error || lens_error) && (
              <div className="bg-red-900/50 text-red-200 p-3 rounded-lg mb-4 max-w-md">
                {error || lens_error}
              </div>
            )}

            <button
              onClick={handle_start_session}
              disabled={is_processing || lens_loading}
              className="px-8 py-4 bg-primary-600 text-white text-lg font-semibold rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              {is_processing || lens_loading ? 'Creating Session...' : 'Start AR Session'}
            </button>

            <div className="mt-8 text-left bg-gray-800 rounded-lg p-6 max-w-md">
              <h3 className="text-white font-semibold mb-3">Request Details</h3>
              <div className="text-gray-400 text-sm space-y-2">
                <p><strong>Category:</strong> {request.category}</p>
                <p><strong>Description:</strong> {request.description}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full h-full">
            <div id="zoho-lens-container" className="w-full h-[calc(100vh-120px)] bg-black rounded-lg">
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin h-12 w-12 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                  <p className="text-gray-400">
                    Session active. Waiting for customer to join...
                  </p>
                  <p className="text-gray-500 text-sm mt-2">
                    Session URL: {session.zoho_session_url}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
