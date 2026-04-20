import { Match, Player } from '@/types/tournament';

interface QualifiedPlayer {
  playerId: string;
  groupNumber: number;
  rank: number;
  won: number;
  setsDiff: number;
  pointsDiff: number;
}

/**
 * Computes group standings and returns the qualified players, ranked across
 * groups by performance within their rank tier.
 *
 * @param qualifyPerGroup How many top players per group to include in the
 *   result. Defaults to 2 (winners + runners-up). Pass 3 to additionally get
 *   group thirds (e.g. for a Trostrunde / consolation bracket).
 */
export function computeQualifiedPlayers(
  groupMatches: Match[],
  players: Player[],
  qualifyPerGroup: number = 2
): {
  winners: QualifiedPlayer[];
  runnersUp: QualifiedPlayer[];
  thirds: QualifiedPlayer[];
  byRank: QualifiedPlayer[][];
} {
  const groupCount = Math.max(...players.map(p => (p.groupNumber ?? 0)), 0) + 1;
  const qualified: QualifiedPlayer[] = [];

  for (let g = 0; g < groupCount; g++) {
    const gMatches = groupMatches.filter(m => m.groupNumber === g);
    const map = new Map<string, { playerId: string; won: number; setsWon: number; setsLost: number; pointsWon: number; pointsLost: number }>();

    for (const m of gMatches) {
      if (!m.player1Id || !m.player2Id || m.status !== 'completed') continue;
      if (!map.has(m.player1Id)) map.set(m.player1Id, { playerId: m.player1Id, won: 0, setsWon: 0, setsLost: 0, pointsWon: 0, pointsLost: 0 });
      if (!map.has(m.player2Id)) map.set(m.player2Id, { playerId: m.player2Id, won: 0, setsWon: 0, setsLost: 0, pointsWon: 0, pointsLost: 0 });
      const s1 = map.get(m.player1Id)!;
      const s2 = map.get(m.player2Id)!;
      if (m.winnerId === m.player1Id) s1.won++;
      else if (m.winnerId === m.player2Id) s2.won++;
      for (const s of m.sets) {
        s1.pointsWon += s.player1; s1.pointsLost += s.player2;
        s2.pointsWon += s.player2; s2.pointsLost += s.player1;
        if (s.player1 >= 11 && s.player1 - s.player2 >= 2) { s1.setsWon++; s2.setsLost++; }
        else if (s.player2 >= 11 && s.player2 - s.player1 >= 2) { s2.setsWon++; s1.setsLost++; }
      }
    }

    const standings = [...map.values()].sort((a, b) => {
      if (b.won !== a.won) return b.won - a.won;
      const h2h = gMatches.find(m => m.status === 'completed' &&
        ((m.player1Id === a.playerId && m.player2Id === b.playerId) ||
          (m.player1Id === b.playerId && m.player2Id === a.playerId)));
      if (h2h) {
        if (h2h.winnerId === a.playerId) return -1;
        if (h2h.winnerId === b.playerId) return 1;
      }
      const aDiff = a.setsWon - a.setsLost;
      const bDiff = b.setsWon - b.setsLost;
      if (bDiff !== aDiff) return bDiff - aDiff;
      return (b.pointsWon - b.pointsLost) - (a.pointsWon - a.pointsLost);
    });

    for (let i = 0; i < Math.min(qualifyPerGroup, standings.length); i++) {
      const s = standings[i];
      qualified.push({
        playerId: s.playerId, groupNumber: g, rank: i + 1,
        won: s.won, setsDiff: s.setsWon - s.setsLost, pointsDiff: s.pointsWon - s.pointsLost,
      });
    }
  }

  const perfSort = (a: QualifiedPlayer, b: QualifiedPlayer) => {
    if (b.won !== a.won) return b.won - a.won;
    if (b.setsDiff !== a.setsDiff) return b.setsDiff - a.setsDiff;
    return b.pointsDiff - a.pointsDiff;
  };

  const byRank: QualifiedPlayer[][] = [];
  for (let r = 1; r <= qualifyPerGroup; r++) {
    byRank.push(qualified.filter(q => q.rank === r).sort(perfSort));
  }

  return {
    winners: byRank[0] ?? [],
    runnersUp: byRank[1] ?? [],
    thirds: byRank[2] ?? [],
    byRank,
  };
}

/**
 * Returns true when the actual bye recipients in the round-0 KO matches do not
 * match the expected top-N performance-ranked group winners.
 */
export function hasMisallocatedByes(
  matches: Match[],
  players: Player[]
): boolean {
  const koMatches = matches.filter(m =>
    (m.groupNumber === undefined || m.groupNumber === null) &&
    (m.bracketType ?? 'main') === 'main'
  );
  const round0 = koMatches.filter(m => m.round === 0);
  if (round0.length === 0) return false;

  // Detect actual byes: round-0 matches with exactly one player
  const byeRecipients: string[] = [];
  for (const m of round0) {
    const hasP1 = !!m.player1Id;
    const hasP2 = !!m.player2Id;
    if (hasP1 !== hasP2) {
      byeRecipients.push((m.player1Id ?? m.player2Id) as string);
    }
  }
  if (byeRecipients.length === 0) return false;

  const groupMatches = matches.filter(m => m.groupNumber !== undefined && m.groupNumber !== null);
  const { winners } = computeQualifiedPlayers(groupMatches, players);
  const expected = winners.slice(0, byeRecipients.length).map(w => w.playerId);

  const actualSet = new Set(byeRecipients);
  return expected.some(id => !actualSet.has(id));
}
