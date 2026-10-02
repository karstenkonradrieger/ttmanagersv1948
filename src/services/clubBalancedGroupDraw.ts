/**
 * Club-balanced group draw.
 *
 * Keeps the existing pot/snake seeding (participants sorted best -> worst,
 * pots of `groupCount`, every group gets at most one participant per pot,
 * alternating snake direction) and adds club balance as a secondary
 * constraint:
 *  1. Greedy: inside a pot each participant goes to the still-free group in
 *     which his club(s) are least represented. Ties -> snake order (or rng).
 *  2. Swap optimisation: participants of the same pot are swapped between
 *     groups whenever that lowers the club concentration.
 * Group sizes and pot membership never change.
 */

export interface DrawParticipant {
  id: string;
  /** Raw club names. Empty strings = "vereinslos" (never treated as shared). */
  clubs: string[];
}

export interface ClubBalanceIssue {
  club: string;
  groupNumber: number;
  count: number;
  maxAllowed: number;
  kind: 'overcap' | 'single_club';
}

export interface ClubBalancedDrawResult {
  /** participant id -> group number (0-based) */
  assignments: Array<{ id: string; groupNumber: number }>;
  issues: ClubBalanceIssue[];
}

export const normalizeClub = (c: string | null | undefined) => (c ?? '').trim().toLowerCase();

function clubKeys(p: DrawParticipant): string[] {
  return Array.from(new Set(p.clubs.map(normalizeClub).filter(k => k !== '')));
}

export function drawClubBalancedGroups(
  participants: DrawParticipant[],
  groupCount: number,
  options: { balance?: boolean; random?: () => number } = {},
): ClubBalancedDrawResult {
  const balance = options.balance ?? true;
  const n = participants.length;
  if (n === 0 || groupCount <= 0) return { assignments: [], issues: [] };

  const keys = participants.map(clubKeys);
  const potCount = Math.ceil(n / groupCount);
  const group = new Array<number>(n).fill(-1);
  const potOf = (i: number) => Math.floor(i / groupCount);

  // counts[g] : Map club -> count
  const counts: Map<string, number>[] = Array.from({ length: groupCount }, () => new Map());
  const add = (i: number, g: number, d: number) => {
    for (const k of keys[i]) counts[g].set(k, (counts[g].get(k) ?? 0) + d);
  };

  // 1. Greedy per pot (same structure as before)
  for (let pot = 0; pot < potCount; pot++) {
    const available = Array.from({ length: groupCount }, (_, i) => i);
    if (pot % 2 !== 0) available.reverse();
    const start = pot * groupCount;
    const end = Math.min(start + groupCount, n);
    for (let i = start; i < end; i++) {
      let best = 0;
      if (balance) {
        let bestScore = Infinity;
        let ties: number[] = [];
        for (let j = 0; j < available.length; j++) {
          const g = available[j];
          const score = keys[i].reduce((s, k) => s + (counts[g].get(k) ?? 0), 0);
          if (score < bestScore) { bestScore = score; ties = [j]; }
          else if (score === bestScore) ties.push(j);
        }
        best = options.random ? ties[Math.floor(options.random() * ties.length)] : ties[0];
      }
      const g = available[best];
      group[i] = g;
      add(i, g, 1);
      available.splice(best, 1);
    }
  }

  const distinctClubs = new Set(keys.flat());

  const isSingleClubGroup = (g: number): string | null => {
    const members = group.map((gg, i) => (gg === g ? i : -1)).filter(i => i >= 0);
    if (members.length < 2 || distinctClubs.size < 2) return null;
    for (const [club] of counts[g]) {
      if (members.every(i => keys[i].length === 1 && keys[i][0] === club)) return club;
    }
    return null;
  };

  const cost = () => {
    let c = 0;
    for (let g = 0; g < groupCount; g++) {
      for (const v of counts[g].values()) c += v * v;
      if (isSingleClubGroup(g)) c += 1000;
    }
    return c;
  };

  // 2. Swap optimisation within the same pot
  if (balance && distinctClubs.size > 0) {
    let current = cost();
    let improved = true;
    let guard = 0;
    while (improved && guard++ < 200) {
      improved = false;
      for (let a = 0; a < n; a++) {
        for (let b = a + 1; b < n && potOf(b) === potOf(a); b++) {
          const ga = group[a], gb = group[b];
          if (ga === gb) continue;
          add(a, ga, -1); add(b, gb, -1);
          add(a, gb, 1); add(b, ga, 1);
          group[a] = gb; group[b] = ga;
          const next = cost();
          if (next < current) { current = next; improved = true; }
          else {
            add(a, gb, -1); add(b, ga, -1);
            add(a, ga, 1); add(b, gb, 1);
            group[a] = ga; group[b] = gb;
          }
        }
      }
    }
  }

  // 3. Issues
  const issues: ClubBalanceIssue[] = [];
  const display = new Map<string, string>();
  participants.forEach(p => p.clubs.forEach(c => {
    const k = normalizeClub(c);
    if (k && !display.has(k)) display.set(k, c.trim());
  }));
  const totals = new Map<string, number>();
  keys.forEach(ks => ks.forEach(k => totals.set(k, (totals.get(k) ?? 0) + 1)));
  if (balance) {
    for (let g = 0; g < groupCount; g++) {
      for (const [k, v] of counts[g]) {
        const cap = Math.ceil((totals.get(k) ?? 0) / groupCount);
        if (v > cap) issues.push({ club: display.get(k) ?? k, groupNumber: g, count: v, maxAllowed: cap, kind: 'overcap' });
      }
      const single = isSingleClubGroup(g);
      if (single) {
        issues.push({ club: display.get(single) ?? single, groupNumber: g, count: counts[g].get(single) ?? 0, maxAllowed: Math.ceil((totals.get(single) ?? 0) / groupCount), kind: 'single_club' });
      }
    }
  }

  return {
    assignments: participants.map((p, i) => ({ id: p.id, groupNumber: group[i] })),
    issues,
  };
}

/** Counts distinct clubs (normalized, vereinslos ignored) per group. */
export function countClubsPerGroup(
  players: Array<{ club: string; groupNumber?: number | null }>,
): Map<number, number> {
  const sets = new Map<number, Set<string>>();
  for (const p of players) {
    if (p.groupNumber === null || p.groupNumber === undefined || p.groupNumber < 0) continue;
    const k = normalizeClub(p.club);
    if (!sets.has(p.groupNumber)) sets.set(p.groupNumber, new Set());
    if (k) sets.get(p.groupNumber)!.add(k);
  }
  return new Map(Array.from(sets.entries()).map(([g, s]) => [g, s.size]));
}

export function formatClubBalanceIssue(i: ClubBalanceIssue): string {
  const g = String.fromCharCode(65 + i.groupNumber);
  return i.kind === 'single_club'
    ? `Gruppe ${g} besteht nur aus Spielern von „${i.club}“ – eine gemischtere Verteilung war wegen der Teilnehmerzahl nicht möglich.`
    : `Verein „${i.club}“ ist in Gruppe ${g} ${i.count}× vertreten – eine gleichmäßigere Verteilung war wegen der Teilnehmerzahl nicht möglich.`;
}
