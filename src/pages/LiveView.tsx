import { useParams } from 'react-router-dom';
import { useTournamentDb } from '@/hooks/useTournamentDb';
import { LiveDashboard } from '@/components/LiveDashboard';
import { Loader2 } from 'lucide-react';

const LiveView = () => {
  const { id } = useParams<{ id: string }>();
  const { tournament, loading, getPlayer } = useTournamentDb(id || null);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-sport border-b border-border">
        <div className="container py-3 flex items-center gap-2">
          {tournament.logoUrl && (
            <img src={tournament.logoUrl} alt="Logo" className="h-10 w-10 rounded-md object-cover" />
          )}
          <h1 className="text-lg font-extrabold tracking-tight">
            {tournament.name || 'Turnier'}
          </h1>
          <span className="ml-auto text-xs text-muted-foreground">Live-Ansicht</span>
        </div>
      </header>
      <div className="container py-6">
        <LiveDashboard
          matches={tournament.matches}
          rounds={tournament.rounds}
          getPlayer={getPlayer}
        />
      </div>
    </div>
  );
};

export default LiveView;
