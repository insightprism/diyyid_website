import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/use_auth';
import { AuthForm, AuthFormData } from '../../components/common/AuthForm';
import { useEffect } from 'react';

export function HelperLogin() {
  const navigate = useNavigate();
  const { user, is_loading, error, sign_in, clear_error } = useAuth();

  useEffect(() => {
    if (user && !is_loading) {
      navigate('/helper/dashboard');
    }
  }, [user, is_loading, navigate]);

  useEffect(() => {
    clear_error();
  }, [clear_error]);

  const handle_submit = async (data: AuthFormData) => {
    await sign_in(data.email, data.password);
    navigate('/helper/dashboard');
  };

  return (
    <AuthForm
      mode="login"
      role="helper"
      on_submit={handle_submit}
      is_loading={is_loading}
      error={error}
    />
  );
}
