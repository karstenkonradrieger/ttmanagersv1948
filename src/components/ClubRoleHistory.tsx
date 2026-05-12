import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Shield, UserCheck, UserMinus, ArrowRight, Clock, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useClubAuthority } from '@/hooks/useClubAuthority';

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

const PAGE_SIZE = 10;

function roleLabel(r: string | null) {
  if (r === 'admin') return 'Administrator';
  if (r === 'chairman') return 'Vorsitzender';
  if (r === 'player') return 'Spieler';
  return '—';
}

function maskEmail(email: string | null | undefined): string {
  if (!email) return 'verifiziert unbekannt';
  const [local, domain] = email.split('@');
  if (!domain) return 'verifiziert unbekannt';
  const head = local.slice(0, 2);
  return `${head}${'•'.repeat(Math.max(1, local.length - 2))}@${domain}`;
}

function anonName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.map(p => (p ? p[0].toUpperCase() + '.' : '')).join(' ') || 'Unbekannt';
}

type RoleFilter = 'all' | 'admin' | 'chairman';
type ActionFilter = 'all' | 'insert' | 'update' | 'delete';

export function ClubRoleHistory({ clubId }: { clubId: string }) {
  const { user } = useAuth();
  const { canManageClub, userEmail } = useClubAuthority();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [actionFilter, setActionFilter] = useState<ActionFilter>('all');
  const [isMember, setIsMember] = useState(false);

  const canManage = canManageClub(clubId);
  const canSeeEmails = !!user && (canManage || isMember);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from('club_role_history')
        .select('id, player_name, player_email, old_role, new_role, action, changed_by_email, created_at')
        .eq('club_id', clubId)
        .order('created_at', { ascending: false });
      let memberFlag = false;
      if (user && userEmail) {
        const { data: priv } = await supabase
          .from('club_players')
          .select('email')
          .eq('club_id', clubId);
        memberFlag = (priv || []).some(p => (p.email || '').toLowerCase().trim() === userEmail);
      }
      if (!cancelled) {
        setEntries((data as any) || []);
        setIsMember(memberFlag);
        setLoading(false);
        setVisible(PAGE_SIZE);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [clubId, user, userEmail]);

  const filtered = useMemo(() => {
    return entries.filter(e => {
      if (roleFilter !== 'all') {
        if (e.new_role !== roleFilter && e.old_role !== roleFilter) return false;
      }
      if (actionFilter !== 'all' && e.action !== actionFilter) return false;
      return true;
    });
  }, [entries, roleFilter, actionFilter]);

  if (loading) return <p className="text-xs text-muted-foreground italic">Lade Rollenverlauf...</p>;

  const shown = filtered.slice(0, visible);
  const hasMore = filtered.length > visible;

  const FilterChip = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button
      onClick={onClick}
      className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded transition-colors ${
        active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70'
      }`}
    >
      {children}
    </button>
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Rollenverlauf {filtered.length > 0 && <span className="ml-1 normal-case">({filtered.length})</span>}
        </span>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="h-3 w-3 text-muted-foreground" />
          <div className="flex gap-1">
            <FilterChip active={roleFilter === 'all'} onClick={() => setRoleFilter('all')}>Alle Rollen</FilterChip>
            <FilterChip active={roleFilter === 'admin'} onClick={() => setRoleFilter('admin')}>Admin</FilterChip>
            <FilterChip active={roleFilter === 'chairman'} onClick={() => setRoleFilter('chairman')}>Vorsitz</FilterChip>
          </div>
          <div className="flex gap-1">
            <FilterChip active={actionFilter === 'all'} onClick={() => setActionFilter('all')}>Alle Aktionen</FilterChip>
            <FilterChip active={actionFilter === 'insert'} onClick={() => setActionFilter('insert')}>Insert</FilterChip>
            <FilterChip active={actionFilter === 'update'} onClick={() => setActionFilter('update')}>Update</FilterChip>
            <FilterChip active={actionFilter === 'delete'} onClick={() => setActionFilter('delete')}>Delete</FilterChip>
          </div>
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Keine Einträge für die gewählten Filter</p>
      ) : (
        <div className="space-y-1">
          {shown.map(e => {
            const Icon = e.action === 'delete' ? UserMinus : (e.new_role || e.old_role) === 'admin' ? Shield : UserCheck;
            const displayName = canSeeEmails ? e.player_name : anonName(e.player_name);
            const displayEmail = canSeeEmails ? e.player_email : maskEmail(e.player_email);
            const displayActor = canSeeEmails ? e.changed_by_email : maskEmail(e.changed_by_email);
            return (
              <div key={e.id} className="flex items-center gap-2 text-xs bg-background/60 rounded-md px-2.5 py-1.5">
                <Icon className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                <span className="font-medium">{displayName}</span>
                {displayEmail && (
                  <span className="text-muted-foreground hidden sm:inline">· {displayEmail}</span>
                )}
                <span className="text-muted-foreground flex items-center gap-1">
                  {roleLabel(e.old_role)}
                  <ArrowRight className="h-3 w-3" />
                  {roleLabel(e.new_role)}
                </span>
                <span className="ml-auto flex items-center gap-1 text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {new Date(e.created_at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  {displayActor && <span className="ml-1">· {displayActor}</span>}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {hasMore && (
        <div className="flex justify-center pt-1">
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setVisible(v => v + PAGE_SIZE)}>
            Mehr laden ({filtered.length - visible})
          </Button>
        </div>
      )}

      {!canSeeEmails && (
        <p className="text-[10px] text-muted-foreground italic">
          E-Mail-Adressen sind nur für eingeloggte Vereinsmitglieder sichtbar.
        </p>
      )}
    </div>
  );
}
