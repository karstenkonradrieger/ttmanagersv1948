import { Match } from '@/types/tournament';

/**
 * Returns the display label for a KO round (e.g. "Finale", "Halbfinale",
 * "Viertelfinale", "Achtelfinale", or a generic "Runde N").
 *
 * The label is derived from the matches actually present in the bracket —
 * NOT from the tournament's total rounds — so it works correctly for
 * group+KO tournaments (where `tournament.rounds` includes the group
 * stage) and for the consolation bracket (Trostrunde).
 */
export function getRoundLabel(round: number, matches: Match[]): string {
  const presentRounds = Array.from(new Set(matches.map(m => m.round))).sort((a, b) => a - b);
  if (presentRounds.length === 0) return `Runde ${round + 1}`;

  const minRound = presentRounds[0];
  const maxRound = presentRounds[presentRounds.length - 1];
  const matchesInRound = matches.filter(m => m.round === round).length;
  const fromEnd = maxRound - round;

  if (fromEnd === 0) return 'Finale';
  if (fromEnd === 1) return 'Halbfinale';
  if (fromEnd === 2 && matchesInRound <= 4) return 'Viertelfinale';
  if (fromEnd === 3 && matchesInRound <= 8) return 'Achtelfinale';
  return `Runde ${round - minRound + 1}`;
}
