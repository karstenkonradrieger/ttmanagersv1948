import { useState, useRef } from 'react';
import { Club } from '@/hooks/useClubs';
import { Player } from '@/types/tournament';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ClubImportExport, exportClubCsv, parseCsv } from '@/components/ClubImportExport';
import { Building2, Plus, Trash2, ChevronDown, ChevronRight, User, Trophy, Phone, Download, Upload, MapPin, Globe, Mail, UserCheck, ImagePlus, Pencil, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useClubAuthority } from '@/hooks/useClubAuthority';
import { Lock } from 'lucide-react';

interface Props {
  clubs: Club[];
  players?: Player[];
  onAdd: (name: string) => Promise<Club | null>;
  onRemove: (id: string) => void;
  onUpdate?: (id: string, updates: Partial<Omit<Club, 'id'>>) => Promise<void>;
  onImportClubsWithPlayers?: (data: Array<{ clubName: string; players: Array<{ name: string; club: string; ttr: number; gender: string; birthDate: string | null; postalCode: string; city: string; street: string; houseNumber: string; phone: string }> }>) => void;
}

function ClubImportButton({ clubName, onImport }: { clubName: string; onImport?: Props['onImportClubsWithPlayers'] }) {
  const ref = useRef<HTMLInputElement>(null);
  if (!onImport) return null;

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCsv(text);
      if (parsed.length === 0) {
        toast.error('Keine gültigen Daten gefunden');
        return;
      }
      onImport(parsed);
      const totalPlayers = parsed.reduce((sum, c) => sum + c.players.length, 0);
      toast.success(`${totalPlayers} Spieler importiert`);
    };
    reader.readAsText(file);
    if (ref.current) ref.current.value = '';
  };

  return (
    <>
      <input ref={ref} type="file" accept=".csv,.txt" onChange={handleFile} className="hidden" />
      <Button
        variant="ghost"
        size="icon"
        onClick={(e) => { e.stopPropagation(); ref.current?.click(); }}
        className="h-7 w-7 text-muted-foreground hover:text-foreground"
        title={`Spieler für ${clubName} importieren`}
      >
        <Upload className="h-3.5 w-3.5" />
      </Button>
    </>
  );
}

function ClubLogoUpload({ club, onUpdate }: { club: Club; onUpdate?: Props['onUpdate'] }) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onUpdate) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Bitte nur Bilddateien hochladen');
      return;
    }
    const ext = file.name.split('.').pop();
    const path = `clubs/${club.id}/logo.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from('logos')
      .upload(path, file, { upsert: true });
    if (uploadError) {
      toast.error('Fehler beim Hochladen des Logos');
      return;
    }
    const { data } = supabase.storage.from('logos').getPublicUrl(path);
    const url = `${data.publicUrl}?t=${Date.now()}`;
    await onUpdate(club.id, { logo_url: url });
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

function ClubDetails({ club, onUpdate, canEdit = true }: { club: Club; onUpdate?: Props['onUpdate']; canEdit?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    chairman: club.chairman,
    admin: club.admin || '',
    street: club.street,
    house_number: club.house_number,
    postal_code: club.postal_code,
    city: club.city,
    phone: club.phone,
    email: club.email,
    website: club.website,
  });

  const handleSave = async () => {
    if (!onUpdate) return;
    await onUpdate(club.id, form);
    setEditing(false);
    toast.success('Vereinsdaten gespeichert');
  };

  const handleCancel = () => {
    setForm({
      chairman: club.chairman,
      admin: club.admin || '',
      street: club.street,
      house_number: club.house_number,
      postal_code: club.postal_code,
      city: club.city,
      phone: club.phone,
      email: club.email,
      website: club.website,
    });
    setEditing(false);
  };

  const hasData = club.chairman || club.admin || club.street || club.city || club.phone || club.email || club.website;

  if (!editing) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Vereinsdaten</span>
          {onUpdate && canEdit && (
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)} className="h-6 px-2 text-xs">
              <Pencil className="h-3 w-3 mr-1" />
              Bearbeiten
            </Button>
          )}
        </div>
        {hasData ? (
          <div className="grid gap-1.5 text-sm">
            {club.chairman && (
              <div className="flex items-center gap-2 text-xs">
                <UserCheck className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                <span>Vorsitzender: {club.chairman}</span>
              </div>
            )}
            {club.admin && (
              <div className="flex items-center gap-2 text-xs">
                <UserCheck className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                <span>Administrator: {club.admin}</span>
              </div>
            )}
            {(club.street || club.city) && (
              <div className="flex items-center gap-2 text-xs">
                <MapPin className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                <span>
                  {club.street && `${club.street} ${club.house_number}`.trim()}
                  {club.street && club.city ? ', ' : ''}
                  {club.postal_code && `${club.postal_code} `}{club.city}
                </span>
              </div>
            )}
            {club.phone && (
              <div className="flex items-center gap-2 text-xs">
                <Phone className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                <span>{club.phone}</span>
              </div>
            )}
            {club.email && (
              <div className="flex items-center gap-2 text-xs">
                <Mail className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                <span>{club.email}</span>
              </div>
            )}
            {club.website && (
              <div className="flex items-center gap-2 text-xs">
                <Globe className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                <a href={club.website.startsWith('http') ? club.website : `https://${club.website}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  {club.website}
                </a>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">Keine Vereinsdaten hinterlegt</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Vereinsdaten bearbeiten</span>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={handleCancel} className="h-6 px-2 text-xs">
            <X className="h-3 w-3 mr-1" />
            Abbrechen
          </Button>
          <Button size="sm" onClick={handleSave} className="h-6 px-2 text-xs">
            <Save className="h-3 w-3 mr-1" />
            Speichern
          </Button>
        </div>
      </div>
      <div className="grid gap-2">
        <Input
          placeholder="Vereinsvorsitzender"
          value={form.chairman}
          onChange={e => setForm(f => ({ ...f, chairman: e.target.value }))}
          className="h-8 text-xs"
        />
        <Input
          placeholder="Administrator"
          value={form.admin}
          onChange={e => setForm(f => ({ ...f, admin: e.target.value }))}
          className="h-8 text-xs"
        />
        <div className="grid grid-cols-[1fr_80px] gap-2">
          <Input
            placeholder="Straße"
            value={form.street}
            onChange={e => setForm(f => ({ ...f, street: e.target.value }))}
            className="h-8 text-xs"
          />
          <Input
            placeholder="Nr."
            value={form.house_number}
            onChange={e => setForm(f => ({ ...f, house_number: e.target.value }))}
            className="h-8 text-xs"
          />
        </div>
        <div className="grid grid-cols-[100px_1fr] gap-2">
          <Input
            placeholder="PLZ"
            value={form.postal_code}
            onChange={e => setForm(f => ({ ...f, postal_code: e.target.value }))}
            className="h-8 text-xs"
          />
          <Input
            placeholder="Ort"
            value={form.city}
            onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
            className="h-8 text-xs"
          />
        </div>
        <Input
          placeholder="Telefon"
          value={form.phone}
          onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
          className="h-8 text-xs"
        />
        <Input
          placeholder="E-Mail"
          value={form.email}
          onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
          className="h-8 text-xs"
        />
        <Input
          placeholder="Website"
          value={form.website}
          onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
          className="h-8 text-xs"
        />
      </div>
    </div>
  );
}

export function ClubManager({ clubs, players = [], onAdd, onRemove, onUpdate, onImportClubsWithPlayers }: Props) {
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

      {onImportClubsWithPlayers && (
        <ClubImportExport
          clubs={clubs}
          players={players}
          onImport={onImportClubsWithPlayers}
        />
      )}

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
                      {club.logo_url ? (
                        <img src={club.logo_url} alt="" className="h-5 w-5 object-contain flex-shrink-0 rounded" />
                      ) : (
                        <Building2 className="h-4 w-4 text-primary flex-shrink-0" />
                      )}
                      <span className="text-sm font-medium">{club.name}</span>
                      <span className="text-xs text-muted-foreground ml-1">
                        ({clubPlayers.length} Spieler)
                      </span>
                    </button>
                  </CollapsibleTrigger>
                  <div className="flex items-center gap-1">
                    <ClubLogoUpload club={club} onUpdate={onUpdate} />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => { e.stopPropagation(); exportClubCsv(club.name, players); }}
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      title="Verein exportieren"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    <ClubImportButton clubName={club.name} onImport={onImportClubsWithPlayers} />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onRemove(club.id)}
                      className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <CollapsibleContent>
                  <div className="px-3 pb-3 pt-1 border-t border-border/50 mx-2 space-y-3">
                    <ClubDetails club={club} onUpdate={onUpdate} />
                    
                    <div>
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Spieler ({clubPlayers.length})
                      </span>
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
