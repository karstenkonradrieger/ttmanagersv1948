import { Match, Player } from '@/types/tournament';
import { computeQualifiedPlayers } from './byeValidation';

/**
 * Standard bracket seeding order for `slots` participants. Returns an array
 * of length `slots` where each entry is the seed number (1-indexed) that
 * should occupy that slot. Mirrors the helper used in useTournamentDb.
 */
function standardSeedOrder(slots: number): number[] {
  let order: number[] = [1, 2];
  while (order.length < slots) {
    const next: number[] = [];
    const sum = order.length * 2 + 1;
    for (const seed of order) {
      next.push(seed, sum - seed);
    }
    order = next;
  }
  return order;
}

function seedBracketSlots(participants: (string | null)[], slots: number): (string | null)[] {
  const order = standardSeedOrder(slots);
  const result: (string | null)[] = Array(slots).fill(null);
  for (let i = 0; i < slots; i++) {
    const seedNum = order[i];
    result[i] = participants[seedNum - 1] ?? null;
  }
  return result;
}

/**
 * Builds the seed list for the consolation bracket: all losers of the main
 * bracket's first round + all group thirds, ranked by group performance.
 */
export function computeConsolationSeeds(
  allMatches: Match[],
  players: Player[]
): string[] {
  // 1. Losers from main bracket round 0 (excluding byes)
  const round0Losers: string[] = [];
  const mainRound0 = allMatches.filter(
    (m) =>
      (m.bracketType ?? 'main') === 'main' &&
      (m.groupNumber === undefined || m.groupNumber === null) &&
      m.round === 0 &&
      m.status === 'completed' &&
      m.player1Id &&
      m.player2Id &&
      m.winnerId
  );
  for (const m of mainRound0) {
    const loser = m.winnerId === m.player1Id ? m.player2Id : m.player1Id;
    if (loser) round0Losers.push(loser);
  }

  // 2. Group thirds (performance-ranked across groups)
  const groupMatches = allMatches.filter(
    (m) => m.groupNumber !== undefined && m.groupNumber !== null
  );
  const { thirds } = computeQualifiedPlayers(groupMatches, players, 3);
  const thirdIds = thirds.map((t) => t.playerId);

  // De-dupe: a third should never also be a round-0 loser, but guard anyway.
  const seen = new Set<string>();
  const result: string[] = [];
  for (const id of [...round0Losers, ...thirdIds]) {
    if (id && !seen.has(id)) {
      seen.add(id);
      result.push(id);
    }
  }
  return result;
}

/**
 * Build consolation matches given the seed list. Uses single-elimination KO
 * for ≥5 participants, round-robin for 3–4 participants. Returns an empty
 * array if there are fewer than 3 participants.
 */
export function buildConsolationMatches(seeds: string[]): Omit<Match, 'id'>[] {
  if (seeds.length < 3) return [];

  // Round-robin for 3 or 4 participants
  if (seeds.length <= 4) {
    const out: Omit<Match, 'id'>[] = [];
    let pos = 0;
    for (let i = 0; i < seeds.length; i++) {
      for (let j = i + 1; j < seeds.length; j++) {
        out.push({
          round: 0,
          position: pos++,
          player1Id: seeds[i],
          player2Id: seeds[j],
          sets: [],
          winnerId: null,
          status: 'pending',
          groupNumber: null,
          bracketType: 'consolation',
        });
      }
    }
    return out;
  }

  // Single elimination KO for 5+ participants
  const slots = Math.pow(2, Math.ceil(Math.log2(seeds.length)));
  const rounds = Math.log2(slots);
  const placed = seedBracketSlots(seeds, slots);
  const out: Omit<Match, 'id'>[] = [];

  for (let i = 0; i < slots / 2; i++) {
    const p1 = placed[i * 2];
    const p2 = placed[i * 2 + 1];
    const isBye = (p1 === null) !== (p2 === null);
    const sole = p1 ?? p2;
    out.push({
      round: 0,
      position: i,
      player1Id: p1,
      player2Id: p2,
      sets: [],
      winnerId: isBye ? sole : null,
      status: isBye ? 'completed' : 'pending',
      groupNumber: null,
      bracketType: 'consolation',
    });
  }

  for (let r = 1; r < rounds; r++) {
    const inRound = slots / Math.pow(2, r + 1);
    for (let i = 0; i < inRound; i++) {
      out.push({
        round: r,
        position: i,
        player1Id: null,
        player2Id: null,
        sets: [],
        winnerId: null,
        status: 'pending',
        groupNumber: null,
        bracketType: 'consolation',
      });
    }
  }

  return out;
}

/**
 * Returns true when all main-bracket round-0 matches are completed, so the
 * consolation bracket can now be safely built with the full set of losers.
 */
export function isMainRound0Complete(allMatches: Match[]): boolean {
  const mainRound0 = allMatches.filter(
    (m) =>
      (m.bracketType ?? 'main') === 'main' &&
      (m.groupNumber === undefined || m.groupNumber === null) &&
      m.round === 0
  );
  if (mainRound0.length === 0) return false;
  return mainRound0.every((m) => m.status === 'completed');
}

/**
 * Returns true when a consolation bracket already exists for this tournament.
 */
export function hasConsolationBracket(allMatches: Match[]): boolean {
  return allMatches.some((m) => m.bracketType === 'consolation');
}
