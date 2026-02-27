import { Match, Player, TournamentMode } from '@/types/tournament';
import { TournamentBracket } from './TournamentBracket';
import { GroupStageView } from './GroupStageView';
import { Monitor, Trophy } from 'lucide-react';

interface Props {
  matches: Match[];
  rounds: number;
  getPlayer: (id: string | null) => Player | null;
  getParticipantName?: (id: string | null) => string;
  mode?: TournamentMode;
  phase?: 'group' | 'knockout' | null;
  players?: Player[];
  groupCount?: number;
}

export function LiveDashboard({ matches, rounds, getPlayer, getParticipantName, mode, phase, players = [], groupCount = 0 }: Props) {
  const getName = (id: string | null) => getParticipantName ? getParticipantName(id) : (getPlayer(id)?.name || '—');
  const activeMatches = matches.filter(m => m.status === 'active');
  const nextPending = matches
    .filter(m => m.status === 'pending' && m.player1Id && m.player2Id)
    .slice(0, 4);

  const champion = rounds > 0
    ? matches.find(m => m.round === rounds - 1 && m.winnerId)
    : null;
  const championPlayer = champion ? getPlayer(champion.winnerId) : null;

  return (
    <div className="space-y-6 animate-slide-up">
      {championPlayer && (
        <div className="bg-gradient-to-r from-primary/20 to-tt-gold/20 border-2 border-tt-gold rounded-xl p-6 text-center">
          <Trophy className="h-12 w-12 mx-auto mb-2 text-tt-gold" />
          <p className="text-sm text-muted-foreground">Turniersieger</p>
          <p className="text-2xl font-extrabold text-tt-gold">{getName(champion?.winnerId)}</p>
          {championPlayer.club && (
            <p className="text-sm text-muted-foreground">{championPlayer.club}</p>
          )}
        </div>
      )}

      {activeMatches.length > 0 && (
        <div>
          <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
            <Monitor className="h-5 w-5 text-primary" />
            Live-Spiele
          </h3>
          <div className="grid gap-3">
            {activeMatches.map(match => {
              const p1 = getPlayer(match.player1Id);
              const p2 = getPlayer(match.player2Id);
              const p1Wins = match.sets.filter(s => s.player1 >= 11 && s.player1 - s.player2 >= 2).length;
              const p2Wins = match.sets.filter(s => s.player2 >= 11 && s.player2 - s.player1 >= 2).length;

              return (
                <div key={match.id} className="bg-card rounded-xl p-4 border-2 border-primary animate-pulse-glow">
                  {match.table && (
                    <p className="text-xs text-primary font-bold mb-2">Tisch {match.table}</p>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="text-center flex-1">
                      <p className="font-bold">{getName(match.player1Id)}</p>
                      <p className="text-3xl font-extrabold text-primary">{p1Wins}</p>
                    </div>
                    <span className="text-muted-foreground text-2xl">:</span>
                    <div className="text-center flex-1">
                      <p className="font-bold">{getName(match.player2Id)}</p>
                      <p className="text-3xl font-extrabold text-primary">{p2Wins}</p>
                    </div>
                  </div>
                  <div className="text-center text-xs text-muted-foreground mt-2">
                    {match.sets.map((s, i) => `${s.player1}:${s.player2}`).join(' | ')}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {nextPending.length > 0 && (
        <div>
          <h3 className="text-lg font-bold mb-3">📋 Nächste Spiele</h3>
          <div className="space-y-2">
            {nextPending.map(match => {
              const p1 = getPlayer(match.player1Id);
              const p2 = getPlayer(match.player2Id);
              return (
                <div key={match.id} className="bg-card/60 rounded-lg p-3 flex items-center justify-between">
                  <span className="font-semibold text-sm">{getName(match.player1Id)}</span>
                  <span className="text-xs text-muted-foreground">vs</span>
                  <span className="font-semibold text-sm">{getName(match.player2Id)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {mode === 'group_knockout' && phase === 'group' && groupCount > 0 && (
        <GroupStageView
          matches={matches.filter(m => m.groupNumber != null)}
          players={players}
          getParticipantName={getName}
          groupCount={groupCount}
        />
      )}

      {mode !== 'round_robin' && (mode !== 'group_knockout' || phase === 'knockout') && rounds > 0 && (
        <div>
          <h3 className="text-lg font-bold mb-3">🏆 Turnierbaum</h3>
          <TournamentBracket
            matches={mode === 'group_knockout' ? matches.filter(m => m.groupNumber == null) : matches}
            rounds={rounds}
            getPlayer={getPlayer}
          />
        </div>
      )}
    </div>
  );
}
