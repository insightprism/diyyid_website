import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Elements } from '@stripe/react-stripe-js';
import { AuthProvider, useAuth } from './hooks/use_auth';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { LoadingSpinner } from './components/common/LoadingSpinner';
import { get_stripe } from './services/stripe_client';

import { Home, NotFound } from './pages/shared';
import {
  CustomerLogin,
  CustomerSignup,
  RequestForm,
  RequestStatus,
  PaymentPage,
  CustomerSession,
} from './pages/customer';
import {
  HelperLogin,
  HelperSignup,
  HelperDashboard,
  HelperSession,
} from './pages/helper';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowed_role?: 'customer' | 'helper';
}

function ProtectedRoute({ children, allowed_role }: ProtectedRouteProps) {
  const { user, is_loading } = useAuth();

  if (is_loading) {
    return <LoadingSpinner fullscreen />;
  }

  if (!user) {
    const redirect_path = allowed_role === 'helper' ? '/helper/login' : '/customer/login';
    return <Navigate to={redirect_path} replace />;
  }

  if (allowed_role && user.role !== allowed_role) {
    const redirect_path = user.role === 'helper' ? '/helper/dashboard' : '/customer/request';
    return <Navigate to={redirect_path} replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<Home />} />

      {/* Customer auth routes */}
      <Route path="/customer/login" element={<CustomerLogin />} />
      <Route path="/customer/signup" element={<CustomerSignup />} />

      {/* Customer protected routes */}
      <Route
        path="/customer/request"
        element={
          <ProtectedRoute allowed_role="customer">
            <RequestForm />
          </ProtectedRoute>
        }
      />
      <Route
        path="/customer/status/:request_id"
        element={
          <ProtectedRoute allowed_role="customer">
            <RequestStatus />
          </ProtectedRoute>
        }
      />
      <Route
        path="/customer/payment/:request_id"
        element={
          <ProtectedRoute allowed_role="customer">
            <Elements stripe={get_stripe()}>
              <PaymentPage />
            </Elements>
          </ProtectedRoute>
        }
      />
      <Route
        path="/customer/session/:session_id"
        element={
          <ProtectedRoute allowed_role="customer">
            <CustomerSession />
          </ProtectedRoute>
        }
      />

      {/* Helper auth routes */}
      <Route path="/helper/login" element={<HelperLogin />} />
      <Route path="/helper/signup" element={<HelperSignup />} />

      {/* Helper protected routes */}
      <Route
        path="/helper/dashboard"
        element={
          <ProtectedRoute allowed_role="helper">
            <HelperDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/helper/session/:request_id"
        element={
          <ProtectedRoute allowed_role="helper">
            <HelperSession />
          </ProtectedRoute>
        }
      />

      {/* 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
