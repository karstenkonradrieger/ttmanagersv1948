import { supabase } from '@/integrations/supabase/client';
import type { Match, TournamentSummary } from '@/types/tournament';

export function createResultSignature(matches: Match[]): string {
  return matches
    .filter(match => match.status === 'completed' && match.winnerId)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(match => `${match.id}:${JSON.stringify(match.sets)}:${match.winnerId}:${match.completedAt ?? ''}`)
    .join('|');
}

export function isTournamentSummaryStale(summary: TournamentSummary | null, matches: Match[]): boolean {
  return Boolean(summary && summary.sourceSignature !== createResultSignature(matches));
}

export async function generateTournamentSummary(tournamentId: string): Promise<TournamentSummary> {
  const { data, error } = await supabase.functions.invoke('generate-tournament-summary', {
    body: { tournamentId },
  });
  if (error) {
    let message = error.message;
    const context = 'context' in error ? error.context : undefined;
    if (context instanceof Response) {
      const payload = await context.clone().json().catch(() => null) as { message?: string } | null;
      message = payload?.message || message;
    }
    throw new Error(message);
  }
  if (!data?.content || !data?.generatedAt || !data?.sourceSignature) {
    throw new Error('Die AI-Antwort war unvollständig.');
  }
  return {
    content: data.content,
    generatedAt: data.generatedAt,
    sourceSignature: data.sourceSignature,
  };
}
