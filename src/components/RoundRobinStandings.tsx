import { useMemo } from 'react';
import { Match, Player, DoublesPair, SetScore } from '@/types/tournament';

interface Props {
  matches: Match[];
  getParticipantName: (id: string | null) => string;
  isDoubles: boolean;
}

interface Standing {
  participantId: string;
  name: string;
  played: number;
  won: number;
  lost: number;
  setsWon: number;
  setsLost: number;
  pointsWon: number;
  pointsLost: number;
}

function computeStandings(matches: Match[], getName: (id: string | null) => string): Standing[] {
  const map = new Map<string, Standing>();

  const ensure = (id: string) => {
    if (!map.has(id)) {
      map.set(id, {
        participantId: id,
        name: getName(id),
        played: 0, won: 0, lost: 0,
        setsWon: 0, setsLost: 0,
        pointsWon: 0, pointsLost: 0,
      });
    }
    return map.get(id)!;
  };

  for (const m of matches) {
    if (!m.player1Id || !m.player2Id) continue;
    ensure(m.player1Id);
    ensure(m.player2Id);

    if (m.status !== 'completed' || m.sets.length === 0) continue;

    const s1 = map.get(m.player1Id)!;
    const s2 = map.get(m.player2Id)!;
    s1.played++;
    s2.played++;

    if (m.winnerId === m.player1Id) { s1.won++; s2.lost++; }
    else if (m.winnerId === m.player2Id) { s2.won++; s1.lost++; }

    for (const s of m.sets) {
      s1.pointsWon += s.player1;
      s1.pointsLost += s.player2;
      s2.pointsWon += s.player2;
      s2.pointsLost += s.player1;
      if (s.player1 >= 11 && s.player1 - s.player2 >= 2) { s1.setsWon++; s2.setsLost++; }
      else if (s.player2 >= 11 && s.player2 - s.player1 >= 2) { s2.setsWon++; s1.setsLost++; }
    }
  }

  return [...map.values()].sort((a, b) => 
    b.won - a.won || 
    (b.setsWon - b.setsLost) - (a.setsWon - a.setsLost) ||
    (b.pointsWon - b.pointsLost) - (a.pointsWon - a.pointsLost)
  );
}

export function RoundRobinStandings({ matches, getParticipantName, isDoubles }: Props) {
  const standings = useMemo(() => computeStandings(matches, getParticipantName), [matches, getParticipantName]);

  if (standings.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        Noch keine Daten vorhanden
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-slide-up">
      <h3 className="text-lg font-bold">📊 Tabelle {isDoubles ? '(Doppel)' : ''}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-2 font-bold text-muted-foreground">#</th>
              <th className="text-left py-2 px-2 font-bold text-muted-foreground">{isDoubles ? 'Paar' : 'Spieler'}</th>
              <th className="text-center py-2 px-2 font-bold text-muted-foreground">Sp.</th>
              <th className="text-center py-2 px-2 font-bold text-muted-foreground">S</th>
              <th className="text-center py-2 px-2 font-bold text-muted-foreground">N</th>
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
                <td className="text-center py-2 px-2">{s.setsWon}:{s.setsLost}</td>
                <td className="text-center py-2 px-2 text-muted-foreground">{s.pointsWon}:{s.pointsLost}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
