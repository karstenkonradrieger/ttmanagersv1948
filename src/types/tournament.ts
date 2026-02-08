export interface Player {
  id: string;
  name: string;
  club: string;
  ttr: number;
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
}

export interface Tournament {
  id: string;
  name: string;
  players: Player[];
  matches: Match[];
  rounds: number;
  started: boolean;
}
