import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Trash2, ChevronRight, Trophy, Calendar, Loader2 } from 'lucide-react';
import { fetchTournaments, createTournament, deleteTournament, DbTournament } from '@/services/tournamentService';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { CreateTournamentWizard } from '@/components/CreateTournamentWizard';
import { FadeIn, StaggerContainer, StaggerItem } from '@/components/ui/motion';

interface Props {
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function TournamentSelector({ selectedId, onSelect }: Props) {
  const { user } = useAuth();
  const [tournaments, setTournaments] = useState<DbTournament[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const data = await fetchTournaments();
      setTournaments(data);
    } catch (error) {
      console.error('Error loading tournaments:', error);
      toast.error('Fehler beim Laden der Turniere');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreated = async (id: string) => {
    await load();
    onSelect(id);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteTournament(id);
      if (selectedId === id) {
        onSelect('');
      }
      await load();
      toast.success('Turnier gelöscht');
    } catch (error) {
      console.error('Error deleting tournament:', error);
      toast.error('Fehler beim Löschen des Turniers');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <FadeIn className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold font-display">Turniere</h2>
        <CreateTournamentWizard
          onCreated={handleCreated}
          userId={user?.id}
          createTournament={createTournament}
        />
      </div>

      {tournaments.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Trophy className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="font-medium">Noch keine Turniere vorhanden</p>
          <p className="text-sm mt-1">Erstelle dein erstes Turnier!</p>
        </div>
      ) : (
        <StaggerContainer className="space-y-2">
          {tournaments.map(t => (
            <StaggerItem key={t.id}>
            <div
              onClick={() => onSelect(t.id)}
              className={`bg-card rounded-xl p-4 card-shadow interactive-card border border-transparent ${
                selectedId === t.id ? 'ring-2 ring-primary border-primary/20' : 'border-border/30 hover:border-border/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Trophy className="h-4 w-4 text-primary flex-shrink-0" />
                    <h3 className="font-semibold truncate font-display">{t.name}</h3>
                    {t.started && (
                      <span className="text-[10px] bg-primary/15 text-primary px-2 py-0.5 rounded-full font-medium">
                        Gestartet
                      </span>
                    )}
                    <span className="text-[10px] bg-secondary text-muted-foreground px-2 py-0.5 rounded-full">
                      {(t as any).mode === 'round_robin' ? 'Alle gg. Alle' : (t as any).mode === 'group_knockout' ? 'Gruppen+KO' : (t as any).mode === 'double_knockout' ? 'Doppel-KO' : (t as any).mode === 'swiss' ? 'Schweizer' : (t as any).mode === 'kaiser' ? 'Kaiser' : (t as any).mode === 'handicap' ? 'Vorgabe' : 'KO'}
                    </span>
                    <span className="text-[10px] bg-secondary text-muted-foreground px-2 py-0.5 rounded-full">
                      {(t as any).type === 'doubles' ? 'Doppel' : (t as any).type === 'team' ? 'Mannschaft' : 'Einzel'}
                    </span>
                    <span className="text-[10px] bg-secondary text-muted-foreground px-2 py-0.5 rounded-full">
                      Bo{((t as any).best_of || 3) * 2 - 1}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>
                      {formatDistanceToNow(new Date(t.created_at), { addSuffix: true, locale: de })}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={e => e.stopPropagation()}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Turnier löschen?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Das Turnier "{t.name}" und alle zugehörigen Daten werden unwiderruflich gelöscht.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={(e) => handleDelete(t.id, e)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Löschen
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <ChevronRight className="h-5 w-5 text-muted-foreground/50" />
                </div>
              </div>
            </div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      )}
    </FadeIn>
  );
}
