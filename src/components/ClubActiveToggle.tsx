import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Power, PowerOff } from 'lucide-react';

interface Props {
  clubName: string;
  isActive: boolean;
  onConfirm: () => void;
}

export function ClubActiveToggle({ clubName, isActive, onConfirm }: Props) {
  const activating = !isActive;

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        {activating ? (
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => e.stopPropagation()}
            className="h-7 px-2 text-xs gap-1 border-primary/40 text-primary hover:bg-primary/10 hover:text-primary"
            title="Verein wieder aktivieren"
          >
            <Power className="h-3.5 w-3.5" />
            Aktivieren
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => e.stopPropagation()}
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            title="Verein deaktivieren (Daten erhalten)"
          >
            <PowerOff className="h-3.5 w-3.5" />
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent onClick={(e) => e.stopPropagation()}>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {activating ? 'Verein wieder aktivieren?' : 'Verein deaktivieren?'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {activating ? (
              <>
                Möchtest du <strong>{clubName}</strong> wieder aktivieren? Der Verein und seine Spieler stehen anschließend
                wieder in allen Auswahllisten und Turnieren zur Verfügung.
              </>
            ) : (
              <>
                Möchtest du <strong>{clubName}</strong> deaktivieren? Alle Daten bleiben erhalten, der Verein wird jedoch
                in Auswahllisten ausgeblendet und kann jederzeit wieder aktiviert werden.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            {activating ? 'Ja, aktivieren' : 'Ja, deaktivieren'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
