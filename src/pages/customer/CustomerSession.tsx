import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Header } from '../../components/common/Header';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useZohoLens } from '../../hooks/use_zoho_lens';
import { db } from '../../services/firebase_client';
import { doc, onSnapshot } from 'firebase/firestore';
import { Session } from '../../types';

export function CustomerSession() {
  const { session_id } = useParams<{ session_id: string }>();
  const navigate = useNavigate();
  const { join_session, end_session, is_loading: lens_loading, error: lens_error } = useZohoLens();

  const [session, set_session] = useState<Session | null>(null);
  const [is_loading, set_is_loading] = useState(true);
  const [error, set_error] = useState('');
  const [session_joined, set_session_joined] = useState(false);

  useEffect(() => {
    if (!session_id) {
      set_error('Invalid session ID');
      set_is_loading(false);
      return;
    }

    const unsubscribe = onSnapshot(
      doc(db, 'sessions', session_id),
      (snapshot) => {
        if (snapshot.exists()) {
          const session_data = { id: snapshot.id, ...snapshot.data() } as Session;
          set_session(session_data);

          if (session_data.status === 'completed') {
            navigate(`/customer/status/${session_data.request_id}`);
          }
        } else {
          set_error('Session not found');
        }
        set_is_loading(false);
      },
      (err) => {
        console.error('Error fetching session:', err);
        set_error('Failed to load session');
        set_is_loading(false);
      }
    );

    return () => unsubscribe();
  }, [session_id, navigate]);

  const handle_join_session = async () => {
    if (!session?.zoho_session_url) {
      set_error('Session link not available yet');
      return;
    }

    try {
      await join_session(session.zoho_session_url);
      set_session_joined(true);
    } catch (err) {
      console.error('Error joining session:', err);
      set_error('Failed to join session');
    }
  };

  const handle_end_session = async () => {
    if (!session_id) return;

    try {
      await end_session(session_id);
      navigate(`/customer/status/${session?.request_id}`);
    } catch (err) {
      console.error('Error ending session:', err);
      set_error('Failed to end session');
    }
  };

  if (is_loading) {
    return <LoadingSpinner fullscreen message="Loading session..." />;
  }

  if (error || !session) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-md mx-auto px-4 py-16 text-center">
          <div className="text-4xl mb-4">😕</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {error || 'Session not found'}
          </h2>
          <button
            onClick={() => navigate('/customer/request')}
            className="btn-primary mt-4"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="bg-gray-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <span className="text-white font-medium">
            Session with {session.helper_name}
          </span>
          {session.status === 'active' && (
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
        {!session_joined ? (
          <div className="text-center">
            <div className="text-6xl mb-6">📹</div>
            <h2 className="text-2xl font-bold text-white mb-4">
              Ready to Join?
            </h2>
            <p className="text-gray-400 mb-8 max-w-md">
              Click the button below to join the AR video session with your helper.
              They will guide you through your repair using live video and AR annotations.
            </p>

            {lens_error && (
              <div className="bg-red-900/50 text-red-200 p-3 rounded-lg mb-4 max-w-md">
                {lens_error}
              </div>
            )}

            <button
              onClick={handle_join_session}
              disabled={lens_loading || !session.zoho_session_url}
              className="px-8 py-4 bg-primary-600 text-white text-lg font-semibold rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              {lens_loading ? 'Connecting...' : 'Join Video Session'}
            </button>

            {!session.zoho_session_url && (
              <p className="text-gray-500 text-sm mt-4">
                Waiting for helper to start the session...
              </p>
            )}

            <div className="mt-8 text-left bg-gray-800 rounded-lg p-6 max-w-md">
              <h3 className="text-white font-semibold mb-3">Tips for a great session:</h3>
              <ul className="text-gray-400 text-sm space-y-2">
                <li>• Ensure good lighting in your work area</li>
                <li>• Have your tools ready before starting</li>
                <li>• Use a stable surface for your phone/tablet</li>
                <li>• Speak clearly and follow helper instructions</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="w-full h-full">
            <div id="zoho-lens-container" className="w-full h-[calc(100vh-120px)] bg-black rounded-lg">
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin h-12 w-12 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                  <p className="text-gray-400">Connecting to video session...</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
