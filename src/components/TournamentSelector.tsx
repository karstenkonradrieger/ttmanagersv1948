import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Plus, Trash2, ChevronRight, Trophy, Calendar, Loader2 } from 'lucide-react';
import { fetchTournaments, createTournament, deleteTournament, DbTournament } from '@/services/tournamentService';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';

interface Props {
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function TournamentSelector({ selectedId, onSelect }: Props) {
  const { user } = useAuth();
  const [tournaments, setTournaments] = useState<DbTournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

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

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const id = await createTournament(newName.trim(), user?.id);
      setNewName('');
      setDialogOpen(false);
      await load();
      onSelect(id);
      toast.success('Turnier erstellt');
    } catch (error) {
      console.error('Error creating tournament:', error);
      toast.error('Fehler beim Erstellen des Turniers');
    } finally {
      setCreating(false);
    }
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
    <div className="space-y-4 animate-slide-up">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Turniere</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="glow-green">
              <Plus className="mr-2 h-4 w-4" />
              Neues Turnier
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Neues Turnier erstellen</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <Input
                placeholder="Turniername..."
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
              />
              <Button 
                onClick={handleCreate} 
                disabled={!newName.trim() || creating}
                className="w-full"
              >
                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Erstellen
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {tournaments.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Noch keine Turniere vorhanden</p>
          <p className="text-sm">Erstelle dein erstes Turnier!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tournaments.map(t => (
            <div
              key={t.id}
              onClick={() => onSelect(t.id)}
              className={`bg-card rounded-lg p-4 card-shadow cursor-pointer transition-all hover:scale-[1.01] ${
                selectedId === t.id ? 'ring-2 ring-primary' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-primary flex-shrink-0" />
                    <h3 className="font-semibold truncate">{t.name}</h3>
                    {t.started && (
                      <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                        Gestartet
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>
                      {formatDistanceToNow(new Date(t.created_at), { addSuffix: true, locale: de })}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
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
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
