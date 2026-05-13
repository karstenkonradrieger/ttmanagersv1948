import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Shield, UserCheck } from 'lucide-react';

/**
 * Kompakte, immer sichtbare Rollenanzeige für die Vereins-Headerzeile.
 * Zeigt Anzahl Admins/Vorsitzender + erste Namen (ohne PII).
 */
export function ClubRoleBadge({ clubId }: { clubId: string }) {
  const [admins, setAdmins] = useState<string[]>([]);
  const [chairmen, setChairmen] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('club_players_public')
        .select('name, role')
        .eq('club_id', clubId)
        .in('role', ['admin', 'chairman']);
      if (cancelled) return;
      const a: string[] = [];
      const c: string[] = [];
      for (const r of (data as any[]) || []) {
        if (r.role === 'admin') a.push(r.name);
        else if (r.role === 'chairman') c.push(r.name);
      }
      setAdmins(a);
      setChairmen(c);
    })();
    return () => { cancelled = true; };
  }, [clubId]);

  if (admins.length === 0 && chairmen.length === 0) {
    return (
      <span
        className="ml-1 inline-flex items-center gap-1 text-[10px] uppercase tracking-wider bg-muted/60 text-muted-foreground px-1.5 py-0.5 rounded"
        title="Keine Administratoren/Vorsitzende eingetragen"
      >
        <Shield className="h-3 w-3" /> 0
      </span>
    );
  }

  return (
    <span className="ml-1 inline-flex items-center gap-1 flex-wrap">
      {admins.length > 0 && (
        <span
          className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider bg-primary/15 text-primary px-1.5 py-0.5 rounded"
          title={`Administrator: ${admins.join(', ')}`}
        >
          <Shield className="h-3 w-3" />
          {admins.length === 1 ? admins[0].split(' ').slice(-1)[0] : admins.length}
        </span>
      )}
      {chairmen.length > 0 && (
        <span
          className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider bg-muted text-muted-foreground px-1.5 py-0.5 rounded"
          title={`Vorsitz: ${chairmen.join(', ')}`}
        >
          <UserCheck className="h-3 w-3" />
          {chairmen.length === 1 ? chairmen[0].split(' ').slice(-1)[0] : chairmen.length}
        </span>
      )}
    </span>
  );
}
