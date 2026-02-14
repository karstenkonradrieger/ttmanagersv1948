import { supabase } from '@/integrations/supabase/client';
import { Tournament, Player, Match, SetScore, DoublesPair } from '@/types/tournament';
import { Json } from '@/integrations/supabase/types';

export interface DbTournament {
  id: string;
  name: string;
  table_count: number;
  rounds: number;
  started: boolean;
  created_at: string;
  updated_at: string;
  logo_url: string | null;
  mode: string;
  type: string;
}

export interface DbPlayer {
  id: string;
  tournament_id: string;
  name: string;
  club: string;
  gender: string;
  birth_date: string | null;
  ttr: number;
  postal_code: string;
  city: string;
  street: string;
  house_number: string;
  phone: string;
  created_at: string;
}

export interface DbMatch {
  id: string;
  tournament_id: string;
  round: number;
  position: number;
  player1_id: string | null;
  player2_id: string | null;
  winner_id: string | null;
  sets: SetScore[];
  table_number: number | null;
  status: 'pending' | 'active' | 'completed';
  created_at: string;
}

// Tournament operations
export async function fetchTournaments(): Promise<DbTournament[]> {
  const { data, error } = await supabase
    .from('tournaments')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

export async function fetchTournament(id: string): Promise<Tournament | null> {
  const { data: tournament, error: tError } = await supabase
    .from('tournaments')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  
  if (tError) throw tError;
  if (!tournament) return null;

  const { data: players, error: pError } = await supabase
    .from('players')
    .select('*')
    .eq('tournament_id', id);
  
  if (pError) throw pError;

  const { data: matches, error: mError } = await supabase
    .from('matches')
    .select('*')
    .eq('tournament_id', id)
    .order('round', { ascending: true })
    .order('position', { ascending: true });
  
  if (mError) throw mError;

  // Fetch doubles pairs
  const { data: doublesPairs, error: dpError } = await supabase
    .from('doubles_pairs')
    .select('*')
    .eq('tournament_id', id);
  
  if (dpError) throw dpError;

  return {
    id: tournament.id,
    name: tournament.name,
    tableCount: tournament.table_count,
    rounds: tournament.rounds,
    started: tournament.started,
    logoUrl: tournament.logo_url,
    mode: (tournament.mode || 'knockout') as 'knockout' | 'round_robin',
    type: (tournament.type || 'singles') as 'singles' | 'doubles',
    doublesPairs: (doublesPairs || []).map((dp: any) => ({
      id: dp.id,
      tournamentId: dp.tournament_id,
      player1Id: dp.player1_id,
      player2Id: dp.player2_id,
      pairName: dp.pair_name || '',
    })),
    players: (players || []).map((p: { id: string; name: string; club: string; gender: string; birth_date: string | null; ttr: number; postal_code: string; city: string; street: string; house_number: string; phone: string }) => ({
      id: p.id,
      name: p.name,
      club: p.club,
      gender: p.gender,
      birthDate: p.birth_date,
      ttr: p.ttr,
      postalCode: p.postal_code,
      city: p.city,
      street: p.street,
      houseNumber: p.house_number,
      phone: p.phone,
    })),
    matches: (matches || []).map((m: { 
      id: string; 
      round: number; 
      position: number; 
      player1_id: string | null; 
      player2_id: string | null; 
      winner_id: string | null; 
      sets: Json; 
      table_number: number | null; 
      status: string;
    }) => ({
      id: m.id,
      round: m.round,
      position: m.position,
      player1Id: m.player1_id,
      player2Id: m.player2_id,
      winnerId: m.winner_id,
      sets: (Array.isArray(m.sets) ? m.sets : []) as unknown as SetScore[],
      table: m.table_number || undefined,
      status: m.status as 'pending' | 'active' | 'completed',
    })),
  };
}

export async function createTournament(name: string = 'Tischtennis Turnier', createdBy?: string, mode: string = 'knockout', type: string = 'singles'): Promise<string> {
  const { data, error } = await supabase
    .from('tournaments')
    .insert({ name, created_by: createdBy || null, mode, type })
    .select('id')
    .single();
  
  if (error) throw error;
  return data.id;
}

export async function updateTournament(id: string, updates: Partial<{
  name: string;
  table_count: number;
  rounds: number;
  started: boolean;
  logo_url: string | null;
  mode: string;
  type: string;
}>): Promise<void> {
  const { error } = await supabase
    .from('tournaments')
    .update(updates)
    .eq('id', id);
  
  if (error) throw error;
}

export async function deleteTournament(id: string): Promise<void> {
  const { error } = await supabase
    .from('tournaments')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
}

// Player operations
export async function addPlayerToDb(tournamentId: string, player: Omit<Player, 'id'>): Promise<Player> {
  const { data, error } = await supabase
    .from('players')
    .insert({
      tournament_id: tournamentId,
      name: player.name,
      club: player.club,
      gender: player.gender,
      birth_date: player.birthDate,
      ttr: player.ttr,
      postal_code: player.postalCode,
      city: player.city,
      street: player.street,
      house_number: player.houseNumber,
      phone: player.phone,
    })
    .select()
    .single();
  
  if (error) throw error;
  return {
    id: data.id,
    name: data.name,
    club: data.club,
    gender: data.gender,
    birthDate: data.birth_date,
    ttr: data.ttr,
    postalCode: data.postal_code,
    city: data.city,
    street: data.street,
    houseNumber: data.house_number,
    phone: data.phone,
  };
}

export async function removePlayerFromDb(playerId: string): Promise<void> {
  const { error } = await supabase
    .from('players')
    .delete()
    .eq('id', playerId);
  
  if (error) throw error;
}

export async function updatePlayerInDb(playerId: string, updates: Partial<Omit<Player, 'id'>>): Promise<void> {
  const dbUpdates: Record<string, unknown> = {};
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.club !== undefined) dbUpdates.club = updates.club;
  if (updates.gender !== undefined) dbUpdates.gender = updates.gender;
  if (updates.birthDate !== undefined) dbUpdates.birth_date = updates.birthDate;
  if (updates.ttr !== undefined) dbUpdates.ttr = updates.ttr;
  if (updates.postalCode !== undefined) dbUpdates.postal_code = updates.postalCode;
  if (updates.city !== undefined) dbUpdates.city = updates.city;
  if (updates.street !== undefined) dbUpdates.street = updates.street;
  if (updates.houseNumber !== undefined) dbUpdates.house_number = updates.houseNumber;
  if (updates.phone !== undefined) dbUpdates.phone = updates.phone;

  const { error } = await supabase
    .from('players')
    .update(dbUpdates)
    .eq('id', playerId);

  if (error) throw error;
}

// Match operations
export async function createMatches(tournamentId: string, matches: Omit<Match, 'id'>[]): Promise<Match[]> {
  const dbMatches = matches.map(m => ({
    tournament_id: tournamentId,
    round: m.round,
    position: m.position,
    player1_id: m.player1Id || null,
    player2_id: m.player2Id || null,
    winner_id: m.winnerId || null,
    sets: m.sets as unknown as Json,
    table_number: m.table || null,
    status: m.status,
  }));

  const { data, error } = await supabase
    .from('matches')
    .insert(dbMatches)
    .select();
  
  if (error) throw error;
  
  return (data || []).map((m: {
    id: string;
    round: number;
    position: number;
    player1_id: string | null;
    player2_id: string | null;
    winner_id: string | null;
    sets: Json;
    table_number: number | null;
    status: string;
  }) => ({
    id: m.id,
    round: m.round,
    position: m.position,
    player1Id: m.player1_id,
    player2Id: m.player2_id,
    winnerId: m.winner_id,
    sets: (Array.isArray(m.sets) ? m.sets : []) as unknown as SetScore[],
    table: m.table_number || undefined,
    status: m.status as 'pending' | 'active' | 'completed',
  }));
}

export async function updateMatch(matchId: string, updates: Partial<{
  player1_id: string | null;
  player2_id: string | null;
  winner_id: string | null;
  sets: SetScore[];
  table_number: number | null;
  status: 'pending' | 'active' | 'completed';
}>): Promise<void> {
  // Convert sets to Json type if present
  const dbUpdates: Record<string, unknown> = { ...updates };
  if (updates.sets) {
    dbUpdates.sets = updates.sets as unknown as Json;
  }
  
  const { error } = await supabase
    .from('matches')
    .update(dbUpdates)
    .eq('id', matchId);
  
  if (error) throw error;
}

export async function updateMultipleMatches(updates: Array<{ id: string; data: Record<string, unknown> }>): Promise<void> {
  // Use Promise.all for batch updates
  await Promise.all(
    updates.map(({ id, data }) =>
      supabase.from('matches').update(data).eq('id', id)
    )
  );
}

// Doubles pair operations
export async function addDoublesPair(tournamentId: string, player1Id: string, player2Id: string, pairName: string): Promise<DoublesPair> {
  const { data, error } = await supabase
    .from('doubles_pairs')
    .insert({
      tournament_id: tournamentId,
      player1_id: player1Id,
      player2_id: player2Id,
      pair_name: pairName,
    })
    .select()
    .single();
  
  if (error) throw error;
  return {
    id: data.id,
    tournamentId: data.tournament_id,
    player1Id: data.player1_id,
    player2Id: data.player2_id,
    pairName: data.pair_name,
  };
}

export async function removeDoublesPair(pairId: string): Promise<void> {
  const { error } = await supabase
    .from('doubles_pairs')
    .delete()
    .eq('id', pairId);
  
  if (error) throw error;
}

export async function clearDoublesPairs(tournamentId: string): Promise<void> {
  const { error } = await supabase
    .from('doubles_pairs')
    .delete()
    .eq('tournament_id', tournamentId);
  
  if (error) throw error;
}
