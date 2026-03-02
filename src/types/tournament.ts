export interface Player {
  id: string;
  name: string;
  club: string;
  gender: string;
  birthDate: string | null;
  ttr: number;
  postalCode: string;
  city: string;
  street: string;
  houseNumber: string;
  phone: string;
  groupNumber?: number | null;
}

export interface SetScore {
  player1: number;
  player2: number;
}

export interface Match {
  id: string;
  round: number;
  position: number;
  player1Id: string | null;
  player2Id: string | null;
  sets: SetScore[];
  winnerId: string | null;
  table?: number;
  status: 'pending' | 'active' | 'completed';
  groupNumber?: number | null;
  completedAt?: string | null;
  homeTeamId?: string | null;
  awayTeamId?: string | null;
}

export interface DoublesPair {
  id: string;
  tournamentId: string;
  player1Id: string;
  player2Id: string;
  pairName: string;
}

export type TournamentMode = 'knockout' | 'double_knockout' | 'round_robin' | 'group_knockout' | 'swiss';
export type TournamentType = 'singles' | 'doubles' | 'team';
export type TeamMode = 'bundessystem' | 'werner_scheffler' | 'olympic' | 'corbillon';

export interface Team {
  id: string;
  tournamentId: string;
  name: string;
}

export interface TeamPlayer {
  id: string;
  teamId: string;
  playerId: string;
  position: number;
}

export interface EncounterGame {
  id: string;
  matchId: string;
  gameNumber: number;
  gameType: 'singles' | 'doubles';
  homePlayer1Id: string | null;
  homePlayer2Id: string | null;
  awayPlayer1Id: string | null;
  awayPlayer2Id: string | null;
  sets: SetScore[];
  winnerSide: 'home' | 'away' | null;
  status: 'pending' | 'active' | 'completed';
}

export interface GameSequenceEntry {
  type: 'singles' | 'doubles';
  homePositions: number[];
  awayPositions: number[];
  label: string;
}

export const TEAM_GAME_SEQUENCES: Record<TeamMode, { games: GameSequenceEntry[]; teamSize: number; winsNeeded: number }> = {
  bundessystem: {
    teamSize: 4,
    winsNeeded: 6,
    games: [
      { type: 'doubles', homePositions: [1, 2], awayPositions: [1, 2], label: 'Doppel 1' },
      { type: 'doubles', homePositions: [3, 4], awayPositions: [3, 4], label: 'Doppel 2' },
      { type: 'singles', homePositions: [1], awayPositions: [1], label: 'Einzel 1' },
      { type: 'singles', homePositions: [2], awayPositions: [2], label: 'Einzel 2' },
      { type: 'singles', homePositions: [3], awayPositions: [3], label: 'Einzel 3' },
      { type: 'singles', homePositions: [4], awayPositions: [4], label: 'Einzel 4' },
      { type: 'singles', homePositions: [1], awayPositions: [2], label: 'Einzel 5' },
      { type: 'singles', homePositions: [2], awayPositions: [1], label: 'Einzel 6' },
      { type: 'singles', homePositions: [3], awayPositions: [4], label: 'Einzel 7' },
      { type: 'singles', homePositions: [4], awayPositions: [3], label: 'Einzel 8' },
    ],
  },
  werner_scheffler: {
    teamSize: 4,
    winsNeeded: 5,
    games: [
      { type: 'singles', homePositions: [1], awayPositions: [2], label: 'Einzel 1' },
      { type: 'singles', homePositions: [2], awayPositions: [1], label: 'Einzel 2' },
      { type: 'doubles', homePositions: [1, 2], awayPositions: [1, 2], label: 'Doppel 1' },
      { type: 'singles', homePositions: [3], awayPositions: [3], label: 'Einzel 3' },
      { type: 'singles', homePositions: [4], awayPositions: [4], label: 'Einzel 4' },
      { type: 'doubles', homePositions: [3, 4], awayPositions: [3, 4], label: 'Doppel 2' },
      { type: 'singles', homePositions: [1], awayPositions: [1], label: 'Einzel 5' },
      { type: 'singles', homePositions: [2], awayPositions: [2], label: 'Einzel 6' },
    ],
  },
  olympic: {
    teamSize: 3,
    winsNeeded: 3,
    games: [
      { type: 'singles', homePositions: [1], awayPositions: [2], label: 'Einzel 1' },
      { type: 'singles', homePositions: [2], awayPositions: [1], label: 'Einzel 2' },
      { type: 'doubles', homePositions: [1, 3], awayPositions: [1, 3], label: 'Doppel' },
      { type: 'singles', homePositions: [1], awayPositions: [1], label: 'Einzel 3' },
      { type: 'singles', homePositions: [2], awayPositions: [2], label: 'Einzel 4' },
    ],
  },
  corbillon: {
    teamSize: 2,
    winsNeeded: 3,
    games: [
      { type: 'singles', homePositions: [1], awayPositions: [2], label: 'Einzel 1' },
      { type: 'singles', homePositions: [2], awayPositions: [1], label: 'Einzel 2' },
      { type: 'doubles', homePositions: [1, 2], awayPositions: [1, 2], label: 'Doppel' },
      { type: 'singles', homePositions: [1], awayPositions: [1], label: 'Einzel 3' },
      { type: 'singles', homePositions: [2], awayPositions: [2], label: 'Einzel 4' },
    ],
  },
};

export interface Tournament {
  id: string;
  name: string;
  players: Player[];
  matches: Match[];
  rounds: number;
  started: boolean;
  tableCount: number;
  logoUrl?: string | null;
  mode: TournamentMode;
  type: TournamentType;
  doublesPairs: DoublesPair[];
  bestOf: number;
  phase: 'group' | 'knockout' | null;
  tournamentDate: string | null;
  venueStreet: string;
  venueHouseNumber: string;
  venuePostalCode: string;
  venueCity: string;
  motto: string;
  breakMinutes: number;
  teamMode: TeamMode | null;
  earlyFinishEnabled: boolean;
  teams: Team[];
  teamPlayers: TeamPlayer[];
}
