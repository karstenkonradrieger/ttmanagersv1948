import { useState, useEffect, useCallback } from 'react';
import { Player, Match, Tournament, SetScore } from '@/types/tournament';

const STORAGE_KEY = 'tt-tournament';

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

function loadTournament(): Tournament {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) return JSON.parse(data);
  } catch {}
  return {
    id: generateId(),
    name: 'Tischtennis Turnier',
    players: [],
    matches: [],
    rounds: 0,
    started: false,
    tableCount: 4,
    mode: 'knockout',
    type: 'singles',
    doublesPairs: [],
    bestOf: 3,
    tournamentDate: null,
    venueStreet: '',
    venueHouseNumber: '',
    venuePostalCode: '',
    venueCity: '',
    motto: '',
  };
}

function saveTournament(t: Tournament) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(t));
}

export function useTournament() {
  const [tournament, setTournament] = useState<Tournament>(loadTournament);

  useEffect(() => {
    saveTournament(tournament);
  }, [tournament]);

  const addPlayer = useCallback((name: string, club: string, ttr: number, gender: string = '', birthDate: string | null = null, postalCode: string = '', city: string = '', street: string = '', houseNumber: string = '', phone: string = '') => {
    setTournament(prev => ({
      ...prev,
      players: [...prev.players, { id: generateId(), name, club, gender, birthDate, ttr, postalCode, city, street, houseNumber, phone }],
    }));
  }, []);

  const removePlayer = useCallback((id: string) => {
    setTournament(prev => ({
      ...prev,
      players: prev.players.filter(p => p.id !== id),
    }));
  }, []);

  const generateBracket = useCallback(() => {
    setTournament(prev => {
      const players = [...prev.players].sort((a, b) => b.ttr - a.ttr);
      const n = players.length;
      if (n < 2) return prev;

      // Next power of 2
      const slots = Math.pow(2, Math.ceil(Math.log2(n)));
      const rounds = Math.log2(slots);

      // Seed players into bracket positions with byes
      const seeded: (string | null)[] = Array(slots).fill(null);
      for (let i = 0; i < n; i++) {
        seeded[i] = players[i].id;
      }

      const matches: Match[] = [];
      let matchId = 0;

      // First round
      for (let i = 0; i < slots / 2; i++) {
        const p1 = seeded[i * 2];
        const p2 = seeded[i * 2 + 1];
        const isBye = p2 === null;
        matches.push({
          id: `m${matchId++}`,
          round: 0,
          position: i,
          player1Id: p1,
          player2Id: p2,
          sets: [],
          winnerId: isBye ? p1 : null,
          status: isBye ? 'completed' : 'pending',
        });
      }

      // Subsequent rounds (empty)
      for (let r = 1; r < rounds; r++) {
        const matchesInRound = slots / Math.pow(2, r + 1);
        for (let i = 0; i < matchesInRound; i++) {
          matches.push({
            id: `m${matchId++}`,
            round: r,
            position: i,
            player1Id: null,
            player2Id: null,
            sets: [],
            winnerId: null,
            status: 'pending',
          });
        }
      }

      // Propagate byes
      const updated = propagateWinners(matches);

      return { ...prev, matches: updated, rounds, started: true };
    });
  }, []);

  const updateMatchScore = useCallback((matchId: string, sets: SetScore[], effectiveBestOf?: number) => {
    setTournament(prev => {
      const neededWins = effectiveBestOf || prev.bestOf;
      const matches = prev.matches.map(m => {
        if (m.id !== matchId) return m;

        let p1Wins = 0;
        let p2Wins = 0;
        for (const s of sets) {
          if (s.player1 >= 11 && s.player1 - s.player2 >= 2) p1Wins++;
          else if (s.player2 >= 11 && s.player2 - s.player1 >= 2) p2Wins++;
        }

        let winnerId: string | null = null;
        let status: Match['status'] = 'active';
        if (p1Wins >= neededWins) {
          winnerId = m.player1Id;
          status = 'completed';
        } else if (p2Wins >= neededWins) {
          winnerId = m.player2Id;
          status = 'completed';
        }

        return { ...m, sets, winnerId, status };
      });

      return { ...prev, matches: propagateWinners(matches) };
    });
  }, []);

  const setMatchActive = useCallback((matchId: string, table?: number) => {
    setTournament(prev => ({
      ...prev,
      matches: prev.matches.map(m =>
        m.id === matchId ? { ...m, status: 'active' as const, table } : m
      ),
    }));
  }, []);

  const resetTournament = useCallback(() => {
    setTournament({
      id: generateId(),
      name: 'Tischtennis Turnier',
      players: [],
      matches: [],
      rounds: 0,
      started: false,
      tableCount: 4,
      mode: 'knockout',
      type: 'singles',
      doublesPairs: [],
      bestOf: 3,
      tournamentDate: null,
      venueStreet: '',
      venueHouseNumber: '',
      venuePostalCode: '',
      venueCity: '',
      motto: '',
    });
  }, []);

  const setTableCount = useCallback((count: number) => {
    setTournament(prev => ({ ...prev, tableCount: Math.max(1, count) }));
  }, []);

  const autoAssignTables = useCallback(() => {
    setTournament(prev => {
      const activeTables = new Set(
        prev.matches.filter(m => m.status === 'active' && m.table).map(m => m.table)
      );
      
      const freeTables: number[] = [];
      for (let i = 1; i <= prev.tableCount; i++) {
        if (!activeTables.has(i)) freeTables.push(i);
      }
      
      const pendingReadyMatches = prev.matches.filter(
        m => m.status === 'pending' && m.player1Id && m.player2Id
      );
      
      const updatedMatches = [...prev.matches];
      let tableIdx = 0;
      
      for (const match of pendingReadyMatches) {
        if (tableIdx >= freeTables.length) break;
        const idx = updatedMatches.findIndex(m => m.id === match.id);
        if (idx !== -1) {
          updatedMatches[idx] = {
            ...updatedMatches[idx],
            status: 'active',
            table: freeTables[tableIdx],
          };
          tableIdx++;
        }
      }
      
      return { ...prev, matches: updatedMatches };
    });
  }, []);

  const getPlayer = useCallback((id: string | null) => {
    if (!id) return null;
    return tournament.players.find(p => p.id === id) || null;
  }, [tournament.players]);

  return {
    tournament,
    addPlayer,
    removePlayer,
    generateBracket,
    updateMatchScore,
    setMatchActive,
    resetTournament,
    getPlayer,
    setTableCount,
    autoAssignTables,
  };
}

function propagateWinners(matches: Match[]): Match[] {
  const updated = [...matches];
  for (const m of updated) {
    if (m.winnerId && m.status === 'completed') {
      // Find next round match
      const nextRound = m.round + 1;
      const nextPos = Math.floor(m.position / 2);
      const nextMatch = updated.find(nm => nm.round === nextRound && nm.position === nextPos);
      if (nextMatch) {
        if (m.position % 2 === 0) {
          nextMatch.player1Id = m.winnerId;
        } else {
          nextMatch.player2Id = m.winnerId;
        }
        // Auto-complete if opponent is bye (null stays null means waiting)
      }
    }
  }
  return updated;
}
