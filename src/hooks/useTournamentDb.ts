import { useState, useEffect, useCallback } from 'react';
import { Player, Match, Tournament, SetScore, DoublesPair, TournamentMode, TournamentType, Team, TeamPlayer, TeamMode } from '@/types/tournament';
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
  breakMinutes: 5,
  teamMode: null,
  earlyFinishEnabled: false,
  teams: [],
  teamPlayers: [],
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
    const isTeam = tournament.type === 'team';
    const isRoundRobin = tournament.mode === 'round_robin';
    const isGroupKnockout = tournament.mode === 'group_knockout';
    const isDoubleKnockout = tournament.mode === 'double_knockout';
    const isSwiss = tournament.mode === 'swiss';

    // Determine participants
    let participants: string[];
    if (isTeam) {
      participants = tournament.teams.map(t => t.id);
    } else if (isDoubles) {
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

      // Assign groups (snake seeding by TTR with club separation)
      const groupAssignments: Array<{ playerId: string; groupNumber: number }> = [];

      const pots: string[][] = Array.from({ length: Math.ceil(n / groupCount) }, () => []);
      for (let i = 0; i < n; i++) {
        pots[Math.floor(i / groupCount)].push(participants[i]);
      }

      for (let pIdx = 0; pIdx < pots.length; pIdx++) {
        const pot = pots[pIdx];
        const isReverseSnake = pIdx % 2 !== 0;
        const availableGroups = Array.from({ length: groupCount }, (_, i) => i);
        if (isReverseSnake) availableGroups.reverse();

        for (let i = 0; i < pot.length; i++) {
          const playerId = pot[i];
          const playerClub = tournament.players.find(p => p.id === playerId)?.club || '';

          let bestGroupIndex = 0;
          let minSameClubPlayers = Infinity;

          for (let j = 0; j < availableGroups.length; j++) {
            const g = availableGroups[j];
            const sameClubCount = groupAssignments.filter(a => {
              const aClub = tournament.players.find(p => p.id === a.playerId)?.club || '';
              return a.groupNumber === g && aClub === playerClub && playerClub !== '';
            }).length;

            if (sameClubCount < minSameClubPlayers) {
              minSameClubPlayers = sameClubCount;
              bestGroupIndex = j;
            }
            if (minSameClubPlayers === 0) break; // perfect match
          }

          const assignedGroup = availableGroups[bestGroupIndex];
          groupAssignments.push({ playerId, groupNumber: assignedGroup });
          availableGroups.splice(bestGroupIndex, 1);
        }
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

    if (isDoubleKnockout) {
      const slots = Math.pow(2, Math.ceil(Math.log2(n)));
      const wbRounds = Math.log2(slots);
      const lbRoundCount = 2 * (wbRounds - 1);

      if (n < 3) {
        toast.error('Doppel-K.o. benötigt mindestens 3 Teilnehmer');
        return;
      }

      matchesData = [];

      // Winner Bracket seeding
      const seeded: (string | null)[] = Array(slots).fill(null);
      for (let i = 0; i < n; i++) seeded[i] = participants[i];

      // WB Round 0
      for (let i = 0; i < slots / 2; i++) {
        const p1 = seeded[i * 2];
        const p2 = seeded[i * 2 + 1];
        const isBye = p2 === null;
        matchesData.push({
          round: 0, position: i,
          player1Id: p1, player2Id: p2,
          sets: [], winnerId: isBye ? p1 : null,
          status: isBye ? 'completed' : 'pending',
          groupNumber: null,
        });
      }

      // WB subsequent rounds
      for (let r = 1; r < wbRounds; r++) {
        const count = slots / Math.pow(2, r + 1);
        for (let i = 0; i < count; i++) {
          matchesData.push({
            round: r, position: i,
            player1Id: null, player2Id: null,
            sets: [], winnerId: null,
            status: 'pending', groupNumber: null,
          });
        }
      }

      // Loser Bracket
      for (let lbR = 0; lbR < lbRoundCount; lbR++) {
        const halfIdx = Math.floor(lbR / 2);
        const count = Math.max(1, Math.floor(slots / (4 * Math.pow(2, halfIdx))));
        for (let p = 0; p < count; p++) {
          matchesData.push({
            round: lbR, position: p,
            player1Id: null, player2Id: null,
            sets: [], winnerId: null,
            status: 'pending', groupNumber: -1,
          });
        }
      }

      // Grand Final
      matchesData.push({
        round: 0, position: 0,
        player1Id: null, player2Id: null,
        sets: [], winnerId: null,
        status: 'pending', groupNumber: -2,
      });

      rounds = wbRounds;

      try {
        const createdMatches = await tournamentService.createMatches(tournamentId, matchesData);

        // Propagate WB byes
        const allMatches = [...createdMatches];
        const byeMatches = allMatches.filter(m =>
          (m.groupNumber === null || m.groupNumber === undefined) &&
          m.winnerId && m.status === 'completed'
        );

        for (const bm of byeMatches) {
          if (bm.round < wbRounds - 1) {
            const nextWb = allMatches.find(nm =>
              (nm.groupNumber === null || nm.groupNumber === undefined) &&
              nm.round === bm.round + 1 &&
              nm.position === Math.floor(bm.position / 2)
            );
            if (nextWb) {
              if (bm.position % 2 === 0) nextWb.player1Id = bm.winnerId;
              else nextWb.player2Id = bm.winnerId;
            }
          }
        }

        const matchesToUpdate = allMatches.filter((m, i) =>
          m.player1Id !== createdMatches[i].player1Id ||
          m.player2Id !== createdMatches[i].player2Id
        );

        if (matchesToUpdate.length > 0) {
          await tournamentService.updateMultipleMatches(
            matchesToUpdate.map(m => ({
              id: m.id,
              data: { player1_id: m.player1Id, player2_id: m.player2Id },
            }))
          );
        }

        await tournamentService.updateTournament(tournamentId, { started: true, rounds });

        setTournament(prev => ({
          ...prev, matches: allMatches, rounds, started: true,
        }));
      } catch (error) {
        console.error('Error generating double elimination bracket:', error);
        toast.error('Fehler beim Erstellen des Doppel-K.o.-Brackets');
      }
      return;
    }

    if (isSwiss) {
      matchesData = [];
      const half = Math.ceil(n / 2);
      for (let i = 0; i < half; i++) {
        const p1 = participants[i];
        const p2 = i + half < n ? participants[i + half] : null;
        const isBye = !p2;
        matchesData.push({
          round: 0, position: i,
          player1Id: p1, player2Id: p2,
          sets: [], winnerId: isBye ? p1 : null,
          status: isBye ? 'completed' : 'pending',
        });
      }
      rounds = 1;

      try {
        const createdMatches = await tournamentService.createMatches(tournamentId, matchesData);
        await tournamentService.updateTournament(tournamentId, { started: true, rounds: 1 });
        setTournament(prev => ({
          ...prev, matches: createdMatches, rounds: 1, started: true,
        }));
      } catch (error) {
        console.error('Error generating Swiss round:', error);
        toast.error('Fehler beim Erstellen der Schweizer Runde');
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
          player1Id: isTeam ? null : p1,
          player2Id: isTeam ? null : p2,
          homeTeamId: isTeam ? p1 : null,
          awayTeamId: isTeam ? p2 : null,
          sets: [],
          winnerId: isBye && !isTeam ? p1 : null,
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
            homeTeamId: null,
            awayTeamId: null,
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

    const completedAt = status === 'completed' ? new Date().toISOString() : null;

    try {
      await tournamentService.updateMatch(matchId, {
        sets,
        winner_id: winnerId,
        status,
        ...(completedAt ? { completed_at: completedAt } : {}),
      });

      // Update local state
      let updatedMatches = tournament.matches.map(m =>
        m.id === matchId ? { ...m, sets, winnerId, status, completedAt } : m
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

      // Double elimination propagation
      if (winnerId && tournament.mode === 'double_knockout') {
        const completedMatch = updatedMatches.find(m => m.id === matchId)!;
        const loserId = completedMatch.player1Id === winnerId ? completedMatch.player2Id : completedMatch.player1Id;
        const wbRounds = tournament.rounds;
        const isWB = completedMatch.groupNumber === null || completedMatch.groupNumber === undefined;
        const isLB = completedMatch.groupNumber === -1;

        const dbUpdates: Array<{ id: string; data: Record<string, unknown> }> = [];

        if (isWB) {
          if (completedMatch.round < wbRounds - 1) {
            const nextWb = updatedMatches.find(nm =>
              (nm.groupNumber === null || nm.groupNumber === undefined) &&
              nm.round === completedMatch.round + 1 &&
              nm.position === Math.floor(completedMatch.position / 2)
            );
            if (nextWb) {
              const dbSlot = completedMatch.position % 2 === 0 ? 'player1_id' : 'player2_id';
              if (completedMatch.position % 2 === 0) nextWb.player1Id = winnerId;
              else nextWb.player2Id = winnerId;
              dbUpdates.push({ id: nextWb.id, data: { [dbSlot]: winnerId } });
            }
          } else {
            const gfMatch = updatedMatches.find(nm => nm.groupNumber === -2);
            if (gfMatch) {
              gfMatch.player1Id = winnerId;
              dbUpdates.push({ id: gfMatch.id, data: { player1_id: winnerId } });
            }
          }

          if (loserId) {
            if (completedMatch.round === 0) {
              const lbMatch = updatedMatches.find(nm =>
                nm.groupNumber === -1 && nm.round === 0 &&
                nm.position === Math.floor(completedMatch.position / 2)
              );
              if (lbMatch) {
                const dbSlot = completedMatch.position % 2 === 0 ? 'player1_id' : 'player2_id';
                if (completedMatch.position % 2 === 0) lbMatch.player1Id = loserId;
                else lbMatch.player2Id = loserId;
                dbUpdates.push({ id: lbMatch.id, data: { [dbSlot]: loserId } });
              }
            } else {
              const lbRound = 2 * completedMatch.round - 1;
              const lbMatch = updatedMatches.find(nm =>
                nm.groupNumber === -1 && nm.round === lbRound &&
                nm.position === completedMatch.position
              );
              if (lbMatch) {
                lbMatch.player2Id = loserId;
                dbUpdates.push({ id: lbMatch.id, data: { player2_id: loserId } });
              }
            }
          }
        } else if (isLB) {
          const lastLbRound = 2 * (wbRounds - 1) - 1;
          if (completedMatch.round === lastLbRound) {
            const gfMatch = updatedMatches.find(nm => nm.groupNumber === -2);
            if (gfMatch) {
              gfMatch.player2Id = winnerId;
              dbUpdates.push({ id: gfMatch.id, data: { player2_id: winnerId } });
            }
          } else if (completedMatch.round % 2 === 0) {
            const next = updatedMatches.find(nm =>
              nm.groupNumber === -1 && nm.round === completedMatch.round + 1 &&
              nm.position === completedMatch.position
            );
            if (next) {
              next.player1Id = winnerId;
              dbUpdates.push({ id: next.id, data: { player1_id: winnerId } });
            }
          } else {
            const next = updatedMatches.find(nm =>
              nm.groupNumber === -1 && nm.round === completedMatch.round + 1 &&
              nm.position === Math.floor(completedMatch.position / 2)
            );
            if (next) {
              if (completedMatch.position % 2 === 0) {
                next.player1Id = winnerId;
                dbUpdates.push({ id: next.id, data: { player1_id: winnerId } });
              } else {
                next.player2Id = winnerId;
                dbUpdates.push({ id: next.id, data: { player2_id: winnerId } });
              }
            }
          }
        }

        if (dbUpdates.length > 0) {
          await tournamentService.updateMultipleMatches(dbUpdates);
        }
      }

      setTournament(prev => ({ ...prev, matches: updatedMatches }));
    } catch (error) {
      console.error('Error updating score:', error);
      toast.error('Fehler beim Speichern des Ergebnisses');
    }
  }, [tournament.matches, tournament.mode, tournament.phase]);

  const setMatchActive = useCallback(async (matchId: string, table?: number) => {
    const match = tournament.matches.find(m => m.id === matchId);
    if (!match) return;

    // Check if any player is currently in an active match
    const activePlayers = new Set<string>();
    tournament.matches.filter(m => m.status === 'active').forEach(m => {
      if (m.player1Id) activePlayers.add(m.player1Id);
      if (m.player2Id) activePlayers.add(m.player2Id);
    });

    if ((match.player1Id && activePlayers.has(match.player1Id)) ||
      (match.player2Id && activePlayers.has(match.player2Id))) {
      toast.error('Ein Spieler spielt gerade noch ein anderes Spiel.');
      return;
    }

    // Check 5-minute pause
    const PAUSE_MS = tournament.breakMinutes * 60 * 1000;
    const now = Date.now();
    const playerIds = [match.player1Id, match.player2Id].filter(Boolean) as string[];
    const recentMatch = tournament.matches.find(m =>
      m.status === 'completed' && m.completedAt &&
      (now - new Date(m.completedAt).getTime() < PAUSE_MS) &&
      playerIds.some(pid => m.player1Id === pid || m.player2Id === pid)
    );
    if (recentMatch) {
      const remaining = Math.ceil((PAUSE_MS - (now - new Date(recentMatch.completedAt!).getTime())) / 60000);
      toast.error(`Spieler braucht noch ${remaining} Min. Pause.`);
      return;
    }

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
  }, [tournament.matches]);

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

    // Collect players currently in an active match
    const activePlayers = new Set<string>();
    tournament.matches.filter(m => m.status === 'active').forEach(m => {
      if (m.player1Id) activePlayers.add(m.player1Id);
      if (m.player2Id) activePlayers.add(m.player2Id);
    });

    // Collect players who completed a match less than 5 minutes ago
    const PAUSE_MS = tournament.breakMinutes * 60 * 1000;
    const now = Date.now();
    const recentPlayers = new Set<string>();
    tournament.matches.filter(m => m.status === 'completed' && m.completedAt).forEach(m => {
      const completedTime = new Date(m.completedAt!).getTime();
      if (now - completedTime < PAUSE_MS) {
        if (m.player1Id) recentPlayers.add(m.player1Id);
        if (m.player2Id) recentPlayers.add(m.player2Id);
      }
    });

    const unavailablePlayers = new Set([...activePlayers, ...recentPlayers]);

    const pendingReadyMatches = tournament.matches.filter(
      m => m.status === 'pending' && m.player1Id && m.player2Id
    );

    const updates: Array<{ id: string; table: number }> = [];
    // Track players being assigned in this batch to avoid double-booking
    const assignedPlayers = new Set<string>();
    let tableIdx = 0;

    for (const match of pendingReadyMatches) {
      if (tableIdx >= freeTables.length) break;
      // Check both players are available
      const p1 = match.player1Id!;
      const p2 = match.player2Id!;
      if (unavailablePlayers.has(p1) || unavailablePlayers.has(p2)) continue;
      if (assignedPlayers.has(p1) || assignedPlayers.has(p2)) continue;

      updates.push({ id: match.id, table: freeTables[tableIdx] });
      assignedPlayers.add(p1);
      assignedPlayers.add(p2);
      tableIdx++;
    }

    if (updates.length === 0) {
      if (pendingReadyMatches.length > 0 && freeTables.length > 0) {
        toast.info(`Spieler benötigen noch eine Pause (mind. ${tournament.breakMinutes} Min.) oder spielen gerade.`);
      }
      return;
    }

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
    // Check if it's a team
    const team = tournament.teams.find(t => t.id === id);
    if (team) return team.name;
    // Check if it's a doubles pair
    const pair = tournament.doublesPairs.find(dp => dp.player1Id === id);
    if (pair) return pair.pairName || `Paar`;
    // Otherwise it's a player
    const player = tournament.players.find(p => p.id === id);
    return player?.name || '—';
  }, [tournament.players, tournament.doublesPairs, tournament.teams]);

  const updateDetails = useCallback(async (details: {
    tournament_date: string | null;
    venue_street: string;
    venue_house_number: string;
    venue_postal_code: string;
    venue_city: string;
    motto: string;
    break_minutes: number;
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
        breakMinutes: details.break_minutes,
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

  const resetTournament = useCallback(async () => {
    if (!tournamentId) return;

    // Check if any sets have been played
    const hasPlayedSets = tournament.matches.some(m => m.sets && m.sets.length > 0) || tournament.matches.some(m => m.status === 'completed' || m.status === 'active');

    if (hasPlayedSets) {
      toast.error('Turnier kann nicht zurückgesetzt werden, da bereits Spiele gestartet oder beendet wurden.');
      return;
    }

    try {
      await tournamentService.clearTournamentMatches(tournamentId);
      await tournamentService.resetTournamentState(tournamentId);

      setTournament(prev => ({
        ...prev,
        started: false,
        rounds: 0,
        phase: null,
        matches: [],
        players: prev.players.map(p => ({ ...p, groupNumber: null })),
      }));
      toast.success('Turnier erfolgreich zurückgesetzt.');
    } catch (error) {
      console.error('Error resetting tournament:', error);
      toast.error('Fehler beim Zurücksetzen des Turniers.');
    }
  }, [tournamentId, tournament.matches]);

  const generateNextSwissRound = useCallback(async () => {
    if (!tournamentId || tournament.mode !== 'swiss') return;

    const currentRound = tournament.rounds;

    const standings = new Map<string, { wins: number; opponents: Set<string> }>();
    for (const p of tournament.players) {
      standings.set(p.id, { wins: 0, opponents: new Set() });
    }

    for (const m of tournament.matches) {
      if (m.status !== 'completed' || !m.player1Id) continue;
      if (m.player2Id) {
        standings.get(m.player1Id)?.opponents.add(m.player2Id);
        standings.get(m.player2Id)?.opponents.add(m.player1Id);
      }
      if (m.winnerId === m.player1Id) {
        const s = standings.get(m.player1Id);
        if (s) s.wins++;
      } else if (m.winnerId === m.player2Id) {
        const s = standings.get(m.player2Id);
        if (s) s.wins++;
      }
    }

    const sorted = [...standings.entries()]
      .sort(([, a], [, b]) => b.wins - a.wins)
      .map(([id]) => id);

    const paired = new Set<string>();
    const newMatches: Omit<Match, 'id'>[] = [];
    let pos = 0;

    for (let i = 0; i < sorted.length; i++) {
      if (paired.has(sorted[i])) continue;
      let found = false;
      for (let j = i + 1; j < sorted.length; j++) {
        if (paired.has(sorted[j])) continue;
        if (standings.get(sorted[i])!.opponents.has(sorted[j])) continue;

        newMatches.push({
          round: currentRound, position: pos++,
          player1Id: sorted[i], player2Id: sorted[j],
          sets: [], winnerId: null, status: 'pending',
        });
        paired.add(sorted[i]);
        paired.add(sorted[j]);
        found = true;
        break;
      }
      if (!found && !paired.has(sorted[i])) {
        newMatches.push({
          round: currentRound, position: pos++,
          player1Id: sorted[i], player2Id: null,
          sets: [], winnerId: sorted[i], status: 'completed',
        });
        paired.add(sorted[i]);
      }
    }

    try {
      const created = await tournamentService.createMatches(tournamentId, newMatches);
      await tournamentService.updateTournament(tournamentId, { rounds: currentRound + 1 });
      setTournament(prev => ({
        ...prev,
        matches: [...prev.matches, ...created],
        rounds: currentRound + 1,
      }));
      toast.success(`Runde ${currentRound + 1} generiert`);
    } catch (error) {
      console.error('Error generating Swiss round:', error);
      toast.error('Fehler beim Generieren der nächsten Runde');
    }
  }, [tournamentId, tournament.mode, tournament.rounds, tournament.matches, tournament.players]);

  // Team management
  const addTeam = useCallback(async (name: string) => {
    if (!tournamentId) return;
    try {
      const team = await tournamentService.addTeam(tournamentId, name);
      setTournament(prev => ({ ...prev, teams: [...prev.teams, team] }));
      toast.success('Team erstellt');
    } catch (error) {
      console.error('Error adding team:', error);
      toast.error('Fehler beim Erstellen des Teams');
    }
  }, [tournamentId]);

  const removeTeam = useCallback(async (teamId: string) => {
    try {
      await tournamentService.removeTeam(teamId);
      setTournament(prev => ({
        ...prev,
        teams: prev.teams.filter(t => t.id !== teamId),
        teamPlayers: prev.teamPlayers.filter(tp => tp.teamId !== teamId),
      }));
      toast.success('Team gelöscht');
    } catch (error) {
      console.error('Error removing team:', error);
      toast.error('Fehler beim Löschen des Teams');
    }
  }, []);

  const addPlayerToTeam = useCallback(async (teamId: string, playerId: string, position: number) => {
    try {
      const tp = await tournamentService.addTeamPlayer(teamId, playerId, position);
      setTournament(prev => ({ ...prev, teamPlayers: [...prev.teamPlayers, tp] }));
    } catch (error) {
      console.error('Error adding player to team:', error);
      toast.error('Fehler beim Zuordnen des Spielers');
    }
  }, []);

  const removePlayerFromTeam = useCallback(async (teamPlayerId: string) => {
    try {
      await tournamentService.removeTeamPlayer(teamPlayerId);
      setTournament(prev => ({
        ...prev,
        teamPlayers: prev.teamPlayers.filter(tp => tp.id !== teamPlayerId),
      }));
    } catch (error) {
      console.error('Error removing player from team:', error);
      toast.error('Fehler beim Entfernen des Spielers aus dem Team');
    }
  }, []);

  const updateTeamMode = useCallback(async (teamMode: TeamMode | null) => {
    if (!tournamentId) return;
    try {
      await tournamentService.updateTournament(tournamentId, { team_mode: teamMode });
      setTournament(prev => ({ ...prev, teamMode }));
    } catch (error) {
      console.error('Error updating team mode:', error);
      toast.error('Fehler beim Aktualisieren des Team-Modus');
    }
  }, [tournamentId]);

  const updateEarlyFinish = useCallback(async (enabled: boolean) => {
    if (!tournamentId) return;
    try {
      await tournamentService.updateTournament(tournamentId, { early_finish_enabled: enabled });
      setTournament(prev => ({ ...prev, earlyFinishEnabled: enabled }));
    } catch (error) {
      console.error('Error updating early finish:', error);
    }
  }, [tournamentId]);

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
    resetTournament,
    generateNextSwissRound,
    addTeam,
    removeTeam,
    addPlayerToTeam,
    removePlayerFromTeam,
    updateTeamMode,
    updateEarlyFinish,
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
