import { supabase } from '@/integrations/supabase/client';
import { Tournament, Player, Match, SetScore, DoublesPair, TournamentMode, Team, TeamPlayer, EncounterGame, TeamMode } from '@/types/tournament';
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
  best_of: number;
  phase: string | null;
  tournament_date: string | null;
  tournament_end_date: string | null;
  venue_street: string;
  venue_house_number: string;
  venue_postal_code: string;
  venue_city: string;
  motto: string;
  break_minutes: number;
  team_mode: string | null;
  early_finish_enabled: boolean;
  sport: string;
  directions_pdf_url: string | null;
  google_maps_link: string | null;
  certificate_text: string;
  organizer_name: string;
  sponsor_name: string;
  sponsor_signature_url: string | null;
  sponsor_logo_url: string | null;
  sponsor_consent: boolean;
  certificate_bg_url: string | null;
  certificate_font_family: string;
  certificate_font_size: number;
  certificate_text_color: string;
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
  group_number: number | null;
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
  group_number: number | null;
  created_at: string;
  completed_at: string | null;
}

// Tournament operations
export async function fetchTournaments(): Promise<DbTournament[]> {
  const { data, error } = await supabase
    .from('tournaments')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map((t: any) => ({
    ...t,
    team_mode: t.team_mode || null,
    early_finish_enabled: t.early_finish_enabled ?? false,
    tournament_end_date: t.tournament_end_date || null,
    sport: t.sport || 'Tischtennis',
    directions_pdf_url: t.directions_pdf_url || null,
    google_maps_link: t.google_maps_link || null,
  }));
}

export async function fetchTournament(id: string): Promise<Tournament | null> {
  const { data: tournament, error: tError } = await supabase
    .from('tournaments')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (tError) throw tError;
  if (!tournament) return null;

  const [
    { data: players, error: pError },
    { data: matches, error: mError },
    { data: doublesPairs, error: dpError },
    { data: teams, error: teError },
    { data: teamPlayers, error: tpError },
  ] = await Promise.all([
    supabase.from('players').select('*').eq('tournament_id', id),
    supabase.from('matches').select('*').eq('tournament_id', id).order('round', { ascending: true }).order('position', { ascending: true }),
    supabase.from('doubles_pairs').select('*').eq('tournament_id', id),
    supabase.from('teams').select('*').eq('tournament_id', id),
    supabase.from('team_players').select('*'),
  ]);

  if (pError) throw pError;
  if (mError) throw mError;
  if (dpError) throw dpError;
  if (teError) throw teError;
  if (tpError) throw tpError;

  // Filter team_players to only those belonging to this tournament's teams
  const teamIds = new Set((teams || []).map((t: any) => t.id));
  const filteredTeamPlayers = (teamPlayers || []).filter((tp: any) => teamIds.has(tp.team_id));

  return {
    id: tournament.id,
    name: tournament.name,
    tableCount: tournament.table_count,
    rounds: tournament.rounds,
    started: tournament.started,
    logoUrl: tournament.logo_url,
    mode: (tournament.mode || 'knockout') as TournamentMode,
    type: (tournament.type || 'singles') as Tournament['type'],
    bestOf: tournament.best_of || 3,
    phase: (tournament.phase as 'group' | 'knockout' | null) || null,
    tournamentDate: tournament.tournament_date || null,
    venueStreet: tournament.venue_street || '',
    venueHouseNumber: tournament.venue_house_number || '',
    venuePostalCode: tournament.venue_postal_code || '',
    venueCity: tournament.venue_city || '',
    motto: tournament.motto || '',
    breakMinutes: tournament.break_minutes ?? 5,
    teamMode: (tournament.team_mode as TeamMode | null) || null,
    earlyFinishEnabled: tournament.early_finish_enabled ?? false,
    kaiserDurationMinutes: (tournament as any).kaiser_duration_minutes ?? 10,
    tournamentEndDate: (tournament as any).tournament_end_date || null,
    sport: (tournament as any).sport || 'Tischtennis',
    directionsPdfUrl: (tournament as any).directions_pdf_url || null,
    googleMapsLink: (tournament as any).google_maps_link || null,
    certificateText: (tournament as any).certificate_text || 'Beim {turniername} hat {spieler} ({verein}) den {platz} belegt.',
    organizerName: (tournament as any).organizer_name || '',
    sponsorName: (tournament as any).sponsor_name || '',
    sponsorSignatureUrl: (tournament as any).sponsor_signature_url || null,
    sponsorLogoUrl: (tournament as any).sponsor_logo_url || null,
    sponsorConsent: (tournament as any).sponsor_consent ?? false,
    certificateBgUrl: (tournament as any).certificate_bg_url || null,
    certificateFontFamily: (tournament as any).certificate_font_family || 'Helvetica',
    certificateFontSize: (tournament as any).certificate_font_size ?? 20,
    certificateTextColor: (tournament as any).certificate_text_color || '#1e1e1e',
    doublesPairs: (doublesPairs || []).map((dp: any) => ({
      id: dp.id,
      tournamentId: dp.tournament_id,
      player1Id: dp.player1_id,
      player2Id: dp.player2_id,
      pairName: dp.pair_name || '',
    })),
    teams: (teams || []).map((t: any) => ({
      id: t.id,
      tournamentId: t.tournament_id,
      name: t.name,
    })),
    teamPlayers: filteredTeamPlayers.map((tp: any) => ({
      id: tp.id,
      teamId: tp.team_id,
      playerId: tp.player_id,
      position: tp.position,
    })),
    players: (players || []).map((p: any) => ({
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
      groupNumber: p.group_number,
      voiceNameUrl: (p as any).voice_name_url || null,
    })),
    matches: (matches || []).map((m: any) => ({
      id: m.id,
      round: m.round,
      position: m.position,
      player1Id: m.player1_id,
      player2Id: m.player2_id,
      winnerId: m.winner_id,
      sets: (Array.isArray(m.sets) ? m.sets : []) as unknown as SetScore[],
      table: m.table_number || undefined,
      status: m.status as 'pending' | 'active' | 'completed',
      groupNumber: m.group_number,
      completedAt: m.completed_at || null,
      homeTeamId: m.home_team_id || null,
      awayTeamId: m.away_team_id || null,
    })),
  };
}

export async function createTournament(
  name: string = 'Tischtennis Turnier',
  createdBy?: string,
  mode: string = 'knockout',
  type: string = 'singles',
  bestOf: number = 3,
  teamMode?: string | null,
  extras?: {
    sport?: string;
    tournament_date?: string | null;
    tournament_end_date?: string | null;
    venue_street?: string;
    venue_house_number?: string;
    venue_postal_code?: string;
    venue_city?: string;
    directions_pdf_url?: string | null;
    google_maps_link?: string | null;
    logo_url?: string | null;
    certificate_text?: string;
    organizer_name?: string;
    sponsor_name?: string;
    sponsor_signature_url?: string | null;
      sponsor_logo_url?: string | null;
      sponsor_consent?: boolean;
      certificate_bg_url?: string | null;
      certificate_font_family?: string;
      certificate_font_size?: number;
      certificate_text_color?: string;
    },
): Promise<string> {
  const { data, error } = await supabase
    .from('tournaments')
    .insert({
      name,
      created_by: createdBy || null,
      mode,
      type,
      best_of: bestOf,
      ...(teamMode ? { team_mode: teamMode } : {}),
      ...(extras?.sport ? { sport: extras.sport } : {}),
      ...(extras?.tournament_date ? { tournament_date: extras.tournament_date } : {}),
      ...(extras?.tournament_end_date ? { tournament_end_date: extras.tournament_end_date } : {}),
      ...(extras?.venue_street ? { venue_street: extras.venue_street } : {}),
      ...(extras?.venue_house_number ? { venue_house_number: extras.venue_house_number } : {}),
      ...(extras?.venue_postal_code ? { venue_postal_code: extras.venue_postal_code } : {}),
      ...(extras?.venue_city ? { venue_city: extras.venue_city } : {}),
      ...(extras?.directions_pdf_url ? { directions_pdf_url: extras.directions_pdf_url } : {}),
      ...(extras?.google_maps_link ? { google_maps_link: extras.google_maps_link } : {}),
      ...(extras?.logo_url ? { logo_url: extras.logo_url } : {}),
      ...(extras?.certificate_text ? { certificate_text: extras.certificate_text } : {}),
      ...(extras?.organizer_name !== undefined ? { organizer_name: extras.organizer_name } : {}),
      ...(extras?.sponsor_name !== undefined ? { sponsor_name: extras.sponsor_name } : {}),
      ...(extras?.sponsor_signature_url !== undefined ? { sponsor_signature_url: extras.sponsor_signature_url } : {}),
      ...(extras?.sponsor_logo_url !== undefined ? { sponsor_logo_url: extras.sponsor_logo_url } : {}),
      ...(extras?.sponsor_consent !== undefined ? { sponsor_consent: extras.sponsor_consent } : {}),
      ...(extras?.certificate_bg_url !== undefined ? { certificate_bg_url: extras.certificate_bg_url } : {}),
      ...(extras?.certificate_font_family !== undefined ? { certificate_font_family: extras.certificate_font_family } : {}),
      ...(extras?.certificate_font_size !== undefined ? { certificate_font_size: extras.certificate_font_size } : {}),
    })
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
  best_of: number;
  phase: string | null;
  tournament_date: string | null;
  venue_street: string;
  venue_house_number: string;
  venue_postal_code: string;
  venue_city: string;
  motto: string;
  break_minutes: number;
  team_mode: string | null;
  early_finish_enabled: boolean;
  kaiser_duration_minutes: number;
  sport: string;
  tournament_end_date: string | null;
  directions_pdf_url: string | null;
  google_maps_link: string | null;
  certificate_text: string;
  organizer_name: string;
  sponsor_name: string;
  sponsor_signature_url: string | null;
  sponsor_logo_url: string | null;
  sponsor_consent: boolean;
  certificate_bg_url: string | null;
  certificate_font_family: string;
  certificate_font_size: number;
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
      voice_name_url: player.voiceNameUrl || null,
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
    voiceNameUrl: data.voice_name_url || null,
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
  if (updates.voiceNameUrl !== undefined) dbUpdates.voice_name_url = updates.voiceNameUrl;

  const { error } = await supabase
    .from('players')
    .update(dbUpdates)
    .eq('id', playerId);

  if (error) throw error;
}

export async function updatePlayersGroupNumbers(updates: Array<{ id: string; group_number: number | null }>): Promise<void> {
  await Promise.all(
    updates.map(({ id, group_number }) =>
      supabase.from('players').update({ group_number }).eq('id', id)
    )
  );
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
    group_number: m.groupNumber ?? null,
    home_team_id: m.homeTeamId || null,
    away_team_id: m.awayTeamId || null,
  }));

  const { data, error } = await supabase
    .from('matches')
    .insert(dbMatches)
    .select();

  if (error) throw error;

  return (data || []).map((m: any) => ({
    id: m.id,
    round: m.round,
    position: m.position,
    player1Id: m.player1_id,
    player2Id: m.player2_id,
    winnerId: m.winner_id,
    sets: (Array.isArray(m.sets) ? m.sets : []) as unknown as SetScore[],
    table: m.table_number || undefined,
    status: m.status as 'pending' | 'active' | 'completed',
    groupNumber: m.group_number,
    completedAt: m.completed_at || null,
    homeTeamId: m.home_team_id || null,
    awayTeamId: m.away_team_id || null,
  }));
}

export async function updateMatch(matchId: string, updates: Partial<{
  player1_id: string | null;
  player2_id: string | null;
  winner_id: string | null;
  sets: SetScore[];
  table_number: number | null;
  status: 'pending' | 'active' | 'completed';
  completed_at: string | null;
}>): Promise<void> {
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

export async function clearTournamentMatches(tournamentId: string): Promise<void> {
  const { error } = await supabase
    .from('matches')
    .delete()
    .eq('tournament_id', tournamentId);

  if (error) throw error;
}

export async function resetTournamentState(tournamentId: string): Promise<void> {
  await supabase.from('players').update({ group_number: null }).eq('tournament_id', tournamentId);

  const { error } = await supabase
    .from('tournaments')
    .update({ started: false, rounds: 0, phase: null })
    .eq('id', tournamentId);

  if (error) throw error;
}

// Team operations
export async function addTeam(tournamentId: string, name: string): Promise<Team> {
  const { data, error } = await supabase
    .from('teams')
    .insert({ tournament_id: tournamentId, name })
    .select()
    .single();

  if (error) throw error;
  return { id: data.id, tournamentId: data.tournament_id, name: data.name };
}

export async function removeTeam(teamId: string): Promise<void> {
  const { error } = await supabase.from('teams').delete().eq('id', teamId);
  if (error) throw error;
}

export async function addTeamPlayer(teamId: string, playerId: string, position: number): Promise<TeamPlayer> {
  const { data, error } = await supabase
    .from('team_players')
    .insert({ team_id: teamId, player_id: playerId, position })
    .select()
    .single();

  if (error) throw error;
  return { id: data.id, teamId: data.team_id, playerId: data.player_id, position: data.position };
}

export async function removeTeamPlayer(teamPlayerId: string): Promise<void> {
  const { error } = await supabase.from('team_players').delete().eq('id', teamPlayerId);
  if (error) throw error;
}

// Encounter game operations
export async function createEncounterGames(games: Array<{
  match_id: string;
  game_number: number;
  game_type: string;
  home_player1_id: string | null;
  home_player2_id: string | null;
  away_player1_id: string | null;
  away_player2_id: string | null;
}>): Promise<EncounterGame[]> {
  const { data, error } = await supabase
    .from('encounter_games')
    .insert(games)
    .select();

  if (error) throw error;
  return (data || []).map((g: any) => ({
    id: g.id,
    matchId: g.match_id,
    gameNumber: g.game_number,
    gameType: g.game_type as 'singles' | 'doubles',
    homePlayer1Id: g.home_player1_id,
    homePlayer2Id: g.home_player2_id,
    awayPlayer1Id: g.away_player1_id,
    awayPlayer2Id: g.away_player2_id,
    sets: (Array.isArray(g.sets) ? g.sets : []) as SetScore[],
    winnerSide: g.winner_side as 'home' | 'away' | null,
    status: g.status as 'pending' | 'active' | 'completed',
  }));
}

export async function updateEncounterGame(gameId: string, updates: Record<string, unknown>): Promise<void> {
  const { error } = await supabase
    .from('encounter_games')
    .update(updates)
    .eq('id', gameId);

  if (error) throw error;
}

export async function fetchEncounterGames(matchId: string): Promise<EncounterGame[]> {
  const { data, error } = await supabase
    .from('encounter_games')
    .select('*')
    .eq('match_id', matchId)
    .order('game_number', { ascending: true });

  if (error) throw error;
  return (data || []).map((g: any) => ({
    id: g.id,
    matchId: g.match_id,
    gameNumber: g.game_number,
    gameType: g.game_type as 'singles' | 'doubles',
    homePlayer1Id: g.home_player1_id,
    homePlayer2Id: g.home_player2_id,
    awayPlayer1Id: g.away_player1_id,
    awayPlayer2Id: g.away_player2_id,
    sets: (Array.isArray(g.sets) ? g.sets : []) as SetScore[],
    winnerSide: g.winner_side as 'home' | 'away' | null,
    status: g.status as 'pending' | 'active' | 'completed',
  }));
}
