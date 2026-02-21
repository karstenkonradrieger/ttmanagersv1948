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
}

export interface DoublesPair {
  id: string;
  tournamentId: string;
  player1Id: string;
  player2Id: string;
  pairName: string;
}

export type TournamentMode = 'knockout' | 'round_robin' | 'group_knockout';
export type TournamentType = 'singles' | 'doubles';

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
}
