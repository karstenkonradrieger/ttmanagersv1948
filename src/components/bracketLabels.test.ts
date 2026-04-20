import { describe, it, expect } from 'vitest';
import { getRoundLabel } from './bracketLabels';
import { Match } from '@/types/tournament';

// Lightweight match factory — only fields used by getRoundLabel matter.
const m = (round: number, position = 0, overrides: Partial<Match> = {}): Match => ({
  id: `m-${round}-${position}`,
  round,
  position,
  player1Id: null,
  player2Id: null,
  sets: [],
  winnerId: null,
  status: 'pending',
  ...overrides,
});

describe('getRoundLabel', () => {
  describe('reines KO-Turnier (8 Spieler, 3 Runden)', () => {
    // Round 0: 4 matches (Viertelfinale), Round 1: 2 (Halbfinale), Round 2: 1 (Finale)
    const matches: Match[] = [
      m(0, 0), m(0, 1), m(0, 2), m(0, 3),
      m(1, 0), m(1, 1),
      m(2, 0),
    ];

    it('beschriftet die letzte Runde als Finale', () => {
      expect(getRoundLabel(2, matches)).toBe('Finale');
    });

    it('beschriftet die vorletzte Runde als Halbfinale', () => {
      expect(getRoundLabel(1, matches)).toBe('Halbfinale');
    });

    it('beschriftet die erste Runde als Viertelfinale', () => {
      expect(getRoundLabel(0, matches)).toBe('Viertelfinale');
    });
  });

  describe('reines KO-Turnier (16 Spieler, 4 Runden)', () => {
    const matches: Match[] = [
      ...Array.from({ length: 8 }, (_, i) => m(0, i)),
      ...Array.from({ length: 4 }, (_, i) => m(1, i)),
      ...Array.from({ length: 2 }, (_, i) => m(2, i)),
      m(3, 0),
    ];

    it('Achtelfinale → Viertelfinale → Halbfinale → Finale', () => {
      expect(getRoundLabel(0, matches)).toBe('Achtelfinale');
      expect(getRoundLabel(1, matches)).toBe('Viertelfinale');
      expect(getRoundLabel(2, matches)).toBe('Halbfinale');
      expect(getRoundLabel(3, matches)).toBe('Finale');
    });
  });

  describe('Gruppen+KO (Gruppenphase = Runden 0-2, KO = Runden 3-4)', () => {
    // Caller filters out group matches before passing to TournamentBracket.
    // Only KO rounds are passed: 2 semifinals + 1 final.
    const koMatches: Match[] = [
      m(3, 0, { bracketType: 'main' }),
      m(3, 1, { bracketType: 'main' }),
      m(4, 0, { bracketType: 'main' }),
    ];

    it('beschriftet KO-Runde 3 (erste KO-Runde) als Halbfinale, NICHT als Viertelfinale', () => {
      // This is the bug that was fixed: previously it used `rounds - r`
      // which produced "Viertelfinale" for KO round 3 of a 5-round tournament.
      expect(getRoundLabel(3, koMatches)).toBe('Halbfinale');
    });

    it('beschriftet die letzte KO-Runde als Finale', () => {
      expect(getRoundLabel(4, koMatches)).toBe('Finale');
    });
  });

  describe('Gruppen+KO mit Viertelfinale (8 KO-Teilnehmer)', () => {
    const koMatches: Match[] = [
      ...Array.from({ length: 4 }, (_, i) => m(2, i, { bracketType: 'main' })),
      ...Array.from({ length: 2 }, (_, i) => m(3, i, { bracketType: 'main' })),
      m(4, 0, { bracketType: 'main' }),
    ];

    it('liefert Viertelfinale → Halbfinale → Finale', () => {
      expect(getRoundLabel(2, koMatches)).toBe('Viertelfinale');
      expect(getRoundLabel(3, koMatches)).toBe('Halbfinale');
      expect(getRoundLabel(4, koMatches)).toBe('Finale');
    });
  });

  describe('Trostrunde (Consolation Bracket)', () => {
    it('5 Teilnehmer → Single-Elim mit Halbfinale + Finale', () => {
      // 2 semifinals + 1 final, rounds 0 and 1
      const consMatches: Match[] = [
        m(0, 0, { bracketType: 'consolation' }),
        m(0, 1, { bracketType: 'consolation' }),
        m(1, 0, { bracketType: 'consolation' }),
      ];
      expect(getRoundLabel(0, consMatches)).toBe('Halbfinale');
      expect(getRoundLabel(1, consMatches)).toBe('Finale');
    });

    it('8 Teilnehmer Trostrunde → Viertelfinale + Halbfinale + Finale', () => {
      const consMatches: Match[] = [
        ...Array.from({ length: 4 }, (_, i) => m(0, i, { bracketType: 'consolation' })),
        ...Array.from({ length: 2 }, (_, i) => m(1, i, { bracketType: 'consolation' })),
        m(2, 0, { bracketType: 'consolation' }),
      ];
      expect(getRoundLabel(0, consMatches)).toBe('Viertelfinale');
      expect(getRoundLabel(1, consMatches)).toBe('Halbfinale');
      expect(getRoundLabel(2, consMatches)).toBe('Finale');
    });

    it('einzelnes Finale-Match → Finale', () => {
      const consMatches: Match[] = [m(0, 0, { bracketType: 'consolation' })];
      expect(getRoundLabel(0, consMatches)).toBe('Finale');
    });
  });

  describe('Edge cases', () => {
    it('leere Match-Liste → generischer Runde-Fallback', () => {
      expect(getRoundLabel(0, [])).toBe('Runde 1');
      expect(getRoundLabel(3, [])).toBe('Runde 4');
    });

    it('unregelmäßige Anzahl Matches in Runde verhindert Falsch-Label', () => {
      // 5 matches in "Viertelfinale"-position → > 4, also kein "Viertelfinale"
      const matches: Match[] = [
        ...Array.from({ length: 5 }, (_, i) => m(0, i)),
        ...Array.from({ length: 2 }, (_, i) => m(1, i)),
        m(2, 0),
      ];
      expect(getRoundLabel(0, matches)).toBe('Runde 1');
      expect(getRoundLabel(1, matches)).toBe('Halbfinale');
      expect(getRoundLabel(2, matches)).toBe('Finale');
    });

    it('rein generische Runden (sehr großes Bracket) → Runde N', () => {
      const matches: Match[] = [
        ...Array.from({ length: 16 }, (_, i) => m(0, i)),
        ...Array.from({ length: 8 }, (_, i) => m(1, i)),
        ...Array.from({ length: 4 }, (_, i) => m(2, i)),
        ...Array.from({ length: 2 }, (_, i) => m(3, i)),
        m(4, 0),
      ];
      expect(getRoundLabel(0, matches)).toBe('Runde 1'); // 16 > 8 → kein Achtelfinale
      expect(getRoundLabel(1, matches)).toBe('Achtelfinale');
      expect(getRoundLabel(2, matches)).toBe('Viertelfinale');
      expect(getRoundLabel(3, matches)).toBe('Halbfinale');
      expect(getRoundLabel(4, matches)).toBe('Finale');
    });
  });
});
