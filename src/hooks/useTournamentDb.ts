import { useState, useEffect, useCallback } from 'react';
import { Player, Match, Tournament, SetScore, DoublesPair, TournamentMode, TournamentType } from '@/types/tournament';
import * as tournamentService from '@/services/tournamentService';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const emptyTournament: Tournament = {
  id: '',
  name: 'Neues Turnier',
  players: [],
  matches: [],
  rounds: 0,
  started: false,
  tableCount: 4,
  mode: 'knockout',
  type: 'singles',
  doublesPairs: [],
};

export function useTournamentDb(tournamentId: string | null) {
  const [tournament, setTournament] = useState<Tournament>(emptyTournament);
  const [loading, setLoading] = useState(false);

  // Load tournament data
  const loadTournament = useCallback(async () => {
    if (!tournamentId) {
      setTournament(emptyTournament);
      return;
    }

    setLoading(true);
    try {
      const data = await tournamentService.fetchTournament(tournamentId);
      if (data) {
        setTournament(data);
      } else {
        setTournament(emptyTournament);
      }
    } catch (error) {
      console.error('Error loading tournament:', error);
      toast.error('Fehler beim Laden des Turniers');
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    loadTournament();
  }, [loadTournament]);

  // Set up realtime subscriptions
  useEffect(() => {
    if (!tournamentId) return;

    const channel = supabase
      .channel(`tournament-${tournamentId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tournaments',
        filter: `id=eq.${tournamentId}`,
      }, () => loadTournament())
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'players',
        filter: `tournament_id=eq.${tournamentId}`,
      }, () => loadTournament())
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'matches',
        filter: `tournament_id=eq.${tournamentId}`,
      }, () => loadTournament())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tournamentId, loadTournament]);

  const addPlayer = useCallback(async (name: string, club: string, ttr: number, gender: string = '', birthDate: string | null = null, postalCode: string = '', city: string = '', street: string = '', houseNumber: string = '', phone: string = '') => {
    if (!tournamentId) return;
    try {
      const player = await tournamentService.addPlayerToDb(tournamentId, { name, club, gender, birthDate, ttr, postalCode, city, street, houseNumber, phone });
      setTournament(prev => ({
        ...prev,
        players: [...prev.players, player],
      }));
    } catch (error) {
      console.error('Error adding player:', error);
      toast.error('Fehler beim Hinzufügen des Spielers');
    }
  }, [tournamentId]);

  const importPlayers = useCallback(async (playersData: Array<{ name: string; club: string; ttr: number; gender: string; birthDate: string | null }>) => {
    if (!tournamentId) return;
    try {
      const added: Player[] = [];
      for (const p of playersData) {
        const player = await tournamentService.addPlayerToDb(tournamentId, { ...p, postalCode: '', city: '', street: '', houseNumber: '', phone: '' });
        added.push(player);
      }
      setTournament(prev => ({
        ...prev,
        players: [...prev.players, ...added],
      }));
    } catch (error) {
      console.error('Error importing players:', error);
      toast.error('Fehler beim Importieren der Spieler');
    }
  }, [tournamentId]);

  const removePlayer = useCallback(async (id: string) => {
    try {
      await tournamentService.removePlayerFromDb(id);
      setTournament(prev => ({
        ...prev,
        players: prev.players.filter(p => p.id !== id),
      }));
    } catch (error) {
      console.error('Error removing player:', error);
      toast.error('Fehler beim Entfernen des Spielers');
    }
  }, []);

  const updatePlayer = useCallback(async (id: string, updates: Partial<Omit<Player, 'id'>>) => {
    try {
      await tournamentService.updatePlayerInDb(id, updates);
      setTournament(prev => ({
        ...prev,
        players: prev.players.map(p => p.id === id ? { ...p, ...updates } : p),
      }));
      toast.success('Spieler aktualisiert');
    } catch (error) {
      console.error('Error updating player:', error);
      toast.error('Fehler beim Aktualisieren des Spielers');
    }
  }, []);

  const generateBracket = useCallback(async () => {
    if (!tournamentId) return;

    const isDoubles = tournament.type === 'doubles';
    const isRoundRobin = tournament.mode === 'round_robin';

    // Determine participants
    // For doubles, we use the pair's player1_id as the match participant identifier
    // (since match FK references players table, we can't use pair IDs directly)
    let participants: string[];
    if (isDoubles) {
      participants = tournament.doublesPairs.map(dp => dp.player1Id);
    } else {
      participants = [...tournament.players].sort((a, b) => b.ttr - a.ttr).map(p => p.id);
    }

    const n = participants.length;
    if (n < 2) return;

    let matchesData: Omit<Match, 'id'>[];
    let rounds: number;

    if (isRoundRobin) {
      // Round-robin: everyone plays everyone
      matchesData = [];
      const roundsList = generateRoundRobinSchedule(participants);
      rounds = roundsList.length;

      for (let r = 0; r < roundsList.length; r++) {
        for (let pos = 0; pos < roundsList[r].length; pos++) {
          const [p1, p2] = roundsList[r][pos];
          matchesData.push({
            round: r,
            position: pos,
            player1Id: p1,
            player2Id: p2,
            sets: [],
            winnerId: null,
            status: 'pending',
          });
        }
      }
    } else {
      // Knockout (existing logic)
      const slots = Math.pow(2, Math.ceil(Math.log2(n)));
      rounds = Math.log2(slots);

      const seeded: (string | null)[] = Array(slots).fill(null);
      for (let i = 0; i < n; i++) {
        seeded[i] = participants[i];
      }

      matchesData = [];
      
      // First round
      for (let i = 0; i < slots / 2; i++) {
        const p1 = seeded[i * 2];
        const p2 = seeded[i * 2 + 1];
        const isBye = p2 === null;
        matchesData.push({
          round: 0,
          position: i,
          player1Id: p1,
          player2Id: p2,
          sets: [],
          winnerId: isBye ? p1 : null,
          status: isBye ? 'completed' : 'pending',
        });
      }

      // Subsequent rounds
      for (let r = 1; r < rounds; r++) {
        const matchesInRound = slots / Math.pow(2, r + 1);
        for (let i = 0; i < matchesInRound; i++) {
          matchesData.push({
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
    }

    try {
      const createdMatches = await tournamentService.createMatches(tournamentId, matchesData);
      
      let updated = createdMatches;
      if (!isRoundRobin) {
        // Propagate byes for knockout
        updated = propagateWinners(createdMatches);
        
        const matchesToUpdate = updated.filter((m, i) => 
          m.player1Id !== createdMatches[i].player1Id || 
          m.player2Id !== createdMatches[i].player2Id
        );
        
        if (matchesToUpdate.length > 0) {
          await tournamentService.updateMultipleMatches(
            matchesToUpdate.map(m => ({
              id: m.id,
              data: {
                player1_id: m.player1Id,
                player2_id: m.player2Id,
              }
            }))
          );
        }
      }

      await tournamentService.updateTournament(tournamentId, {
        started: true,
        rounds: rounds,
      });

      setTournament(prev => ({
        ...prev,
        matches: updated,
        rounds,
        started: true,
      }));
    } catch (error) {
      console.error('Error generating bracket:', error);
      toast.error('Fehler beim Erstellen des Turnierplans');
    }
  }, [tournamentId, tournament.players, tournament.doublesPairs, tournament.mode, tournament.type]);

  const updateMatchScore = useCallback(async (matchId: string, sets: SetScore[]) => {
    const match = tournament.matches.find(m => m.id === matchId);
    if (!match) return;

    let p1Wins = 0;
    let p2Wins = 0;
    for (const s of sets) {
      if (s.player1 >= 11 && s.player1 - s.player2 >= 2) p1Wins++;
      else if (s.player2 >= 11 && s.player2 - s.player1 >= 2) p2Wins++;
    }

    let winnerId: string | null = null;
    let status: Match['status'] = 'active';
    if (p1Wins >= 3) {
      winnerId = match.player1Id;
      status = 'completed';
    } else if (p2Wins >= 3) {
      winnerId = match.player2Id;
      status = 'completed';
    }

    try {
      await tournamentService.updateMatch(matchId, {
        sets,
        winner_id: winnerId,
        status,
      });

      // Update local state
      let updatedMatches = tournament.matches.map(m =>
        m.id === matchId ? { ...m, sets, winnerId, status } : m
      );

      // Propagate winner if completed (only for knockout mode)
      if (winnerId && tournament.mode === 'knockout') {
        updatedMatches = propagateWinners(updatedMatches);
        
        // Find next match and update in DB
        const nextRound = match.round + 1;
        const nextPos = Math.floor(match.position / 2);
        const nextMatch = updatedMatches.find(nm => nm.round === nextRound && nm.position === nextPos);
        
        if (nextMatch) {
          const updateData = match.position % 2 === 0
            ? { player1_id: winnerId }
            : { player2_id: winnerId };
          await tournamentService.updateMatch(nextMatch.id, updateData);
        }
      }

      setTournament(prev => ({ ...prev, matches: updatedMatches }));
    } catch (error) {
      console.error('Error updating score:', error);
      toast.error('Fehler beim Speichern des Ergebnisses');
    }
  }, [tournament.matches, tournament.mode]);

  const setMatchActive = useCallback(async (matchId: string, table?: number) => {
    try {
      await tournamentService.updateMatch(matchId, {
        status: 'active',
        table_number: table || null,
      });
      
      setTournament(prev => ({
        ...prev,
        matches: prev.matches.map(m =>
          m.id === matchId ? { ...m, status: 'active' as const, table } : m
        ),
      }));
    } catch (error) {
      console.error('Error setting match active:', error);
      toast.error('Fehler beim Aktivieren des Spiels');
    }
  }, []);

  const setTableCount = useCallback(async (count: number) => {
    if (!tournamentId) return;
    try {
      await tournamentService.updateTournament(tournamentId, {
        table_count: Math.max(1, count),
      });
      setTournament(prev => ({ ...prev, tableCount: Math.max(1, count) }));
    } catch (error) {
      console.error('Error updating table count:', error);
    }
  }, [tournamentId]);

  const autoAssignTables = useCallback(async () => {
    const activeTables = new Set(
      tournament.matches.filter(m => m.status === 'active' && m.table).map(m => m.table)
    );
    
    const freeTables: number[] = [];
    for (let i = 1; i <= tournament.tableCount; i++) {
      if (!activeTables.has(i)) freeTables.push(i);
    }
    
    const pendingReadyMatches = tournament.matches.filter(
      m => m.status === 'pending' && m.player1Id && m.player2Id
    );
    
    const updates: Array<{ id: string; table: number }> = [];
    let tableIdx = 0;
    
    for (const match of pendingReadyMatches) {
      if (tableIdx >= freeTables.length) break;
      updates.push({ id: match.id, table: freeTables[tableIdx] });
      tableIdx++;
    }

    if (updates.length === 0) return;

    try {
      await Promise.all(
        updates.map(u => tournamentService.updateMatch(u.id, {
          status: 'active',
          table_number: u.table,
        }))
      );

      setTournament(prev => ({
        ...prev,
        matches: prev.matches.map(m => {
          const update = updates.find(u => u.id === m.id);
          if (update) {
            return { ...m, status: 'active' as const, table: update.table };
          }
          return m;
        }),
      }));
    } catch (error) {
      console.error('Error auto-assigning tables:', error);
      toast.error('Fehler bei der Tischzuweisung');
    }
  }, [tournament.matches, tournament.tableCount]);

  const getPlayer = useCallback((id: string | null) => {
    if (!id) return null;
    return tournament.players.find(p => p.id === id) || null;
  }, [tournament.players]);

  const updateLogoUrl = useCallback(async (logoUrl: string | null) => {
    if (!tournamentId) return;
    try {
      await tournamentService.updateTournament(tournamentId, { logo_url: logoUrl });
      setTournament(prev => ({ ...prev, logoUrl }));
    } catch (error) {
      console.error('Error updating logo:', error);
      toast.error('Fehler beim Aktualisieren des Logos');
    }
  }, [tournamentId]);

  const updateTournamentMode = useCallback(async (mode: TournamentMode) => {
    if (!tournamentId) return;
    try {
      await tournamentService.updateTournament(tournamentId, { mode });
      setTournament(prev => ({ ...prev, mode }));
    } catch (error) {
      console.error('Error updating mode:', error);
      toast.error('Fehler beim Aktualisieren des Modus');
    }
  }, [tournamentId]);

  const updateTournamentType = useCallback(async (type: TournamentType) => {
    if (!tournamentId) return;
    try {
      await tournamentService.updateTournament(tournamentId, { type });
      setTournament(prev => ({ ...prev, type }));
    } catch (error) {
      console.error('Error updating type:', error);
      toast.error('Fehler beim Aktualisieren des Typs');
    }
  }, [tournamentId]);

  const addDoublesPair = useCallback(async (player1Id: string, player2Id: string, pairName: string) => {
    if (!tournamentId) return;
    try {
      const pair = await tournamentService.addDoublesPair(tournamentId, player1Id, player2Id, pairName);
      setTournament(prev => ({
        ...prev,
        doublesPairs: [...prev.doublesPairs, pair],
      }));
    } catch (error) {
      console.error('Error adding doubles pair:', error);
      toast.error('Fehler beim Erstellen des Doppelpaars');
    }
  }, [tournamentId]);

  const removeDoublesPair = useCallback(async (pairId: string) => {
    try {
      await tournamentService.removeDoublesPair(pairId);
      setTournament(prev => ({
        ...prev,
        doublesPairs: prev.doublesPairs.filter(dp => dp.id !== pairId),
      }));
    } catch (error) {
      console.error('Error removing doubles pair:', error);
      toast.error('Fehler beim Entfernen des Doppelpaars');
    }
  }, []);

  const autoGenerateDoublesPairs = useCallback(async (method: 'ttr' | 'random') => {
    if (!tournamentId) return;
    const players = [...tournament.players];
    if (players.length < 2) return;

    // Clear existing pairs
    try {
      await tournamentService.clearDoublesPairs(tournamentId);
    } catch (error) {
      console.error('Error clearing pairs:', error);
    }

    let ordered: Player[];
    if (method === 'ttr') {
      // Pair strongest with weakest
      ordered = [...players].sort((a, b) => b.ttr - a.ttr);
    } else {
      // Shuffle randomly
      ordered = [...players];
      for (let i = ordered.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
      }
    }

    const newPairs: DoublesPair[] = [];
    for (let i = 0; i + 1 < ordered.length; i += 2) {
      const p1 = ordered[i];
      const p2 = ordered[i + 1];
      try {
        const pair = await tournamentService.addDoublesPair(
          tournamentId,
          p1.id,
          p2.id,
          `${p1.name} / ${p2.name}`
        );
        newPairs.push(pair);
      } catch (error) {
        console.error('Error creating pair:', error);
      }
    }

    setTournament(prev => ({ ...prev, doublesPairs: newPairs }));
    toast.success(`${newPairs.length} Doppelpaare erstellt`);
  }, [tournamentId, tournament.players]);

  const getParticipantName = useCallback((id: string | null): string => {
    if (!id) return '—';
    // Check if it's a doubles pair (matched by player1Id since that's what we store in matches)
    const pair = tournament.doublesPairs.find(dp => dp.player1Id === id);
    if (pair) return pair.pairName || `Paar`;
    // Otherwise it's a player
    const player = tournament.players.find(p => p.id === id);
    return player?.name || '—';
  }, [tournament.players, tournament.doublesPairs]);

  return {
    tournament,
    loading,
    addPlayer,
    removePlayer,
    updatePlayer,
    importPlayers,
    generateBracket,
    updateMatchScore,
    setMatchActive,
    getPlayer,
    setTableCount,
    autoAssignTables,
    updateLogoUrl,
    updateTournamentMode,
    updateTournamentType,
    addDoublesPair,
    removeDoublesPair,
    autoGenerateDoublesPairs,
    getParticipantName,
    reload: loadTournament,
  };
}

function propagateWinners(matches: Match[]): Match[] {
  const updated = [...matches];
  for (const m of updated) {
    if (m.winnerId && m.status === 'completed') {
      const nextRound = m.round + 1;
      const nextPos = Math.floor(m.position / 2);
      const nextMatch = updated.find(nm => nm.round === nextRound && nm.position === nextPos);
      if (nextMatch) {
        if (m.position % 2 === 0) {
          nextMatch.player1Id = m.winnerId;
        } else {
          nextMatch.player2Id = m.winnerId;
        }
      }
    }
  }
  return updated;
}

// Round-robin schedule using circle method
function generateRoundRobinSchedule(participants: string[]): [string, string][][] {
  const list = [...participants];
  // If odd number, add a bye placeholder
  if (list.length % 2 !== 0) {
    list.push('__BYE__');
  }
  const n = list.length;
  const rounds: [string, string][][] = [];

  for (let round = 0; round < n - 1; round++) {
    const roundMatches: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) {
      const home = list[i];
      const away = list[n - 1 - i];
      if (home !== '__BYE__' && away !== '__BYE__') {
        roundMatches.push([home, away]);
      }
    }
    rounds.push(roundMatches);
    // Rotate: fix first element, rotate rest
    const last = list.pop()!;
    list.splice(1, 0, last);
  }

  return rounds;
}
