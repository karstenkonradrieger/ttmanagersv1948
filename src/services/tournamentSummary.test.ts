import { describe, expect, it } from 'vitest';
import type { Match } from '@/types/tournament';
import { createResultSignature, isTournamentSummaryStale } from './tournamentSummary';

const completed: Match = {
  id: 'm1', round: 0, position: 0, player1Id: 'p1', player2Id: 'p2',
  sets: [{ player1: 11, player2: 7 }, { player1: 11, player2: 8 }],
  winnerId: 'p1', status: 'completed', completedAt: '2026-10-02T10:00:00Z',
};

describe('tournament summary result signature', () => {
  it('ignores unfinished matches and is independent of array order', () => {
    const pending: Match = { ...completed, id: 'm2', winnerId: null, status: 'pending', sets: [] };
    expect(createResultSignature([pending, completed])).toBe(createResultSignature([completed]));
  });

  it('detects corrected completed results', () => {
    const summary = { content: 'Bericht', generatedAt: '2026-10-02T10:01:00Z', sourceSignature: createResultSignature([completed]) };
    expect(isTournamentSummaryStale(summary, [completed])).toBe(false);
    expect(isTournamentSummaryStale(summary, [{ ...completed, sets: [{ player1: 9, player2: 11 }], winnerId: 'p2' }])).toBe(true);
  });
});
