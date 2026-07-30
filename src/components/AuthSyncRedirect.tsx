import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { onAuthSignOut } from '@/lib/authSync';

/**
 * Listens for sign-out signals from other tabs and navigates this tab to
 * /auth immediately — even if the page is already loaded.
 */
export function AuthSyncRedirect() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    return onAuthSignOut(() => {
      if (location.pathname !== '/auth') {
        navigate('/auth', { replace: true });
      }
    });
  }, [navigate, location.pathname]);

  return null;
}
