import { useState } from 'react';
import { Player } from '@/types/tournament';
import { Club } from '@/hooks/useClubs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserPlus, Trash2, Trophy, Pencil, Check, X } from 'lucide-react';

interface Props {
  players: Player[];
  onAdd: (name: string, club: string, ttr: number, gender: string, birthDate: string | null) => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Omit<Player, 'id'>>) => void;
  started: boolean;
  clubs?: Club[];
  onAddClub?: (name: string) => Promise<Club | null>;
}

export function PlayerManager({ players, onAdd, onRemove, onUpdate, started, clubs = [], onAddClub }: Props) {
  const [name, setName] = useState('');
  const [club, setClub] = useState('');
  const [newClubName, setNewClubName] = useState('');
  const [showNewClub, setShowNewClub] = useState(false);
  const [ttr, setTtr] = useState('');
  const [gender, setGender] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Player>>({});

  const handleAdd = () => {
    if (!name.trim()) return;
    onAdd(name.trim(), club, parseInt(ttr) || 0, gender, birthDate || null);
    setName('');
    setClub('');
    setTtr('');
    setGender('');
    setBirthDate('');
  };

  const handleAddNewClub = async () => {
    if (!onAddClub || !newClubName.trim()) return;
    const created = await onAddClub(newClubName.trim());
    if (created) {
      setClub(created.name);
      setNewClubName('');
      setShowNewClub(false);
    }
  };

  const startEdit = (player: Player) => {
    setEditingId(player.id);
    setEditData({ ...player });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditData({});
  };

  const saveEdit = () => {
    if (!editingId || !editData.name?.trim()) return;
    const updates: Partial<Omit<Player, 'id'>> = {
      name: editData.name.trim(),
      birthDate: editData.birthDate || null,
    };
    if (!started) {
      updates.club = editData.club || '';
      updates.gender = editData.gender || '';
      updates.ttr = editData.ttr || 0;
    }
    onUpdate(editingId, updates);
    setEditingId(null);
    setEditData({});
  };

  return (
    <div className="space-y-4 animate-slide-up">
      {!started && (
        <div className="flex flex-col gap-3">
          <Input
            placeholder="Spielername"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            className="h-12 text-base bg-secondary border-border"
          />
          <div className="flex gap-2">
            {!showNewClub ? (
              <div className="flex-1 flex gap-1">
                <Select value={club} onValueChange={setClub}>
                  <SelectTrigger className="h-12 text-base bg-secondary border-border flex-1">
                    <SelectValue placeholder="Verein wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {clubs.map(c => (
                      <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {onAddClub && (
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-12 w-12 flex-shrink-0"
                    onClick={() => setShowNewClub(true)}
                    title="Neuen Verein anlegen"
                  >
                    +
                  </Button>
                )}
              </div>
            ) : (
              <div className="flex-1 flex gap-1">
                <Input
                  placeholder="Neuer Vereinsname"
                  value={newClubName}
                  onChange={e => setNewClubName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddNewClub()}
                  className="h-12 text-base bg-secondary border-border flex-1"
                  autoFocus
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-12"
                  onClick={handleAddNewClub}
                  disabled={!newClubName.trim()}
                >
                  OK
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-12"
                  onClick={() => { setShowNewClub(false); setNewClubName(''); }}
                >
                  ✕
                </Button>
              </div>
            )}
            <Select value={gender} onValueChange={setGender}>
              <SelectTrigger className="h-12 text-base bg-secondary border-border w-28">
                <SelectValue placeholder="Geschl." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="m">Männlich</SelectItem>
                <SelectItem value="w">Weiblich</SelectItem>
                <SelectItem value="d">Divers</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Geburtsdatum"
              type="date"
              value={birthDate}
              onChange={e => setBirthDate(e.target.value)}
              className="h-12 text-base bg-secondary border-border"
            />
            <Input
              placeholder="TTR"
              type="number"
              value={ttr}
              onChange={e => setTtr(e.target.value)}
              className="h-12 text-base bg-secondary border-border w-24"
            />
          </div>
          <Button
            onClick={handleAdd}
            className="h-12 text-base font-semibold glow-green"
            disabled={!name.trim()}
          >
            <UserPlus className="mr-2 h-5 w-5" />
            Spieler hinzufügen
          </Button>
        </div>
      )}

      <div className="space-y-2">
        {players.length === 0 && (
          <p className="text-center text-muted-foreground py-8">
            Noch keine Spieler hinzugefügt
          </p>
        )}
        {players.map((player, i) => (
          <div
            key={player.id}
            className="bg-secondary rounded-lg p-3 animate-slide-up"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            {editingId === player.id ? (
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <Input
                    value={editData.name || ''}
                    onChange={e => setEditData(prev => ({ ...prev, name: e.target.value }))}
                    className="h-10 text-sm bg-background border-border flex-1"
                    placeholder="Name"
                  />
                  {!started && (
                    <Select
                      value={editData.club || ''}
                      onValueChange={v => setEditData(prev => ({ ...prev, club: v }))}
                    >
                      <SelectTrigger className="h-10 text-sm bg-background border-border w-40">
                        <SelectValue placeholder="Verein" />
                      </SelectTrigger>
                      <SelectContent>
                        {clubs.map(c => (
                          <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="flex gap-2">
                  {!started && (
                    <Select
                      value={editData.gender || ''}
                      onValueChange={v => setEditData(prev => ({ ...prev, gender: v }))}
                    >
                      <SelectTrigger className="h-10 text-sm bg-background border-border w-28">
                        <SelectValue placeholder="Geschl." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="m">Männlich</SelectItem>
                        <SelectItem value="w">Weiblich</SelectItem>
                        <SelectItem value="d">Divers</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                  <Input
                    type="date"
                    value={editData.birthDate || ''}
                    onChange={e => setEditData(prev => ({ ...prev, birthDate: e.target.value }))}
                    className="h-10 text-sm bg-background border-border flex-1"
                  />
                  {!started && (
                    <Input
                      type="number"
                      value={editData.ttr ?? ''}
                      onChange={e => setEditData(prev => ({ ...prev, ttr: parseInt(e.target.value) || 0 }))}
                      className="h-10 text-sm bg-background border-border w-20"
                      placeholder="TTR"
                    />
                  )}
                </div>
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="icon" onClick={cancelEdit} className="h-8 w-8">
                    <X className="h-4 w-4" />
                  </Button>
                  <Button variant="default" size="icon" onClick={saveEdit} className="h-8 w-8" disabled={!editData.name?.trim()}>
                    <Check className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                    {i + 1}
                  </div>
                  <div>
                    <p className="font-semibold">
                      {player.name}
                      {player.gender && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({player.gender === 'm' ? '♂' : player.gender === 'w' ? '♀' : '⚧'})
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {player.club && `${player.club} · `}
                      {player.birthDate && `${new Date(player.birthDate).toLocaleDateString('de-DE')} · `}
                      <Trophy className="inline h-3 w-3" /> {player.ttr}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => startEdit(player)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {!started && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onRemove(player.id)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-5 w-5" />
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
