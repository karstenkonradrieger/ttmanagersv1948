import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { Match, Player } from '@/types/tournament';
import { Trophy, ChevronDown, ChevronUp, Info, ArrowUp, ArrowDown } from 'lucide-react';
import { getRoundLabel } from './bracketLabels';
import { computeQualifiedPlayers, TiebreakerCriterion, DEFAULT_TIEBREAKER_ORDER } from '@/services/byeValidation';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';

type SeedInfo = {
  seed: number;
  rank: number;
  groupNumber: number;
  won: number;
  setsDiff: number;
  pointsDiff: number;
};

interface Props {
  matches: Match[];
  rounds: number;
  getPlayer: (id: string | null) => Player | null;
  /** All tournament matches (incl. group stage) – needed for seeding details */
  allMatches?: Match[];
  /** All tournament players – needed for seeding details */
  players?: Player[];
}

export function TournamentBracket({ matches, rounds, getPlayer, allMatches, players }: Props) {
  const presentRounds = useMemo(() =>
    Array.from(new Set(matches.map(m => m.round))).sort((a, b) => a - b),
    [matches]
  );
  const maxRound = presentRounds[presentRounds.length - 1] ?? rounds - 1;

  const roundNames = (r: number) => getRoundLabel(r, matches);

  const finalist = matches.find(m => m.round === maxRound && m.winnerId);
  const champion = finalist ? getPlayer(finalist.winnerId) : null;

  // Configurable tiebreaker order and H2H priority — persisted in localStorage
  const LS_KEY = 'tt-tiebreaker-config';
  const [tiebreakerOrder, setTiebreakerOrder] = useState<TiebreakerCriterion[]>(() => {
    try {
      const stored = localStorage.getItem(LS_KEY);
      if (stored) { const parsed = JSON.parse(stored); return parsed.order ?? DEFAULT_TIEBREAKER_ORDER; }
    } catch {}
    return DEFAULT_TIEBREAKER_ORDER;
  });
  const [h2hPriority, setH2hPriority] = useState(() => {
    try {
      const stored = localStorage.getItem(LS_KEY);
      if (stored) { const parsed = JSON.parse(stored); return parsed.h2hPriority ?? false; }
    } catch {}
    return false;
  });

  const initialRender = useRef(true);
  useEffect(() => {
    if (initialRender.current) { initialRender.current = false; return; }
    localStorage.setItem(LS_KEY, JSON.stringify({ order: tiebreakerOrder, h2hPriority }));
    toast.success('Tiebreaker-Konfiguration gespeichert');
  }, [tiebreakerOrder, h2hPriority]);

  const moveCriterion = useCallback((idx: number, dir: -1 | 1) => {
    setTiebreakerOrder(prev => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }, []);

  const criterionLabels: Record<TiebreakerCriterion, string> = {
    wins: 'Siege',
    setsDiff: 'Satzdifferenz',
    pointsDiff: 'Punktdifferenz',
  };

  // Compute seeding details for first KO round when group data is available
  const seedingDetails = useMemo(() => {
    if (!allMatches || !players || matches.length === 0) return null;
    const groupMatches = allMatches.filter(m => m.groupNumber !== undefined && m.groupNumber !== null);
    if (groupMatches.length === 0) return null;
    const { winners, runnersUp } = computeQualifiedPlayers(groupMatches, players, 2, tiebreakerOrder, h2hPriority);
    const seeded = [...winners, ...runnersUp];
    if (seeded.length < 2) return null;

    // Reconstruct bracket slot assignments (same logic as useTournamentDb)
    const firstRoundMatches = matches
      .filter(m => m.round === (presentRounds[0] ?? 0))
      .sort((a, b) => a.position - b.position);

    return firstRoundMatches.map((m, idx) => {
      const p1 = m.player1Id ? getPlayer(m.player1Id) : null;
      const p2 = m.player2Id ? getPlayer(m.player2Id) : null;
      const s1 = seeded.find(s => s.playerId === m.player1Id);
      const s2 = seeded.find(s => s.playerId === m.player2Id);
      const seed1 = s1 ? seeded.indexOf(s1) + 1 : null;
      const seed2 = s2 ? seeded.indexOf(s2) + 1 : null;
      const isBye = (p1 && !p2) || (!p1 && p2);
      return { position: idx + 1, p1, p2, s1, s2, seed1, seed2, isBye };
    });
  }, [allMatches, players, matches, presentRounds, getPlayer, tiebreakerOrder, h2hPriority]);

  const tierLabelShort = (rank: number) => rank === 1 ? 'Gruppensieger' : rank === 2 ? 'Gruppenzweiter' : rank === 3 ? 'Gruppendritter' : `Gr.-${rank}.`;

  // Map playerId -> SeedInfo for first-round tooltips
  const seedMap = useMemo(() => {
    const map = new Map<string, SeedInfo>();
    if (!allMatches || !players) return map;
    const groupMatches = allMatches.filter(m => m.groupNumber !== undefined && m.groupNumber !== null);
    if (groupMatches.length === 0) return map;
    const { winners, runnersUp, bestThirds } = computeQualifiedPlayers(groupMatches, players, 2, tiebreakerOrder, h2hPriority) as any;
    const seeded = [...winners, ...runnersUp, ...(bestThirds ?? [])];
    seeded.forEach((s, idx) => {
      map.set(s.playerId, {
        seed: idx + 1,
        rank: s.rank,
        groupNumber: s.groupNumber,
        won: s.won,
        setsDiff: s.setsDiff,
        pointsDiff: s.pointsDiff,
      });
    });
    return map;
  }, [allMatches, players, tiebreakerOrder, h2hPriority]);

  const firstRound = presentRounds[0] ?? 0;

  const [seedingOpen, setSeedingOpen] = useState(false);

  const tierLabel = (rank: number) => rank === 1 ? 'Gruppensieger' : rank === 2 ? 'Gruppenzweiter' : `Gr.-${rank}.`;

  if (matches.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-12">
        Starte das Turnier, um den Bracket zu sehen
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={150}>
    <div className="space-y-4">
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-6 min-w-max items-start">
          {presentRounds.map((r, idx) => {
            const roundMatches = matches
              .filter(m => m.round === r)
              .sort((a, b) => a.position - b.position);

            const isFinal = r === maxRound;

            return (
              <div key={r} className="flex flex-col min-w-[220px]">
                <div className={`text-center mb-3 pb-2 border-b ${isFinal ? 'border-primary/40' : 'border-border/40'}`}>
                  <h3 className={`text-xs font-bold uppercase tracking-widest ${isFinal ? 'text-primary' : 'text-muted-foreground'}`}>
                    {roundNames(r)}
                  </h3>
                  <span className="text-[10px] text-muted-foreground/60">
                    {roundMatches.length} {roundMatches.length === 1 ? 'Spiel' : 'Spiele'}
                  </span>
                </div>
                <div
                  className="flex flex-col justify-around flex-1"
                  style={{ gap: `${Math.max(Math.pow(2, idx) * 8, 12)}px` }}
                >
                  {roundMatches.map(match => (
                    <BracketMatch key={match.id} match={match} getPlayer={getPlayer} isFinal={isFinal} seedMap={r === firstRound ? seedMap : undefined} tierLabel={tierLabelShort} />
                  ))}
                </div>
              </div>
            );
          })}

          {champion && (
            <div className="flex flex-col min-w-[180px] items-center justify-center">
              <div className="text-center mb-3 pb-2 border-b border-primary/40 w-full">
                <h3 className="text-xs font-bold uppercase tracking-widest text-primary">Sieger</h3>
              </div>
              <div className="flex flex-col items-center gap-2 mt-4 p-4 rounded-xl bg-primary/10 border-2 border-primary/30">
                <Trophy className="h-8 w-8 text-primary" />
                <span className="font-extrabold text-lg text-primary">{champion.name}</span>
                {champion.club && (
                  <span className="text-xs text-muted-foreground">{champion.club}</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {seedingDetails && seedingDetails.length > 0 && (
        <Collapsible open={seedingOpen} onOpenChange={setSeedingOpen}>
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors w-full py-2">
              <Info className="h-3.5 w-3.5" />
              <span>Setzlogik-Details (1. K.O.-Runde)</span>
              <ChevronDown className={`h-3.5 w-3.5 ml-auto transition-transform ${seedingOpen ? 'rotate-180' : ''}`} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="rounded-lg border border-border/50 bg-muted/30 p-3 space-y-3">
              {/* Tiebreaker order config */}
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold text-muted-foreground">Tiebreaker-Reihenfolge (anpassbar):</p>
                <div className="flex flex-col gap-1">
                  {tiebreakerOrder.map((criterion, idx) => (
                    <div key={criterion} className="flex items-center gap-1.5 text-xs bg-background/60 border border-border/30 rounded-md px-2 py-1">
                      <span className="font-bold text-muted-foreground min-w-[16px]">{idx + 1}.</span>
                      <span className="flex-1 font-medium">{criterionLabels[criterion]}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        disabled={idx === 0}
                        onClick={() => moveCriterion(idx, -1)}
                      >
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        disabled={idx === tiebreakerOrder.length - 1}
                        onClick={() => moveCriterion(idx, 1)}
                      >
                        <ArrowDown className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
              {/* H2H priority toggle */}
              <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={h2hPriority}
                  onChange={(e) => setH2hPriority(e.target.checked)}
                  className="rounded border-border accent-primary h-3.5 w-3.5"
                />
                <span className="font-medium">Direkter Vergleich (H2H) hat Vorrang</span>
                <span className="text-muted-foreground text-[10px]">
                  {h2hPriority ? '— H2H wird vor der Tiebreaker-Reihenfolge geprüft' : '— H2H greift nur als letzter Fallback'}
                </span>
              </label>
              <p className="text-[11px] text-muted-foreground">
                Setzung: Gruppensieger (nach {h2hPriority ? 'H2H → ' : ''}{tiebreakerOrder.map(c => criterionLabels[c]).join(' → ')}{!h2hPriority ? ' → H2H' : ''}), dann Gruppenzweite nach gleicher Logik. Seed #1 trifft auf den niedrigsten Seed.
              </p>
              <div className="space-y-1.5">
                {seedingDetails.map((d) => (
                  <div key={d.position} className="flex items-start gap-2 text-xs rounded-md bg-background/60 border border-border/30 px-2.5 py-1.5">
                    <span className="font-bold text-muted-foreground min-w-[24px]">#{d.position}</span>
                    <div className="flex-1 space-y-0.5">
                      {d.isBye ? (
                        <span className="text-muted-foreground italic">
                          {d.p1?.name || d.p2?.name} — Freilos (Seed {d.seed1 ?? d.seed2})
                        </span>
                      ) : (
                        <>
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className="font-semibold">{d.p1?.name ?? 'TBD'}</span>
                            {d.seed1 && (
                              <span className="px-1 py-px rounded text-[10px] bg-primary/15 text-primary font-bold">
                                Seed {d.seed1}
                              </span>
                            )}
                            {d.s1 && (
                              <span className="text-muted-foreground text-[10px]">
                                ({tierLabel(d.s1.rank)}, Gr.{d.s1.groupNumber + 1}: {d.s1.won}S, ±{d.s1.setsDiff > 0 ? '+' : ''}{d.s1.setsDiff} Sätze, ±{d.s1.pointsDiff > 0 ? '+' : ''}{d.s1.pointsDiff} Pkt)
                              </span>
                            )}
                          </div>
                          <div className="text-muted-foreground/60 text-[10px] pl-1">vs.</div>
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className="font-semibold">{d.p2?.name ?? 'TBD'}</span>
                            {d.seed2 && (
                              <span className="px-1 py-px rounded text-[10px] bg-accent/50 text-accent-foreground font-bold">
                                Seed {d.seed2}
                              </span>
                            )}
                            {d.s2 && (
                              <span className="text-muted-foreground text-[10px]">
                                ({tierLabel(d.s2.rank)}, Gr.{d.s2.groupNumber + 1}: {d.s2.won}S, ±{d.s2.setsDiff > 0 ? '+' : ''}{d.s2.setsDiff} Sätze, ±{d.s2.pointsDiff > 0 ? '+' : ''}{d.s2.pointsDiff} Pkt)
                              </span>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
    </TooltipProvider>
  );
}

function BracketMatch({ match, getPlayer, isFinal, seedMap, tierLabel }: { match: Match; getPlayer: (id: string | null) => Player | null; isFinal: boolean; seedMap?: Map<string, SeedInfo>; tierLabel?: (rank: number) => string }) {
  const p1 = getPlayer(match.player1Id);
  const p2 = getPlayer(match.player2Id);
  const p1Wins = match.sets.filter(s => s.player1 >= 11 && s.player1 - s.player2 >= 2).length;
  const p2Wins = match.sets.filter(s => s.player2 >= 11 && s.player2 - s.player1 >= 2).length;

  const isActive = match.status === 'active';
  const isCompleted = match.status === 'completed';

  const borderClass = isActive
    ? 'border-primary ring-2 ring-primary/20 animate-pulse-glow'
    : isCompleted
      ? 'border-border/60'
      : 'border-border/30';

  const bgClass = isActive
    ? 'bg-card'
    : isCompleted
      ? 'bg-card/80'
      : 'bg-card/40';

  return (
    <div className={`rounded-lg border-2 ${borderClass} ${bgClass} overflow-hidden shadow-sm transition-all ${isFinal ? 'ring-1 ring-primary/10' : ''}`}>
      <PlayerSlot
        player={p1}
        wins={p1Wins}
        isWinner={match.winnerId === match.player1Id && match.winnerId !== null}
        isLoser={match.winnerId !== null && match.winnerId !== match.player1Id}
        sets={match.sets}
        playerKey="player1"
        isActive={isActive}
        seedInfo={match.player1Id ? seedMap?.get(match.player1Id) : undefined}
        tierLabel={tierLabel}
      />
      <div className="h-px bg-border/40 mx-2" />
      <PlayerSlot
        player={p2}
        wins={p2Wins}
        isWinner={match.winnerId === match.player2Id && match.winnerId !== null}
        isLoser={match.winnerId !== null && match.winnerId !== match.player2Id}
        sets={match.sets}
        playerKey="player2"
        isActive={isActive}
        seedInfo={match.player2Id ? seedMap?.get(match.player2Id) : undefined}
        tierLabel={tierLabel}
      />
      {isActive && match.table && (
        <div className="bg-primary/15 text-primary text-[10px] text-center py-0.5 font-bold uppercase tracking-wider">
          Tisch {match.table}
        </div>
      )}
    </div>
  );
}

function PlayerSlot({ player, wins, isWinner, isLoser, sets, playerKey, isActive, seedInfo, tierLabel }: {
  player: Player | null;
  wins: number;
  isWinner: boolean;
  isLoser: boolean;
  sets: Array<{ player1: number; player2: number }>;
  playerKey: 'player1' | 'player2';
  isActive: boolean;
  seedInfo?: SeedInfo;
  tierLabel?: (rank: number) => string;
}) {
  const hasSets = sets.length > 0 && sets.some(s => s.player1 > 0 || s.player2 > 0);

  const nameEl = (
    <span className={`truncate flex-1 min-w-0 ${
      isWinner ? 'font-bold text-primary' :
      isLoser ? 'text-muted-foreground' :
      player ? 'font-medium' : 'text-muted-foreground/50 italic'
    } ${seedInfo ? 'cursor-help underline decoration-dotted decoration-primary/40 underline-offset-2' : ''}`}>
      {player?.name || 'TBD'}
      {seedInfo && (
        <span className="ml-1.5 px-1 py-px rounded text-[9px] bg-primary/15 text-primary font-bold align-middle">
          #{seedInfo.seed}
        </span>
      )}
    </span>
  );

  return (
    <div className={`flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
      isWinner ? 'bg-primary/10' : isLoser ? 'opacity-50' : ''
    }`}>
      {/* Seed / Status indicator */}
      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
        isWinner ? 'bg-primary' : isActive ? 'bg-primary animate-pulse' : player ? 'bg-muted-foreground/30' : 'bg-transparent'
      }`} />

      {/* Player name (with optional seed tooltip) */}
      {seedInfo && player ? (
        <Tooltip>
          <TooltipTrigger asChild>{nameEl}</TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <div className="space-y-1 text-xs">
              <div className="font-bold text-primary">Seed #{seedInfo.seed} – {tierLabel?.(seedInfo.rank) ?? `Rang ${seedInfo.rank}`}</div>
              <div className="text-muted-foreground">aus Gruppe {seedInfo.groupNumber + 1}</div>
              <div className="text-muted-foreground">
                {seedInfo.won} Siege · Satzdiff. {seedInfo.setsDiff > 0 ? '+' : ''}{seedInfo.setsDiff} · Punktdiff. {seedInfo.pointsDiff > 0 ? '+' : ''}{seedInfo.pointsDiff}
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      ) : nameEl}


      {/* Set scores */}
      {hasSets && (
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {sets.filter(s => s.player1 > 0 || s.player2 > 0).map((s, i) => {
            const score = s[playerKey];
            const opponentScore = s[playerKey === 'player1' ? 'player2' : 'player1'];
            const wonSet = score >= 11 && score - opponentScore >= 2;
            return (
              <span
                key={i}
                className={`text-[10px] w-5 text-center rounded-sm py-px ${
                  wonSet ? 'bg-primary/15 text-primary font-bold' : 'text-muted-foreground'
                }`}
              >
                {score}
              </span>
            );
          })}
        </div>
      )}

      {/* Total set wins */}
      <span className={`font-bold text-sm min-w-[18px] text-right flex-shrink-0 ${
        isWinner ? 'text-primary' : hasSets ? '' : 'text-transparent'
      }`}>
        {hasSets ? wins : '0'}
      </span>
    </div>
  );
}
