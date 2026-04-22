import { useParams } from 'react-router-dom';
import { useTournamentDb } from '@/hooks/useTournamentDb';
import { GroupStageView } from '@/components/GroupStageView';
import { TournamentBracket } from '@/components/TournamentBracket';
import { SponsorLogos } from '@/components/SponsorLogos';
import { Loader2 } from 'lucide-react';

const GroupBracketView = () => {
  const { id } = useParams<{ id: string }>();
  const { tournament, loading, getPlayer, getParticipantName } = useTournamentDb(id || null);
  const isDoubles = tournament.type === 'doubles';

  const getParticipantNameLocal = isDoubles
    ? getParticipantName
    : (pid: string) => getPlayer(pid)?.name || '—';

  const groupCount = tournament.players.length > 0
    ? Math.max(...tournament.players.map(p => (p.groupNumber ?? 0)), 0) + 1
    : 0;

  const groupMatches = tournament.matches.filter(m => m.groupNumber !== undefined && m.groupNumber !== null);
  const koMatches = tournament.matches.filter(m => (m.groupNumber === undefined || m.groupNumber === null) && (m.bracketType ?? 'main') === 'main');
  const phase = tournament.phase;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="glass border-b border-border/50">
        <div className="container py-3 flex items-center gap-2">
          {tournament.logoUrl && (
            <img src={tournament.logoUrl} alt="Logo" className="h-10 w-10 rounded-lg object-cover" />
          )}
          <h1 className="text-lg font-bold tracking-tight font-display">
            {tournament.name || 'Turnier'}
          </h1>
          <span className="ml-auto text-xs text-muted-foreground font-medium">Gruppen & K.O.</span>
        </div>
      </header>
      <div className="container py-6 space-y-8">
        {/* Gruppenphase */}
        {groupCount > 0 && groupMatches.length > 0 && (
          <section>
            <h2 className="text-base font-bold mb-4">Gruppenphase</h2>
            <GroupStageView
              matches={groupMatches}
              players={tournament.players}
              getParticipantName={getParticipantNameLocal}
              groupCount={groupCount}
            />
          </section>
        )}

        {/* K.O.-Runde */}
        {phase === 'knockout' && koMatches.length > 0 && (
          <>
            <div className="flex items-center gap-3" aria-hidden="true">
              <div className="flex-1 h-px bg-border/60" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
                K.O.-Runde
              </span>
              <div className="flex-1 h-px bg-border/60" />
            </div>
            <section>
              <TournamentBracket
                matches={koMatches}
                rounds={tournament.rounds}
                getPlayer={isDoubles
                  ? (pid) => pid ? { id: pid, name: getParticipantName(pid), club: '', gender: '', birthDate: null, ttr: 0, postalCode: '', city: '', street: '', houseNumber: '', phone: '' } : null
                  : getPlayer
                }
                allMatches={tournament.matches}
                players={tournament.players}
              />
            </section>
          </>
        )}

        <SponsorLogos sponsors={tournament.sponsors} />
      </div>
    </div>
  );
};

export default GroupBracketView;
