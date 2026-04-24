import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTournamentDb } from '@/hooks/useTournamentDb';
import { GroupStageView } from '@/components/GroupStageView';
import { TournamentBracket } from '@/components/TournamentBracket';
import { SponsorLogos } from '@/components/SponsorLogos';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Loader2, ChevronDown } from 'lucide-react';

const GroupBracketView = () => {
  const { id } = useParams<{ id: string }>();
  const { tournament, loading, getPlayer, getParticipantName } = useTournamentDb(id || null);
  const isDoubles = tournament.type === 'doubles';
  const [groupOpen, setGroupOpen] = useState(true);
  const [koOpen, setKoOpen] = useState(true);

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
      <div className="container py-6 space-y-6">
        {/* Gruppenphase */}
        {groupCount > 0 && groupMatches.length > 0 && (
          <Collapsible open={groupOpen} onOpenChange={setGroupOpen} asChild>
            <section className="rounded-xl border border-border/60 bg-card/40 overflow-hidden">
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="w-full flex items-center justify-between gap-3 px-5 py-3 border-b border-border/50 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/15 text-primary text-sm font-bold flex-shrink-0">1</span>
                    <div className="min-w-0">
                      <h3 className="text-base font-bold leading-tight">Gruppenphase</h3>
                      <p className="text-xs text-muted-foreground truncate">
                        {groupOpen ? 'Ergebnisse & Tabellen' : 'Klick zum Anzeigen'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded bg-muted text-muted-foreground hidden sm:inline">
                      Phase 1
                    </span>
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${groupOpen ? 'rotate-180' : ''}`} />
                  </div>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="p-4">
                  <GroupStageView
                    matches={groupMatches}
                    players={tournament.players}
                    getParticipantName={getParticipantNameLocal}
                    groupCount={groupCount}
                    koQualificationMode={tournament.koQualificationMode}
                  />
                </div>
              </CollapsibleContent>
            </section>
          </Collapsible>
        )}

        {/* Trenner */}
        {phase === 'knockout' && koMatches.length > 0 && (
          <div className="flex items-center gap-3" aria-hidden="true">
            <div className="flex-1 h-px bg-border/60" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
              ↓ Qualifizierte ziehen ins K.O. ein ↓
            </span>
            <div className="flex-1 h-px bg-border/60" />
          </div>
        )}

        {/* K.O.-Runde */}
        {phase === 'knockout' && koMatches.length > 0 && (
          <Collapsible open={koOpen} onOpenChange={setKoOpen} asChild>
            <section className="rounded-xl border-2 border-primary/30 bg-primary/[0.02] overflow-hidden">
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="w-full flex items-center justify-between gap-3 px-5 py-3 border-b border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary text-primary-foreground text-sm font-bold flex-shrink-0">2</span>
                    <div className="min-w-0">
                      <h3 className="text-base font-bold leading-tight text-primary">K.O.-Runde</h3>
                      <p className="text-xs text-muted-foreground truncate">
                        {koOpen ? 'Finalrunden um den Turniersieg' : 'Klick zum Anzeigen'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded bg-primary/15 text-primary hidden sm:inline">
                      Phase 2
                    </span>
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${koOpen ? 'rotate-180' : ''}`} />
                  </div>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="p-4">
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
                </div>
              </CollapsibleContent>
            </section>
          </Collapsible>
        )}

        <SponsorLogos sponsors={tournament.sponsors} />
      </div>
    </div>
  );
};

export default GroupBracketView;
