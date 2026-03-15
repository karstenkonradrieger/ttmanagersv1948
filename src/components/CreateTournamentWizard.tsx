import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Plus, Loader2, ArrowLeft, ArrowRight, Upload, X, MapPin, ImagePlus, PenTool } from 'lucide-react';
import { TournamentMode, TournamentType, TeamMode } from '@/types/tournament';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface WizardData {
  name: string;
  sport: string;
  startDate: string;
  endDate: string;
  venueStreet: string;
  venueHouseNumber: string;
  venuePostalCode: string;
  venueCity: string;
  directionsPdfUrl: string | null;
  googleMapsLink: string;
  logoUrl: string | null;
  certificateText: string;
  certificateBgUrl: string | null;
  certificateFontFamily: string;
  certificateFontSize: number;
  certificateTextColor: string;
  organizerName: string;
  sponsorName: string;
  sponsorSignatureUrl: string | null;
  sponsorLogoUrl: string | null;
  sponsorConsent: boolean;
  type: TournamentType;
  teamMode: TeamMode;
  mode: TournamentMode;
  bestOf: number;
}

const DEFAULT_CERTIFICATE_TEXT = 'Beim {turniername} hat {spieler} ({verein}) den {platz} belegt.';

const SPORT_OPTIONS = ['Tischtennis', 'Badminton', 'Tennis', 'Squash'];

const MODE_OPTIONS: Record<string, Array<{ value: TournamentMode; label: string; desc: string }>> = {
  all: [
    { value: 'knockout', label: 'K.-o.-System (Einfach-K.o.)', desc: 'Wer verliert, scheidet sofort aus.' },
    { value: 'double_knockout', label: 'Doppel-K.-o.-System', desc: 'Jeder darf einmal verlieren.' },
    { value: 'round_robin', label: 'Jeder gegen Jeden (Round Robin)', desc: 'Alle spielen gegen alle anderen.' },
    { value: 'group_knockout', label: 'Kombiniertes System', desc: 'Erst Gruppenphase, dann K.O.' },
    { value: 'swiss', label: 'Schweizer System', desc: 'Ähnliche Bilanzen spielen gegeneinander.' },
    { value: 'kaiser', label: 'Kaiserspiel (King of the Hill)', desc: 'Gewinner rücken auf, Verlierer ab.' },
    { value: 'handicap', label: 'Vorgabeturnier (Handicap)', desc: 'Schwächere starten mit Punktevorsprung.' },
  ],
};

interface Props {
  onCreated: (id: string) => void;
  userId?: string;
  createTournament: (
    name: string,
    createdBy: string | undefined,
    mode: string,
    type: string,
    bestOf: number,
    teamMode: string | null,
    extras?: {
      sport?: string;
      tournament_date?: string | null;
      tournament_end_date?: string | null;
      venue_street?: string;
      venue_house_number?: string;
      venue_postal_code?: string;
      venue_city?: string;
      directions_pdf_url?: string | null;
      google_maps_link?: string | null;
      logo_url?: string | null;
      certificate_text?: string;
      organizer_name?: string;
      sponsor_name?: string;
      sponsor_signature_url?: string | null;
      sponsor_logo_url?: string | null;
      sponsor_consent?: boolean;
      certificate_bg_url?: string | null;
      certificate_font_family?: string;
      certificate_font_size?: number;
      certificate_text_color?: string;
    },
  ) => Promise<string>;
}

export function CreateTournamentWizard({ onCreated, userId, createTournament }: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [creating, setCreating] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingSignature, setUploadingSignature] = useState(false);
  const [uploadingSponsorLogo, setUploadingSponsorLogo] = useState(false);
  const [uploadingCertBg, setUploadingCertBg] = useState(false);
  const [customSport, setCustomSport] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const signatureInputRef = useRef<HTMLInputElement>(null);
  const sponsorLogoInputRef = useRef<HTMLInputElement>(null);
  const certBgInputRef = useRef<HTMLInputElement>(null);

  const [data, setData] = useState<WizardData>({
    name: '',
    sport: 'Tischtennis',
    startDate: '',
    endDate: '',
    venueStreet: '',
    venueHouseNumber: '',
    venuePostalCode: '',
    venueCity: '',
    directionsPdfUrl: null,
    googleMapsLink: '',
    logoUrl: null,
    certificateText: DEFAULT_CERTIFICATE_TEXT,
    certificateBgUrl: null,
    certificateFontFamily: 'Helvetica',
    certificateFontSize: 20,
    certificateTextColor: '#1e1e1e',
    organizerName: '',
    sponsorName: '',
    sponsorSignatureUrl: null,
    sponsorLogoUrl: null,
    sponsorConsent: false,
    type: 'singles',
    teamMode: 'bundessystem',
    mode: 'knockout',
    bestOf: 3,
  });

  const update = (partial: Partial<WizardData>) => setData(prev => ({ ...prev, ...partial }));

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      setStep(1);
      setData({
        name: '',
        sport: 'Tischtennis',
        startDate: '',
        endDate: '',
        venueStreet: '',
        venueHouseNumber: '',
        venuePostalCode: '',
        venueCity: '',
        directionsPdfUrl: null,
        googleMapsLink: '',
        logoUrl: null,
        certificateText: DEFAULT_CERTIFICATE_TEXT,
        certificateBgUrl: null,
        certificateFontFamily: 'Helvetica',
        certificateFontSize: 20,
        certificateTextColor: '#1e1e1e',
        organizerName: '',
        sponsorName: '',
        sponsorSignatureUrl: null,
        sponsorLogoUrl: null,
        sponsorConsent: false,
        type: 'singles',
        teamMode: 'bundessystem',
        mode: 'knockout',
        bestOf: 3,
      });
      setCustomSport('');
    }
    setOpen(isOpen);
  };

  const handleStartDateChange = (val: string) => {
    update({ startDate: val, endDate: data.endDate || val });
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      toast.error('Bitte eine PDF-Datei auswählen');
      return;
    }
    setUploadingPdf(true);
    try {
      const fileName = `${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from('directions').upload(fileName, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('directions').getPublicUrl(fileName);
      update({ directionsPdfUrl: urlData.publicUrl });
      toast.success('PDF hochgeladen');
    } catch {
      toast.error('Fehler beim Hochladen');
    } finally {
      setUploadingPdf(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removePdf = async () => {
    if (data.directionsPdfUrl) {
      const parts = data.directionsPdfUrl.split('/');
      const fileName = parts[parts.length - 1];
      await supabase.storage.from('directions').remove([fileName]);
    }
    update({ directionsPdfUrl: null });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Bitte nur Bilddateien hochladen');
      return;
    }
    setUploadingLogo(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `wizard-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('logos').upload(fileName, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('logos').getPublicUrl(fileName);
      update({ logoUrl: `${urlData.publicUrl}?t=${Date.now()}` });
      toast.success('Logo hochgeladen');
    } catch {
      toast.error('Fehler beim Hochladen des Logos');
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  const removeLogo = async () => {
    if (data.logoUrl) {
      const url = data.logoUrl.split('?')[0];
      const parts = url.split('/');
      const fileName = parts[parts.length - 1];
      await supabase.storage.from('logos').remove([fileName]);
    }
    update({ logoUrl: null });
  };

  const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Bitte nur Bilddateien hochladen');
      return;
    }
    setUploadingSignature(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `sig-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('signatures').upload(fileName, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('signatures').getPublicUrl(fileName);
      update({ sponsorSignatureUrl: urlData.publicUrl });
      toast.success('Unterschrift hochgeladen');
    } catch {
      toast.error('Fehler beim Hochladen');
    } finally {
      setUploadingSignature(false);
      if (signatureInputRef.current) signatureInputRef.current.value = '';
    }
  };

  const removeSignature = async () => {
    if (data.sponsorSignatureUrl) {
      const parts = data.sponsorSignatureUrl.split('/');
      const fileName = parts[parts.length - 1];
      await supabase.storage.from('signatures').remove([fileName]);
    }
    update({ sponsorSignatureUrl: null });
  };

  const handleSponsorLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Bitte nur Bilddateien hochladen');
      return;
    }
    setUploadingSponsorLogo(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `sponsor-logo-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('logos').upload(fileName, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('logos').getPublicUrl(fileName);
      update({ sponsorLogoUrl: urlData.publicUrl });
      toast.success('Sponsor-Logo hochgeladen');
    } catch {
      toast.error('Fehler beim Hochladen');
    } finally {
      setUploadingSponsorLogo(false);
      if (sponsorLogoInputRef.current) sponsorLogoInputRef.current.value = '';
    }
  };

  const removeSponsorLogo = async () => {
    if (data.sponsorLogoUrl) {
      const parts = data.sponsorLogoUrl.split('/');
      const fileName = parts[parts.length - 1];
      await supabase.storage.from('logos').remove([fileName]);
    }
    update({ sponsorLogoUrl: null });
  };

  const handleCertBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Bitte nur Bilddateien hochladen');
      return;
    }
    setUploadingCertBg(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `cert-bg-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('logos').upload(fileName, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from('logos').getPublicUrl(fileName);
      update({ certificateBgUrl: urlData.publicUrl });
      toast.success('Hintergrundbild hochgeladen');
    } catch {
      toast.error('Fehler beim Hochladen');
    } finally {
      setUploadingCertBg(false);
      if (certBgInputRef.current) certBgInputRef.current.value = '';
    }
  };

  const removeCertBg = async () => {
    if (data.certificateBgUrl) {
      const parts = data.certificateBgUrl.split('/');
      const fileName = parts[parts.length - 1];
      await supabase.storage.from('logos').remove([fileName]);
    }
    update({ certificateBgUrl: null });
  };

  const canProceedStep1 = data.name.trim().length > 0;

  const handleCreate = async () => {
    setCreating(true);
    try {
      const sport = data.sport === '__custom' ? customSport.trim() || 'Tischtennis' : data.sport;
      const id = await createTournament(
        data.name.trim(),
        userId,
        data.mode,
        data.type,
        data.bestOf,
        data.type === 'team' ? data.teamMode : null,
        {
          sport,
          tournament_date: data.startDate || null,
          tournament_end_date: data.endDate || null,
          venue_street: data.venueStreet,
          venue_house_number: data.venueHouseNumber,
          venue_postal_code: data.venuePostalCode,
          venue_city: data.venueCity,
          directions_pdf_url: data.directionsPdfUrl,
          google_maps_link: data.googleMapsLink || null,
          logo_url: data.logoUrl || null,
          certificate_text: data.certificateText,
          organizer_name: data.organizerName,
          sponsor_name: data.sponsorName,
          sponsor_signature_url: data.sponsorSignatureUrl,
          sponsor_logo_url: data.sponsorLogoUrl,
          sponsor_consent: data.sponsorConsent,
          certificate_bg_url: data.certificateBgUrl,
          certificate_font_family: data.certificateFontFamily,
          certificate_font_size: data.certificateFontSize,
          certificate_text_color: data.certificateTextColor,
        },
      );
      setOpen(false);
      onCreated(id);
      toast.success('Turnier erstellt');
    } catch {
      toast.error('Fehler beim Erstellen des Turniers');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button className="glow-green">
          <Plus className="mr-2 h-4 w-4" />
          Neues Turnier
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Neues Turnier – Schritt {step} von 2
          </DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4 pt-2">
            {/* Name + Logo */}
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <Label className="text-sm font-semibold mb-1 block">Turniername *</Label>
                <Input
                  placeholder="z.B. Vereinsmeisterschaft 2026"
                  value={data.name}
                  onChange={e => update({ name: e.target.value })}
                  autoFocus
                />
              </div>
              <div>
                <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                <button
                  onClick={() => logoInputRef.current?.click()}
                  disabled={uploadingLogo}
                  className="flex-shrink-0 h-10 w-10 rounded-lg overflow-hidden border border-border hover:border-primary transition-colors flex items-center justify-center bg-secondary relative"
                  title="Turnierlogo hochladen"
                >
                  {uploadingLogo ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : data.logoUrl ? (
                    <img src={data.logoUrl} alt="Logo" className="h-full w-full object-contain" />
                  ) : (
                    <ImagePlus className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
                {data.logoUrl && (
                  <button onClick={removeLogo} className="text-xs text-destructive hover:underline mt-0.5 block mx-auto">
                    <X className="h-3 w-3 inline" />
                  </button>
                )}
              </div>
            </div>

            {/* Sport */}
            <div>
              <Label className="text-sm font-semibold mb-2 block">Sportart</Label>
              <RadioGroup
                value={data.sport}
                onValueChange={v => update({ sport: v })}
                className="flex flex-wrap gap-3"
              >
                {SPORT_OPTIONS.map(s => (
                  <div key={s} className="flex items-center space-x-2">
                    <RadioGroupItem value={s} id={`sport-${s}`} />
                    <Label htmlFor={`sport-${s}`} className="text-sm cursor-pointer">{s}</Label>
                  </div>
                ))}
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="__custom" id="sport-custom" />
                  <Label htmlFor="sport-custom" className="text-sm cursor-pointer">Andere</Label>
                </div>
              </RadioGroup>
              {data.sport === '__custom' && (
                <Input
                  placeholder="Sportart eingeben..."
                  value={customSport}
                  onChange={e => setCustomSport(e.target.value)}
                  className="mt-2"
                />
              )}
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-semibold mb-1 block">Erster Turniertag</Label>
                <Input
                  type="date"
                  value={data.startDate}
                  onChange={e => handleStartDateChange(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-sm font-semibold mb-1 block">Letzter Turniertag</Label>
                <Input
                  type="date"
                  value={data.endDate}
                  onChange={e => update({ endDate: e.target.value })}
                  min={data.startDate}
                />
              </div>
            </div>

            {/* Venue */}
            <div>
              <Label className="text-sm font-semibold mb-1 block">Veranstaltungsort</Label>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <Input placeholder="Straße" value={data.venueStreet} onChange={e => update({ venueStreet: e.target.value })} />
                </div>
                <Input placeholder="Hausnr." value={data.venueHouseNumber} onChange={e => update({ venueHouseNumber: e.target.value })} />
              </div>
              <div className="grid grid-cols-3 gap-2 mt-2">
                <Input placeholder="PLZ" value={data.venuePostalCode} onChange={e => update({ venuePostalCode: e.target.value })} />
                <div className="col-span-2">
                  <Input placeholder="Ort" value={data.venueCity} onChange={e => update({ venueCity: e.target.value })} />
                </div>
              </div>
            </div>

            {/* Directions PDF */}
            <div>
              <Label className="text-sm font-semibold mb-1 block">Anfahrtsbeschreibung (PDF)</Label>
              {data.directionsPdfUrl ? (
                <div className="flex items-center gap-2 text-sm">
                  <a href={data.directionsPdfUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline truncate flex-1">
                    PDF hochgeladen
                  </a>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={removePdf}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div>
                  <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={handlePdfUpload} />
                  <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploadingPdf}>
                    {uploadingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                    PDF hochladen
                  </Button>
                </div>
              )}
            </div>

            {/* Google Maps Link */}
            <div>
              <Label className="text-sm font-semibold mb-1 block">
                <MapPin className="inline h-4 w-4 mr-1" />
                Google Maps Link
              </Label>
              <Input
                placeholder="https://maps.google.com/..."
                value={data.googleMapsLink}
                onChange={e => update({ googleMapsLink: e.target.value })}
              />
            </div>

            {/* Certificate Text */}
            <div>
              <Label className="text-sm font-semibold mb-1 block">Text für Siegerurkunden</Label>
              <Textarea
                value={data.certificateText}
                onChange={e => update({ certificateText: e.target.value })}
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
                    ? !data.certificateBgUrl || data.certificateBgUrl === ''
                    : data.certificateBgUrl === frame.url;
                  return (
                    <button
                      key={frame.label}
                      type="button"
                      className={`flex flex-col items-center gap-1 rounded-md border-2 p-1 transition-colors ${
                        isSelected ? 'border-primary bg-primary/10' : 'border-border hover:border-muted-foreground'
                      }`}
                      onClick={() => update({ certificateBgUrl: frame.url })}
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
              {data.certificateBgUrl && !['/certificate-frames/frame-classic-gold.png', '/certificate-frames/frame-sport-red.png', '/certificate-frames/frame-nature-green.png', '/certificate-frames/frame-modern-blue.png'].includes(data.certificateBgUrl) ? (
                <div className="flex items-center gap-2">
                  <img src={data.certificateBgUrl} alt="Hintergrund" className="h-16 border border-border rounded p-1 object-contain" />
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
                  value={data.certificateFontFamily}
                  onChange={e => update({ certificateFontFamily: e.target.value })}
                >
                  <option value="Helvetica">Helvetica (Sans-Serif)</option>
                  <option value="Times">Times (Serif)</option>
                  <option value="Courier">Courier (Monospace)</option>
                </select>
              </div>
              <div>
                <Label className="text-sm font-semibold mb-1 block">Schriftgröße</Label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={data.certificateFontSize}
                  onChange={e => update({ certificateFontSize: Number(e.target.value) })}
                >
                  {[14, 16, 18, 20, 22, 24, 28].map(s => (
                    <option key={s} value={s}>{s} pt</option>
                  ))}
                </select>
              </div>
            </div>
            {/* Text Color */}
            <div>
              <Label className="text-sm font-semibold mb-1 block">Textfarbe</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={data.certificateTextColor}
                  onChange={e => update({ certificateTextColor: e.target.value })}
                  className="w-10 h-10 rounded border border-input cursor-pointer"
                />
                <input
                  className="w-28 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                  value={data.certificateTextColor}
                  onChange={e => update({ certificateTextColor: e.target.value })}
                  maxLength={7}
                />
              </div>
            </div>

            {/* Organizer */}
            <div>
              <Label className="text-sm font-semibold mb-1 block">Veranstalter</Label>
              <Input
                placeholder="Name des Veranstalters"
                value={data.organizerName}
                onChange={e => update({ organizerName: e.target.value })}
              />
            </div>

            {/* Sponsor */}
            <div>
              <Label className="text-sm font-semibold mb-1 block">Sponsor</Label>
              <Input
                placeholder="Name des Sponsors"
                value={data.sponsorName}
                onChange={e => update({ sponsorName: e.target.value })}
              />
            </div>

            {/* Sponsor Signature */}
            {data.sponsorName && (
              <div>
                <Label className="text-sm font-semibold mb-1 block">
                  <PenTool className="inline h-4 w-4 mr-1" />
                  Unterschrift des Sponsors
                </Label>
                {data.sponsorSignatureUrl ? (
                  <div className="flex items-center gap-2">
                    <img src={data.sponsorSignatureUrl} alt="Unterschrift" className="h-12 border border-border rounded p-1" />
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={removeSignature}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div>
                    <input ref={signatureInputRef} type="file" accept="image/*" className="hidden" onChange={handleSignatureUpload} />
                    <Button variant="outline" size="sm" onClick={() => signatureInputRef.current?.click()} disabled={uploadingSignature}>
                      {uploadingSignature ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                      Unterschrift hochladen
                    </Button>
                  </div>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="checkbox"
                    id="wiz-sponsor-consent"
                    checked={data.sponsorConsent}
                    onChange={e => update({ sponsorConsent: e.target.checked })}
                    className="rounded border-border"
                  />
                  <Label htmlFor="wiz-sponsor-consent" className="text-xs text-muted-foreground cursor-pointer">
                    Der Sponsor stimmt der Veröffentlichung seiner Unterschrift auf der Urkunde zu
                  </Label>
                </div>
              </div>
            )}

            <Button onClick={() => setStep(2)} disabled={!canProceedStep1} className="w-full">
              Weiter <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
            )}

            {/* Sponsor Logo */}
            {data.sponsorName && (
              <div>
                <Label className="text-sm font-semibold mb-1 block">
                  <ImagePlus className="inline h-4 w-4 mr-1" />
                  Logo des Sponsors
                </Label>
                {data.sponsorLogoUrl ? (
                  <div className="flex items-center gap-2">
                    <img src={data.sponsorLogoUrl} alt="Sponsor-Logo" className="h-12 border border-border rounded p-1 object-contain" />
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={removeSponsorLogo}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div>
                    <input ref={sponsorLogoInputRef} type="file" accept="image/*" className="hidden" onChange={handleSponsorLogoUpload} />
                    <Button variant="outline" size="sm" onClick={() => sponsorLogoInputRef.current?.click()} disabled={uploadingSponsorLogo}>
                      {uploadingSponsorLogo ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                      Logo hochladen
                    </Button>
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-1">Wird auf der Siegerurkunde neben dem Sponsornamen angezeigt</p>
              </div>
            )}
        {step === 2 && (
          <div className="space-y-4 pt-2">
            {/* Tournament Type */}
            <div>
              <Label className="text-sm font-semibold mb-2 block">Turniertyp</Label>
              <RadioGroup value={data.type} onValueChange={v => update({ type: v as TournamentType })} className="flex gap-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="singles" id="wiz-type-singles" />
                  <Label htmlFor="wiz-type-singles" className="text-sm cursor-pointer">Einzel</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="doubles" id="wiz-type-doubles" />
                  <Label htmlFor="wiz-type-doubles" className="text-sm cursor-pointer">Doppel</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="team" id="wiz-type-team" />
                  <Label htmlFor="wiz-type-team" className="text-sm cursor-pointer">Mannschaft</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Team Mode (only for team type) */}
            {data.type === 'team' && (
              <div>
                <Label className="text-sm font-semibold mb-2 block">Mannschaftssystem</Label>
                <RadioGroup value={data.teamMode} onValueChange={v => update({ teamMode: v as TeamMode })} className="flex flex-col gap-3">
                  {[
                    { value: 'bundessystem', label: 'Bundessystem (4er)', desc: '2 Doppel + 8 Einzel.' },
                    { value: 'werner_scheffler', label: 'Werner-Scheffler (4er)', desc: '2 Doppel + 6 Einzel.' },
                    { value: 'olympic', label: 'Olympisches System (3er)', desc: '2 Einzel, 1 Doppel, ggf. 2 weitere.' },
                    { value: 'corbillon', label: 'Corbillon-Cup (2er)', desc: '2 Einzel, 1 Doppel, ggf. 2 weitere.' },
                  ].map(opt => (
                    <div key={opt.value} className="flex items-start space-x-2">
                      <RadioGroupItem value={opt.value} id={`wiz-team-${opt.value}`} className="mt-0.5" />
                      <div>
                        <Label htmlFor={`wiz-team-${opt.value}`} className="text-sm font-medium cursor-pointer">{opt.label}</Label>
                        <p className="text-xs text-muted-foreground">{opt.desc}</p>
                      </div>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            )}

            {/* Tournament Mode */}
            <div>
              <Label className="text-sm font-semibold mb-2 block">Turniermodus</Label>
              <RadioGroup value={data.mode} onValueChange={v => update({ mode: v as TournamentMode })} className="flex flex-col gap-3">
                {MODE_OPTIONS.all.map(opt => (
                  <div key={opt.value} className="flex items-start space-x-2">
                    <RadioGroupItem value={opt.value} id={`wiz-mode-${opt.value}`} className="mt-0.5" />
                    <div>
                      <Label htmlFor={`wiz-mode-${opt.value}`} className="text-sm font-medium cursor-pointer">{opt.label}</Label>
                      <p className="text-xs text-muted-foreground">{opt.desc}</p>
                    </div>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* Best Of */}
            <div>
              <Label className="text-sm font-semibold mb-2 block">Gewinnsätze</Label>
              <RadioGroup value={String(data.bestOf)} onValueChange={v => update({ bestOf: parseInt(v) })} className="flex gap-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="2" id="wiz-bestof-2" />
                  <Label htmlFor="wiz-bestof-2" className="text-sm cursor-pointer">2 Gewinnsätze (Best of 3)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="3" id="wiz-bestof-3" />
                  <Label htmlFor="wiz-bestof-3" className="text-sm cursor-pointer">3 Gewinnsätze (Best of 5)</Label>
                </div>
              </RadioGroup>
            </div>

            {/* Buttons */}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                <ArrowLeft className="mr-2 h-4 w-4" /> Zurück
              </Button>
              <Button onClick={handleCreate} disabled={creating} className="flex-1">
                {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Erstellen
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
