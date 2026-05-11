import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { History, Power, PowerOff } from 'lucide-react';

interface Entry {
  id: string;
  is_active: boolean;
  changed_by_email: string | null;
  changed_by: string | null;
  created_at: string;
}

export function ClubStatusHistory({ clubId }: { clubId: string }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('club_status_history')
        .select('id, is_active, changed_by_email, changed_by, created_at')
        .eq('club_id', clubId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (!cancelled) {
        setEntries(data || []);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [clubId]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <History className="h-3 w-3 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Änderungsverlauf
        </span>
      </div>
      {loading ? (
        <p className="text-xs text-muted-foreground italic">Wird geladen…</p>
      ) : entries.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Noch keine Statusänderungen</p>
      ) : (
        <ul className="space-y-1">
          {entries.map(e => (
            <li key={e.id} className="flex items-center gap-2 text-xs bg-background/60 rounded px-2 py-1.5">
              {e.is_active ? (
                <Power className="h-3 w-3 text-primary flex-shrink-0" />
              ) : (
                <PowerOff className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              )}
              <span className={e.is_active ? 'text-primary font-medium' : 'text-muted-foreground font-medium'}>
                {e.is_active ? 'Aktiviert' : 'Deaktiviert'}
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">
                {new Date(e.created_at).toLocaleString('de-DE', {
                  day: '2-digit', month: '2-digit', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </span>
              {e.changed_by_email && (
                <>
                  <span className="text-muted-foreground">·</span>
                  <span className="truncate">{e.changed_by_email}</span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
