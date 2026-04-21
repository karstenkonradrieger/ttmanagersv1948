import { useMemo } from 'react';
import { Match, Player, SetScore } from '@/types/tournament';
import { Button } from '@/components/ui/button';
import { ArrowRight, Trophy, Medal, Info } from 'lucide-react';
import { computeQualifiedPlayers } from '@/services/byeValidation';

interface GroupStanding {
  playerId: string;
  name: string;
  played: number;
  won: number;
  lost: number;
  setsWon: number;
  setsLost: number;
  pointsWon: number;
  pointsLost: number;
}

export function computeGroupStandings(
  groupMatches: Match[],
  getName: (id: string | null) => string,
): GroupStanding[] {
  const map = new Map<string, GroupStanding>();

  const ensure = (id: string) => {
    if (!map.has(id)) {
      map.set(id, {
        playerId: id,
        name: getName(id),
        played: 0, won: 0, lost: 0,
        setsWon: 0, setsLost: 0,
        pointsWon: 0, pointsLost: 0,
      });
    }
    return map.get(id)!;
  };

  for (const m of groupMatches) {
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

  const standings = [...map.values()];

  // Sort with head-to-head tiebreaker
  standings.sort((a, b) => {
    // 1. Wins
    if (b.won !== a.won) return b.won - a.won;

    // 2. Head-to-head (for 2-way tie)
    const h2h = groupMatches.find(
      m => m.status === 'completed' &&
        ((m.player1Id === a.playerId && m.player2Id === b.playerId) ||
         (m.player1Id === b.playerId && m.player2Id === a.playerId))
    );
    if (h2h) {
      if (h2h.winnerId === a.playerId) return -1;
      if (h2h.winnerId === b.playerId) return 1;
    }

    // 3. Set difference (for circle / 3-way tie)
    const aDiff = a.setsWon - a.setsLost;
    const bDiff = b.setsWon - b.setsLost;
    if (bDiff !== aDiff) return bDiff - aDiff;

    // 4. Point difference
    return (b.pointsWon - b.pointsLost) - (a.pointsWon - a.pointsLost);
  });

  return standings;
}

interface TiebreakerInfo {
  players: [string, string]; // names
  decidedBy: 'h2h' | 'setDiff' | 'pointDiff' | 'none';
  label: string;
  detail: string;
}

function detectTiebreakers(
  standings: GroupStanding[],
  groupMatches: Match[],
): TiebreakerInfo[] {
  const results: TiebreakerInfo[] = [];
  for (let i = 0; i < standings.length - 1; i++) {
    const a = standings[i];
    const b = standings[i + 1];
    if (a.won !== b.won) continue; // no tie

    // Same wins — find which tiebreaker decided
    const h2h = groupMatches.find(
      m => m.status === 'completed' &&
        ((m.player1Id === a.playerId && m.player2Id === b.playerId) ||
         (m.player1Id === b.playerId && m.player2Id === a.playerId))
    );
    if (h2h && h2h.winnerId === a.playerId) {
      results.push({
        players: [a.name, b.name],
        decidedBy: 'h2h',
        label: 'Direkter Vergleich',
        detail: `${a.name} gewann gegen ${b.name}`,
      });
    } else {
      const aDiff = a.setsWon - a.setsLost;
      const bDiff = b.setsWon - b.setsLost;
      if (aDiff !== bDiff) {
        results.push({
          players: [a.name, b.name],
          decidedBy: 'setDiff',
          label: 'Satzdifferenz',
          detail: `${a.name} (${aDiff > 0 ? '+' : ''}${aDiff}) vor ${b.name} (${bDiff > 0 ? '+' : ''}${bDiff})`,
        });
      } else {
        const aPDiff = a.pointsWon - a.pointsLost;
        const bPDiff = b.pointsWon - b.pointsLost;
        if (aPDiff !== bPDiff) {
          results.push({
            players: [a.name, b.name],
            decidedBy: 'pointDiff',
            label: 'Punktdifferenz',
            detail: `${a.name} (${aPDiff > 0 ? '+' : ''}${aPDiff}) vor ${b.name} (${bPDiff > 0 ? '+' : ''}${bPDiff})`,
          });
        } else {
          results.push({
            players: [a.name, b.name],
            decidedBy: 'none',
            label: 'Vollständiger Gleichstand',
            detail: `${a.name} und ${b.name} sind in allen Kriterien gleich`,
          });
        }
      }
    }
  }
  return results;
}

interface Props {
  matches: Match[];
  players: Player[];
  getParticipantName: (id: string | null) => string;
  onAdvanceToKnockout?: () => void;
  groupCount: number;
}

export function GroupStageView({ matches, players, getParticipantName, onAdvanceToKnockout, groupCount }: Props) {
  const groupData = useMemo(() => {
    const groups: { groupNumber: number; standings: GroupStanding[]; matches: Match[]; allCompleted: boolean; tiebreakers: TiebreakerInfo[] }[] = [];
    for (let g = 0; g < groupCount; g++) {
      const gMatches = matches.filter(m => m.groupNumber === g);
      const standings = computeGroupStandings(gMatches, getParticipantName);
      const allCompleted = gMatches.length > 0 && gMatches.every(m => m.status === 'completed');
      const tiebreakers = allCompleted ? detectTiebreakers(standings, gMatches) : [];
      groups.push({ groupNumber: g, standings, matches: gMatches, allCompleted, tiebreakers });
    }
    return groups;
  }, [matches, getParticipantName, groupCount]);

  const allGroupsComplete = groupData.every(g => g.allCompleted);

  const qualifiedData = useMemo(() => {
    if (!allGroupsComplete) return null;
    return computeQualifiedPlayers(matches, players);
  }, [allGroupsComplete, matches, players]);

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">📊 Gruppenphase</h3>
        {allGroupsComplete && onAdvanceToKnockout && (
          <Button onClick={onAdvanceToKnockout} className="glow-green gap-1.5">
            <ArrowRight className="h-4 w-4" />
            Weiter zur K.O.-Runde
          </Button>
        )}
      </div>

      {groupData.map(group => (
        <div key={group.groupNumber} className="bg-card rounded-lg p-4 card-shadow">
          <h4 className="font-bold text-primary mb-3">Gruppe {String.fromCharCode(65 + group.groupNumber)}</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-2 font-bold text-muted-foreground">#</th>
                  <th className="text-left py-2 px-2 font-bold text-muted-foreground">Spieler</th>
                  <th className="text-center py-2 px-2 font-bold text-muted-foreground">Sp.</th>
                  <th className="text-center py-2 px-2 font-bold text-muted-foreground">S</th>
                  <th className="text-center py-2 px-2 font-bold text-muted-foreground">N</th>
                  <th className="text-center py-2 px-2 font-bold text-muted-foreground">Sätze</th>
                  <th className="text-center py-2 px-2 font-bold text-muted-foreground">Punkte</th>
                </tr>
              </thead>
              <tbody>
                {group.standings.map((s, i) => (
                  <tr
                    key={s.playerId}
                    className={`border-b border-border/50 ${
                      i < 2 ? 'bg-primary/5' : ''
                    }`}
                  >
                    <td className="py-2 px-2 text-muted-foreground font-semibold">{i + 1}</td>
                    <td className="py-2 px-2 font-semibold">
                      {s.name}
                      {i < 2 && group.allCompleted && (
                        <span className="ml-1.5 text-[10px] bg-primary/20 text-primary px-1 py-0.5 rounded">Q</span>
                      )}
                    </td>
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

          {/* Group matches */}
          <div className="mt-3 space-y-1">
            {group.matches.map(m => {
              const p1Wins = m.sets.filter(s => s.player1 >= 11 && s.player1 - s.player2 >= 2).length;
              const p2Wins = m.sets.filter(s => s.player2 >= 11 && s.player2 - s.player1 >= 2).length;
              return (
                <div key={m.id} className="flex items-center gap-2 text-xs">
                  <span className={`${m.winnerId === m.player1Id ? 'font-bold text-primary' : ''}`}>
                    {getParticipantName(m.player1Id)}
                  </span>
                  <span className="text-muted-foreground">
                    {m.status === 'completed' ? `${p1Wins}:${p2Wins}` : 'vs'}
                  </span>
                  <span className={`${m.winnerId === m.player2Id ? 'font-bold text-primary' : ''}`}>
                    {getParticipantName(m.player2Id)}
                  </span>
                  {m.status === 'active' && m.table && (
                    <span className="text-primary text-[10px]">T{m.table}</span>
                  )}
                  {m.status === 'completed' && (
                    <span className="text-muted-foreground ml-1">
                      ({m.sets.map(s => `${s.player1}:${s.player2}`).join(', ')})
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Qualification Preview */}
      {allGroupsComplete && qualifiedData && (qualifiedData.winners.length > 0 || qualifiedData.runnersUp.length > 0) && (
        <div className="bg-card rounded-lg p-4 card-shadow border-2 border-primary/30">
          <h4 className="font-bold text-primary mb-3 flex items-center gap-2">
            <Trophy className="h-4 w-4" />
            Qualifiziert für die K.O.-Phase
          </h4>

          <div className="space-y-4">
            {/* Group Winners */}
            {qualifiedData.winners.length > 0 && (
              <div>
                <h5 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-accent text-accent-foreground text-[10px] font-bold">1</span>
                  Gruppensieger
                </h5>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-1.5 px-2 text-xs font-bold text-muted-foreground">Seed</th>
                        <th className="text-left py-1.5 px-2 text-xs font-bold text-muted-foreground">Spieler</th>
                        <th className="text-center py-1.5 px-2 text-xs font-bold text-muted-foreground">Gruppe</th>
                        <th className="text-center py-1.5 px-2 text-xs font-bold text-muted-foreground">Siege</th>
                        <th className="text-center py-1.5 px-2 text-xs font-bold text-muted-foreground">Satz-Diff</th>
                        <th className="text-center py-1.5 px-2 text-xs font-bold text-muted-foreground">Pkt-Diff</th>
                      </tr>
                    </thead>
                    <tbody>
                      {qualifiedData.winners.map((q, i) => (
                        <tr key={q.playerId} className="border-b border-border/50 bg-accent/10">
                          <td className="py-1.5 px-2 font-bold text-primary">{i + 1}</td>
                          <td className="py-1.5 px-2 font-semibold">{getParticipantName(q.playerId)}</td>
                          <td className="text-center py-1.5 px-2">
                            <span className="inline-flex items-center justify-center h-5 min-w-[20px] rounded bg-primary/10 text-primary text-xs font-bold px-1">
                              {String.fromCharCode(65 + q.groupNumber)}
                            </span>
                          </td>
                          <td className="text-center py-1.5 px-2 font-bold">{q.won}</td>
                          <td className="text-center py-1.5 px-2">{q.setsDiff > 0 ? '+' : ''}{q.setsDiff}</td>
                          <td className="text-center py-1.5 px-2 text-muted-foreground">{q.pointsDiff > 0 ? '+' : ''}{q.pointsDiff}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Runners-up */}
            {qualifiedData.runnersUp.length > 0 && (
              <div>
                <h5 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-muted text-muted-foreground text-[10px] font-bold">2</span>
                  Gruppenzweite
                </h5>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-1.5 px-2 text-xs font-bold text-muted-foreground">Seed</th>
                        <th className="text-left py-1.5 px-2 text-xs font-bold text-muted-foreground">Spieler</th>
                        <th className="text-center py-1.5 px-2 text-xs font-bold text-muted-foreground">Gruppe</th>
                        <th className="text-center py-1.5 px-2 text-xs font-bold text-muted-foreground">Siege</th>
                        <th className="text-center py-1.5 px-2 text-xs font-bold text-muted-foreground">Satz-Diff</th>
                        <th className="text-center py-1.5 px-2 text-xs font-bold text-muted-foreground">Pkt-Diff</th>
                      </tr>
                    </thead>
                    <tbody>
                      {qualifiedData.runnersUp.map((q, i) => (
                        <tr key={q.playerId} className="border-b border-border/50">
                          <td className="py-1.5 px-2 font-bold text-muted-foreground">{qualifiedData.winners.length + i + 1}</td>
                          <td className="py-1.5 px-2 font-semibold">{getParticipantName(q.playerId)}</td>
                          <td className="text-center py-1.5 px-2">
                            <span className="inline-flex items-center justify-center h-5 min-w-[20px] rounded bg-primary/10 text-primary text-xs font-bold px-1">
                              {String.fromCharCode(65 + q.groupNumber)}
                            </span>
                          </td>
                          <td className="text-center py-1.5 px-2 font-bold">{q.won}</td>
                          <td className="text-center py-1.5 px-2">{q.setsDiff > 0 ? '+' : ''}{q.setsDiff}</td>
                          <td className="text-center py-1.5 px-2 text-muted-foreground">{q.pointsDiff > 0 ? '+' : ''}{q.pointsDiff}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <p className="text-xs text-muted-foreground mt-3">
            Setzliste: Gruppensieger nach Leistung (Siege → Satzdifferenz → Punktdifferenz), dann Gruppenzweite nach gleichen Kriterien.
          </p>
        </div>
      )}
    </div>
  );
}

export type { GroupStanding };
