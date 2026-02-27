import { Match, Player } from '@/types/tournament';
import { Trophy } from 'lucide-react';

interface Props {
  matches: Match[];
  rounds: number;
  getPlayer: (id: string | null) => Player | null;
}

export function TournamentBracket({ matches, rounds, getPlayer }: Props) {
  if (matches.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-12">
        Starte das Turnier, um den Bracket zu sehen
      </div>
    );
  }

  const roundNames = (r: number, total: number) => {
    const diff = total - r;
    if (diff === 1) return 'Finale';
    if (diff === 2) return 'Halbfinale';
    if (diff === 3) return 'Viertelfinale';
    return `Runde ${r + 1}`;
  };

  const finalist = matches.find(m => m.round === rounds - 1 && m.winnerId);
  const champion = finalist ? getPlayer(finalist.winnerId) : null;

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-6 min-w-max items-start">
        {Array.from({ length: rounds }).map((_, r) => {
          const roundMatches = matches
            .filter(m => m.round === r)
            .sort((a, b) => a.position - b.position);

          const isFinal = r === rounds - 1;

          return (
            <div key={r} className="flex flex-col min-w-[220px]">
              <div className={`text-center mb-3 pb-2 border-b ${isFinal ? 'border-primary/40' : 'border-border/40'}`}>
                <h3 className={`text-xs font-bold uppercase tracking-widest ${isFinal ? 'text-primary' : 'text-muted-foreground'}`}>
                  {roundNames(r, rounds)}
                </h3>
                <span className="text-[10px] text-muted-foreground/60">
                  {roundMatches.length} {roundMatches.length === 1 ? 'Spiel' : 'Spiele'}
                </span>
              </div>
              <div
                className="flex flex-col justify-around flex-1"
                style={{ gap: `${Math.max(Math.pow(2, r) * 8, 12)}px` }}
              >
                {roundMatches.map(match => (
                  <BracketMatch key={match.id} match={match} getPlayer={getPlayer} isFinal={isFinal} />
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
  );
}

function BracketMatch({ match, getPlayer, isFinal }: { match: Match; getPlayer: (id: string | null) => Player | null; isFinal: boolean }) {
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
      />
      {isActive && match.table && (
        <div className="bg-primary/15 text-primary text-[10px] text-center py-0.5 font-bold uppercase tracking-wider">
          Tisch {match.table}
        </div>
      )}
    </div>
  );
}

function PlayerSlot({ player, wins, isWinner, isLoser, sets, playerKey, isActive }: {
  player: Player | null;
  wins: number;
  isWinner: boolean;
  isLoser: boolean;
  sets: Array<{ player1: number; player2: number }>;
  playerKey: 'player1' | 'player2';
  isActive: boolean;
}) {
  const hasSets = sets.length > 0 && sets.some(s => s.player1 > 0 || s.player2 > 0);

  return (
    <div className={`flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
      isWinner ? 'bg-primary/10' : isLoser ? 'opacity-50' : ''
    }`}>
      {/* Seed / Status indicator */}
      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
        isWinner ? 'bg-primary' : isActive ? 'bg-primary animate-pulse' : player ? 'bg-muted-foreground/30' : 'bg-transparent'
      }`} />

      {/* Player name */}
      <span className={`truncate flex-1 min-w-0 ${
        isWinner ? 'font-bold text-primary' :
        isLoser ? 'text-muted-foreground' :
        player ? 'font-medium' : 'text-muted-foreground/50 italic'
      }`}>
        {player?.name || 'TBD'}
      </span>

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
