import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Shield, UserCheck, UserMinus, ArrowRight, Clock } from 'lucide-react';

interface Entry {
  id: string;
  player_name: string;
  player_email: string;
  old_role: string | null;
  new_role: string | null;
  action: 'insert' | 'update' | 'delete';
  changed_by_email: string | null;
  created_at: string;
}

function roleLabel(r: string | null) {
  if (r === 'admin') return 'Administrator';
  if (r === 'chairman') return 'Vorsitzender';
  if (r === 'player') return 'Spieler';
  return '—';
}

export function ClubRoleHistory({ clubId }: { clubId: string }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from('club_role_history')
        .select('id, player_name, player_email, old_role, new_role, action, changed_by_email, created_at')
        .eq('club_id', clubId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (!cancelled) {
        setEntries((data as any) || []);
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [clubId]);

  if (loading) return <p className="text-xs text-muted-foreground italic">Lade Rollenverlauf...</p>;

  return (
    <div className="space-y-2">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Rollenverlauf
      </span>
      {entries.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Keine Rollenänderungen erfasst</p>
      ) : (
        <div className="space-y-1">
          {entries.map(e => {
            const Icon = e.action === 'delete' ? UserMinus : e.new_role === 'admin' ? Shield : UserCheck;
            return (
              <div key={e.id} className="flex items-center gap-2 text-xs bg-background/60 rounded-md px-2.5 py-1.5">
                <Icon className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                <span className="font-medium">{e.player_name}</span>
                <span className="text-muted-foreground flex items-center gap-1">
                  {roleLabel(e.old_role)}
                  <ArrowRight className="h-3 w-3" />
                  {roleLabel(e.new_role)}
                </span>
                <span className="ml-auto flex items-center gap-1 text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {new Date(e.created_at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  {e.changed_by_email && <span className="ml-1">· {e.changed_by_email}</span>}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
