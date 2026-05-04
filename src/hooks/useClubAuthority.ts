import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

/**
 * Bestimmt für den aktuell angemeldeten Benutzer die Vereins-IDs,
 * in denen er als 'admin' oder 'chairman' eingetragen ist (E-Mail-Match).
 * Liefert Helfer, um vereinsbezogen Zugriffsrechte zu prüfen.
 */
export function useClubAuthority() {
  const { user } = useAuth();
  const [authorityClubIds, setAuthorityClubIds] = useState<Set<string>>(new Set());
  const [creatorClubIds, setCreatorClubIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const userEmail = useMemo(
    () => (user?.email || '').toLowerCase().trim(),
    [user?.email],
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user) {
        setAuthorityClubIds(new Set());
        setCreatorClubIds(new Set());
        setLoading(false);
        return;
      }
      setLoading(true);

      // Authority via E-Mail-Match auf club_players (Basistabelle ist für eigene Zeilen lesbar)
      const authorityIds = new Set<string>();
      if (userEmail) {
        const { data } = await supabase
          .from('club_players')
          .select('club_id, role, email')
          .in('role', ['admin', 'chairman']);
        for (const row of data || []) {
          if ((row.email || '').toLowerCase().trim() === userEmail) {
            authorityIds.add(row.club_id);
          }
        }
      }

      // Ersteller-Vereine (created_by = auth.uid())
      const { data: ownClubs } = await supabase
        .from('clubs')
        .select('id, created_by')
        .eq('created_by', user.id);
      const creatorIds = new Set<string>((ownClubs || []).map(c => c.id));

      if (!cancelled) {
        setAuthorityClubIds(authorityIds);
        setCreatorClubIds(creatorIds);
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [user, userEmail]);

  const canManageClub = (clubId: string) =>
    authorityClubIds.has(clubId) || creatorClubIds.has(clubId);

  const isAuthority = (clubId: string) => authorityClubIds.has(clubId);

  return {
    loading,
    userEmail,
    authorityClubIds,
    creatorClubIds,
    canManageClub,
    isAuthority,
    isAuthenticated: !!user,
  };
}
