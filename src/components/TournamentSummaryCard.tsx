import { useState } from 'react';
import { Bot, Copy, Loader2, RefreshCw, Share2, Sparkles, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type { TournamentSummary } from '@/types/tournament';
import { generateTournamentSummary } from '@/services/tournamentSummary';

interface Props {
  tournamentId: string;
  tournamentName: string;
  completedMatchCount: number;
  summary: TournamentSummary | null;
  isStale: boolean;
  onGenerated: (summary: TournamentSummary) => void;
}

export function TournamentSummaryCard({ tournamentId, tournamentName, completedMatchCount, summary, isStale, onGenerated }: Props) {
  const [generating, setGenerating] = useState(false);

  const generate = async () => {
    setGenerating(true);
    try {
      const next = await generateTournamentSummary(tournamentId);
      onGenerated(next);
      toast.success('Turnierzusammenfassung erstellt');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Zusammenfassung konnte nicht erstellt werden');
    } finally {
      setGenerating(false);
    }
  };

  const share = async () => {
    if (!summary) return;
    const shareData = { title: tournamentName, text: summary.content, url: `${window.location.origin}/live/${tournamentId}` };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }
    await navigator.clipboard.writeText(`${summary.content}\n\n${shareData.url}`);
    toast.success('Zusammenfassung und Live-Link kopiert');
  };

  return (
    <section className="rounded-lg border border-border bg-card p-4 card-shadow" aria-labelledby="tournament-summary-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 id="tournament-summary-title" className="flex items-center gap-2 font-bold">
            <Bot className="h-5 w-5 text-primary" />
            Turnierzusammenfassung
          </h4>
          <p className="mt-1 text-xs text-muted-foreground">Kurzer Zuschauerbericht aus den gespeicherten Ergebnissen.</p>
        </div>
        <Button className="min-h-11" onClick={generate} disabled={generating || completedMatchCount === 0}>
          {generating ? <Loader2 className="animate-spin" /> : summary ? <RefreshCw /> : <Sparkles />}
          {summary ? 'Neu erstellen' : 'Mit Lovable AI erstellen'}
        </Button>
      </div>

      {summary && (
        <div className="mt-4 space-y-3 border-t border-border pt-4">
          {isStale && (
            <p className="flex items-start gap-2 text-xs font-medium text-status-waiting">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              Seit der Erstellung wurden Ergebnisse geändert. Bitte neu erstellen.
            </p>
          )}
          <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">{summary.content}</p>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <time className="text-xs text-muted-foreground" dateTime={summary.generatedAt}>
              Erstellt {new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(summary.generatedAt))}
            </time>
            <Button variant="outline" className="min-h-11" onClick={share}>
              {navigator.share ? <Share2 /> : <Copy />}
              {navigator.share ? 'Teilen' : 'Kopieren'}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
