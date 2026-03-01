import { useMemo } from 'react';
import { Match, Player } from '@/types/tournament';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

interface Props {
  matches: Match[];
  players: Player[];
  getParticipantName: (id: string | null) => string;
  onGenerateNextRound: () => void;
  currentRound: number;
  isDoubles: boolean;
}

interface SwissStanding {
  participantId: string;
  name: string;
  played: number;
  won: number;
  lost: number;
  setsWon: number;
  setsLost: number;
  pointsWon: number;
  pointsLost: number;
  buchholz: number;
  opponents: string[];
}

export function SwissStandings({ matches, players, getParticipantName, onGenerateNextRound, currentRound, isDoubles }: Props) {
  const standings = useMemo(() => {
    const map = new Map<string, SwissStanding>();

    const ensure = (id: string) => {
      if (!map.has(id)) {
        map.set(id, {
          participantId: id, name: getParticipantName(id),
          played: 0, won: 0, lost: 0,
          setsWon: 0, setsLost: 0,
          pointsWon: 0, pointsLost: 0,
          buchholz: 0, opponents: [],
        });
      }
      return map.get(id)!;
    };

    for (const m of matches) {
      if (!m.player1Id) continue;
      ensure(m.player1Id);
      if (m.player2Id) {
        ensure(m.player2Id);
        map.get(m.player1Id)!.opponents.push(m.player2Id);
        map.get(m.player2Id)!.opponents.push(m.player1Id);
      }

      if (m.status !== 'completed') continue;

      // Bye win
      if (!m.player2Id && m.winnerId === m.player1Id) {
        map.get(m.player1Id)!.won++;
        map.get(m.player1Id)!.played++;
        continue;
      }

      if (m.sets.length === 0) continue;

      const s1 = map.get(m.player1Id)!;
      const s2 = map.get(m.player2Id!)!;
      s1.played++; s2.played++;

      if (m.winnerId === m.player1Id) { s1.won++; s2.lost++; }
      else if (m.winnerId === m.player2Id) { s2.won++; s1.lost++; }

      for (const s of m.sets) {
        s1.pointsWon += s.player1; s1.pointsLost += s.player2;
        s2.pointsWon += s.player2; s2.pointsLost += s.player1;
        if (s.player1 >= 11 && s.player1 - s.player2 >= 2) { s1.setsWon++; s2.setsLost++; }
        else if (s.player2 >= 11 && s.player2 - s.player1 >= 2) { s2.setsWon++; s1.setsLost++; }
      }
    }

    // Compute Buchholz (sum of opponents' wins)
    for (const [, s] of map) {
      s.buchholz = s.opponents.reduce((sum, oppId) => sum + (map.get(oppId)?.won || 0), 0);
    }

    return [...map.values()].sort((a, b) =>
      b.won - a.won ||
      b.buchholz - a.buchholz ||
      (b.setsWon - b.setsLost) - (a.setsWon - a.setsLost) ||
      (b.pointsWon - b.pointsLost) - (a.pointsWon - a.pointsLost)
    );
  }, [matches, getParticipantName]);

  const allCurrentRoundComplete = useMemo(() => {
    if (currentRound === 0) return false;
    const currentRoundMatches = matches.filter(m => m.round === currentRound - 1);
    return currentRoundMatches.length > 0 && currentRoundMatches.every(m => m.status === 'completed');
  }, [matches, currentRound]);

  const recommendedRounds = players.length > 0 ? Math.ceil(Math.log2(players.length)) : 0;

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-lg font-bold">🇨🇭 Schweizer System {isDoubles ? '(Doppel)' : ''}</h3>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            Runde {currentRound} / {recommendedRounds} empf.
          </span>
          {allCurrentRoundComplete && (
            <Button onClick={onGenerateNextRound} size="sm" className="glow-green gap-1.5">
              <ArrowRight className="h-4 w-4" />
              Nächste Runde
            </Button>
          )}
        </div>
      </div>

      {standings.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-2 font-bold text-muted-foreground">#</th>
                <th className="text-left py-2 px-2 font-bold text-muted-foreground">{isDoubles ? 'Paar' : 'Spieler'}</th>
                <th className="text-center py-2 px-2 font-bold text-muted-foreground">Sp.</th>
                <th className="text-center py-2 px-2 font-bold text-muted-foreground">S</th>
                <th className="text-center py-2 px-2 font-bold text-muted-foreground">N</th>
                <th className="text-center py-2 px-2 font-bold text-muted-foreground" title="Buchholz-Wertung: Summe der Siege aller Gegner">BH</th>
                <th className="text-center py-2 px-2 font-bold text-muted-foreground">Sätze</th>
                <th className="text-center py-2 px-2 font-bold text-muted-foreground">Punkte</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((s, i) => (
                <tr key={s.participantId} className="border-b border-border/50 hover:bg-secondary/50">
                  <td className="py-2 px-2 text-muted-foreground font-semibold">{i + 1}</td>
                  <td className="py-2 px-2 font-semibold">{s.name}</td>
                  <td className="text-center py-2 px-2">{s.played}</td>
                  <td className="text-center py-2 px-2 font-bold text-primary">{s.won}</td>
                  <td className="text-center py-2 px-2">{s.lost}</td>
                  <td className="text-center py-2 px-2 text-muted-foreground">{s.buchholz}</td>
                  <td className="text-center py-2 px-2">{s.setsWon}:{s.setsLost}</td>
                  <td className="text-center py-2 px-2 text-muted-foreground">{s.pointsWon}:{s.pointsLost}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Round-by-round results */}
      {currentRound > 0 && (
        <div className="space-y-3">
          {Array.from({ length: currentRound }).map((_, r) => {
            const roundMatches = matches.filter(m => m.round === r && m.player1Id);
            return (
              <div key={r} className="bg-card rounded-lg p-3 card-shadow">
                <h4 className="font-bold text-sm text-primary mb-2">Runde {r + 1}</h4>
                <div className="space-y-1">
                  {roundMatches.map(m => {
                    if (!m.player2Id) {
                      return (
                        <div key={m.id} className="text-xs text-muted-foreground">
                          {getParticipantName(m.player1Id)} — Freilos
                        </div>
                      );
                    }
                    const p1Wins = m.sets.filter(s => s.player1 >= 11 && s.player1 - s.player2 >= 2).length;
                    const p2Wins = m.sets.filter(s => s.player2 >= 11 && s.player2 - s.player1 >= 2).length;
                    return (
                      <div key={m.id} className="flex items-center gap-2 text-xs">
                        <span className={m.winnerId === m.player1Id ? 'font-bold text-primary' : ''}>
                          {getParticipantName(m.player1Id)}
                        </span>
                        <span className="text-muted-foreground">
                          {m.status === 'completed' ? `${p1Wins}:${p2Wins}` : 'vs'}
                        </span>
                        <span className={m.winnerId === m.player2Id ? 'font-bold text-primary' : ''}>
                          {getParticipantName(m.player2Id)}
                        </span>
                        {m.status === 'active' && m.table && (
                          <span className="text-primary text-[10px]">T{m.table}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
