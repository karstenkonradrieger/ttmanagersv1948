import { Match, Player } from '@/types/tournament';

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

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-4 min-w-max">
        {Array.from({ length: rounds }).map((_, r) => {
          const roundMatches = matches
            .filter(m => m.round === r)
            .sort((a, b) => a.position - b.position);

          return (
            <div key={r} className="flex flex-col gap-2 min-w-[180px]">
              <h3 className="text-sm font-bold text-primary text-center mb-2">
                {roundNames(r, rounds)}
              </h3>
              <div
                className="flex flex-col justify-around flex-1"
                style={{ gap: `${Math.pow(2, r) * 8}px` }}
              >
                {roundMatches.map(match => (
                  <BracketMatch key={match.id} match={match} getPlayer={getPlayer} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BracketMatch({ match, getPlayer }: { match: Match; getPlayer: (id: string | null) => Player | null }) {
  const p1 = getPlayer(match.player1Id);
  const p2 = getPlayer(match.player2Id);
  const p1Wins = match.sets.filter(s => s.player1 >= 11 && s.player1 - s.player2 >= 2).length;
  const p2Wins = match.sets.filter(s => s.player2 >= 11 && s.player2 - s.player1 >= 2).length;

  const statusColor =
    match.status === 'active' ? 'border-primary animate-pulse-glow' :
    match.status === 'completed' ? 'border-border' :
    'border-border/50';

  return (
    <div className={`rounded-lg border-2 ${statusColor} bg-card card-shadow overflow-hidden`}>
      <PlayerSlot
        player={p1}
        wins={p1Wins}
        isWinner={match.winnerId === match.player1Id && match.winnerId !== null}
        sets={match.sets.map(s => s.player1)}
      />
      <div className="h-px bg-border" />
      <PlayerSlot
        player={p2}
        wins={p2Wins}
        isWinner={match.winnerId === match.player2Id && match.winnerId !== null}
        sets={match.sets.map(s => s.player2)}
      />
      {match.status === 'active' && match.table && (
        <div className="bg-primary/20 text-primary text-xs text-center py-0.5 font-semibold">
          Tisch {match.table}
        </div>
      )}
    </div>
  );
}

function PlayerSlot({ player, wins, isWinner, sets }: {
  player: Player | null;
  wins: number;
  isWinner: boolean;
  sets: number[];
}) {
  return (
    <div className={`flex items-center justify-between px-2 py-1.5 text-sm ${isWinner ? 'bg-primary/10' : ''}`}>
      <span className={`truncate max-w-[100px] ${isWinner ? 'font-bold text-primary' : player ? '' : 'text-muted-foreground'}`}>
        {player?.name || '—'}
      </span>
      <div className="flex items-center gap-1">
        {sets.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {sets.join(' ')}
          </span>
        )}
        <span className={`font-bold min-w-[16px] text-right ${isWinner ? 'text-primary' : ''}`}>
          {sets.length > 0 ? wins : ''}
        </span>
      </div>
    </div>
  );
}
