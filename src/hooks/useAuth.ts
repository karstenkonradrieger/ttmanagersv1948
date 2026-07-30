import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Session, User } from '@supabase/supabase-js';

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

  const signOut = async () => {
    try {
      // 'local' avoids a hard failure when the refresh token is already invalid
      await supabase.auth.signOut({ scope: 'local' });
    } catch (e) {
      console.error('signOut failed', e);
    } finally {
      // Clear any leftover Supabase auth entries and reset local state
      try {
        Object.keys(localStorage)
          .filter((k) => k.startsWith('sb-') && k.includes('-auth-token'))
          .forEach((k) => localStorage.removeItem(k));
      } catch {
        /* ignore */
      }
      setSession(null);
      setUser(null);
      setLoading(false);
    }
  };


  return { session, user, loading, signOut };
}
