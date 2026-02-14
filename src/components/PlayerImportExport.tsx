import { useRef } from 'react';
import { Player } from '@/types/tournament';
import { Button } from '@/components/ui/button';
import { Download, Upload } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  players: Player[];
  onImport: (players: Array<{ name: string; club: string; ttr: number; gender: string; birthDate: string | null; postalCode?: string; city?: string; street?: string; houseNumber?: string; phone?: string }>) => void;
  started: boolean;
}

function exportPlayersCsv(players: Player[]) {
  const header = 'Name;Verein;Geschlecht;Geburtsdatum;TTR;Straße;Hausnummer;PLZ;Ort;Telefon';
  const rows = players.map(p => {
    const genderLabel = p.gender === 'm' ? 'männlich' : p.gender === 'w' ? 'weiblich' : p.gender === 'd' ? 'divers' : '';
    const bd = p.birthDate ? new Date(p.birthDate).toLocaleDateString('de-DE') : '';
    return `${p.name};${p.club};${genderLabel};${bd};${p.ttr};${p.street || ''};${p.houseNumber || ''};${p.postalCode || ''};${p.city || ''};${p.phone || ''}`;
  });
  return [header, ...rows].join('\n');
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
  // Try DD.MM.YYYY
  const deParts = value.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (deParts) {
    return `${deParts[3]}-${deParts[2].padStart(2, '0')}-${deParts[1].padStart(2, '0')}`;
  }
  // Try YYYY-MM-DD
  const isoParts = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoParts) return value.trim();
  return null;
}

function parseCsv(text: string): Array<{ name: string; club: string; ttr: number; gender: string; birthDate: string | null; street: string; houseNumber: string; postalCode: string; city: string; phone: string }> {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  
  // Detect separator
  const sep = lines[0].includes(';') ? ';' : ',';
  
  // Skip header
  const results: Array<{ name: string; club: string; ttr: number; gender: string; birthDate: string | null; street: string; houseNumber: string; postalCode: string; city: string; phone: string }> = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(sep).map(c => c.trim());
    if (cols.length < 1 || !cols[0]) continue;
    results.push({
      name: cols[0] || '',
      club: cols[1] || '',
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
  return results;
}

export function PlayerImportExport({ players, onImport, started }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    if (players.length === 0) {
      toast.error('Keine Spieler zum Exportieren');
      return;
    }
    const csv = exportPlayersCsv(players);
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'spielerliste.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${players.length} Spieler exportiert`);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCsv(text);
      if (parsed.length === 0) {
        toast.error('Keine gültigen Spielerdaten gefunden');
        return;
      }
      onImport(parsed);
      toast.success(`${parsed.length} Spieler importiert`);
    };
    reader.readAsText(file);
    
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleExport}
        className="text-xs"
      >
        <Download className="mr-1 h-3 w-3" />
        Export CSV
      </Button>
      {!started && (
        <>
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
        </>
      )}
    </div>
  );
}
