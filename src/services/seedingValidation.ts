/**
 * Seeding & bracket structure validation.
 *
 * Protects against:
 *  - duplicate seeds (same player listed in multiple tiers / appears twice)
 *  - empty / invalid seed entries (null, "", whitespace)
 *  - bracket size mismatches (slots not power of 2, or fewer slots than seeds)
 *  - silent overflow when more qualified players exist than bracket slots
 *  - mis-ordered seed tiers (offset overlap between winners / runners-up / thirds)
 */

export interface SeedTier {
  label: string;
  /** seed offset within the global bracket (0-based count of preceding seeds) */
  offset: number;
  ids: (string | null | undefined)[];
}

export interface SeedingValidationResult {
  ok: boolean;
  /** Cleaned, de-duplicated, ordered seed list (best -> worst). */
  seeds: string[];
  /** Power-of-two slot count needed (>= seeds.length). */
  slots: number;
  /** Hard problems that prevent KO build. */
  errors: string[];
  /** Soft issues (auto-corrected) – good for toasts/console.warn. */
  warnings: string[];
}

const isNonEmptyId = (v: unknown): v is string =>
  typeof v === 'string' && v.trim().length > 0;

/**
 * Validates a list of seeding tiers and returns the consolidated, safe-to-use
 * seed list together with the bracket size to allocate.
 *
 * - Duplicates are removed (later occurrences dropped, earlier seed kept).
 * - Tier offset mismatches are reported as warnings; the function still
 *   returns a deterministic, monotonically increasing seed order.
 */
export function validateSeeding(tiers: SeedTier[]): SeedingValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Verify offsets line up with cumulative tier sizes.
  let expectedOffset = 0;
  for (const tier of tiers) {
    if (tier.offset !== expectedOffset) {
      warnings.push(
        `Seed-Offset für "${tier.label}" ist ${tier.offset}, erwartet ${expectedOffset}. Wird automatisch korrigiert.`
      );
    }
    expectedOffset += tier.ids.length;
  }

  // 2. Flatten with de-duplication.
  const seen = new Map<string, string>(); // id -> first tier label that contained it
  const seeds: string[] = [];
  for (const tier of tiers) {
    for (const raw of tier.ids) {
      if (!isNonEmptyId(raw)) {
        warnings.push(`Leerer Seed-Eintrag in "${tier.label}" wurde übersprungen.`);
        continue;
      }
      const id = raw.trim();
      const firstSeen = seen.get(id);
      if (firstSeen) {
        errors.push(
          `Doppelter Seed: Spieler ${id.slice(0, 8)} erscheint in "${firstSeen}" und "${tier.label}".`
        );
        continue;
      }
      seen.set(id, tier.label);
      seeds.push(id);
    }
  }

  // 3. Bracket size sanity.
  if (seeds.length < 2) {
    errors.push('Mindestens 2 Spieler werden für eine K.O.-Runde benötigt.');
  }
  const slots = seeds.length > 0
    ? Math.pow(2, Math.ceil(Math.log2(Math.max(2, seeds.length))))
    : 0;
  if (slots > 0 && seeds.length > slots) {
    // Should be impossible by construction but guard anyway.
    errors.push(`Mehr Seeds (${seeds.length}) als Bracket-Plätze (${slots}).`);
  }

  return {
    ok: errors.length === 0,
    seeds,
    slots,
    errors,
    warnings,
  };
}

/**
 * Final structural check on the seeded slot array. Used right before the KO
 * matches are persisted.
 */
export function validateBracketSlots(
  slotsArray: (string | null)[],
  seedCount: number
): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const size = slotsArray.length;

  if (size === 0 || (size & (size - 1)) !== 0) {
    errors.push(`Bracket-Größe ${size} ist keine 2er-Potenz.`);
  }

  const occupied = slotsArray.filter(isNonEmptyId) as string[];
  if (occupied.length !== seedCount) {
    errors.push(
      `Bracket enthält ${occupied.length} besetzte Plätze, erwartet ${seedCount}.`
    );
  }

  const set = new Set(occupied);
  if (set.size !== occupied.length) {
    errors.push('Mindestens ein Spieler ist im Bracket doppelt platziert.');
  }

  return { ok: errors.length === 0, errors };
}
