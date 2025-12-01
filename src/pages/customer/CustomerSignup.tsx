import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/use_auth';
import { AuthForm, AuthFormData } from '../../components/common/AuthForm';
import { useEffect } from 'react';

export function CustomerSignup() {
  const navigate = useNavigate();
  const { user, is_loading, error, sign_up, clear_error } = useAuth();

  useEffect(() => {
    if (user && !is_loading) {
      navigate('/customer/request');
    }
  }, [user, is_loading, navigate]);

  useEffect(() => {
    clear_error();
  }, [clear_error]);

  const handle_submit = async (data: AuthFormData) => {
    await sign_up(data.email, data.password, data.display_name!, data.phone!, 'customer');
    navigate('/customer/request');
  };

  return (
    <AuthForm
      mode="signup"
      role="customer"
      on_submit={handle_submit}
      is_loading={is_loading}
      error={error}
    />
  );
}
