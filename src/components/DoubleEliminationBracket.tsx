import { Match, Player } from '@/types/tournament';
import { Trophy } from 'lucide-react';

interface Props {
  matches: Match[];
  wbRounds: number;
  getPlayer: (id: string | null) => Player | null;
}

export function DoubleEliminationBracket({ matches, wbRounds, getPlayer }: Props) {
  const wbMatches = matches.filter(m => m.groupNumber === null || m.groupNumber === undefined);
  const lbMatches = matches.filter(m => m.groupNumber === -1);
  const gfMatches = matches.filter(m => m.groupNumber === -2);
  const lbRoundCount = 2 * (wbRounds - 1);

  const gfMatch = gfMatches[0];
  const champion = gfMatch?.winnerId ? getPlayer(gfMatch.winnerId) : null;

  const roundNames = (r: number, total: number) => {
    const diff = total - r;
    if (diff === 1) return 'WB Finale';
    if (diff === 2) return 'WB Halbfinale';
    if (diff === 3) return 'WB Viertelfinale';
    return `WB Runde ${r + 1}`;
  };

  return (
    <div className="space-y-8 animate-slide-up">
      {champion && (
        <div className="bg-gradient-to-r from-primary/20 to-accent/20 border-2 border-primary/30 rounded-xl p-6 text-center">
          <Trophy className="h-8 w-8 mx-auto mb-2 text-primary" />
          <p className="text-sm text-muted-foreground">Turniersieger</p>
          <p className="text-2xl font-extrabold text-primary">{champion.name}</p>
          {champion.club && <p className="text-xs text-muted-foreground">{champion.club}</p>}
        </div>
      )}

      {/* Winner Bracket */}
      <div>
        <h4 className="font-bold text-sm mb-3 text-primary">🏆 Winner Bracket</h4>
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-6 min-w-max items-start">
            {Array.from({ length: wbRounds }).map((_, r) => {
              const roundMatches = wbMatches
                .filter(m => m.round === r)
                .sort((a, b) => a.position - b.position);
              return (
                <div key={r} className="flex flex-col min-w-[200px]">
                  <div className="text-center mb-3 pb-2 border-b border-border/40">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                      {roundNames(r, wbRounds)}
                    </h3>
                    <span className="text-[10px] text-muted-foreground/60">
                      {roundMatches.length} {roundMatches.length === 1 ? 'Spiel' : 'Spiele'}
                    </span>
                  </div>
                  <div className="flex flex-col justify-around flex-1" style={{ gap: `${Math.max(Math.pow(2, r) * 8, 12)}px` }}>
                    {roundMatches.map(match => (
                      <MatchCard key={match.id} match={match} getPlayer={getPlayer} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Loser Bracket */}
      {lbMatches.length > 0 && (
        <div>
          <h4 className="font-bold text-sm mb-3 text-destructive">💀 Trostrunde (Loser Bracket)</h4>
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-6 min-w-max items-start">
              {Array.from({ length: lbRoundCount }).map((_, r) => {
                const roundMatches = lbMatches
                  .filter(m => m.round === r)
                  .sort((a, b) => a.position - b.position);
                if (roundMatches.length === 0) return null;
                return (
                  <div key={r} className="flex flex-col min-w-[200px]">
                    <div className="text-center mb-3 pb-2 border-b border-border/40">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                        LB Runde {r + 1}
                      </h3>
                      <span className="text-[10px] text-muted-foreground/60">
                        {roundMatches.length} {roundMatches.length === 1 ? 'Spiel' : 'Spiele'}
                      </span>
                    </div>
                    <div className="flex flex-col justify-around flex-1" style={{ gap: `${Math.max(Math.pow(2, Math.floor(r / 2)) * 8, 12)}px` }}>
                      {roundMatches.map(match => (
                        <MatchCard key={match.id} match={match} getPlayer={getPlayer} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Grand Final */}
      {gfMatch && (
        <div>
          <h4 className="font-bold text-sm mb-3 text-primary">⭐ Grand Final</h4>
          <div className="max-w-[250px]">
            <MatchCard match={gfMatch} getPlayer={getPlayer} highlight />
          </div>
        </div>
      )}
    </div>
  );
}

function MatchCard({ match, getPlayer, highlight = false }: { match: Match; getPlayer: (id: string | null) => Player | null; highlight?: boolean }) {
  const isActive = match.status === 'active';
  const isCompleted = match.status === 'completed';

  const borderClass = isActive
    ? 'border-primary ring-2 ring-primary/20 animate-pulse-glow'
    : isCompleted ? 'border-border/60' : 'border-border/30';
  const bgClass = isActive ? 'bg-card' : isCompleted ? 'bg-card/80' : 'bg-card/40';

  return (
    <div className={`rounded-lg border-2 ${borderClass} ${bgClass} overflow-hidden shadow-sm ${highlight ? 'ring-1 ring-primary/20' : ''}`}>
      <PlayerRow player={getPlayer(match.player1Id)} isWinner={match.winnerId === match.player1Id && match.winnerId !== null} isLoser={match.winnerId !== null && match.winnerId !== match.player1Id} match={match} playerKey="player1" />
      <div className="h-px bg-border/40 mx-2" />
      <PlayerRow player={getPlayer(match.player2Id)} isWinner={match.winnerId === match.player2Id && match.winnerId !== null} isLoser={match.winnerId !== null && match.winnerId !== match.player2Id} match={match} playerKey="player2" />
      {isActive && match.table && (
        <div className="bg-primary/15 text-primary text-[10px] text-center py-0.5 font-bold uppercase tracking-wider">
          Tisch {match.table}
        </div>
      )}
    </div>
  );
}

function PlayerRow({ player, isWinner, isLoser, match, playerKey }: {
  player: Player | null; isWinner: boolean; isLoser: boolean; match: Match; playerKey: 'player1' | 'player2';
}) {
  const sets = match.sets;
  const hasSets = sets.length > 0 && sets.some(s => s.player1 > 0 || s.player2 > 0);
  const wins = sets.filter(s => {
    const score = s[playerKey];
    const opp = s[playerKey === 'player1' ? 'player2' : 'player1'];
    return score >= 11 && score - opp >= 2;
  }).length;

  return (
    <div className={`flex items-center gap-2 px-3 py-2 text-sm ${isWinner ? 'bg-primary/10' : isLoser ? 'opacity-50' : ''}`}>
      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isWinner ? 'bg-primary' : player ? 'bg-muted-foreground/30' : 'bg-transparent'}`} />
      <span className={`truncate flex-1 min-w-0 ${isWinner ? 'font-bold text-primary' : isLoser ? 'text-muted-foreground' : player ? 'font-medium' : 'text-muted-foreground/50 italic'}`}>
        {player?.name || 'TBD'}
      </span>
      {hasSets && (
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {sets.filter(s => s.player1 > 0 || s.player2 > 0).map((s, i) => {
            const score = s[playerKey];
            const opp = s[playerKey === 'player1' ? 'player2' : 'player1'];
            const wonSet = score >= 11 && score - opp >= 2;
            return (
              <span key={i} className={`text-[10px] w-5 text-center rounded-sm py-px ${wonSet ? 'bg-primary/15 text-primary font-bold' : 'text-muted-foreground'}`}>
                {score}
              </span>
            );
          })}
        </div>
      )}
      <span className={`font-bold text-sm min-w-[18px] text-right flex-shrink-0 ${isWinner ? 'text-primary' : hasSets ? '' : 'text-transparent'}`}>
        {hasSets ? wins : '0'}
      </span>
    </div>
  );
}
