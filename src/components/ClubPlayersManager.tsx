import { useState, useRef, useEffect } from 'react';
import { Club } from '@/hooks/useClubs';
import { ClubPlayer } from '@/hooks/useClubPlayers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Building2, Plus, Trash2, ChevronDown, ChevronRight, User, Trophy, Phone, UserPlus, Pencil, Check, X, Download, Upload, Mail, Camera, FileText, Paperclip, FileCheck, ExternalLink, MapPin, Globe, UserCheck, ImagePlus, Save } from 'lucide-react';
import { VoiceRecorder } from '@/components/VoiceRecorder';
import { printGeneralPhotoConsentPdf } from '@/components/PhotoConsentForm';
import { ConsentDocumentDialog } from '@/components/ConsentViewDialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useClubAuthority } from '@/hooks/useClubAuthority';
import { Lock } from 'lucide-react';

interface Props {
  clubs: Club[];
  clubPlayers: ClubPlayer[];
  onAddClub: (name: string) => Promise<Club | null>;
  onRemoveClub: (id: string) => void;
  onUpdateClub?: (id: string, updates: Partial<Omit<Club, 'id'>>) => Promise<void>;
  onAddPlayer: (clubId: string, name: string, gender: string, birthDate: string | null, ttr: number, postalCode: string, city: string, street: string, houseNumber: string, phone: string, email: string, photoConsent: boolean) => Promise<ClubPlayer | null>;
  onUpdatePlayer: (id: string, updates: Partial<Omit<ClubPlayer, 'id' | 'clubId' | 'clubName'>>) => void;
  onRemovePlayer: (id: string) => void;
  getPlayersForClub: (clubId: string) => ClubPlayer[];
}

function ClubLogoUpload({ club, onUpdate }: { club: Club; onUpdate?: Props['onUpdateClub'] }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onUpdate) return;
    if (!file.type.startsWith('image/')) { toast.error('Bitte nur Bilddateien hochladen'); return; }
    const ext = file.name.split('.').pop();
    const path = `clubs/${club.id}/logo.${ext}`;
    const { error: uploadError } = await supabase.storage.from('logos').upload(path, file, { upsert: true });
    if (uploadError) { toast.error('Fehler beim Hochladen des Logos'); return; }
    const { data } = supabase.storage.from('logos').getPublicUrl(path);
    await onUpdate(club.id, { logo_url: `${data.publicUrl}?t=${Date.now()}` });
    toast.success('Vereinslogo hochgeladen');
  };
  return (
    <>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
      <button
        onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
        className="flex-shrink-0 h-8 w-8 rounded-md overflow-hidden border border-border hover:border-primary transition-colors flex items-center justify-center bg-background"
        title="Vereinslogo hochladen"
      >
        {club.logo_url ? (
          <img src={club.logo_url} alt="Logo" className="h-full w-full object-contain" />
        ) : (
          <ImagePlus className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>
    </>
  );
}

function ClubDetailsSection({ club, onUpdate, canEdit = true }: { club: Club; onUpdate?: Props['onUpdateClub']; canEdit?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    chairman: club.chairman, admin: club.admin || '', street: club.street, house_number: club.house_number,
    postal_code: club.postal_code, city: club.city, phone: club.phone, email: club.email, website: club.website,
  });

  const handleSave = async () => {
    if (!onUpdate) return;
    await onUpdate(club.id, form);
    setEditing(false);
    toast.success('Vereinsdaten gespeichert');
  };

  const handleCancel = () => {
    setForm({ chairman: club.chairman, admin: club.admin || '', street: club.street, house_number: club.house_number,
      postal_code: club.postal_code, city: club.city, phone: club.phone, email: club.email, website: club.website });
    setEditing(false);
  };

  const hasData = club.chairman || club.admin || club.street || club.city || club.phone || club.email || club.website;

  if (!editing) {
    return (
      <div className="space-y-2 mb-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Vereinsdaten</span>
          {onUpdate && canEdit && (
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)} className="h-6 px-2 text-xs">
              <Pencil className="h-3 w-3 mr-1" /> Bearbeiten
            </Button>
          )}
        </div>
        {hasData ? (
          <div className="grid gap-1.5 text-sm">
            {club.chairman && <div className="flex items-center gap-2 text-xs"><UserCheck className="h-3 w-3 text-muted-foreground flex-shrink-0" /><span>Vorsitzender: {club.chairman}</span></div>}
            {club.admin && <div className="flex items-center gap-2 text-xs"><UserCheck className="h-3 w-3 text-muted-foreground flex-shrink-0" /><span>Administrator: {club.admin}</span></div>}
            {(club.street || club.city) && <div className="flex items-center gap-2 text-xs"><MapPin className="h-3 w-3 text-muted-foreground flex-shrink-0" /><span>{club.street && `${club.street} ${club.house_number}`.trim()}{club.street && club.city ? ', ' : ''}{club.postal_code && `${club.postal_code} `}{club.city}</span></div>}
            {club.phone && <div className="flex items-center gap-2 text-xs"><Phone className="h-3 w-3 text-muted-foreground flex-shrink-0" /><span>{club.phone}</span></div>}
            {club.email && <div className="flex items-center gap-2 text-xs"><Mail className="h-3 w-3 text-muted-foreground flex-shrink-0" /><span>{club.email}</span></div>}
            {club.website && <div className="flex items-center gap-2 text-xs"><Globe className="h-3 w-3 text-muted-foreground flex-shrink-0" /><a href={club.website.startsWith('http') ? club.website : `https://${club.website}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{club.website}</a></div>}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">Keine Vereinsdaten hinterlegt</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2 mb-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Vereinsdaten bearbeiten</span>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={handleCancel} className="h-6 px-2 text-xs"><X className="h-3 w-3 mr-1" /> Abbrechen</Button>
          <Button size="sm" onClick={handleSave} className="h-6 px-2 text-xs"><Save className="h-3 w-3 mr-1" /> Speichern</Button>
        </div>
      </div>
      <div className="grid gap-2">
        <Input placeholder="Vereinsvorsitzender" value={form.chairman} onChange={e => setForm(f => ({ ...f, chairman: e.target.value }))} className="h-8 text-xs" />
        <Input placeholder="Administrator" value={form.admin} onChange={e => setForm(f => ({ ...f, admin: e.target.value }))} className="h-8 text-xs" />
        <div className="grid grid-cols-[1fr_80px] gap-2">
          <Input placeholder="Straße" value={form.street} onChange={e => setForm(f => ({ ...f, street: e.target.value }))} className="h-8 text-xs" />
          <Input placeholder="Nr." value={form.house_number} onChange={e => setForm(f => ({ ...f, house_number: e.target.value }))} className="h-8 text-xs" />
        </div>
        <div className="grid grid-cols-[100px_1fr] gap-2">
          <Input placeholder="PLZ" value={form.postal_code} onChange={e => setForm(f => ({ ...f, postal_code: e.target.value }))} className="h-8 text-xs" />
          <Input placeholder="Ort" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} className="h-8 text-xs" />
        </div>
        <Input placeholder="Telefon" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="h-8 text-xs" />
        <Input placeholder="E-Mail" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="h-8 text-xs" />
        <Input placeholder="Website" value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} className="h-8 text-xs" />
      </div>
    </div>
  );
}

function formatGender(g: string): string {
  if (g === 'm') return 'männlich';
  if (g === 'w') return 'weiblich';
  if (g === 'd') return 'divers';
  return '';
}

function parseGender(value: string): string {
  const v = value.toLowerCase().trim();
  if (v === 'm' || v === 'männlich' || v === 'maennlich' || v === 'male') return 'm';
  if (v === 'w' || v === 'weiblich' || v === 'female') return 'w';
  if (v === 'd' || v === 'divers' || v === 'diverse') return 'd';
  return '';
}

function parseDateDE(value: string): string | null {
  if (!value.trim()) return null;
  const deParts = value.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (deParts) return `${deParts[3]}-${deParts[2].padStart(2, '0')}-${deParts[1].padStart(2, '0')}`;
  const isoParts = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoParts) return value.trim();
  return null;
}

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function buildCsv(clubName: string, players: ClubPlayer[]): string {
  const header = 'Verein;Name;Geschlecht;Geburtsdatum;TTR;Straße;Hausnummer;PLZ;Ort;Telefon';
  const rows = players.length === 0
    ? [`${clubName};;;;;;;;;`]
    : players.map(p => {
        const bd = p.birthDate ? new Date(p.birthDate).toLocaleDateString('de-DE') : '';
        return `${clubName};${p.name};${formatGender(p.gender)};${bd};${p.ttr};${p.street || ''};${p.houseNumber || ''};${p.postalCode || ''};${p.city || ''};${p.phone || ''}`;
      });
  return [header, ...rows].join('\n');
}

interface CsvParsedPlayer {
  clubName: string;
  name: string;
  gender: string;
  birthDate: string | null;
  ttr: number;
  postalCode: string;
  city: string;
  street: string;
  houseNumber: string;
  phone: string;
}

function parseCsvForClubPlayers(text: string): CsvParsedPlayer[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const sep = lines[0].includes(';') ? ';' : ',';
  const result: CsvParsedPlayer[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(sep).map(c => c.trim());
    const clubName = cols[0] || '';
    const playerName = cols[1] || '';
    if (!clubName || !playerName) continue;
    result.push({
      clubName,
      name: playerName,
      gender: parseGender(cols[2] || ''),
      birthDate: parseDateDE(cols[3] || ''),
      ttr: parseInt(cols[4]) || 1000,
      street: cols[5] || '',
      houseNumber: cols[6] || '',
      postalCode: cols[7] || '',
      city: cols[8] || '',
      phone: cols[9] || '',
    });
  }
  return result;
}

function ConsentViewDialog({ url, name, playerId, onClose, onDelete }: {
  url: string | null;
  name: string;
  playerId: string | null;
  onClose: () => void;
  onDelete: () => void;
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const isImage = url ? /\.(jpg|jpeg|png|webp)(\?|$)/i.test(url) : false;

  useEffect(() => {
    if (!url || isImage) { setBlobUrl(null); return; }
    let revoked = false;
    setLoading(true);
    fetch(url)
      .then(res => res.blob())
      .then(blob => {
        if (revoked) return;
        const objUrl = URL.createObjectURL(blob);
        setBlobUrl(objUrl);
      })
      .catch(() => setBlobUrl(null))
      .finally(() => setLoading(false));
    return () => { revoked = true; if (blobUrl) URL.revokeObjectURL(blobUrl); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, isImage]);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => { if (blobUrl) URL.revokeObjectURL(blobUrl); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Dialog open={!!url} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Fotoerlaubnis — {name}</DialogTitle>
        </DialogHeader>
        {url && (
          isImage ? (
            <img src={url} alt="Fotoerlaubnis" className="w-full h-auto rounded" />
          ) : loading ? (
            <div className="flex items-center justify-center h-[70vh] text-muted-foreground">Dokument wird geladen…</div>
          ) : blobUrl ? (
            <iframe src={blobUrl} className="w-full h-[70vh] rounded border-0" title="Fotoerlaubnis" />
          ) : (
            <div className="flex flex-col items-center justify-center h-[40vh] gap-3 text-muted-foreground">
              <p>Das Dokument konnte nicht angezeigt werden.</p>
              <a href={url} download className="text-primary hover:underline text-sm">Dokument herunterladen</a>
            </div>
          )
        )}
        <div className="flex justify-end">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" className="gap-1">
                <Trash2 className="h-3.5 w-3.5" /> Dokument löschen
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Fotoerlaubnis löschen?</AlertDialogTitle>
                <AlertDialogDescription>
                  Das hinterlegte Dokument von <strong>{name}</strong> wird unwiderruflich gelöscht. Der Fotoerlaubnis-Status wird zurückgesetzt.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={onDelete}
                >
                  Löschen
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ClubPlayersManager({ clubs, clubPlayers, onAddClub, onRemoveClub, onUpdateClub, onAddPlayer, onUpdatePlayer, onRemovePlayer, getPlayersForClub }: Props) {
  const { canManageClub, isAuthenticated } = useClubAuthority();
  const [clubName, setClubName] = useState('');
  const [addingClub, setAddingClub] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const consentFileRef = useRef<HTMLInputElement>(null);
  const [uploadingConsentFor, setUploadingConsentFor] = useState<string | null>(null);
  const [openClubs, setOpenClubs] = useState<Set<string>>(new Set());
  const [addingPlayerFor, setAddingPlayerFor] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<ClubPlayer>>({});
  const [consentViewUrl, setConsentViewUrl] = useState<string | null>(null);
  const [consentViewName, setConsentViewName] = useState<string>('');
  const [consentViewPlayerId, setConsentViewPlayerId] = useState<string | null>(null);

  // New player form state
  const [pName, setPName] = useState('');
  const [pGender, setPGender] = useState('');
  const [pBirthDate, setPBirthDate] = useState('');
  const [pTtr, setPTtr] = useState('');
  const [pPostalCode, setPPostalCode] = useState('');
  const [pCity, setPCity] = useState('');
  const [pStreet, setPStreet] = useState('');
  const [pHouseNumber, setPHouseNumber] = useState('');
  const [pPhone, setPPhone] = useState('');
  const [pEmail, setPEmail] = useState('');
  const [pPhotoConsent, setPPhotoConsent] = useState(false);
  const [pRole, setPRole] = useState<'player' | 'chairman' | 'admin'>('player');

  const handleAddClub = async () => {
    if (!clubName.trim()) return;
    setAddingClub(true);
    const club = await onAddClub(clubName.trim());
    if (club) {
      setOpenClubs(prev => new Set(prev).add(club.id));
    }
    setClubName('');
    setAddingClub(false);
  };

  const resetPlayerForm = () => {
    setPName(''); setPGender(''); setPBirthDate(''); setPTtr('');
    setPPostalCode(''); setPCity(''); setPStreet(''); setPHouseNumber(''); setPPhone('');
    setPEmail(''); setPPhotoConsent(false); setPRole('player');
  };

  const handleAddPlayer = async (clubId: string) => {
    if (!pName.trim()) return;
    const created = await onAddPlayer(clubId, pName.trim(), pGender, pBirthDate || null, parseInt(pTtr) || 1000, pPostalCode, pCity, pStreet, pHouseNumber, pPhone, pEmail, pPhotoConsent);
    if (created && pRole !== 'player') {
      onUpdatePlayer(created.id, { role: pRole });
    }
    resetPlayerForm();
    setAddingPlayerFor(null);
  };

  const startEdit = (player: ClubPlayer) => {
    setEditingId(player.id);
    setEditData({ ...player });
  };

  const saveEdit = () => {
    if (!editingId || !editData.name?.trim()) return;
    onUpdatePlayer(editingId, {
      name: editData.name.trim(),
      gender: editData.gender || '',
      birthDate: editData.birthDate || null,
      ttr: editData.ttr ?? 1000,
      postalCode: editData.postalCode || '',
      city: editData.city || '',
      street: editData.street || '',
      houseNumber: editData.houseNumber || '',
      phone: editData.phone || '',
      email: editData.email || '',
      photoConsent: editData.photoConsent ?? false,
      role: (editData.role as ClubPlayer['role']) || 'player',
    });
    setEditingId(null);
    setEditData({});
  };

  const toggleClub = (clubId: string) => {
    setOpenClubs(prev => {
      const next = new Set(prev);
      next.has(clubId) ? next.delete(clubId) : next.add(clubId);
      return next;
    });
  };

  const handleConsentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingConsentFor) return;
    try {
      const ext = file.name.split('.').pop() || 'pdf';
      const path = `consent-${uploadingConsentFor}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('consent-documents').upload(path, file);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('consent-documents').getPublicUrl(path);
      onUpdatePlayer(uploadingConsentFor, { photoConsentUrl: urlData.publicUrl, photoConsent: true });
      toast.success('Fotoerlaubnis-Dokument hochgeladen');
    } catch (error) {
      console.error('Error uploading consent document:', error);
      toast.error('Fehler beim Hochladen');
    } finally {
      setUploadingConsentFor(null);
      if (consentFileRef.current) consentFileRef.current.value = '';
    }
  };

  const handleExportAll = () => {
    if (clubs.length === 0) { toast.error('Keine Vereine zum Exportieren'); return; }
    for (const club of clubs) {
      const players = getPlayersForClub(club.id);
      const csv = buildCsv(club.name, players);
      const safeName = club.name.replace(/[^a-zA-Z0-9äöüÄÖÜß _-]/g, '_');
      downloadCsv(csv, `${safeName}.csv`);
    }
    toast.success(`${clubs.length} Vereine exportiert`);
  };

  const handleExportClub = (club: Club) => {
    const players = getPlayersForClub(club.id);
    const csv = buildCsv(club.name, players);
    const safeName = club.name.replace(/[^a-zA-Z0-9äöüÄÖÜß _-]/g, '_');
    downloadCsv(csv, `${safeName}.csv`);
    toast.success(`${club.name} exportiert (${players.length} Spieler)`);
  };

  const handleImportCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const parsed = parseCsvForClubPlayers(text);
    if (parsed.length === 0) { toast.error('Keine gültigen Daten gefunden'); return; }

    // Group by club
    const byClub = new Map<string, CsvParsedPlayer[]>();
    for (const p of parsed) {
      if (!byClub.has(p.clubName)) byClub.set(p.clubName, []);
      byClub.get(p.clubName)!.push(p);
    }

    let importedCount = 0;
    for (const [cName, players] of byClub) {
      let club = clubs.find(c => c.name.toLowerCase() === cName.toLowerCase());
      if (!club) {
        club = await onAddClub(cName) || undefined;
      }
      if (!club) continue;
      for (const p of players) {
        await onAddPlayer(club.id, p.name, p.gender, p.birthDate, p.ttr, p.postalCode, p.city, p.street, p.houseNumber, p.phone, '', false);
        importedCount++;
      }
    }
    toast.success(`${importedCount} Spieler aus ${byClub.size} Vereinen importiert`);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-4 animate-slide-up">
      <div className="flex gap-2">
        <Input
          placeholder="Neuen Verein hinzufügen..."
          value={clubName}
          onChange={e => setClubName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAddClub()}
          className="h-10 text-base bg-secondary border-border"
        />
        <Button onClick={handleAddClub} disabled={!clubName.trim() || addingClub} size="sm" className="h-10 px-3">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={handleExportAll} className="text-xs gap-1" disabled={clubs.length === 0}>
          <Download className="h-3 w-3" /> Alle exportieren
        </Button>
        <input ref={fileInputRef} type="file" accept=".csv,.txt" onChange={handleImportCsv} className="hidden" />
        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="text-xs gap-1">
          <Upload className="h-3 w-3" /> CSV importieren
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-xs gap-1"
          disabled={clubPlayers.filter(p => !p.photoConsent).length === 0}
          onClick={() => {
            const withoutConsent = clubPlayers.filter(p => !p.photoConsent);
            if (withoutConsent.length === 0) { toast.info('Alle Spieler haben bereits eine Fotoerlaubnis'); return; }
            printGeneralPhotoConsentPdf(withoutConsent.map(p => ({ name: p.name, club: p.clubName, birthDate: p.birthDate })));
            toast.success(`PDF mit ${withoutConsent.length} Formularen erstellt`);
          }}
        >
          <FileText className="h-3 w-3" /> Fotoerlaubnis PDF
        </Button>
      </div>

      <div className="space-y-1">
        {clubs.length === 0 && (
          <p className="text-center text-muted-foreground py-4 text-sm">Noch keine Vereine vorhanden</p>
        )}
        {clubs.map(club => {
          const players = getPlayersForClub(club.id);
          const isOpen = openClubs.has(club.id);
          const canManage = canManageClub(club.id);

          return (
            <Collapsible key={club.id} open={isOpen} onOpenChange={() => toggleClub(club.id)}>
              <div className="bg-secondary rounded-lg">
                <div className="flex items-center justify-between px-3 py-2">
                  <CollapsibleTrigger asChild>
                    <button className="flex items-center gap-2 flex-1 text-left hover:opacity-80 transition-opacity">
                      {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                      {club.logo_url ? (
                        <img src={club.logo_url} alt="" className="h-5 w-5 object-contain flex-shrink-0 rounded" />
                      ) : (
                        <Building2 className="h-4 w-4 text-primary" />
                      )}
                      <span className="text-sm font-medium">{club.name}</span>
                      <span className="text-xs text-muted-foreground ml-1">({players.length} Spieler)</span>
                      {!canManage && isAuthenticated && (
                        <Lock className="h-3 w-3 text-muted-foreground ml-1" aria-label="Nur Lesezugriff – Vorsitz/Admin erforderlich" />
                      )}
                    </button>
                  </CollapsibleTrigger>
                  <div className="flex items-center gap-1">
                    {canManage && <ClubLogoUpload club={club} onUpdate={onUpdateClub} />}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => { e.stopPropagation(); handleExportClub(club); }}
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      title="Verein exportieren"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    {canManage && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => { e.stopPropagation(); setAddingPlayerFor(addingPlayerFor === club.id ? null : club.id); resetPlayerForm(); }}
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        title="Spieler hinzufügen"
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {canManage && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Verein löschen?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Möchtest du <strong>{club.name}</strong> und alle zugehörigen Spieler wirklich löschen?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                            <AlertDialogAction onClick={() => onRemoveClub(club.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              Löschen
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>

                <CollapsibleContent>
                  <div className="px-3 pb-3 pt-1 border-t border-border/50 mx-2">
                    <ClubDetailsSection club={club} onUpdate={onUpdateClub} canEdit={canManage} />
                    {!canManage && isAuthenticated && (
                      <div className="mb-3 px-3 py-2 rounded-md bg-muted/50 text-xs text-muted-foreground flex items-center gap-2">
                        <Lock className="h-3.5 w-3.5" />
                        <span>Nur <strong>Vorsitz</strong> oder <strong>Admin</strong> dieses Vereins können Daten und Spielerrollen bearbeiten.</span>
                      </div>
                    )}
                    {/* Add player form */}
                    {addingPlayerFor === club.id && (
                      <div className="space-y-2 mb-3 p-2 bg-background/60 rounded-md">
                        <Input placeholder="Spielername *" value={pName} onChange={e => setPName(e.target.value)} className="h-9 text-sm bg-secondary" />
                        <div className="flex gap-2">
                          <Select value={pGender} onValueChange={setPGender}>
                            <SelectTrigger className="h-9 text-sm bg-secondary w-28"><SelectValue placeholder="Geschl." /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="m">Männlich</SelectItem>
                              <SelectItem value="w">Weiblich</SelectItem>
                              <SelectItem value="d">Divers</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input type="date" value={pBirthDate} onChange={e => setPBirthDate(e.target.value)} className="h-9 text-sm bg-secondary flex-1" />
                          <Input type="number" placeholder="TTR" value={pTtr} onChange={e => setPTtr(e.target.value)} className="h-9 text-sm bg-secondary w-20" />
                        </div>
                        <div className="flex gap-2">
                          <Input placeholder="Straße" value={pStreet} onChange={e => setPStreet(e.target.value)} className="h-9 text-sm bg-secondary flex-1" />
                          <Input placeholder="Nr." value={pHouseNumber} onChange={e => setPHouseNumber(e.target.value)} className="h-9 text-sm bg-secondary w-16" />
                        </div>
                        <div className="flex gap-2">
                          <Input placeholder="PLZ" value={pPostalCode} onChange={e => setPPostalCode(e.target.value)} className="h-9 text-sm bg-secondary w-24" />
                          <Input placeholder="Ort" value={pCity} onChange={e => setPCity(e.target.value)} className="h-9 text-sm bg-secondary flex-1" />
                        </div>
                        <Input placeholder="Telefon" type="tel" value={pPhone} onChange={e => setPPhone(e.target.value)} className="h-9 text-sm bg-secondary" />
                        <Input placeholder="E-Mail" type="email" value={pEmail} onChange={e => setPEmail(e.target.value)} className="h-9 text-sm bg-secondary" />
                        <div className="flex items-center gap-2">
                          <Checkbox id={`photo-consent-new-${club.id}`} checked={pPhotoConsent} onCheckedChange={(v) => setPPhotoConsent(v === true)} />
                          <label htmlFor={`photo-consent-new-${club.id}`} className="text-sm text-muted-foreground cursor-pointer">Fotoerlaubnis erteilt</label>
                        </div>
                        <Select value={pRole} onValueChange={(v) => setPRole(v as 'player' | 'chairman' | 'admin')}>
                          <SelectTrigger className="h-9 text-sm bg-secondary"><SelectValue placeholder="Rolle" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="player">Spieler</SelectItem>
                            <SelectItem value="chairman">Vorsitz</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="flex gap-2">
                          <Button size="sm" className="flex-1 h-9" onClick={() => handleAddPlayer(club.id)} disabled={!pName.trim()}>
                            <UserPlus className="mr-1 h-3.5 w-3.5" /> Hinzufügen
                          </Button>
                          <Button variant="ghost" size="sm" className="h-9" onClick={() => { setAddingPlayerFor(null); resetPlayerForm(); }}>
                            Abbrechen
                          </Button>
                        </div>
                      </div>
                    )}

                    {players.length === 0 && addingPlayerFor !== club.id && (
                      <p className="text-xs text-muted-foreground py-2 text-center">Keine Spieler vorhanden</p>
                    )}
                    <div className="space-y-1.5 mt-1">
                      {players.map(player => (
                        <div key={player.id} className="flex items-start gap-2 bg-background/60 rounded-md px-2.5 py-2">
                          {editingId === player.id ? (
                            <div className="flex-1 space-y-2">
                              <Input value={editData.name || ''} onChange={e => setEditData(p => ({ ...p, name: e.target.value }))} className="h-8 text-sm bg-secondary" placeholder="Name" />
                              <div className="flex gap-2">
                                <Select value={editData.gender || ''} onValueChange={v => setEditData(p => ({ ...p, gender: v }))}>
                                  <SelectTrigger className="h-8 text-sm bg-secondary w-28"><SelectValue placeholder="Geschl." /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="m">Männlich</SelectItem>
                                    <SelectItem value="w">Weiblich</SelectItem>
                                    <SelectItem value="d">Divers</SelectItem>
                                  </SelectContent>
                                </Select>
                                <Input type="date" value={editData.birthDate || ''} onChange={e => setEditData(p => ({ ...p, birthDate: e.target.value }))} className="h-8 text-sm bg-secondary flex-1" />
                                <Input type="number" value={editData.ttr ?? ''} onChange={e => setEditData(p => ({ ...p, ttr: parseInt(e.target.value) || 0 }))} className="h-8 text-sm bg-secondary w-20" placeholder="TTR" />
                              </div>
                              <div className="flex gap-2">
                                <Input value={editData.street || ''} onChange={e => setEditData(p => ({ ...p, street: e.target.value }))} className="h-8 text-sm bg-secondary flex-1" placeholder="Straße" />
                                <Input value={editData.houseNumber || ''} onChange={e => setEditData(p => ({ ...p, houseNumber: e.target.value }))} className="h-8 text-sm bg-secondary w-16" placeholder="Nr." />
                              </div>
                              <div className="flex gap-2">
                                <Input value={editData.postalCode || ''} onChange={e => setEditData(p => ({ ...p, postalCode: e.target.value }))} className="h-8 text-sm bg-secondary w-24" placeholder="PLZ" />
                                <Input value={editData.city || ''} onChange={e => setEditData(p => ({ ...p, city: e.target.value }))} className="h-8 text-sm bg-secondary flex-1" placeholder="Ort" />
                              </div>
                              <Input type="tel" value={editData.phone || ''} onChange={e => setEditData(p => ({ ...p, phone: e.target.value }))} className="h-8 text-sm bg-secondary" placeholder="Telefon" />
                              <Input type="email" value={editData.email || ''} onChange={e => setEditData(p => ({ ...p, email: e.target.value }))} className="h-8 text-sm bg-secondary" placeholder="E-Mail" />
                              <div className="flex items-center gap-2">
                                <Checkbox id={`photo-consent-edit-${editingId}`} checked={editData.photoConsent ?? false} onCheckedChange={(v) => setEditData(p => ({ ...p, photoConsent: v === true }))} />
                                <label htmlFor={`photo-consent-edit-${editingId}`} className="text-sm text-muted-foreground cursor-pointer">Fotoerlaubnis erteilt</label>
                              </div>
                              <Select value={editData.role || 'player'} onValueChange={(v) => setEditData(p => ({ ...p, role: v as ClubPlayer['role'] }))}>
                                <SelectTrigger className="h-8 text-sm bg-secondary"><SelectValue placeholder="Rolle" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="player">Spieler</SelectItem>
                                  <SelectItem value="chairman">Vorsitz</SelectItem>
                                  <SelectItem value="admin">Admin</SelectItem>
                                </SelectContent>
                              </Select>
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="icon" onClick={() => { setEditingId(null); setEditData({}); }} className="h-7 w-7"><X className="h-3.5 w-3.5" /></Button>
                                <Button size="icon" onClick={saveEdit} className="h-7 w-7" disabled={!editData.name?.trim()}><Check className="h-3.5 w-3.5" /></Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <User className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium leading-tight">
                                  {player.name}
                                  {player.gender && (
                                    <span className="ml-1 text-xs text-muted-foreground">
                                      ({player.gender === 'm' ? '♂' : player.gender === 'w' ? '♀' : '⚧'})
                                    </span>
                                  )}
                                  {player.role && player.role !== 'player' && (
                                    <span className="ml-2 text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded bg-primary/15 text-primary">
                                      {player.role === 'chairman' ? 'Vorsitz' : 'Admin'}
                                    </span>
                                  )}
                                </p>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
                                  {player.birthDate && <span>{new Date(player.birthDate).toLocaleDateString('de-DE')}</span>}
                                  <span className="flex items-center gap-0.5"><Trophy className="h-3 w-3" /> {player.ttr}</span>
                                  {player.phone && <span className="flex items-center gap-0.5"><Phone className="h-3 w-3" /> {player.phone}</span>}
                                  {player.email && <span className="flex items-center gap-0.5"><Mail className="h-3 w-3" /> {player.email}</span>}
                                  <span className="flex items-center gap-0.5">
                                    <Camera className="h-3 w-3" /> {player.photoConsent ? '✓ Foto' : '✗ Foto'}
                                    {player.photoConsentUrl && (
                                      <button
                                        onClick={() => { setConsentViewUrl(player.photoConsentUrl); setConsentViewName(player.name); setConsentViewPlayerId(player.id); }}
                                        className="text-primary hover:underline ml-0.5 inline-flex"
                                        title="Scan anzeigen"
                                      >
                                        <ExternalLink className="h-3 w-3" />
                                      </button>
                                    )}
                                  </span>
                                </div>
                                {(player.street || player.city) && (
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {player.street && `${player.street} ${player.houseNumber}`.trim()}
                                    {player.street && player.city ? ', ' : ''}
                                    {player.postalCode && `${player.postalCode} `}{player.city}
                                  </p>
                                )}
                              </div>
                              {canManage && (
                                <div className="flex items-center gap-0.5">
                                  <VoiceRecorder
                                    playerId={player.id}
                                    playerName={player.name}
                                    voiceNameUrl={player.voiceNameUrl}
                                    onSaved={(url) => onUpdatePlayer(player.id, { voiceNameUrl: url })}
                                    storagePrefix="voice-names-club"
                                  />
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => { setUploadingConsentFor(player.id); consentFileRef.current?.click(); }}
                                    className={`h-7 w-7 ${player.photoConsentUrl ? 'text-green-600' : 'text-muted-foreground'} hover:text-foreground`}
                                    title={player.photoConsentUrl ? 'Fotoerlaubnis-Scan ersetzen' : 'Fotoerlaubnis-Scan hochladen'}
                                  >
                                    <Paperclip className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => startEdit(player)} className="h-7 w-7 text-muted-foreground hover:text-foreground">
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10">
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Spieler entfernen?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Möchtest du <strong>{player.name}</strong> wirklich aus dem Verein entfernen?
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => onRemovePlayer(player.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                          Entfernen
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}
      </div>
      <input
        ref={consentFileRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp"
        onChange={handleConsentUpload}
        className="hidden"
      />
      <ConsentDocumentDialog
        url={consentViewUrl}
        name={consentViewName}
        onClose={() => { setConsentViewUrl(null); setConsentViewName(''); setConsentViewPlayerId(null); }}
        onDelete={async () => {
          if (!consentViewPlayerId || !consentViewUrl) return;
          try {
            const match = consentViewUrl.match(/consent-documents\/(.+?)(\?|$)/);
            if (match) {
              await supabase.storage.from('consent-documents').remove([match[1]]);
            }
            onUpdatePlayer(consentViewPlayerId, { photoConsentUrl: null, photoConsent: false });
            toast.success('Fotoerlaubnis-Dokument gelöscht');
          } catch (error) {
            console.error('Error deleting consent document:', error);
            toast.error('Fehler beim Löschen');
          }
          setConsentViewUrl(null);
          setConsentViewName('');
          setConsentViewPlayerId(null);
        }}
      />
    </div>
  );
}
