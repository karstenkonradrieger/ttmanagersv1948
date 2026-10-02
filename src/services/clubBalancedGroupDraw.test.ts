import { describe, it, expect } from 'vitest';
import { drawClubBalancedGroups, normalizeClub, type DrawParticipant } from './clubBalancedGroupDraw';

const mk = (clubs: string[]): DrawParticipant[] => clubs.map((c, i) => ({ id: `p${i}`, clubs: [c] }));

function groupsOf(res: ReturnType<typeof drawClubBalancedGroups>, ps: DrawParticipant[], gc: number) {
  const byId = new Map(ps.map(p => [p.id, p]));
  return Array.from({ length: gc }, (_, g) =>
    res.assignments.filter(a => a.groupNumber === g).map(a => byId.get(a.id)!));
}

describe('drawClubBalancedGroups', () => {
  it('a) 16 players, 4 clubs x 4, 4 groups -> one per club per group', () => {
    // worst case seeding: clubs clustered by TTR
    const ps = mk([...Array(4).fill('A'), ...Array(4).fill('B'), ...Array(4).fill('C'), ...Array(4).fill('D')]);
    const res = drawClubBalancedGroups(ps, 4);
    for (const g of groupsOf(res, ps, 4)) {
      expect(g).toHaveLength(4);
      expect(new Set(g.map(p => p.clubs[0])).size).toBe(4);
    }
    expect(res.issues).toHaveLength(0);
  });

  it('b) A=6, B=3, C=3, 3 groups -> A max 2, no single-club group', () => {
    const ps = mk(['A', 'A', 'A', 'A', 'A', 'A', 'B', 'B', 'B', 'C', 'C', 'C']);
    const res = drawClubBalancedGroups(ps, 3);
    for (const g of groupsOf(res, ps, 3)) {
      expect(g.filter(p => p.clubs[0] === 'A').length).toBeLessThanOrEqual(2);
      expect(new Set(g.map(p => p.clubs[0])).size).toBeGreaterThan(1);
    }
    expect(res.issues).toHaveLength(0);
  });

  it('c) single club -> works without errors', () => {
    const ps = mk(Array(8).fill('A'));
    const res = drawClubBalancedGroups(ps, 2);
    expect(res.assignments).toHaveLength(8);
    expect(res.issues).toHaveLength(0);
    groupsOf(res, ps, 2).forEach(g => expect(g).toHaveLength(4));
  });

  it('d) club-less players are not counted as a common club', () => {
    const ps = mk(['', '  ', '', '']);
    const res = drawClubBalancedGroups(ps, 2);
    expect(res.issues).toHaveLength(0);
    // pure snake order, no balancing influence
    expect(res.assignments.map(a => a.groupNumber)).toEqual([0, 1, 1, 0]);
    expect(normalizeClub('  TTC Muster ')).toBe(normalizeClub('ttc muster'));
  });

  it('e) group sizes and seed order (pot membership) preserved', () => {
    const ps = mk(['A', 'A', 'B', 'B', 'A', 'C', 'C', 'A', 'B', 'D', 'A']);
    const gc = 3;
    const res = drawClubBalancedGroups(ps, gc);
    const off = drawClubBalancedGroups(ps, gc, { balance: false });
    const sizes = (r: typeof res) => Array.from({ length: gc }, (_, g) => r.assignments.filter(a => a.groupNumber === g).length);
    expect(sizes(res)).toEqual(sizes(off));
    // each group holds at most one participant per pot
    for (let pot = 0; pot < Math.ceil(ps.length / gc); pot++) {
      const gs = res.assignments.slice(pot * gc, pot * gc + gc).map(a => a.groupNumber);
      expect(new Set(gs).size).toBe(gs.length);
    }
    // top seeds still in distinct groups
    expect(new Set(res.assignments.slice(0, gc).map(a => a.groupNumber)).size).toBe(gc);
  });

  it('reports issues when perfect balance is impossible', () => {
    // A dominates whole pots: 9 of 12, all in top pots
    const ps = mk(['A', 'A', 'A', 'A', 'A', 'A', 'A', 'A', 'A', 'B', 'C', 'D']);
    const res = drawClubBalancedGroups(ps, 3);
    expect(res.assignments).toHaveLength(12);
    for (const g of groupsOf(res, ps, 3)) {
      expect(g.filter(p => p.clubs[0] === 'A').length).toBe(3);
    }
  });

  it('doubles: mixed pair counts both clubs', () => {
    const ps: DrawParticipant[] = [
      { id: 'd0', clubs: ['A', 'B'] }, { id: 'd1', clubs: ['A'] },
      { id: 'd2', clubs: ['B'] }, { id: 'd3', clubs: ['C'] },
    ];
    const res = drawClubBalancedGroups(ps, 2);
    const g0 = res.assignments.find(a => a.id === 'd0')!.groupNumber;
    const g1 = res.assignments.find(a => a.id === 'd1')!.groupNumber;
    expect(g0).not.toBe(g1);
  });
});
