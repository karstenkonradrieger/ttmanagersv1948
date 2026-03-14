import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Settings2, Upload, X, Loader2, PenTool, ImagePlus } from 'lucide-react';
import { TournamentMode, TournamentType, TeamMode } from '@/types/tournament';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  mode: TournamentMode;
  type: TournamentType;
  bestOf: number;
  started?: boolean;
  tournamentDate: string | null;
  venueStreet: string;
  venueHouseNumber: string;
  venuePostalCode: string;
  venueCity: string;
  motto: string;
  breakMinutes: number;
  certificateText: string;
  certificateBgUrl: string | null;
  certificateFontFamily: string;
  certificateFontSize: number;
  organizerName: string;
  sponsorName: string;
  sponsorSignatureUrl: string | null;
  sponsorLogoUrl: string | null;
  sponsorConsent: boolean;
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
    break_minutes: number;
    certificate_text: string;
    organizer_name: string;
    sponsor_name: string;
    sponsor_signature_url: string | null;
    sponsor_logo_url: string | null;
    sponsor_consent: boolean;
    certificate_bg_url?: string | null;
  }) => Promise<void>;
}

export function TournamentSettingsDialog({
  mode, type, bestOf, started = false,
  tournamentDate, venueStreet, venueHouseNumber, venuePostalCode, venueCity, motto, breakMinutes,
  certificateText, certificateBgUrl, organizerName, sponsorName, sponsorSignatureUrl, sponsorLogoUrl, sponsorConsent,
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
  const [localBreakMinutes, setLocalBreakMinutes] = useState(breakMinutes);
  const [localCertText, setLocalCertText] = useState(certificateText);
  const [localOrganizerName, setLocalOrganizerName] = useState(organizerName);
  const [localSponsorName, setLocalSponsorName] = useState(sponsorName);
  const [localSponsorSigUrl, setLocalSponsorSigUrl] = useState(sponsorSignatureUrl);
  const [localSponsorLogoUrl, setLocalSponsorLogoUrl] = useState(sponsorLogoUrl);
  const [localSponsorConsent, setLocalSponsorConsent] = useState(sponsorConsent);
  const [localCertBgUrl, setLocalCertBgUrl] = useState(certificateBgUrl);
  const [uploadingSig, setUploadingSig] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCertBg, setUploadingCertBg] = useState(false);
  const [saving, setSaving] = useState(false);
  const sigInputRef = useRef<HTMLInputElement>(null);
  const sponsorLogoInputRef = useRef<HTMLInputElement>(null);
  const certBgInputRef = useRef<HTMLInputElement>(null);

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
      setLocalBreakMinutes(breakMinutes);
      setLocalCertText(certificateText);
      setLocalOrganizerName(organizerName);
      setLocalSponsorName(sponsorName);
      setLocalSponsorSigUrl(sponsorSignatureUrl);
      setLocalSponsorLogoUrl(sponsorLogoUrl);
      setLocalSponsorConsent(sponsorConsent);
      setLocalCertBgUrl(certificateBgUrl);
    }
    setOpen(isOpen);
  };

  const handleSigUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    setUploadingSig(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `sig-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('signatures').upload(fileName, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('signatures').getPublicUrl(fileName);
      setLocalSponsorSigUrl(urlData.publicUrl);
      toast.success('Unterschrift hochgeladen');
    } catch {
      toast.error('Fehler beim Hochladen');
    } finally {
      setUploadingSig(false);
      if (sigInputRef.current) sigInputRef.current.value = '';
    }
  };

  const removeSig = async () => {
    if (localSponsorSigUrl) {
      const parts = localSponsorSigUrl.split('/');
      const fileName = parts[parts.length - 1];
      await supabase.storage.from('signatures').remove([fileName]);
    }
    setLocalSponsorSigUrl(null);
  };

  const handleSponsorLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `sponsor-logo-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('logos').upload(fileName, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('logos').getPublicUrl(fileName);
      setLocalSponsorLogoUrl(urlData.publicUrl);
      toast.success('Sponsor-Logo hochgeladen');
    } catch {
      toast.error('Fehler beim Hochladen');
    } finally {
      setUploadingLogo(false);
      if (sponsorLogoInputRef.current) sponsorLogoInputRef.current.value = '';
    }
  };

  const removeSponsorLogo = async () => {
    if (localSponsorLogoUrl) {
      const parts = localSponsorLogoUrl.split('/');
      const fileName = parts[parts.length - 1];
      await supabase.storage.from('logos').remove([fileName]);
    }
    setLocalSponsorLogoUrl(null);
  };

  const handleCertBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    setUploadingCertBg(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `cert-bg-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('logos').upload(fileName, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('logos').getPublicUrl(fileName);
      setLocalCertBgUrl(urlData.publicUrl);
      toast.success('Hintergrundbild hochgeladen');
    } catch {
      toast.error('Fehler beim Hochladen');
    } finally {
      setUploadingCertBg(false);
      if (certBgInputRef.current) certBgInputRef.current.value = '';
    }
  };

  const removeCertBg = async () => {
    if (localCertBgUrl) {
      const parts = localCertBgUrl.split('/');
      const fileName = parts[parts.length - 1];
      await supabase.storage.from('logos').remove([fileName]);
    }
    setLocalCertBgUrl(null);
  };

  const hasChanges =
    localMode !== mode || localType !== type || localBestOf !== bestOf ||
    (localDate || null) !== (tournamentDate || null) ||
    localStreet !== venueStreet || localHouseNumber !== venueHouseNumber ||
    localPostalCode !== venuePostalCode || localCity !== venueCity ||
    localMotto !== motto || localBreakMinutes !== breakMinutes ||
    localCertText !== certificateText || localOrganizerName !== organizerName ||
    localSponsorName !== sponsorName || localSponsorSigUrl !== sponsorSignatureUrl ||
    localSponsorLogoUrl !== sponsorLogoUrl || localSponsorConsent !== sponsorConsent ||
    localCertBgUrl !== certificateBgUrl;

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
        localMotto !== motto || localBreakMinutes !== breakMinutes ||
        localCertText !== certificateText || localOrganizerName !== organizerName ||
        localSponsorName !== sponsorName || localSponsorSigUrl !== sponsorSignatureUrl ||
        localSponsorLogoUrl !== sponsorLogoUrl || localSponsorConsent !== sponsorConsent ||
        localCertBgUrl !== certificateBgUrl;

      if (detailsChanged) {
        await onUpdateDetails({
          tournament_date: localDate || null,
          venue_street: localStreet,
          venue_house_number: localHouseNumber,
          venue_postal_code: localPostalCode,
          venue_city: localCity,
          motto: localMotto,
          break_minutes: localBreakMinutes,
          certificate_text: localCertText,
          organizer_name: localOrganizerName,
          sponsor_name: localSponsorName,
          sponsor_signature_url: localSponsorSigUrl,
          sponsor_logo_url: localSponsorLogoUrl,
          sponsor_consent: localSponsorConsent,
          certificate_bg_url: localCertBgUrl,
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

          {/* Break time */}
          <div>
            <Label className="text-sm font-semibold mb-2 block">Pausenzeit zwischen Spielen</Label>
            <RadioGroup value={String(localBreakMinutes)} onValueChange={(v) => setLocalBreakMinutes(parseInt(v))} className="flex gap-4">
              {[0, 3, 5, 10].map(min => (
                <div key={min} className="flex items-center space-x-2">
                  <RadioGroupItem value={String(min)} id={`break-${min}`} />
                  <Label htmlFor={`break-${min}`} className="text-sm cursor-pointer">{min === 0 ? 'Keine' : `${min} Min.`}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Certificate Text */}
          <div>
            <Label className="text-sm font-semibold mb-1 block">Text für Siegerurkunden</Label>
            <Textarea
              value={localCertText}
              onChange={e => setLocalCertText(e.target.value)}
              rows={3}
              className="text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Platzhalter: <code className="bg-muted px-1 rounded">{'{turniername}'}</code> <code className="bg-muted px-1 rounded">{'{spieler}'}</code> <code className="bg-muted px-1 rounded">{'{verein}'}</code> <code className="bg-muted px-1 rounded">{'{platz}'}</code>
            </p>
          </div>

          {/* Certificate Background */}
          <div>
            <Label className="text-sm font-semibold mb-1 block">
              <ImagePlus className="inline h-4 w-4 mr-1" />
              Hintergrundbild / Rahmen für Urkunden
            </Label>

            {/* Predefined frames */}
            <div className="grid grid-cols-5 gap-2 mb-2">
              {[
                { label: 'Keiner', url: null },
                { label: 'Klassisch Gold', url: '/certificate-frames/frame-classic-gold.png' },
                { label: 'Sport Rot', url: '/certificate-frames/frame-sport-red.png' },
                { label: 'Natur Grün', url: '/certificate-frames/frame-nature-green.png' },
                { label: 'Modern Blau', url: '/certificate-frames/frame-modern-blue.png' },
              ].map((frame) => {
                const isSelected = frame.url === null
                  ? !localCertBgUrl || localCertBgUrl === ''
                  : localCertBgUrl === frame.url;
                return (
                  <button
                    key={frame.label}
                    type="button"
                    className={`flex flex-col items-center gap-1 rounded-md border-2 p-1 transition-colors ${
                      isSelected ? 'border-primary bg-primary/10' : 'border-border hover:border-muted-foreground'
                    }`}
                    onClick={() => setLocalCertBgUrl(frame.url)}
                  >
                    {frame.url ? (
                      <img src={frame.url} alt={frame.label} className="h-14 w-10 object-cover rounded" />
                    ) : (
                      <div className="h-14 w-10 flex items-center justify-center bg-muted rounded text-muted-foreground text-xs">–</div>
                    )}
                    <span className="text-[10px] text-muted-foreground leading-tight text-center">{frame.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Custom upload */}
            {localCertBgUrl && !['/certificate-frames/frame-classic-gold.png', '/certificate-frames/frame-sport-red.png', '/certificate-frames/frame-nature-green.png', '/certificate-frames/frame-modern-blue.png'].includes(localCertBgUrl) ? (
              <div className="flex items-center gap-2">
                <img src={localCertBgUrl} alt="Hintergrund" className="h-16 border border-border rounded p-1 object-contain" />
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={removeCertBg}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div>
                <input ref={certBgInputRef} type="file" accept="image/*" className="hidden" onChange={handleCertBgUpload} />
                <Button variant="outline" size="sm" onClick={() => certBgInputRef.current?.click()} disabled={uploadingCertBg}>
                  {uploadingCertBg ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  Eigenes Bild hochladen
                </Button>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Wird als Hintergrund auf der Siegerurkunde (A4) verwendet</p>
          </div>

          {/* Organizer */}
          <div>
            <Label className="text-sm font-semibold mb-1 block">Veranstalter</Label>
            <Input
              placeholder="Name des Veranstalters"
              value={localOrganizerName}
              onChange={e => setLocalOrganizerName(e.target.value)}
            />
          </div>

          {/* Sponsor */}
          <div>
            <Label className="text-sm font-semibold mb-1 block">Sponsor</Label>
            <Input
              placeholder="Name des Sponsors"
              value={localSponsorName}
              onChange={e => setLocalSponsorName(e.target.value)}
            />
          </div>

          {/* Sponsor Signature */}
          {localSponsorName && (
            <div>
              <Label className="text-sm font-semibold mb-1 block">
                <PenTool className="inline h-4 w-4 mr-1" />
                Unterschrift des Sponsors
              </Label>
              {localSponsorSigUrl ? (
                <div className="flex items-center gap-2">
                  <img src={localSponsorSigUrl} alt="Unterschrift" className="h-12 border border-border rounded p-1" />
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={removeSig}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div>
                  <input ref={sigInputRef} type="file" accept="image/*" className="hidden" onChange={handleSigUpload} />
                  <Button variant="outline" size="sm" onClick={() => sigInputRef.current?.click()} disabled={uploadingSig}>
                    {uploadingSig ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                    Unterschrift hochladen
                  </Button>
                </div>
              )}
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  id="settings-sponsor-consent"
                  checked={localSponsorConsent}
                  onChange={e => setLocalSponsorConsent(e.target.checked)}
                  className="rounded border-border"
                />
                <Label htmlFor="settings-sponsor-consent" className="text-xs text-muted-foreground cursor-pointer">
                  Der Sponsor stimmt der Veröffentlichung seiner Unterschrift auf der Urkunde zu
                </Label>
              </div>
            </div>
          )}

          {/* Sponsor Logo */}
          {localSponsorName && (
            <div>
              <Label className="text-sm font-semibold mb-1 block">
                <ImagePlus className="inline h-4 w-4 mr-1" />
                Logo des Sponsors
              </Label>
              {localSponsorLogoUrl ? (
                <div className="flex items-center gap-2">
                  <img src={localSponsorLogoUrl} alt="Sponsor-Logo" className="h-12 border border-border rounded p-1 object-contain" />
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={removeSponsorLogo}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div>
                  <input ref={sponsorLogoInputRef} type="file" accept="image/*" className="hidden" onChange={handleSponsorLogoUpload} />
                  <Button variant="outline" size="sm" onClick={() => sponsorLogoInputRef.current?.click()} disabled={uploadingLogo}>
                    {uploadingLogo ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                    Logo hochladen
                  </Button>
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">Wird auf der Siegerurkunde neben dem Sponsornamen angezeigt</p>
            </div>
          )}

          {/* Mode */}
          <div className={started ? 'opacity-50' : ''}>
            <Label className="text-sm font-semibold mb-2 block">Turniermodus</Label>
            <RadioGroup value={localMode} onValueChange={(v) => setLocalMode(v as TournamentMode)} disabled={started} className="flex flex-col gap-3">
              {[
                { value: 'knockout', label: 'K.-o.-System (Einfach-K.o.)', desc: 'Wer verliert, scheidet sofort aus. Ideal bei Zeitnot.' },
                { value: 'double_knockout', label: 'Doppel-K.-o.-System', desc: 'Jeder darf einmal verlieren. Erst bei der zweiten Niederlage ist man raus.' },
                { value: 'round_robin', label: 'Jeder gegen Jeden (Round Robin)', desc: 'Alle Teilnehmer spielen gegen alle anderen.' },
                { value: 'group_knockout', label: 'Kombiniertes System', desc: 'Erst Gruppenphase (4er-Gruppen), dann K.O. für die Besten.' },
                { value: 'swiss', label: 'Schweizer System', desc: 'Ähnliche Bilanzen spielen gegeneinander. Kein Ausscheiden.' },
                { value: 'kaiser', label: 'Kaiserspiel (King of the Hill)', desc: 'Gewinner rücken auf, Verlierer ab. Timer-basiert.' },
                { value: 'handicap', label: 'Vorgabeturnier (Handicap)', desc: 'Schwächere starten mit Punktevorsprung pro Satz.' },
              ].map(opt => (
                <div key={opt.value} className="flex items-start space-x-2">
                  <RadioGroupItem value={opt.value} id={`edit-mode-${opt.value}`} disabled={started} className="mt-0.5" />
                  <div>
                    <Label htmlFor={`edit-mode-${opt.value}`} className="text-sm font-medium cursor-pointer">{opt.label}</Label>
                    <p className="text-xs text-muted-foreground">{opt.desc}</p>
                  </div>
                </div>
              ))}
            </RadioGroup>
          </div>
          <div className={started ? 'opacity-50' : ''}>
            <Label className="text-sm font-semibold mb-2 block">Turniertyp</Label>
            <RadioGroup value={localType} onValueChange={(v) => setLocalType(v as TournamentType)} disabled={started} className="flex gap-4">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="singles" id="edit-type-singles" disabled={started} />
                <Label htmlFor="edit-type-singles" className="text-sm cursor-pointer">Einzel</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="doubles" id="edit-type-doubles" disabled={started} />
                <Label htmlFor="edit-type-doubles" className="text-sm cursor-pointer">Doppel</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="team" id="edit-type-team" disabled={started} />
                <Label htmlFor="edit-type-team" className="text-sm cursor-pointer">Mannschaft</Label>
              </div>
            </RadioGroup>
          </div>
          <div className={started ? 'opacity-50' : ''}>
            <Label className="text-sm font-semibold mb-2 block">Gewinnsätze</Label>
            <RadioGroup value={String(localBestOf)} onValueChange={(v) => setLocalBestOf(parseInt(v))} disabled={started} className="flex gap-4">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="2" id="edit-bestof-2" disabled={started} />
                <Label htmlFor="edit-bestof-2" className="text-sm cursor-pointer">2 Gewinnsätze (Best of 3)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="3" id="edit-bestof-3" disabled={started} />
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
