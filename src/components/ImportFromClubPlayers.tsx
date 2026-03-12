import { useState, useMemo } from 'react';
import { Club } from '@/hooks/useClubs';
import { ClubPlayer } from '@/hooks/useClubPlayers';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, UserPlus, Users, Filter, AlertTriangle, Camera, FileCheck } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ImportPlayerData {
  name: string;
  club: string;
  ttr: number;
  gender: string;
  birthDate: string | null;
  postalCode: string;
  city: string;
  street: string;
  houseNumber: string;
  phone: string;
  voiceNameUrl?: string | null;
  photoConsent?: boolean;
}

interface Props {
  clubs: Club[];
  clubPlayers: ClubPlayer[];
  getPlayersForClub: (clubId: string) => ClubPlayer[];
  onImportPlayers: (players: ImportPlayerData[]) => void;
  existingPlayerNames: string[];
}

export function ImportFromClubPlayers({ clubs, clubPlayers, getPlayersForClub, onImportPlayers, existingPlayerNames }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [genderFilter, setGenderFilter] = useState<string>('all');
  const [ttrMin, setTtrMin] = useState<string>('');
  const [ttrMax, setTtrMax] = useState<string>('');
  const [showConsentDialog, setShowConsentDialog] = useState(false);
  const [pendingImport, setPendingImport] = useState<ImportPlayerData[]>([]);
  const [consentOverrides, setConsentOverrides] = useState<Record<string, boolean>>({});

  const filteredForClub = useMemo(() => {
    return (clubId: string) => {
      let players = getPlayersForClub(clubId);
      if (genderFilter !== 'all') {
        players = players.filter(p => p.gender === genderFilter);
      }
      const min = ttrMin ? parseInt(ttrMin) : null;
      const max = ttrMax ? parseInt(ttrMax) : null;
      if (min !== null && !isNaN(min)) players = players.filter(p => p.ttr >= min);
      if (max !== null && !isNaN(max)) players = players.filter(p => p.ttr <= max);
      return players;
    };
  }, [getPlayersForClub, genderFilter, ttrMin, ttrMax]);

  const togglePlayer = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleClub = (clubId: string) => {
    const players = filteredForClub(clubId);
    const allSelected = players.every(p => selected.has(p.id));
    setSelected(prev => {
      const next = new Set(prev);
      players.forEach(p => allSelected ? next.delete(p.id) : next.add(p.id));
      return next;
    });
  };

  const handleImport = () => {
    const selectedPlayers = clubPlayers.filter(p => selected.has(p.id));
    const playersWithConsent = selectedPlayers.filter(p => p.photoConsent);

    const toImport = selectedPlayers.map(p => ({
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
      voiceNameUrl: p.voiceNameUrl || null,
      photoConsent: false, // default, will be overridden if confirmed
    }));

    if (playersWithConsent.length > 0) {
      // Initialize all consent players as confirmed by default
      const overrides: Record<string, boolean> = {};
      playersWithConsent.forEach(p => { overrides[p.name] = true; });
      setConsentOverrides(overrides);
      setPendingImport(toImport);
      setShowConsentDialog(true);
    } else {
      onImportPlayers(toImport);
      setSelected(new Set());
      setOpen(false);
    }
  };

  const confirmConsentImport = () => {
    const finalImport = pendingImport.map(p => ({
      ...p,
      photoConsent: consentOverrides[p.name] ?? false,
    }));
    onImportPlayers(finalImport);
    setSelected(new Set());
    setPendingImport([]);
    setConsentOverrides({});
    setShowConsentDialog(false);
    setOpen(false);
  };

  const cancelConsentImport = () => {
    // Import without any photo consent
    onImportPlayers(pendingImport);
    setSelected(new Set());
    setPendingImport([]);
    setConsentOverrides({});
    setShowConsentDialog(false);
    setOpen(false);
  };

  const existingNamesLower = new Set(existingPlayerNames.map(n => n.toLowerCase()));
  const playersWithConsentInSelection = clubPlayers.filter(p => selected.has(p.id) && p.photoConsent);

  if (clubPlayers.length === 0) return null;

  return (
    <>
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
          <div className="flex items-center gap-2 pb-2">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <Select value={genderFilter} onValueChange={setGenderFilter}>
              <SelectTrigger className="h-8 w-28 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                <SelectItem value="m">Männlich</SelectItem>
                <SelectItem value="w">Weiblich</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="number"
              placeholder="TTR min"
              value={ttrMin}
              onChange={e => setTtrMin(e.target.value)}
              className="h-8 w-20 text-xs"
            />
            <span className="text-xs text-muted-foreground">–</span>
            <Input
              type="number"
              placeholder="TTR max"
              value={ttrMax}
              onChange={e => setTtrMax(e.target.value)}
              className="h-8 w-20 text-xs"
            />
          </div>
          <ScrollArea className="max-h-[50vh]">
            <div className="space-y-3 pr-3">
              {clubs.map(club => {
                const players = filteredForClub(club.id);
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
                            {p.photoConsent && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <FileCheck className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="text-xs">
                                    Fotoerlaubnis im Verein erteilt
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                            {!p.photoConsent && !alreadyExists && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="text-xs">
                                    Fotoerlaubnis nicht erteilt
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
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

      <AlertDialog open={showConsentDialog} onOpenChange={setShowConsentDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-primary" />
              Fotoerlaubnis für dieses Turnier
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Folgende Spieler haben in der Vereinsverwaltung eine Fotoerlaubnis erteilt. 
                  Bitte bestätige, ob diese auch für dieses Turnier gelten soll:
                </p>
                <ScrollArea className="max-h-[30vh]">
                  <div className="space-y-2 pr-3">
                    {playersWithConsentInSelection.map(p => (
                      <div key={p.id} className="flex items-center gap-2 py-1">
                        <Checkbox
                          id={`consent-confirm-${p.id}`}
                          checked={consentOverrides[p.name] ?? false}
                          onCheckedChange={(v) => setConsentOverrides(prev => ({ ...prev, [p.name]: v === true }))}
                        />
                        <label htmlFor={`consent-confirm-${p.id}`} className="text-sm cursor-pointer flex-1">
                          {p.name}
                          {p.clubName && <span className="text-muted-foreground ml-1">({p.clubName})</span>}
                        </label>
                        {p.photoConsentUrl && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <a href={p.photoConsentUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                                  <FileCheck className="h-4 w-4 text-green-500" />
                                </a>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs">Scan der Fotoerlaubnis anzeigen</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelConsentImport}>Ohne Fotoerlaubnis importieren</AlertDialogCancel>
            <AlertDialogAction onClick={confirmConsentImport}>
              Bestätigen & importieren
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
