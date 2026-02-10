import { useState, useEffect, useRef, useCallback } from 'react';
import { Match, Player, SetScore } from '@/types/tournament';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Check, Play, X, Zap, Settings } from 'lucide-react';

interface Props {
  matches: Match[];
  getPlayer: (id: string | null) => Player | null;
  onUpdateScore: (matchId: string, sets: SetScore[]) => void;
  onSetActive: (matchId: string, table?: number) => void;
  tableCount: number;
  onTableCountChange: (count: number) => void;
  onAutoAssign: () => void;
}

export function MatchScoring({ matches, getPlayer, onUpdateScore, onSetActive, tableCount, onTableCountChange, onAutoAssign }: Props) {
  const pendingMatches = matches.filter(
    m => m.status !== 'completed' && m.player1Id && m.player2Id
  );
  const activeMatches = matches.filter(m => m.status === 'active');
  const completedMatches = matches.filter(m => m.status === 'completed' && m.sets.length > 0);

  const activeTables = new Set(activeMatches.filter(m => m.table).map(m => m.table));
  const freeTables = Array.from({ length: tableCount }, (_, i) => i + 1).filter(t => !activeTables.has(t));
  const pendingReadyCount = matches.filter(m => m.status === 'pending' && m.player1Id && m.player2Id).length;
  if (matches.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-12">
        Starte zuerst das Turnier
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Table Configuration */}
      <div className="bg-card rounded-lg p-4 card-shadow">
        <div className="flex items-center gap-2 mb-3">
          <Settings className="h-4 w-4 text-primary" />
          <h3 className="font-bold">Tischkonfiguration</h3>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="tableCount" className="text-sm">Anzahl Tische:</Label>
            <Input
              id="tableCount"
              type="number"
              min={1}
              max={20}
              value={tableCount}
              onChange={e => onTableCountChange(parseInt(e.target.value) || 1)}
              className="w-20 h-9 bg-secondary"
            />
          </div>
          <div className="text-sm text-muted-foreground">
            <span className="text-primary font-semibold">{freeTables.length}</span> frei | <span className="text-primary font-semibold">{activeTables.size}</span> belegt
          </div>
          {pendingReadyCount > 0 && freeTables.length > 0 && (
            <Button onClick={onAutoAssign} size="sm" className="h-9 glow-green">
              <Zap className="mr-1 h-4 w-4" />
              Auto-Zuweisen ({Math.min(pendingReadyCount, freeTables.length)})
            </Button>
          )}
        </div>
        {/* Table status indicators */}
        <div className="flex flex-wrap gap-2 mt-3">
          {Array.from({ length: tableCount }, (_, i) => i + 1).map(table => {
            const isActive = activeTables.has(table);
            const match = activeMatches.find(m => m.table === table);
            const p1 = match ? getPlayer(match.player1Id) : null;
            const p2 = match ? getPlayer(match.player2Id) : null;
            return (
              <div
                key={table}
                className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  isActive 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-secondary text-muted-foreground'
                }`}
                title={isActive && p1 && p2 ? `${p1.name} vs ${p2.name}` : 'Frei'}
              >
                T{table} {isActive && p1 && p2 ? `• ${p1.name?.split(' ')[0]} vs ${p2.name?.split(' ')[0]}` : ''}
              </div>
            );
          })}
        </div>
      </div>

      {activeMatches.length > 0 && (
        <Section title="🏓 Laufende Spiele">
          {activeMatches.map(m => (
            <ScoreEntry key={m.id} match={m} getPlayer={getPlayer} onUpdateScore={onUpdateScore} />
          ))}
        </Section>
      )}

      {pendingMatches.filter(m => m.status === 'pending').length > 0 && (
        <Section title="⏳ Anstehende Spiele">
          {pendingMatches
            .filter(m => m.status === 'pending')
            .map(m => (
              <PendingMatch key={m.id} match={m} getPlayer={getPlayer} onSetActive={onSetActive} freeTables={freeTables} />
            ))}
        </Section>
      )}

      {completedMatches.length > 0 && (
        <Section title="✅ Abgeschlossene Spiele">
          {completedMatches.map(m => (
            <CompletedMatch key={m.id} match={m} getPlayer={getPlayer} />
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-lg font-bold mb-3">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function PendingMatch({ match, getPlayer, onSetActive, freeTables }: {
  match: Match;
  getPlayer: (id: string | null) => Player | null;
  onSetActive: (id: string, table?: number) => void;
  freeTables: number[];
}) {
  const p1 = getPlayer(match.player1Id);
  const p2 = getPlayer(match.player2Id);
  const [selectedTable, setSelectedTable] = useState<number | ''>(freeTables[0] || '');

  return (
    <div className="bg-card rounded-lg p-4 card-shadow">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm">
          <span className="font-semibold">{p1?.name}</span>
          <span className="text-muted-foreground mx-2">vs</span>
          <span className="font-semibold">{p2?.name}</span>
        </div>
      </div>
      <div className="flex gap-2">
        <select
          value={selectedTable}
          onChange={e => setSelectedTable(e.target.value ? parseInt(e.target.value) : '')}
          className="w-28 h-10 rounded-md border border-input bg-secondary px-3 text-sm"
        >
          <option value="">Tisch...</option>
          {freeTables.map(t => (
            <option key={t} value={t}>Tisch {t}</option>
          ))}
        </select>
        <Button
          onClick={() => onSetActive(match.id, selectedTable || undefined)}
          className="h-10 flex-1 font-semibold"
          disabled={freeTables.length === 0}
        >
          <Play className="mr-2 h-4 w-4" />
          {freeTables.length === 0 ? 'Kein Tisch frei' : 'Spiel starten'}
        </Button>
      </div>
    </div>
  );
}

function ScoreEntry({ match, getPlayer, onUpdateScore }: {
  match: Match;
  getPlayer: (id: string | null) => Player | null;
  onUpdateScore: (matchId: string, sets: SetScore[]) => void;
}) {
  const p1 = getPlayer(match.player1Id);
  const p2 = getPlayer(match.player2Id);
  const [sets, setSets] = useState<SetScore[]>(
    match.sets.length > 0 ? match.sets : [{ player1: 0, player2: 0 }]
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);

  const p1Wins = sets.filter(s => s.player1 >= 11 && s.player1 - s.player2 >= 2).length;
  const p2Wins = sets.filter(s => s.player2 >= 11 && s.player2 - s.player1 >= 2).length;
  const matchOver = p1Wins >= 3 || p2Wins >= 3;

  // Auto-save with debounce
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onUpdateScore(match.id, sets);
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [sets, match.id, onUpdateScore]);

  const updateSet = (idx: number, field: 'player1' | 'player2', value: number) => {
    const updated = [...sets];
    updated[idx] = { ...updated[idx], [field]: value };
    setSets(updated);
  };

  const addSet = () => {
    if (sets.length < 5 && !matchOver) {
      setSets([...sets, { player1: 0, player2: 0 }]);
    }
  };

  const removeSet = (idx: number) => {
    if (sets.length > 1) {
      setSets(sets.filter((_, i) => i !== idx));
    }
  };

  return (
    <div className="bg-card rounded-lg p-4 card-shadow border-2 border-primary/30">
      <div className="flex items-center justify-between mb-4">
        <div className="text-center flex-1">
          <p className="font-bold text-lg">{p1?.name}</p>
          <p className={`text-2xl font-extrabold ${p1Wins >= 3 ? 'text-primary' : ''}`}>{p1Wins}</p>
        </div>
        <span className="text-muted-foreground text-xl font-light mx-2">:</span>
        <div className="text-center flex-1">
          <p className="font-bold text-lg">{p2?.name}</p>
          <p className={`text-2xl font-extrabold ${p2Wins >= 3 ? 'text-primary' : ''}`}>{p2Wins}</p>
        </div>
      </div>

      {match.table && (
        <p className="text-xs text-primary text-center mb-3 font-semibold">Tisch {match.table}</p>
      )}

      <div className="space-y-2">
        {sets.map((set, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-8">S{i + 1}</span>
            <Input
              type="number"
              value={set.player1 || ''}
              onChange={e => updateSet(i, 'player1', parseInt(e.target.value) || 0)}
              className="h-12 text-center text-lg font-bold bg-secondary flex-1"
              min={0}
            />
            <span className="text-muted-foreground">:</span>
            <Input
              type="number"
              value={set.player2 || ''}
              onChange={e => updateSet(i, 'player2', parseInt(e.target.value) || 0)}
              className="h-12 text-center text-lg font-bold bg-secondary flex-1"
              min={0}
            />
            {sets.length > 1 && (
              <Button variant="ghost" size="icon" onClick={() => removeSet(i)} className="h-10 w-10 text-muted-foreground">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-2 mt-4">
        {!matchOver && sets.length < 5 && (
          <Button variant="secondary" onClick={addSet} className="flex-1 h-12 font-semibold">
            + Satz
          </Button>
        )}
      </div>

      {matchOver && (
        <p className="text-center text-primary font-bold mt-3 text-sm">
          🏆 {p1Wins >= 3 ? p1?.name : p2?.name} gewinnt {p1Wins}:{p2Wins}
        </p>
      )}
    </div>
  );
}

function CompletedMatch({ match, getPlayer }: {
  match: Match;
  getPlayer: (id: string | null) => Player | null;
}) {
  const p1 = getPlayer(match.player1Id);
  const p2 = getPlayer(match.player2Id);
  const p1Wins = match.sets.filter(s => s.player1 >= 11 && s.player1 - s.player2 >= 2).length;
  const p2Wins = match.sets.filter(s => s.player2 >= 11 && s.player2 - s.player1 >= 2).length;
  const winner = getPlayer(match.winnerId);

  return (
    <div className="bg-card/50 rounded-lg p-3 card-shadow">
      <div className="flex items-center justify-between">
        <div className="text-sm">
          <span className={match.winnerId === match.player1Id ? 'font-bold text-primary' : ''}>{p1?.name}</span>
          <span className="text-muted-foreground mx-2">{p1Wins} : {p2Wins}</span>
          <span className={match.winnerId === match.player2Id ? 'font-bold text-primary' : ''}>{p2?.name}</span>
        </div>
        <span className="text-xs text-primary">🏆 {winner?.name}</span>
      </div>
      <div className="text-xs text-muted-foreground mt-1">
        {match.sets.map((s, i) => `${s.player1}:${s.player2}`).join(', ')}
      </div>
    </div>
  );
}
