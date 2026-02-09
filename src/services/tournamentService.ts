import { supabase } from '@/integrations/supabase/client';
import { Tournament, Player, Match, SetScore } from '@/types/tournament';
import { Json } from '@/integrations/supabase/types';

export interface DbTournament {
  id: string;
  name: string;
  table_count: number;
  rounds: number;
  started: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbPlayer {
  id: string;
  tournament_id: string;
  name: string;
  club: string;
  ttr: number;
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

  return {
    id: tournament.id,
    name: tournament.name,
    tableCount: tournament.table_count,
    rounds: tournament.rounds,
    started: tournament.started,
    players: (players || []).map((p: { id: string; name: string; club: string; ttr: number }) => ({
      id: p.id,
      name: p.name,
      club: p.club,
      ttr: p.ttr,
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

export async function createTournament(name: string = 'Tischtennis Turnier'): Promise<string> {
  const { data, error } = await supabase
    .from('tournaments')
    .insert({ name })
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
      ttr: player.ttr,
    })
    .select()
    .single();
  
  if (error) throw error;
  return {
    id: data.id,
    name: data.name,
    club: data.club,
    ttr: data.ttr,
  };
}

export async function removePlayerFromDb(playerId: string): Promise<void> {
  const { error } = await supabase
    .from('players')
    .delete()
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
