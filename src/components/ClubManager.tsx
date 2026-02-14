import { useState } from 'react';
import { Club } from '@/hooks/useClubs';
import { Player } from '@/types/tournament';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Building2, Plus, Trash2, ChevronDown, ChevronRight, User, Trophy, Phone } from 'lucide-react';

interface Props {
  clubs: Club[];
  players?: Player[];
  onAdd: (name: string) => Promise<Club | null>;
  onRemove: (id: string) => void;
}

export function ClubManager({ clubs, players = [], onAdd, onRemove }: Props) {
  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);
  const [openClubs, setOpenClubs] = useState<Set<string>>(new Set());

  const handleAdd = async () => {
    if (!name.trim()) return;
    setAdding(true);
    await onAdd(name.trim());
    setName('');
    setAdding(false);
  };

  const toggleClub = (clubId: string) => {
    setOpenClubs(prev => {
      const next = new Set(prev);
      if (next.has(clubId)) {
        next.delete(clubId);
      } else {
        next.add(clubId);
      }
      return next;
    });
  };

  const getPlayersForClub = (clubName: string) => {
    return players.filter(p => p.club === clubName);
  };

  return (
    <div className="space-y-4 animate-slide-up">
      <div className="flex gap-2">
        <Input
          placeholder="Neuen Verein hinzufügen..."
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          className="h-10 text-base bg-secondary border-border"
        />
        <Button
          onClick={handleAdd}
          disabled={!name.trim() || adding}
          size="sm"
          className="h-10 px-3"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-1">
        {clubs.length === 0 && (
          <p className="text-center text-muted-foreground py-4 text-sm">
            Noch keine Vereine hinzugefügt
          </p>
        )}
        {clubs.map(club => {
          const clubPlayers = getPlayersForClub(club.name);
          const isOpen = openClubs.has(club.id);

          return (
            <Collapsible
              key={club.id}
              open={isOpen}
              onOpenChange={() => toggleClub(club.id)}
            >
              <div className="bg-secondary rounded-lg">
                <div className="flex items-center justify-between px-3 py-2">
                  <CollapsibleTrigger asChild>
                    <button className="flex items-center gap-2 flex-1 text-left hover:opacity-80 transition-opacity">
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      )}
                      <Building2 className="h-4 w-4 text-primary flex-shrink-0" />
                      <span className="text-sm font-medium">{club.name}</span>
                      <span className="text-xs text-muted-foreground ml-1">
                        ({clubPlayers.length} {clubPlayers.length === 1 ? 'Spieler' : 'Spieler'})
                      </span>
                    </button>
                  </CollapsibleTrigger>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemove(club.id)}
                    className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <CollapsibleContent>
                  <div className="px-3 pb-3 pt-1 border-t border-border/50 mx-2">
                    {clubPlayers.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2 text-center">
                        Keine Spieler zugeordnet
                      </p>
                    ) : (
                      <div className="space-y-1.5 mt-2">
                        {clubPlayers.map(player => (
                          <div
                            key={player.id}
                            className="flex items-start gap-2 bg-background/60 rounded-md px-2.5 py-2"
                          >
                            <User className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium leading-tight">
                                {player.name}
                                {player.gender && (
                                  <span className="ml-1 text-xs text-muted-foreground">
                                    ({player.gender === 'm' ? '♂' : player.gender === 'w' ? '♀' : '⚧'})
                                  </span>
                                )}
                              </p>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
                                {player.birthDate && (
                                  <span>{new Date(player.birthDate).toLocaleDateString('de-DE')}</span>
                                )}
                                <span className="flex items-center gap-0.5">
                                  <Trophy className="h-3 w-3" /> {player.ttr}
                                </span>
                                {player.phone && (
                                  <span className="flex items-center gap-0.5">
                                    <Phone className="h-3 w-3" /> {player.phone}
                                  </span>
                                )}
                              </div>
                              {(player.street || player.city) && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {player.street && `${player.street} ${player.houseNumber}`.trim()}
                                  {player.street && player.city ? ', ' : ''}
                                  {player.postalCode && `${player.postalCode} `}{player.city}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}
