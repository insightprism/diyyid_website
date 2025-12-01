import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { LoadingSpinner } from './LoadingSpinner';
import {
  validate_email,
  validate_password,
  validate_phone,
  validate_display_name,
} from '../../utils/validation_utils';
import { UserRole } from '../../types';

interface AuthFormProps {
  mode: 'login' | 'signup';
  role: UserRole;
  on_submit: (data: AuthFormData) => Promise<void>;
  is_loading: boolean;
  error: string | null;
}

export interface AuthFormData {
  email: string;
  password: string;
  display_name?: string;
  phone?: string;
}

export function AuthForm({
  mode,
  role,
  on_submit,
  is_loading,
  error,
}: AuthFormProps) {
  const [email, set_email] = useState('');
  const [password, set_password] = useState('');
  const [display_name, set_display_name] = useState('');
  const [phone, set_phone] = useState('');
  const [validation_errors, set_validation_errors] = useState<
    Record<string, string>
  >({});

  const is_signup = mode === 'signup';
  const other_role_link =
    role === 'customer' ? '/helper/login' : '/customer/login';
  const other_role_label = role === 'customer' ? 'Helper' : 'Customer';

  const validate_form = (): boolean => {
    const errors: Record<string, string> = {};

    const email_result = validate_email(email);
    if (!email_result.is_valid) {
      errors.email = email_result.error!;
    }

    const password_result = validate_password(password);
    if (!password_result.is_valid) {
      errors.password = password_result.error!;
    }

    if (is_signup) {
      const name_result = validate_display_name(display_name);
      if (!name_result.is_valid) {
        errors.display_name = name_result.error!;
      }

      const phone_result = validate_phone(phone);
      if (!phone_result.is_valid) {
        errors.phone = phone_result.error!;
      }
    }

    set_validation_errors(errors);
    return Object.keys(errors).length === 0;
  };

  const handle_submit = async (e: FormEvent) => {
    e.preventDefault();

    if (!validate_form()) return;

    await on_submit({
      email,
      password,
      ...(is_signup && { display_name, phone }),
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center space-x-2">
            <span className="text-3xl">🏠</span>
            <span className="text-2xl font-bold text-gray-900">
              HomePro Assist
            </span>
          </Link>
          <h1 className="mt-4 text-xl text-gray-600">
            {is_signup ? 'Create Account' : 'Sign In'} as {role === 'customer' ? 'Customer' : 'Helper'}
          </h1>
        </div>

        <div className="card">
          <form onSubmit={handle_submit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            {is_signup && (
              <div>
                <label htmlFor="display_name" className="label">
                  Full Name
                </label>
                <input
                  id="display_name"
                  type="text"
                  value={display_name}
                  onChange={(e) => set_display_name(e.target.value)}
                  className="input-field"
                  placeholder="John Smith"
                  disabled={is_loading}
                />
                {validation_errors.display_name && (
                  <p className="error-text">{validation_errors.display_name}</p>
                )}
              </div>
            )}

            <div>
              <label htmlFor="email" className="label">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => set_email(e.target.value)}
                className="input-field"
                placeholder="you@example.com"
                disabled={is_loading}
              />
              {validation_errors.email && (
                <p className="error-text">{validation_errors.email}</p>
              )}
            </div>

            {is_signup && (
              <div>
                <label htmlFor="phone" className="label">
                  Phone Number
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => set_phone(e.target.value)}
                  className="input-field"
                  placeholder="+1 (555) 123-4567"
                  disabled={is_loading}
                />
                {validation_errors.phone && (
                  <p className="error-text">{validation_errors.phone}</p>
                )}
              </div>
            )}

            <div>
              <label htmlFor="password" className="label">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => set_password(e.target.value)}
                className="input-field"
                placeholder={is_signup ? 'At least 6 characters' : 'Your password'}
                disabled={is_loading}
              />
              {validation_errors.password && (
                <p className="error-text">{validation_errors.password}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={is_loading}
              className="btn-primary w-full flex items-center justify-center"
            >
              {is_loading ? (
                <LoadingSpinner size="sm" />
              ) : is_signup ? (
                'Create Account'
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-200 text-center text-sm">
            {is_signup ? (
              <p className="text-gray-600">
                Already have an account?{' '}
                <Link
                  to={`/${role}/login`}
                  className="text-primary-600 hover:underline"
                >
                  Sign in
                </Link>
              </p>
            ) : (
              <p className="text-gray-600">
                Don't have an account?{' '}
                <Link
                  to={`/${role}/signup`}
                  className="text-primary-600 hover:underline"
                >
                  Create one
                </Link>
              </p>
            )}
          </div>
        </div>

        <p className="mt-4 text-center text-sm text-gray-500">
          Are you a {other_role_label}?{' '}
          <Link to={other_role_link} className="text-primary-600 hover:underline">
            Sign in here
          </Link>
        </p>
      </div>
    </div>
  );
}
