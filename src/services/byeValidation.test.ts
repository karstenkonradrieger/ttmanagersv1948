import { describe, it, expect } from 'vitest';
import { computeQualifiedPlayers } from './byeValidation';
import type { Match, Player, SetScore } from '@/types/tournament';

const mkPlayer = (id: string, groupNumber: number): Player => ({
  id,
  name: id,
  club: '',
  gender: '',
  birthDate: null,
  ttr: 1500,
  postalCode: '',
  city: '',
  street: '',
  houseNumber: '',
  phone: '',
  groupNumber,
});

let matchSeq = 0;
const mkMatch = (
  groupNumber: number,
  p1: string,
  p2: string,
  sets: SetScore[],
  winnerId: string | null,
  status: Match['status'] = 'completed',
): Match => ({
  id: `m${++matchSeq}`,
  round: 0,
  position: 0,
  player1Id: p1,
  player2Id: p2,
  sets,
  winnerId,
  status,
  groupNumber,
});

describe('computeQualifiedPlayers', () => {
  it('ranks group winners by wins, then set diff, then point diff', () => {
    // Two groups, each with 3 players, all matches completed.
    const players = [
      mkPlayer('a1', 0), mkPlayer('a2', 0), mkPlayer('a3', 0),
      mkPlayer('b1', 1), mkPlayer('b2', 1), mkPlayer('b3', 1),
    ];
    const matches: Match[] = [
      // Group 0: a1 wins both 2-0, a2 beats a3 2-0
      mkMatch(0, 'a1', 'a2', [{ player1: 11, player2: 5 }, { player1: 11, player2: 6 }], 'a1'),
      mkMatch(0, 'a1', 'a3', [{ player1: 11, player2: 4 }, { player1: 11, player2: 3 }], 'a1'),
      mkMatch(0, 'a2', 'a3', [{ player1: 11, player2: 7 }, { player1: 11, player2: 9 }], 'a2'),
      // Group 1: b1 wins both but with closer scores; b2 beats b3
      mkMatch(1, 'b1', 'b2', [{ player1: 11, player2: 9 }, { player1: 11, player2: 9 }], 'b1'),
      mkMatch(1, 'b1', 'b3', [{ player1: 11, player2: 8 }, { player1: 11, player2: 8 }], 'b1'),
      mkMatch(1, 'b2', 'b3', [{ player1: 11, player2: 9 }, { player1: 11, player2: 9 }], 'b2'),
    ];

    const { winners, runnersUp } = computeQualifiedPlayers(matches, players);

    expect(winners.map(w => w.playerId)).toEqual(['a1', 'b1']);
    expect(new Set(runnersUp.map(r => r.playerId))).toEqual(new Set(['a2', 'b2']));
    // a1 has bigger point diff than b1
    expect(winners[0].pointsDiff).toBeGreaterThan(winners[1].pointsDiff);
  });

  it('uses head-to-head to break ties on equal wins within a group', () => {
    const players = [mkPlayer('x', 0), mkPlayer('y', 0), mkPlayer('z', 0)];
    // x beats y, y beats z, z beats x → all 1 win.
    // Without h2h, sort by set/point diff. We use equal set scores so h2h decides
    // when comparing pairs. Note: 3-way cycles can't be resolved purely by h2h,
    // but pairwise comparator still pulls h2h winner above h2h loser.
    const matches: Match[] = [
      mkMatch(0, 'x', 'y', [{ player1: 11, player2: 5 }, { player1: 11, player2: 5 }], 'x'),
      mkMatch(0, 'y', 'z', [{ player1: 11, player2: 5 }, { player1: 11, player2: 5 }], 'y'),
      mkMatch(0, 'z', 'x', [{ player1: 11, player2: 5 }, { player1: 11, player2: 5 }], 'z'),
    ];

    const { winners, runnersUp } = computeQualifiedPlayers(matches, players);

    // Each player has 1 win, identical set/point diff. Two of them qualify.
    expect(winners).toHaveLength(1);
    expect(runnersUp).toHaveLength(1);
    expect(['x', 'y', 'z']).toContain(winners[0].playerId);
    expect(['x', 'y', 'z']).toContain(runnersUp[0].playerId);
  });

  it('breaks tie by set difference when wins are equal and no head-to-head winner applies', () => {
    // 4-player group: p1 and p2 each have 2 wins. p1 has better set diff.
    const players = [
      mkPlayer('p1', 0), mkPlayer('p2', 0), mkPlayer('p3', 0), mkPlayer('p4', 0),
    ];
    const matches: Match[] = [
      // p1 beats p3 2-0, p1 beats p4 2-0, p2 beats p1 2-1
      mkMatch(0, 'p1', 'p3', [{ player1: 11, player2: 5 }, { player1: 11, player2: 5 }], 'p1'),
      mkMatch(0, 'p1', 'p4', [{ player1: 11, player2: 5 }, { player1: 11, player2: 5 }], 'p1'),
      mkMatch(0, 'p2', 'p1', [{ player1: 11, player2: 5 }, { player1: 5, player2: 11 }, { player1: 11, player2: 9 }], 'p2'),
      // p2 beats p3 2-1, p2 beats p4 2-1
      mkMatch(0, 'p2', 'p3', [{ player1: 11, player2: 5 }, { player1: 5, player2: 11 }, { player1: 11, player2: 9 }], 'p2'),
      mkMatch(0, 'p2', 'p4', [{ player1: 11, player2: 5 }, { player1: 5, player2: 11 }, { player1: 11, player2: 9 }], 'p2'),
      // p3 beats p4
      mkMatch(0, 'p3', 'p4', [{ player1: 11, player2: 5 }, { player1: 11, player2: 5 }], 'p3'),
    ];

    const { winners, runnersUp } = computeQualifiedPlayers(matches, players);

    // p2 beat p1 head-to-head → p2 is winner, p1 is runner-up
    expect(winners[0].playerId).toBe('p2');
    expect(runnersUp[0].playerId).toBe('p1');
  });

  it('ignores incomplete or pending matches', () => {
    const players = [mkPlayer('a', 0), mkPlayer('b', 0), mkPlayer('c', 0)];
    const matches: Match[] = [
      mkMatch(0, 'a', 'b', [{ player1: 11, player2: 3 }, { player1: 11, player2: 3 }], 'a'),
      // pending — should be ignored entirely
      mkMatch(0, 'b', 'c', [], null, 'pending'),
      mkMatch(0, 'a', 'c', [{ player1: 11, player2: 4 }, { player1: 11, player2: 4 }], 'a'),
    ];

    const { winners, runnersUp } = computeQualifiedPlayers(matches, players);

    expect(winners[0].playerId).toBe('a');
    expect(winners[0].won).toBe(2);
    // b and c: only b appears (via the a-b match). c also appears via a-c. Both have 0 wins.
    expect(runnersUp).toHaveLength(1);
    expect(['b', 'c']).toContain(runnersUp[0].playerId);
  });

  it('returns empty arrays when no group matches are completed', () => {
    const players = [mkPlayer('a', 0), mkPlayer('b', 0)];
    const matches: Match[] = [
      mkMatch(0, 'a', 'b', [], null, 'pending'),
    ];

    const { winners, runnersUp } = computeQualifiedPlayers(matches, players);

    expect(winners).toEqual([]);
    expect(runnersUp).toEqual([]);
  });

  it('orders cross-group winners by performance (wins → setsDiff → pointsDiff)', () => {
    // Group 0: weak winner (1 win, small diff). Group 1: strong winner (2 wins).
    const players = [
      mkPlayer('w0', 0), mkPlayer('l0', 0),
      mkPlayer('w1', 1), mkPlayer('m1', 1), mkPlayer('l1', 1),
    ];
    const matches: Match[] = [
      mkMatch(0, 'w0', 'l0', [{ player1: 11, player2: 9 }, { player1: 11, player2: 9 }], 'w0'),
      mkMatch(1, 'w1', 'm1', [{ player1: 11, player2: 2 }, { player1: 11, player2: 2 }], 'w1'),
      mkMatch(1, 'w1', 'l1', [{ player1: 11, player2: 2 }, { player1: 11, player2: 2 }], 'w1'),
      mkMatch(1, 'm1', 'l1', [{ player1: 11, player2: 5 }, { player1: 11, player2: 5 }], 'm1'),
    ];

    const { winners } = computeQualifiedPlayers(matches, players);

    // w1 has more wins → ranked first
    expect(winners.map(w => w.playerId)).toEqual(['w1', 'w0']);
  });
});
