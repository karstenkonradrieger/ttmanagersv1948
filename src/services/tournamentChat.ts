import type { UIMessage } from 'ai';
import { supabase } from '@/integrations/supabase/client';

export interface TournamentChatMessage {
  id: string;
  tournamentId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

const toUiMessage = (message: TournamentChatMessage): UIMessage => ({
  id: message.id,
  role: message.role,
  parts: [{ type: 'text', text: message.content }],
});

export async function fetchTournamentChat(tournamentId: string): Promise<UIMessage[]> {
  const { data, error } = await supabase
    .from('tournament_chat_messages')
    .select('id,tournament_id,role,content,created_at')
    .eq('tournament_id', tournamentId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => toUiMessage({
    id: row.id,
    tournamentId: row.tournament_id,
    role: row.role === 'assistant' ? 'assistant' : 'user',
    content: row.content,
    createdAt: row.created_at,
  }));
}

export async function deleteTournamentChat(tournamentId: string): Promise<void> {
  const { error } = await supabase.from('tournament_chat_messages').delete().eq('tournament_id', tournamentId);
  if (error) throw error;
}
