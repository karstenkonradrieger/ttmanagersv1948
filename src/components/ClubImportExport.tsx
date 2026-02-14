import { useRef } from 'react';
import { Club } from '@/hooks/useClubs';
import { Player } from '@/types/tournament';
import { Button } from '@/components/ui/button';
import { Download, Upload } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  clubs: Club[];
  players: Player[];
  onImport: (data: Array<{ clubName: string; players: Array<{ name: string; club: string; ttr: number; gender: string; birthDate: string | null; postalCode: string; city: string; street: string; houseNumber: string; phone: string }> }>) => void;
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
  if (deParts) {
    return `${deParts[3]}-${deParts[2].padStart(2, '0')}-${deParts[1].padStart(2, '0')}`;
  }
  const isoParts = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoParts) return value.trim();
  return null;
}

function exportSingleClubCsv(clubName: string, players: Player[]): string {
  const header = 'Verein;Name;Geschlecht;Geburtsdatum;TTR;Straße;Hausnummer;PLZ;Ort;Telefon';
  const clubPlayers = players.filter(p => p.club === clubName);
  const rows: string[] = [];

  if (clubPlayers.length === 0) {
    rows.push(`${clubName};;;;;;;;;`);
  } else {
    for (const p of clubPlayers) {
      const bd = p.birthDate ? new Date(p.birthDate).toLocaleDateString('de-DE') : '';
      rows.push(`${clubName};${p.name};${formatGender(p.gender)};${bd};${p.ttr};${p.street || ''};${p.houseNumber || ''};${p.postalCode || ''};${p.city || ''};${p.phone || ''}`);
    }
  }

  return [header, ...rows].join('\n');
}

export function parseCsv(text: string): Array<{ clubName: string; players: Array<{ name: string; club: string; ttr: number; gender: string; birthDate: string | null; postalCode: string; city: string; street: string; houseNumber: string; phone: string }> }> {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  const sep = lines[0].includes(';') ? ';' : ',';

  const clubMap = new Map<string, Array<{ name: string; club: string; ttr: number; gender: string; birthDate: string | null; postalCode: string; city: string; street: string; houseNumber: string; phone: string }>>();

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(sep).map(c => c.trim());
    const clubName = cols[0] || '';
    if (!clubName) continue;

    if (!clubMap.has(clubName)) {
      clubMap.set(clubName, []);
    }

    const playerName = cols[1] || '';
    if (playerName) {
      clubMap.get(clubName)!.push({
        name: playerName,
        club: clubName,
        gender: parseGender(cols[2] || ''),
        birthDate: parseDateDE(cols[3] || ''),
        ttr: parseInt(cols[4]) || 0,
        street: cols[5] || '',
        houseNumber: cols[6] || '',
        postalCode: cols[7] || '',
        city: cols[8] || '',
        phone: cols[9] || '',
      });
    }
  }

  return Array.from(clubMap.entries()).map(([clubName, players]) => ({ clubName, players }));
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

export function exportClubCsv(clubName: string, players: Player[]) {
  const csv = exportSingleClubCsv(clubName, players);
  const safeName = clubName.replace(/[^a-zA-Z0-9äöüÄÖÜß _-]/g, '_');
  downloadCsv(csv, `${safeName}.csv`);
  const count = players.filter(p => p.club === clubName).length;
  toast.success(`${clubName} exportiert (${count} Spieler)`);
}

export function ClubImportExport({ clubs, players, onImport }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportAll = () => {
    if (clubs.length === 0) {
      toast.error('Keine Vereine zum Exportieren');
      return;
    }
    // Export each club as separate file
    for (const club of clubs) {
      exportClubCsv(club.name, players);
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
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
      toast.success(`${parsed.length} Vereine mit ${totalPlayers} Spielern importiert`);
    };
    reader.readAsText(file);

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={handleExportAll} className="text-xs">
        <Download className="mr-1 h-3 w-3" />
        Alle exportieren
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.txt"
        onChange={handleImport}
        className="hidden"
      />
      <Button
        variant="outline"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        className="text-xs"
      >
        <Upload className="mr-1 h-3 w-3" />
        Import CSV
      </Button>
    </div>
  );
}
