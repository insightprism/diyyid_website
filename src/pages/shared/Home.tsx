import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/use_auth';
import { app_config } from '../../config/app_config';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export function Home() {
  const { user, is_loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!is_loading && user) {
      const redirect = user.role === 'helper' ? '/helper/dashboard' : '/customer/request';
      navigate(redirect);
    }
  }, [user, is_loading, navigate]);

  if (is_loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-primary-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50 to-white">
      <div className="max-w-4xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            {app_config.app_name}
          </h1>
          <p className="text-xl text-gray-600">
            Get expert help with your home repairs via live AR-guided video calls
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-2xl mx-auto">
          {/* Customer Card */}
          <div className="card text-center">
            <div className="text-4xl mb-4">🏠</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              I Need Help
            </h2>
            <p className="text-gray-600 mb-6">
              Get guided through your home repair by a professional
            </p>
            <Link to="/customer/login" className="btn-primary w-full block">
              Get Started
            </Link>
          </div>

          {/* Helper Card */}
          <div className="card text-center">
            <div className="text-4xl mb-4">🔧</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              I'm a Professional
            </h2>
            <p className="text-gray-600 mb-6">
              Help homeowners and earn money from anywhere
            </p>
            <Link to="/helper/login" className="btn-secondary w-full block">
              Helper Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
