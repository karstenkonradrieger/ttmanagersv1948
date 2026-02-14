import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Settings2 } from 'lucide-react';
import { TournamentMode, TournamentType } from '@/types/tournament';
import { toast } from 'sonner';

interface Props {
  mode: TournamentMode;
  type: TournamentType;
  bestOf: number;
  onUpdateMode: (mode: TournamentMode) => Promise<void>;
  onUpdateType: (type: TournamentType) => Promise<void>;
  onUpdateBestOf: (bestOf: number) => Promise<void>;
}

export function TournamentSettingsDialog({ mode, type, bestOf, onUpdateMode, onUpdateType, onUpdateBestOf }: Props) {
  const [open, setOpen] = useState(false);
  const [localMode, setLocalMode] = useState(mode);
  const [localType, setLocalType] = useState(type);
  const [localBestOf, setLocalBestOf] = useState(bestOf);
  const [saving, setSaving] = useState(false);

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      setLocalMode(mode);
      setLocalType(type);
      setLocalBestOf(bestOf);
    }
    setOpen(isOpen);
  };

  const hasChanges = localMode !== mode || localType !== type || localBestOf !== bestOf;

  const handleSave = async () => {
    setSaving(true);
    try {
      if (localMode !== mode) await onUpdateMode(localMode);
      if (localType !== type) await onUpdateType(localType);
      if (localBestOf !== bestOf) await onUpdateBestOf(localBestOf);
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Turnier-Einstellungen</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
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
