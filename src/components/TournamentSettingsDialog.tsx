import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Settings2, Upload, X, Loader2, ImagePlus, Video, Play, Plus } from 'lucide-react';
import { TournamentMode, TournamentType, TeamMode, Sponsor } from '@/types/tournament';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import * as tournamentService from '@/services/tournamentService';

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
  certificateTextColor: string;
  certificateExtraSizes?: Record<string, number>;
  organizerName: string;
  sponsors: Sponsor[];
  openingVideoUrl: string | null;
  tournamentId: string;
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
    certificate_bg_url?: string | null;
    certificate_font_family?: string;
    certificate_font_size?: number;
    certificate_text_color?: string;
    certificate_extra_sizes?: Record<string, number>;
    opening_video_url?: string | null;
  }) => Promise<void>;
}

export function TournamentSettingsDialog({
  mode, type, bestOf, started = false,
  tournamentDate, venueStreet, venueHouseNumber, venuePostalCode, venueCity, motto, breakMinutes,
  certificateText, certificateBgUrl, certificateFontFamily, certificateFontSize, certificateTextColor, certificateExtraSizes = {},
  organizerName, sponsors,
  openingVideoUrl, tournamentId,
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
  const [localSponsors, setLocalSponsors] = useState<Sponsor[]>(sponsors);
  const [localCertBgUrl, setLocalCertBgUrl] = useState(certificateBgUrl);
  const [localFontFamily, setLocalFontFamily] = useState(certificateFontFamily);
  const [localFontSize, setLocalFontSize] = useState(certificateFontSize);
  const [localTextColor, setLocalTextColor] = useState(certificateTextColor);
  const [localFontBold, setLocalFontBold] = useState(!!certificateExtraSizes.fontBold);
  const [uploadingSponsorLogoIdx, setUploadingSponsorLogoIdx] = useState<number | null>(null);
  const [uploadingCertBg, setUploadingCertBg] = useState(false);
  const [uploadingOpeningVideo, setUploadingOpeningVideo] = useState(false);
  const [localOpeningVideoUrl, setLocalOpeningVideoUrl] = useState(openingVideoUrl);
  const [openingVideoPlayerOpen, setOpeningVideoPlayerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const sponsorLogoInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const certBgInputRef = useRef<HTMLInputElement>(null);
  const openingVideoInputRef = useRef<HTMLInputElement>(null);

  const draftKey = `tt-tournament-settings-draft-${tournamentId}`;
  const [hasDraft, setHasDraft] = useState<boolean>(() => {
    try { return !!localStorage.getItem(draftKey); } catch { return false; }
  });

  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);

  const handleOpen = (isOpen: boolean) => {
    if (!isOpen && open && hasDraft && !saving) {
      // Intercept close while a draft exists
      setConfirmCloseOpen(true);
      return;
    }
    if (isOpen) {
      // Try to load draft from localStorage first
      let draft: any = null;
      try {
        const raw = localStorage.getItem(draftKey);
        if (raw) draft = JSON.parse(raw);
      } catch {}

      setLocalMode(draft?.localMode ?? mode);
      setLocalType(draft?.localType ?? type);
      setLocalBestOf(draft?.localBestOf ?? bestOf);
      setLocalDate(draft?.localDate ?? (tournamentDate || ''));
      setLocalStreet(draft?.localStreet ?? venueStreet);
      setLocalHouseNumber(draft?.localHouseNumber ?? venueHouseNumber);
      setLocalPostalCode(draft?.localPostalCode ?? venuePostalCode);
      setLocalCity(draft?.localCity ?? venueCity);
      setLocalMotto(draft?.localMotto ?? motto);
      setLocalBreakMinutes(draft?.localBreakMinutes ?? breakMinutes);
      setLocalCertText(draft?.localCertText ?? certificateText);
      setLocalOrganizerName(draft?.localOrganizerName ?? organizerName);
      setLocalSponsors(draft?.localSponsors ?? sponsors.map(s => ({ ...s })));
      setLocalCertBgUrl(draft?.localCertBgUrl ?? certificateBgUrl);
      setLocalFontFamily(draft?.localFontFamily ?? certificateFontFamily);
      setLocalFontSize(draft?.localFontSize ?? certificateFontSize);
      setLocalTextColor(draft?.localTextColor ?? certificateTextColor);
      setLocalFontBold(draft?.localFontBold ?? !!certificateExtraSizes.fontBold);
      setLocalOpeningVideoUrl(draft?.localOpeningVideoUrl ?? openingVideoUrl);

      setHasDraft(!!draft);
      if (draft) toast.info('Nicht gespeicherter Entwurf wiederhergestellt');
    }
    setOpen(isOpen);
  };

  // Persist draft to localStorage whenever any field changes while dialog is open
  useEffect(() => {
    if (!open) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify({
        localMode, localType, localBestOf, localDate,
        localStreet, localHouseNumber, localPostalCode, localCity,
        localMotto, localBreakMinutes, localCertText, localOrganizerName,
        localSponsors, localCertBgUrl, localFontFamily, localFontSize,
        localTextColor, localFontBold, localOpeningVideoUrl,
      }));
      setHasDraft(true);
    } catch {}
  }, [open, draftKey,
    localMode, localType, localBestOf, localDate,
    localStreet, localHouseNumber, localPostalCode, localCity,
    localMotto, localBreakMinutes, localCertText, localOrganizerName,
    localSponsors, localCertBgUrl, localFontFamily, localFontSize,
    localTextColor, localFontBold, localOpeningVideoUrl,
  ]);

  const discardDraft = () => {
    try { localStorage.removeItem(draftKey); } catch {}
    setHasDraft(false);
    // Reset fields to props
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
    setLocalSponsors(sponsors.map(s => ({ ...s })));
    setLocalCertBgUrl(certificateBgUrl);
    setLocalFontFamily(certificateFontFamily);
    setLocalFontSize(certificateFontSize);
    setLocalTextColor(certificateTextColor);
    setLocalFontBold(!!certificateExtraSizes.fontBold);
    setLocalOpeningVideoUrl(openingVideoUrl);
    toast.info('Entwurf verworfen');
  };




  const handleSponsorLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>, idx: number) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    setUploadingSponsorLogoIdx(idx);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `sponsor-logo-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('logos').upload(fileName, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('logos').getPublicUrl(fileName);
      setLocalSponsors(prev => prev.map((s, i) => i === idx ? { ...s, logoUrl: urlData.publicUrl } : s));
      toast.success('Sponsor-Logo hochgeladen');
    } catch {
      toast.error('Fehler beim Hochladen');
    } finally {
      setUploadingSponsorLogoIdx(null);
      const ref = sponsorLogoInputRefs.current[idx];
      if (ref) ref.value = '';
    }
  };

  const removeSponsorLogo = async (idx: number) => {
    const url = localSponsors[idx]?.logoUrl;
    if (url) {
      const parts = url.split('/');
      const fileName = parts[parts.length - 1];
      await supabase.storage.from('logos').remove([fileName]);
    }
    setLocalSponsors(prev => prev.map((s, i) => i === idx ? { ...s, logoUrl: null } : s));
  };

  const addSponsorSlot = () => {
    if (localSponsors.length >= 5) return;
    setLocalSponsors(prev => [...prev, { id: '', name: '', logoUrl: null, sortOrder: prev.length + 1 }]);
  };

  const removeSponsorSlot = (idx: number) => {
    setLocalSponsors(prev => prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, sortOrder: i + 1 })));
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

  const handleOpeningVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('video/')) {
      toast.error('Nur Videos sind erlaubt');
      return;
    }
    if (file.size > 200 * 1024 * 1024) {
      toast.error('Datei zu groß (max. 200 MB)');
      return;
    }
    setUploadingOpeningVideo(true);
    try {
      const ext = file.name.split('.').pop() || 'mp4';
      const fileName = `opening-${tournamentId}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('tournament-videos').upload(fileName, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('tournament-videos').getPublicUrl(fileName);
      setLocalOpeningVideoUrl(urlData.publicUrl);
      toast.success('Eröffnungsvideo hochgeladen');
    } catch {
      toast.error('Fehler beim Hochladen');
    } finally {
      setUploadingOpeningVideo(false);
      if (openingVideoInputRef.current) openingVideoInputRef.current.value = '';
    }
  };

  const removeOpeningVideo = async () => {
    if (localOpeningVideoUrl) {
      try {
        const url = new URL(localOpeningVideoUrl);
        const pathParts = url.pathname.split('/tournament-videos/');
        if (pathParts[1]) {
          await supabase.storage.from('tournament-videos').remove([decodeURIComponent(pathParts[1])]);
        }
      } catch {}
    }
    setLocalOpeningVideoUrl(null);
  };

  const hasChanges = true; // Always allow saving since sponsor changes are tracked separately

  const handleSave = async () => {
    setSaving(true);
    try {
      if (localMode !== mode) await onUpdateMode(localMode);
      if (localType !== type) await onUpdateType(localType);
      if (localBestOf !== bestOf) await onUpdateBestOf(localBestOf);

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
        certificate_bg_url: localCertBgUrl,
        certificate_font_family: localFontFamily,
        certificate_font_size: localFontSize,
        certificate_text_color: localTextColor,
        certificate_extra_sizes: { ...certificateExtraSizes, fontBold: localFontBold ? 1 : 0 },
        opening_video_url: localOpeningVideoUrl,
      });

      // Save sponsors
      // Remove deleted sponsors
      for (const existing of sponsors) {
        if (!localSponsors.find(s => s.id === existing.id)) {
          await tournamentService.removeSponsor(existing.id);
        }
      }
      // Add/update sponsors
      for (const s of localSponsors) {
        if (s.id) {
          const existing = sponsors.find(e => e.id === s.id);
          if (existing && (existing.name !== s.name || existing.logoUrl !== s.logoUrl)) {
            await tournamentService.updateSponsor(s.id, { name: s.name, logo_url: s.logoUrl });
          }
        } else if (s.name.trim()) {
          await tournamentService.addSponsor(tournamentId, s.name, s.logoUrl, s.sortOrder);
        }
      }

      toast.success('Einstellungen gespeichert');
      try { localStorage.removeItem(draftKey); } catch {}
      setHasDraft(false);
      setOpen(false);
    } catch {
      toast.error('Fehler beim Speichern');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground relative">
          <Settings2 className="h-4 w-4" />
          {hasDraft && (
            <span className="absolute top-0.5 right-0.5 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-background" title="Ungespeicherter Entwurf" />
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2 pr-6">
            <DialogTitle>Turnier-Einstellungen</DialogTitle>
            {hasDraft && (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 px-2 py-0.5 text-xs font-medium">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                  Ungespeichert
                </span>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={discardDraft}>
                  Verwerfen
                </Button>
              </div>
            )}
          </div>
        </DialogHeader>
        <Tabs defaultValue="general" className="pt-2">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="general">Allgemein</TabsTrigger>
            <TabsTrigger value="mode">Modus</TabsTrigger>
            <TabsTrigger value="certificate">Urkunden</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4">
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

            {/* Opening Video */}
            <div>
              <Label className="text-sm font-semibold mb-1 block">
                <Video className="inline h-4 w-4 mr-1" />
                Eröffnungsvideo
              </Label>
              {localOpeningVideoUrl ? (
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setOpeningVideoPlayerOpen(true)}>
                    <Play className="mr-1 h-4 w-4" />
                    Abspielen
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={removeOpeningVideo}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div>
                  <input ref={openingVideoInputRef} type="file" accept="video/*" className="hidden" onChange={handleOpeningVideoUpload} />
                  <Button variant="outline" size="sm" onClick={() => openingVideoInputRef.current?.click()} disabled={uploadingOpeningVideo}>
                    {uploadingOpeningVideo ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                    Video hochladen
                  </Button>
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-1">Wird vor dem Turnier in einem separaten Fenster abgespielt (max. 200 MB)</p>
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

            {/* Organizer */}
            <div>
              <Label className="text-sm font-semibold mb-1 block">Veranstalter</Label>
              <Input
                placeholder="Name des Veranstalters"
                value={localOrganizerName}
                onChange={e => setLocalOrganizerName(e.target.value)}
              />
            </div>
          </TabsContent>

          <TabsContent value="mode" className="space-y-4">
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
          </TabsContent>

          <TabsContent value="certificate" className="space-y-4">
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

            {/* Certificate Font Settings */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-semibold mb-1 block">Schriftart</Label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={localFontFamily}
                  onChange={e => setLocalFontFamily(e.target.value)}
                >
                  <option value="Helvetica">Helvetica (Sans-Serif)</option>
                  <option value="Times">Times (Serif)</option>
                  <option value="Courier">Courier (Monospace)</option>
                  <option value="Dancing Script">Dancing Script (Schreibschrift)</option>
                  <option value="Great Vibes">Great Vibes (Kalligraphie)</option>
                  <option value="Playfair Display">Playfair Display (Elegant Serif)</option>
                  <option value="Montserrat">Montserrat (Modern Sans)</option>
                  <option value="Lora">Lora (Buch-Serif)</option>
                  <option value="Raleway">Raleway (Dünn Sans)</option>
                </select>
              </div>
              <div>
                <Label className="text-sm font-semibold mb-1 block">Schriftgröße</Label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={localFontSize}
                  onChange={e => setLocalFontSize(Number(e.target.value))}
                >
                  {[14, 16, 18, 20, 22, 24, 28].map(s => (
                    <option key={s} value={s}>{s} pt</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="cert-font-bold-settings"
                checked={!!localFontBold}
                onChange={e => setLocalFontBold(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              <Label htmlFor="cert-font-bold-settings" className="text-sm font-semibold cursor-pointer">Fettdruck</Label>
            </div>

            {/* Text Color */}
            <div>
              <Label className="text-sm font-semibold mb-1 block">Textfarbe</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={localTextColor}
                  onChange={e => setLocalTextColor(e.target.value)}
                  className="w-10 h-10 rounded border border-input cursor-pointer"
                />
                <Input
                  value={localTextColor}
                  onChange={e => setLocalTextColor(e.target.value)}
                  className="w-28 font-mono text-sm"
                  maxLength={7}
                />
              </div>
            </div>

            {/* Sponsoren (bis zu 5) */}
            <div>
              <Label className="text-sm font-semibold mb-2 block">Sponsoren (max. 5)</Label>
              <div className="space-y-3">
                {localSponsors.map((sponsor, idx) => (
                  <div key={idx} className="border border-border rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder={`Sponsor ${idx + 1}`}
                        value={sponsor.name}
                        onChange={e => setLocalSponsors(prev => prev.map((s, i) => i === idx ? { ...s, name: e.target.value } : s))}
                        className="flex-1"
                      />
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeSponsorSlot(idx)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      {sponsor.logoUrl ? (
                        <>
                          <img src={sponsor.logoUrl} alt="Logo" className="h-10 border border-border rounded p-1 object-contain" />
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeSponsorLogo(idx)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <input
                            ref={el => { sponsorLogoInputRefs.current[idx] = el; }}
                            type="file" accept="image/*" className="hidden"
                            onChange={e => handleSponsorLogoUpload(e, idx)}
                          />
                          <Button variant="outline" size="sm" onClick={() => sponsorLogoInputRefs.current[idx]?.click()} disabled={uploadingSponsorLogoIdx === idx}>
                            {uploadingSponsorLogoIdx === idx ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Upload className="mr-1 h-3 w-3" />}
                            Logo
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {localSponsors.length < 5 && (
                <Button variant="outline" size="sm" className="mt-2" onClick={addSponsorSlot}>
                  <Plus className="mr-1 h-3 w-3" /> Sponsor hinzufügen
                </Button>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <Button onClick={handleSave} disabled={saving} className="w-full mt-4">
          {saving ? 'Speichern...' : 'Speichern'}
        </Button>
      </DialogContent>
    </Dialog>

    <Dialog open={openingVideoPlayerOpen} onOpenChange={setOpeningVideoPlayerOpen}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-none overflow-hidden flex items-center justify-center">
        {openingVideoPlayerOpen && localOpeningVideoUrl && (
          <video
            src={localOpeningVideoUrl}
            controls
            autoPlay
            className="max-w-full max-h-[90vh] rounded"
          />
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}
