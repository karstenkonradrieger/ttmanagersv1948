import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Shield, UserCheck, Mail } from 'lucide-react';

interface Role {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'chairman' | 'player';
}

export function ClubRoles({ clubId }: { clubId: string }) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      // Public view exposes role + name without PII; basistabelle liefert E-Mail wenn erlaubt
      const { data: pub } = await supabase
        .from('club_players_public')
        .select('id, name, role')
        .eq('club_id', clubId)
        .in('role', ['admin', 'chairman']);
      const { data: priv } = await supabase
        .from('club_players')
        .select('id, email')
        .eq('club_id', clubId)
        .in('role', ['admin', 'chairman']);
      const emailMap = new Map<string, string>();
      for (const r of priv || []) emailMap.set(r.id, r.email || '');
      if (!cancelled) {
        const list = (pub || []).map((r: any) => ({
          id: r.id,
          name: r.name,
          email: emailMap.get(r.id) || '',
          role: r.role,
        })) as Role[];
        list.sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name) : a.role === 'admin' ? -1 : 1));
        setRoles(list);
        setLoading(false);
      }
    }
    load();
  }, [clubId]);

  if (loading) {
    return <p className="text-xs text-muted-foreground italic">Lade Rollen...</p>;
  }

  return (
    <div className="space-y-2">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Rollen & Berechtigungen
      </span>
      {roles.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Keine Administratoren oder Vorsitzenden eingetragen</p>
      ) : (
        <div className="space-y-1">
          {roles.map(r => (
            <div key={r.id} className="flex items-center gap-2 text-xs bg-background/60 rounded-md px-2.5 py-1.5">
              {r.role === 'admin' ? (
                <Shield className="h-3.5 w-3.5 text-primary flex-shrink-0" />
              ) : (
                <UserCheck className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              )}
              <span className="font-medium">{r.name}</span>
              <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${r.role === 'admin' ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}>
                {r.role === 'admin' ? 'Administrator' : 'Vorsitzender'}
              </span>
              {r.email && (
                <span className="ml-auto flex items-center gap-1 text-muted-foreground">
                  <Mail className="h-3 w-3" />
                  {r.email}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
