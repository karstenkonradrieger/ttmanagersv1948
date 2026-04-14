import { useParams } from 'react-router-dom';
import { useTournamentDb } from '@/hooks/useTournamentDb';
import { Loader2, Users } from 'lucide-react';
import { SponsorLogos } from '@/components/SponsorLogos';

const DoublesView = () => {
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
      <header className="glass border-b border-border/50">
        <div className="container py-3 flex items-center gap-2">
          {tournament.logoUrl && (
            <img src={tournament.logoUrl} alt="Logo" className="h-10 w-10 rounded-lg object-cover" />
          )}
          <h1 className="text-lg font-bold tracking-tight font-display">
            {tournament.name || 'Turnier'}
          </h1>
          <span className="ml-auto text-xs text-muted-foreground font-medium">Doppelpaare</span>
        </div>
      </header>

      <main className="container py-6">
        <div className="flex items-center gap-2 mb-6">
          <Users className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold">Doppelpaare ({tournament.doublesPairs.length})</h2>
        </div>

        {tournament.doublesPairs.length === 0 ? (
          <div className="text-center text-muted-foreground py-12">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-lg">Keine Doppelpaare vorhanden</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tournament.doublesPairs.map((pair, i) => {
              const p1 = getPlayer(pair.player1Id);
              const p2 = getPlayer(pair.player2Id);
              return (
                <div key={pair.id} className="bg-card rounded-lg p-4 card-shadow border border-border/50">
                  <div className="flex items-start gap-3">
                    <span className="text-sm font-mono text-muted-foreground mt-0.5">{i + 1}.</span>
                    <div className="space-y-1">
                      <p className="font-semibold text-sm">{p1?.name || '?'}</p>
                      {p1?.club && <p className="text-xs text-muted-foreground">{p1.club}</p>}
                      <div className="border-t border-border/50 my-1" />
                      <p className="font-semibold text-sm">{p2?.name || '?'}</p>
                      {p2?.club && <p className="text-xs text-muted-foreground">{p2.club}</p>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default DoublesView;
