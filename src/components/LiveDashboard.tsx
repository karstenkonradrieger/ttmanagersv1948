import { useMemo } from 'react';
import { Match, Player, TournamentMode, SetScore } from '@/types/tournament';
import { TournamentBracket } from './TournamentBracket';
import { GroupStageView } from './GroupStageView';
import { Monitor, Trophy, Crown } from 'lucide-react';

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

  // Round-robin top 3 calculation
  const rrTopThree = useMemo(() => {
    if (mode !== 'round_robin') return null;
    const completed = matches.filter(m => m.status === 'completed');
    if (completed.length === 0) return null;

    const stats = new Map<string, { won: number; setDiff: number; ptDiff: number }>();
    for (const m of completed) {
      if (!m.player1Id || !m.player2Id) continue;
      if (!stats.has(m.player1Id)) stats.set(m.player1Id, { won: 0, setDiff: 0, ptDiff: 0 });
      if (!stats.has(m.player2Id)) stats.set(m.player2Id, { won: 0, setDiff: 0, ptDiff: 0 });
      const s1 = stats.get(m.player1Id)!;
      const s2 = stats.get(m.player2Id)!;
      if (m.winnerId === m.player1Id) { s1.won++; } else if (m.winnerId === m.player2Id) { s2.won++; }
      for (const s of m.sets) {
        s1.ptDiff += s.player1 - s.player2;
        s2.ptDiff += s.player2 - s.player1;
        if (s.player1 >= 11 && s.player1 - s.player2 >= 2) { s1.setDiff++; s2.setDiff--; }
        else if (s.player2 >= 11 && s.player2 - s.player1 >= 2) { s2.setDiff++; s1.setDiff--; }
      }
    }
    const sorted = [...stats.entries()]
      .map(([id, s]) => ({ id, ...s }))
      .sort((a, b) => b.won - a.won || b.setDiff - a.setDiff || b.ptDiff - a.ptDiff);
    return sorted.slice(0, 3);
  }, [matches, mode]);

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

      {rrTopThree && rrTopThree.length > 0 && !championPlayer && (
        <div className="bg-gradient-to-r from-primary/10 to-accent/10 border-2 border-primary/40 rounded-xl p-5 space-y-4">
          {/* 1st place */}
          <div className="text-center">
            <Crown className="h-10 w-10 mx-auto mb-1 text-primary" />
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Aktueller Spitzenreiter</p>
            <p className="text-2xl font-extrabold text-primary mt-1">{getName(rrTopThree[0].id)}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {rrTopThree[0].won} {rrTopThree[0].won === 1 ? 'Sieg' : 'Siege'} · Sätze {rrTopThree[0].setDiff > 0 ? '+' : ''}{rrTopThree[0].setDiff} · Punkte {rrTopThree[0].ptDiff > 0 ? '+' : ''}{rrTopThree[0].ptDiff}
            </p>
          </div>
          {/* 2nd & 3rd */}
          {rrTopThree.length > 1 && (
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/50">
              {rrTopThree.slice(1).map((entry, i) => (
                <div key={entry.id} className="text-center">
                  <p className="text-xs text-muted-foreground font-semibold">{i === 0 ? '🥈 2.' : '🥉 3.'}</p>
                  <p className="font-bold text-sm">{getName(entry.id)}</p>
                  <p className="text-xs text-muted-foreground">
                    {entry.won} {entry.won === 1 ? 'Sieg' : 'Siege'} · Sätze {entry.setDiff > 0 ? '+' : ''}{entry.setDiff}
                  </p>
                </div>
              ))}
            </div>
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
