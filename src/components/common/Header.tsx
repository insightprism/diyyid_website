import { Link, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../../services/firebase_client';
import { useAuth } from '../../hooks/use_auth';
import { NotificationBell } from '../helper/NotificationBell';
import { app_config } from '../../config/app_config';

export function Header() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handle_sign_out = async () => {
    await signOut(auth);
    navigate('/');
  };

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center space-x-2">
          <span className="text-2xl">🏠</span>
          <span className="font-bold text-xl text-gray-900">
            {app_config.app_name}
          </span>
        </Link>

        {user ? (
          <div className="flex items-center space-x-4">
            {user.role === 'helper' && <NotificationBell />}
            <span className="text-sm text-gray-600">
              {user.display_name}
              <span className="ml-2 px-2 py-0.5 text-xs bg-gray-100 rounded capitalize">
                {user.role}
              </span>
            </span>
            <button
              onClick={handle_sign_out}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Sign Out
            </button>
          </div>
        ) : (
          <div className="flex items-center space-x-4">
            <Link
              to="/customer/login"
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Customer Login
            </Link>
            <Link
              to="/helper/login"
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              Helper Login
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
