import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { onAuthSignOut } from '@/lib/authSync';

/** Routes that stay reachable without a session. */
const PUBLIC_PREFIXES = ['/auth', '/live/', '/standings/', '/doubles/', '/groups/'];

/**
 * Listens for sign-out signals from other tabs and navigates this tab to
 * /auth immediately — even if the page is already loaded.
 */
export function AuthSyncRedirect() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    return onAuthSignOut(() => {
      const isPublic = PUBLIC_PREFIXES.some((p) => location.pathname.startsWith(p));
      if (!isPublic) {
        navigate('/auth', { replace: true });
      }
    });
  }, [navigate, location.pathname]);

  return null;
}
