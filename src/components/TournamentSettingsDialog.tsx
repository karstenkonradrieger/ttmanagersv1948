import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Settings2 } from 'lucide-react';
import { TournamentMode, TournamentType } from '@/types/tournament';
import { toast } from 'sonner';

interface Props {
  mode: TournamentMode;
  type: TournamentType;
  bestOf: number;
  tournamentDate: string | null;
  venueStreet: string;
  venueHouseNumber: string;
  venuePostalCode: string;
  venueCity: string;
  motto: string;
  onUpdateMode: (mode: TournamentMode) => Promise<void>;
  onUpdateType: (type: TournamentType) => Promise<void>;
  onUpdateBestOf: (bestOf: number) => Promise<void>;
  onUpdateDetails: (details: {
    tournament_date: string | null;
    venue_street: string;
    venue_house_number: string;
    venue_postal_code: string;
    venue_city: string;
    motto: string;
  }) => Promise<void>;
}

export function TournamentSettingsDialog({
  mode, type, bestOf,
  tournamentDate, venueStreet, venueHouseNumber, venuePostalCode, venueCity, motto,
  onUpdateMode, onUpdateType, onUpdateBestOf, onUpdateDetails,
}: Props) {
  const [open, setOpen] = useState(false);
  const [localMode, setLocalMode] = useState(mode);
  const [localType, setLocalType] = useState(type);
  const [localBestOf, setLocalBestOf] = useState(bestOf);
  const [localDate, setLocalDate] = useState(tournamentDate || '');
  const [localStreet, setLocalStreet] = useState(venueStreet);
  const [localHouseNumber, setLocalHouseNumber] = useState(venueHouseNumber);
  const [localPostalCode, setLocalPostalCode] = useState(venuePostalCode);
  const [localCity, setLocalCity] = useState(venueCity);
  const [localMotto, setLocalMotto] = useState(motto);
  const [saving, setSaving] = useState(false);

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      setLocalMode(mode);
      setLocalType(type);
      setLocalBestOf(bestOf);
      setLocalDate(tournamentDate || '');
      setLocalStreet(venueStreet);
      setLocalHouseNumber(venueHouseNumber);
      setLocalPostalCode(venuePostalCode);
      setLocalCity(venueCity);
      setLocalMotto(motto);
    }
    setOpen(isOpen);
  };

  const hasChanges =
    localMode !== mode || localType !== type || localBestOf !== bestOf ||
    (localDate || null) !== (tournamentDate || null) ||
    localStreet !== venueStreet || localHouseNumber !== venueHouseNumber ||
    localPostalCode !== venuePostalCode || localCity !== venueCity ||
    localMotto !== motto;

  const handleSave = async () => {
    setSaving(true);
    try {
      if (localMode !== mode) await onUpdateMode(localMode);
      if (localType !== type) await onUpdateType(localType);
      if (localBestOf !== bestOf) await onUpdateBestOf(localBestOf);

      const detailsChanged =
        (localDate || null) !== (tournamentDate || null) ||
        localStreet !== venueStreet || localHouseNumber !== venueHouseNumber ||
        localPostalCode !== venuePostalCode || localCity !== venueCity ||
        localMotto !== motto;

      if (detailsChanged) {
        await onUpdateDetails({
          tournament_date: localDate || null,
          venue_street: localStreet,
          venue_house_number: localHouseNumber,
          venue_postal_code: localPostalCode,
          venue_city: localCity,
          motto: localMotto,
        });
      }

      toast.success('Einstellungen gespeichert');
      setOpen(false);
    } catch {
      toast.error('Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
          <Settings2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Turnier-Einstellungen</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {/* Tournament date */}
          <div>
            <Label className="text-sm font-semibold mb-1 block">Turniertag</Label>
            <Input
              type="date"
              value={localDate}
              onChange={e => setLocalDate(e.target.value)}
            />
          </div>

          {/* Motto */}
          <div>
            <Label className="text-sm font-semibold mb-1 block">Turniermotto</Label>
            <Input
              placeholder="z.B. Sommerfest-Turnier"
              value={localMotto}
              onChange={e => setLocalMotto(e.target.value)}
            />
          </div>

          {/* Venue */}
          <div>
            <Label className="text-sm font-semibold mb-1 block">Veranstaltungsort</Label>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <Input placeholder="Straße" value={localStreet} onChange={e => setLocalStreet(e.target.value)} />
              </div>
              <Input placeholder="Hausnr." value={localHouseNumber} onChange={e => setLocalHouseNumber(e.target.value)} />
            </div>
            <div className="grid grid-cols-3 gap-2 mt-2">
              <Input placeholder="PLZ" value={localPostalCode} onChange={e => setLocalPostalCode(e.target.value)} />
              <div className="col-span-2">
                <Input placeholder="Ort" value={localCity} onChange={e => setLocalCity(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Mode */}
          <div>
            <Label className="text-sm font-semibold mb-2 block">Turniermodus</Label>
            <RadioGroup value={localMode} onValueChange={(v) => setLocalMode(v as TournamentMode)} className="flex gap-4">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="knockout" id="edit-mode-ko" />
                <Label htmlFor="edit-mode-ko" className="text-sm cursor-pointer">KO-System</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="round_robin" id="edit-mode-rr" />
                <Label htmlFor="edit-mode-rr" className="text-sm cursor-pointer">Alle gegen Alle</Label>
              </div>
            </RadioGroup>
          </div>
          <div>
            <Label className="text-sm font-semibold mb-2 block">Turniertyp</Label>
            <RadioGroup value={localType} onValueChange={(v) => setLocalType(v as TournamentType)} className="flex gap-4">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="singles" id="edit-type-singles" />
                <Label htmlFor="edit-type-singles" className="text-sm cursor-pointer">Einzel</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="doubles" id="edit-type-doubles" />
                <Label htmlFor="edit-type-doubles" className="text-sm cursor-pointer">Doppel</Label>
              </div>
            </RadioGroup>
          </div>
          <div>
            <Label className="text-sm font-semibold mb-2 block">Gewinnsätze</Label>
            <RadioGroup value={String(localBestOf)} onValueChange={(v) => setLocalBestOf(parseInt(v))} className="flex gap-4">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="2" id="edit-bestof-2" />
                <Label htmlFor="edit-bestof-2" className="text-sm cursor-pointer">2 Gewinnsätze (Best of 3)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="3" id="edit-bestof-3" />
                <Label htmlFor="edit-bestof-3" className="text-sm cursor-pointer">3 Gewinnsätze (Best of 5)</Label>
              </div>
            </RadioGroup>
          </div>
          <Button onClick={handleSave} disabled={!hasChanges || saving} className="w-full">
            {saving ? 'Speichern...' : 'Speichern'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
