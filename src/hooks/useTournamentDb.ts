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
  bestOf: 3,
  phase: null,
  tournamentDate: null,
  venueStreet: '',
  venueHouseNumber: '',
  venuePostalCode: '',
  venueCity: '',
  motto: '',
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
    const isGroupKnockout = tournament.mode === 'group_knockout';

    // Determine participants
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

    if (isGroupKnockout) {
      // Group knockout: Phase 1 - assign groups of 4, round-robin within groups
      const groupSize = 4;
      const groupCount = Math.ceil(n / groupSize);

      // Assign groups (snake seeding by TTR)
      const groupAssignments: Array<{ playerId: string; groupNumber: number }> = [];
      for (let i = 0; i < n; i++) {
        const groupIdx = i < groupCount
          ? i
          : (Math.floor(i / groupCount) % 2 === 0
            ? i % groupCount
            : groupCount - 1 - (i % groupCount));
        const finalGroup = Math.min(groupIdx, groupCount - 1);
        groupAssignments.push({ playerId: participants[i], groupNumber: finalGroup });
      }

      // Update player group numbers in DB
      await tournamentService.updatePlayersGroupNumbers(
        groupAssignments.map(a => ({ id: a.playerId, group_number: a.groupNumber }))
      );

      // Update local state
      setTournament(prev => ({
        ...prev,
        players: prev.players.map(p => {
          const assignment = groupAssignments.find(a => a.playerId === p.id);
          return assignment ? { ...p, groupNumber: assignment.groupNumber } : p;
        }),
      }));

      // Generate round-robin matches per group
      matchesData = [];
      let maxRounds = 0;

      for (let g = 0; g < groupCount; g++) {
        const groupPlayers = groupAssignments
          .filter(a => a.groupNumber === g)
          .map(a => a.playerId);

        if (groupPlayers.length < 2) continue;

        const groupSchedule = generateRoundRobinSchedule(groupPlayers);
        if (groupSchedule.length > maxRounds) maxRounds = groupSchedule.length;

        for (let r = 0; r < groupSchedule.length; r++) {
          for (let pos = 0; pos < groupSchedule[r].length; pos++) {
            const [p1, p2] = groupSchedule[r][pos];
            matchesData.push({
              round: r,
              position: pos + g * 100, // offset position by group
              player1Id: p1,
              player2Id: p2,
              sets: [],
              winnerId: null,
              status: 'pending',
              groupNumber: g,
            });
          }
        }
      }

      rounds = maxRounds;

      try {
        const createdMatches = await tournamentService.createMatches(tournamentId, matchesData);

        await tournamentService.updateTournament(tournamentId, {
          started: true,
          rounds,
          phase: 'group',
        });

        setTournament(prev => ({
          ...prev,
          matches: createdMatches,
          rounds,
          started: true,
          phase: 'group',
        }));
      } catch (error) {
        console.error('Error generating group bracket:', error);
        toast.error('Fehler beim Erstellen der Gruppenphase');
      }
      return;
    }

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

  const updateMatchScore = useCallback(async (matchId: string, sets: SetScore[], effectiveBestOf?: number) => {
    const match = tournament.matches.find(m => m.id === matchId);
    if (!match) return;

    let p1Wins = 0;
    let p2Wins = 0;
    for (const s of sets) {
      if (s.player1 >= 11 && s.player1 - s.player2 >= 2) p1Wins++;
      else if (s.player2 >= 11 && s.player2 - s.player1 >= 2) p2Wins++;
    }

    const neededWins = effectiveBestOf || tournament.bestOf;
    let winnerId: string | null = null;
    let status: Match['status'] = 'active';
    if (p1Wins >= neededWins) {
      winnerId = match.player1Id;
      status = 'completed';
    } else if (p2Wins >= neededWins) {
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
      if (winnerId && (tournament.mode === 'knockout' || (tournament.mode === 'group_knockout' && tournament.phase === 'knockout'))) {
        const koMatches = tournament.mode === 'group_knockout'
          ? updatedMatches.filter(m => m.groupNumber === undefined || m.groupNumber === null)
          : updatedMatches;
        const propagated = propagateWinners(koMatches);
        // Merge propagated back
        updatedMatches = updatedMatches.map(m => {
          const p = propagated.find(pm => pm.id === m.id);
          return p || m;
        });
        
        // Find next match and update in DB
        const nextRound = match.round + 1;
        const nextPos = Math.floor(match.position / 2);
        const nextMatch = updatedMatches.find(nm => nm.round === nextRound && nm.position === nextPos && (nm.groupNumber === undefined || nm.groupNumber === null));
        
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
  }, [tournament.matches, tournament.mode, tournament.phase]);

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

  const updateBestOf = useCallback(async (bestOf: number) => {
    if (!tournamentId) return;
    try {
      await tournamentService.updateTournament(tournamentId, { best_of: bestOf });
      setTournament(prev => ({ ...prev, bestOf }));
    } catch (error) {
      console.error('Error updating bestOf:', error);
      toast.error('Fehler beim Aktualisieren der Gewinnsätze');
    }
  }, [tournamentId]);

  const updateName = useCallback(async (name: string) => {
    if (!tournamentId || !name.trim()) return;
    try {
      await tournamentService.updateTournament(tournamentId, { name: name.trim() });
      setTournament(prev => ({ ...prev, name: name.trim() }));
    } catch (error) {
      console.error('Error updating name:', error);
      toast.error('Fehler beim Aktualisieren des Namens');
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

  const updateDetails = useCallback(async (details: {
    tournament_date: string | null;
    venue_street: string;
    venue_house_number: string;
    venue_postal_code: string;
    venue_city: string;
    motto: string;
  }) => {
    if (!tournamentId) return;
    try {
      await tournamentService.updateTournament(tournamentId, details);
      setTournament(prev => ({
        ...prev,
        tournamentDate: details.tournament_date,
        venueStreet: details.venue_street,
        venueHouseNumber: details.venue_house_number,
        venuePostalCode: details.venue_postal_code,
        venueCity: details.venue_city,
        motto: details.motto,
      }));
    } catch (error) {
      console.error('Error updating details:', error);
      toast.error('Fehler beim Aktualisieren der Details');
    }
  }, [tournamentId]);

  // Advance from group phase to knockout phase
  const advanceToKnockout = useCallback(async () => {
    if (!tournamentId || tournament.mode !== 'group_knockout' || tournament.phase !== 'group') return;

    // Import computeGroupStandings dynamically to compute standings
    const groupMatches = tournament.matches.filter(m => m.groupNumber !== undefined && m.groupNumber !== null);
    const groupCount = Math.max(...tournament.players.map(p => (p.groupNumber ?? 0))) + 1;

    // Compute standings per group
    const qualifiedPlayers: Array<{ playerId: string; groupNumber: number; rank: number }> = [];
    
    for (let g = 0; g < groupCount; g++) {
      const gMatches = groupMatches.filter(m => m.groupNumber === g);
      // Compute standings inline
      const map = new Map<string, { playerId: string; won: number; setsWon: number; setsLost: number; pointsWon: number; pointsLost: number }>();
      
      for (const m of gMatches) {
        if (!m.player1Id || !m.player2Id || m.status !== 'completed') continue;
        if (!map.has(m.player1Id)) map.set(m.player1Id, { playerId: m.player1Id, won: 0, setsWon: 0, setsLost: 0, pointsWon: 0, pointsLost: 0 });
        if (!map.has(m.player2Id)) map.set(m.player2Id, { playerId: m.player2Id, won: 0, setsWon: 0, setsLost: 0, pointsWon: 0, pointsLost: 0 });
        
        const s1 = map.get(m.player1Id)!;
        const s2 = map.get(m.player2Id)!;
        if (m.winnerId === m.player1Id) s1.won++;
        else if (m.winnerId === m.player2Id) s2.won++;
        
        for (const s of m.sets) {
          s1.pointsWon += s.player1; s1.pointsLost += s.player2;
          s2.pointsWon += s.player2; s2.pointsLost += s.player1;
          if (s.player1 >= 11 && s.player1 - s.player2 >= 2) { s1.setsWon++; s2.setsLost++; }
          else if (s.player2 >= 11 && s.player2 - s.player1 >= 2) { s2.setsWon++; s1.setsLost++; }
        }
      }
      
      const standings = [...map.values()].sort((a, b) => {
        if (b.won !== a.won) return b.won - a.won;
        // Head-to-head
        const h2h = gMatches.find(m => m.status === 'completed' &&
          ((m.player1Id === a.playerId && m.player2Id === b.playerId) ||
           (m.player1Id === b.playerId && m.player2Id === a.playerId)));
        if (h2h) {
          if (h2h.winnerId === a.playerId) return -1;
          if (h2h.winnerId === b.playerId) return 1;
        }
        const aDiff = a.setsWon - a.setsLost;
        const bDiff = b.setsWon - b.setsLost;
        if (bDiff !== aDiff) return bDiff - aDiff;
        return (b.pointsWon - b.pointsLost) - (a.pointsWon - a.pointsLost);
      });
      
      // Top 2 qualify
      for (let i = 0; i < Math.min(2, standings.length); i++) {
        qualifiedPlayers.push({ playerId: standings[i].playerId, groupNumber: g, rank: i + 1 });
      }
    }

    const qualifiedCount = qualifiedPlayers.length;
    if (qualifiedCount < 2) return;

    // Cross-seeding: Group winners vs runners-up of other groups
    // Sort: all group winners first (by group), then runners-up (reversed for cross)
    const winners = qualifiedPlayers.filter(q => q.rank === 1).sort((a, b) => a.groupNumber - b.groupNumber);
    const runnersUp = qualifiedPlayers.filter(q => q.rank === 2).sort((a, b) => a.groupNumber - b.groupNumber);
    
    // Interleave: Winner A vs Runner-up B, Winner B vs Runner-up A, etc.
    const seeded: string[] = [];
    const runnersUpReversed = [...runnersUp].reverse();
    for (let i = 0; i < winners.length; i++) {
      seeded.push(winners[i].playerId);
      if (i < runnersUpReversed.length) {
        seeded.push(runnersUpReversed[i].playerId);
      }
    }
    // Add any remaining runners-up
    for (let i = winners.length; i < runnersUpReversed.length; i++) {
      seeded.push(runnersUpReversed[i].playerId);
    }

    const n = seeded.length;
    const slots = Math.pow(2, Math.ceil(Math.log2(n)));
    const koRounds = Math.log2(slots);

    const seededSlots: (string | null)[] = Array(slots).fill(null);
    for (let i = 0; i < n; i++) {
      seededSlots[i] = seeded[i];
    }

    const koMatchesData: Omit<Match, 'id'>[] = [];
    
    // First round
    for (let i = 0; i < slots / 2; i++) {
      const p1 = seededSlots[i * 2];
      const p2 = seededSlots[i * 2 + 1];
      const isBye = p2 === null;
      koMatchesData.push({
        round: 0,
        position: i,
        player1Id: p1,
        player2Id: p2,
        sets: [],
        winnerId: isBye ? p1 : null,
        status: isBye ? 'completed' : 'pending',
        groupNumber: null,
      });
    }

    // Subsequent rounds
    for (let r = 1; r < koRounds; r++) {
      const matchesInRound = slots / Math.pow(2, r + 1);
      for (let i = 0; i < matchesInRound; i++) {
        koMatchesData.push({
          round: r,
          position: i,
          player1Id: null,
          player2Id: null,
          sets: [],
          winnerId: null,
          status: 'pending',
          groupNumber: null,
        });
      }
    }

    try {
      const createdKoMatches = await tournamentService.createMatches(tournamentId, koMatchesData);
      
      // Propagate byes
      const propagated = propagateWinners(createdKoMatches);
      const matchesToUpdate = propagated.filter((m, i) =>
        m.player1Id !== createdKoMatches[i].player1Id ||
        m.player2Id !== createdKoMatches[i].player2Id
      );
      
      if (matchesToUpdate.length > 0) {
        await tournamentService.updateMultipleMatches(
          matchesToUpdate.map(m => ({
            id: m.id,
            data: { player1_id: m.player1Id, player2_id: m.player2Id },
          }))
        );
      }

      await tournamentService.updateTournament(tournamentId, {
        phase: 'knockout',
        rounds: koRounds,
      });

      setTournament(prev => ({
        ...prev,
        matches: [...prev.matches, ...propagated],
        rounds: koRounds,
        phase: 'knockout',
      }));

      toast.success(`K.O.-Runde mit ${qualifiedCount} Spielern gestartet`);
    } catch (error) {
      console.error('Error advancing to knockout:', error);
      toast.error('Fehler beim Starten der K.O.-Runde');
    }
  }, [tournamentId, tournament.mode, tournament.phase, tournament.matches, tournament.players]);

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
    updateName,
    updateTournamentMode,
    updateTournamentType,
    updateBestOf,
    updateDetails,
    addDoublesPair,
    removeDoublesPair,
    autoGenerateDoublesPairs,
    getParticipantName,
    advanceToKnockout,
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
