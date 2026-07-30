import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Session, User } from '@supabase/supabase-js';

/** Returns true if a Supabase auth token exists in localStorage. */
export function hasStoredAuthToken(): boolean {
  try {
    return Object.keys(localStorage).some(
      (k) => k.startsWith('sb-') && k.includes('-auth-token') && !!localStorage.getItem(k)
    );
  } catch {
    return true; // storage unavailable -> don't force a logout
  }
}

/** Removes all Supabase auth token entries from localStorage. */
export function clearStoredAuthTokens() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('sb-') && k.includes('-auth-token'))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Token watchdog: if the stored token disappears (other tab, manual clear,
  // failed refresh) we drop the local session even without a SIGNED_OUT event.
  useEffect(() => {
    const check = () => {
      if (!hasStoredAuthToken()) {
        setSession((prev) => (prev ? null : prev));
        setUser((prev) => (prev ? null : prev));
        setLoading(false);
      }
    };
    const forceSignedOut = () => {
      clearStoredAuthTokens();
      setSession(null);
      setUser(null);
      setLoading(false);
    };
    const unsubscribe = onAuthSignOut(forceSignedOut);
    window.addEventListener('focus', check);
    const interval = window.setInterval(check, 2000);
    return () => {
      unsubscribe();
      window.removeEventListener('focus', check);
      window.clearInterval(interval);
    };
  }, []);

  const signOut = async () => {
    try {
      // 'local' avoids a hard failure when the refresh token is already invalid
      await supabase.auth.signOut({ scope: 'local' });
    } catch (e) {
      console.error('signOut failed', e);
    } finally {
      clearStoredAuthTokens();
      broadcastSignOut();
      setSession(null);
      setUser(null);
      setLoading(false);
    }
  };

  return { session, user, loading, signOut };
}
