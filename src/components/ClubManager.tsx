import { useState } from 'react';
import { Club } from '@/hooks/useClubs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Building2, Plus, Trash2 } from 'lucide-react';

interface Props {
  clubs: Club[];
  onAdd: (name: string) => Promise<Club | null>;
  onRemove: (id: string) => void;
}

export function ClubManager({ clubs, onAdd, onRemove }: Props) {
  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    if (!name.trim()) return;
    setAdding(true);
    await onAdd(name.trim());
    setName('');
    setAdding(false);
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

      <div className="space-y-1">
        {clubs.length === 0 && (
          <p className="text-center text-muted-foreground py-4 text-sm">
            Noch keine Vereine hinzugefügt
          </p>
        )}
        {clubs.map(club => (
          <div
            key={club.id}
            className="flex items-center justify-between bg-secondary rounded-lg px-3 py-2"
          >
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">{club.name}</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onRemove(club.id)}
              className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
