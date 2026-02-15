import { useState } from 'react';
import { Club } from '@/hooks/useClubs';
import { ClubPlayer } from '@/hooks/useClubPlayers';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Building2, UserPlus, Users } from 'lucide-react';

interface Props {
  clubs: Club[];
  clubPlayers: ClubPlayer[];
  getPlayersForClub: (clubId: string) => ClubPlayer[];
  onImportPlayers: (players: Array<{ name: string; club: string; ttr: number; gender: string; birthDate: string | null; postalCode: string; city: string; street: string; houseNumber: string; phone: string }>) => void;
  existingPlayerNames: string[];
}

export function ImportFromClubPlayers({ clubs, clubPlayers, getPlayersForClub, onImportPlayers, existingPlayerNames }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const togglePlayer = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleClub = (clubId: string) => {
    const players = getPlayersForClub(clubId);
    const allSelected = players.every(p => selected.has(p.id));
    setSelected(prev => {
      const next = new Set(prev);
      players.forEach(p => allSelected ? next.delete(p.id) : next.add(p.id));
      return next;
    });
  };

  const handleImport = () => {
    const toImport = clubPlayers
      .filter(p => selected.has(p.id))
      .map(p => ({
        name: p.name,
        club: p.clubName || '',
        ttr: p.ttr,
        gender: p.gender,
        birthDate: p.birthDate,
        postalCode: p.postalCode,
        city: p.city,
        street: p.street,
        houseNumber: p.houseNumber,
        phone: p.phone,
      }));
    onImportPlayers(toImport);
    setSelected(new Set());
    setOpen(false);
  };

  const existingNamesLower = new Set(existingPlayerNames.map(n => n.toLowerCase()));

  if (clubPlayers.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
          <Users className="h-3.5 w-3.5" />
          Aus Vereinen importieren
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Spieler aus Vereinen importieren</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-3 pr-3">
            {clubs.map(club => {
              const players = getPlayersForClub(club.id);
              if (players.length === 0) return null;
              const allSelected = players.every(p => selected.has(p.id));
              const someSelected = players.some(p => selected.has(p.id));

              return (
                <div key={club.id} className="space-y-1">
                  <div
                    className="flex items-center gap-2 cursor-pointer hover:opacity-80"
                    onClick={() => toggleClub(club.id)}
                  >
                    <Checkbox
                      checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                      onCheckedChange={() => toggleClub(club.id)}
                    />
                    <Building2 className="h-3.5 w-3.5 text-primary" />
                    <span className="text-sm font-semibold">{club.name}</span>
                    <span className="text-xs text-muted-foreground">({players.length})</span>
                  </div>
                  <div className="ml-6 space-y-0.5">
                    {players.map(p => {
                      const alreadyExists = existingNamesLower.has(p.name.toLowerCase());
                      return (
                        <div
                          key={p.id}
                          className={`flex items-center gap-2 py-0.5 ${alreadyExists ? 'opacity-50' : 'cursor-pointer hover:opacity-80'}`}
                          onClick={() => !alreadyExists && togglePlayer(p.id)}
                        >
                          <Checkbox
                            checked={selected.has(p.id)}
                            onCheckedChange={() => togglePlayer(p.id)}
                            disabled={alreadyExists}
                          />
                          <span className="text-sm">{p.name}</span>
                          {p.ttr > 0 && <span className="text-xs text-muted-foreground">TTR {p.ttr}</span>}
                          {alreadyExists && <span className="text-xs text-muted-foreground italic">(bereits im Turnier)</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
        <div className="flex justify-between items-center pt-2">
          <span className="text-sm text-muted-foreground">{selected.size} ausgewählt</span>
          <Button onClick={handleImport} disabled={selected.size === 0} className="gap-1.5">
            <UserPlus className="h-4 w-4" />
            {selected.size} Spieler importieren
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
