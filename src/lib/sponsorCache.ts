import { Sponsor } from '@/types/tournament';

const KEY_PREFIX = 'ttm_sponsors_cache_v1:';

function key(tournamentId: string) {
  return `${KEY_PREFIX}${tournamentId}`;
}

export function readSponsorCache(tournamentId: string): Sponsor[] | null {
  if (!tournamentId) return null;
  try {
    const raw = localStorage.getItem(key(tournamentId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed as Sponsor[];
  } catch {
    return null;
  }
}

export function writeSponsorCache(tournamentId: string, sponsors: Sponsor[]) {
  if (!tournamentId) return;
  try {
    localStorage.setItem(key(tournamentId), JSON.stringify(sponsors ?? []));
  } catch {
    // ignore quota / privacy errors
  }
}

export function clearSponsorCache(tournamentId: string) {
  if (!tournamentId) return;
  try {
    localStorage.removeItem(key(tournamentId));
  } catch {
    // ignore
  }
}
