import { useState } from 'react';
import { Match, Player, SetScore } from '@/types/tournament';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Check, Play, X, Zap, Settings, Printer, FileText } from 'lucide-react';
import { printRefereeSheet, printAllRefereeSheets } from '@/components/RefereeSheet';
import { MatchPhotos } from '@/components/MatchPhotos';
import { generateMatchReport } from '@/components/MatchReport';

interface Props {
  matches: Match[];
  getPlayer: (id: string | null) => Player | null;
  getParticipantName: (id: string | null) => string;
  onUpdateScore: (matchId: string, sets: SetScore[], effectiveBestOf?: number) => void;
  onSetActive: (matchId: string, table?: number) => void;
  tableCount: number;
  onTableCountChange: (count: number) => void;
  onAutoAssign: () => void;
  bestOf: number;
  tournamentName: string;
  rounds: number;
  tournamentId: string;
  logoUrl?: string | null;
}

const announceMatch = (table: number | undefined, player1Name: string, player2Name: string, nextPlayer1Name?: string, nextPlayer2Name?: string) => {
  try {
    const tableWords: Record<number, string> = { 1: 'eins', 2: 'zwei', 3: 'drei', 4: 'vier', 5: 'fünf', 6: 'sechs', 7: 'sieben', 8: 'acht', 9: 'neun', 10: 'zehn', 11: 'elf', 12: 'zwölf', 13: 'dreizehn', 14: 'vierzehn', 15: 'fünfzehn', 16: 'sechzehn', 17: 'siebzehn', 18: 'achtzehn', 19: 'neunzehn', 20: 'zwanzig' };
    const tableSpoken = table ? (tableWords[table] || String(table)) : undefined;
    const tableText = tableSpoken ? `Nächstes Spiel am Tisch ${tableSpoken}.` : 'Nächstes Spiel.';
    let text = `${tableText} Es spielt ${player1Name} gegen ${player2Name}.`;
    if (nextPlayer1Name && nextPlayer2Name) {
      text += ` Es bereiten sich vor: ${nextPlayer1Name} gegen ${nextPlayer2Name}.`;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'de-DE';
    utterance.rate = 0.7;
    const voices = speechSynthesis.getVoices();
    const maleDeVoice = voices.find(v => v.lang.startsWith('de') && /male|mann|männlich/i.test(v.name) && !/female|frau|weiblich/i.test(v.name))
      || voices.find(v => v.lang.startsWith('de') && !/female|frau|weiblich/i.test(v.name));
    if (maleDeVoice) utterance.voice = maleDeVoice;
    speechSynthesis.speak(utterance);
  } catch {}
};

export function MatchScoring({ matches, getPlayer, getParticipantName, onUpdateScore, onSetActive, tableCount, onTableCountChange, onAutoAssign, bestOf, tournamentName, rounds, tournamentId, logoUrl }: Props) {
  const [autoPrint, setAutoPrint] = useState(true);

  const pendingMatches = matches.filter(
    m => m.status !== 'completed' && m.player1Id && m.player2Id
  );
  const activeMatches = matches.filter(m => m.status === 'active');
  const completedMatches = matches.filter(m => m.status === 'completed' && m.sets.length > 0);

  const activeTables = new Set(activeMatches.filter(m => m.table).map(m => m.table));
  const freeTables = Array.from({ length: tableCount }, (_, i) => i + 1).filter(t => !activeTables.has(t));
  const pendingReadyCount = matches.filter(m => m.status === 'pending' && m.player1Id && m.player2Id).length;

  // Wrap onSetActive to auto-print referee sheet
  const getNextPendingAfter = (excludeId: string) => {
    return matches.find(m => m.status === 'pending' && m.player1Id && m.player2Id && m.id !== excludeId);
  };

  const handleSetActive = (matchId: string, table?: number) => {
    onSetActive(matchId, table);
    const match = matches.find(m => m.id === matchId);
    if (match) {
      const next = getNextPendingAfter(matchId);
      announceMatch(
        table,
        getParticipantName(match.player1Id),
        getParticipantName(match.player2Id),
        next ? getParticipantName(next.player1Id) : undefined,
        next ? getParticipantName(next.player2Id) : undefined,
      );
    }
    if (autoPrint) {
      const match = matches.find(m => m.id === matchId);
      if (match) {
        const updatedMatch = { ...match, table: table, status: 'active' as const };
        printRefereeSheet({
          match: updatedMatch,
          player1Name: getParticipantName(match.player1Id),
          player2Name: getParticipantName(match.player2Id),
          tournamentName,
          bestOf,
        });
      }
    }
  };

  // Wrap onAutoAssign to auto-print all newly assigned sheets
  const handleAutoAssign = () => {
    const pendingReady = matches.filter(m => m.status === 'pending' && m.player1Id && m.player2Id);
    const assignCount = Math.min(pendingReady.length, freeTables.length);
    const assignedMatches = pendingReady.slice(0, assignCount).map((m, i) => ({
      ...m,
      table: freeTables[i],
      status: 'active' as const,
    }));

    onAutoAssign();
    if (assignedMatches.length > 0) {
      const remainingPending = matches.filter(
        m => m.status === 'pending' && m.player1Id && m.player2Id && !assignedMatches.find(a => a.id === m.id)
      );
      assignedMatches.forEach((m, i) => {
        // For the last assigned match, show the next pending as preparation
        const nextPrep = i === assignedMatches.length - 1 ? remainingPending[0] : undefined;
        setTimeout(() => {
          announceMatch(
            m.table,
            getParticipantName(m.player1Id),
            getParticipantName(m.player2Id),
            nextPrep ? getParticipantName(nextPrep.player1Id) : undefined,
            nextPrep ? getParticipantName(nextPrep.player2Id) : undefined,
          );
        }, i * 500);
      });
    }

    if (autoPrint && assignedMatches.length > 0) {
      printAllRefereeSheets(
        assignedMatches,
        getParticipantName,
        tournamentName,
        bestOf,
      );
    }
  };
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
          <div className="flex items-center gap-2">
            <Switch id="autoPrint" checked={autoPrint} onCheckedChange={setAutoPrint} />
            <Label htmlFor="autoPrint" className="text-sm cursor-pointer">SR-Zettel auto</Label>
          </div>
          {pendingReadyCount > 0 && freeTables.length > 0 && (
            <Button onClick={handleAutoAssign} size="sm" className="h-9 glow-green">
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
        <Section title="🏓 Laufende Spiele" action={
          <Button variant="outline" size="sm" onClick={() => printAllRefereeSheets(matches, getParticipantName, tournamentName, bestOf)} className="text-xs">
            <Printer className="mr-1 h-3 w-3" />
            Alle SR-Zettel drucken
          </Button>
        }>
          {activeMatches.map(m => (
            <ScoreEntry key={m.id} match={m} getPlayer={getPlayer} onUpdateScore={onUpdateScore} bestOf={bestOf} getParticipantName={getParticipantName} tournamentName={tournamentName} rounds={rounds} tournamentId={tournamentId} />
          ))}
        </Section>
      )}

      {pendingMatches.filter(m => m.status === 'pending').length > 0 && (
        <Section title="⏳ Anstehende Spiele">
          {pendingMatches
            .filter(m => m.status === 'pending')
            .map(m => (
              <PendingMatch key={m.id} match={m} getPlayer={getPlayer} onSetActive={handleSetActive} freeTables={freeTables} />
            ))}
        </Section>
      )}

      {completedMatches.length > 0 && (
        <Section title="✅ Abgeschlossene Spiele">
          {completedMatches.map(m => (
            <CompletedMatch key={m.id} match={m} getPlayer={getPlayer} tournamentId={tournamentId} tournamentName={tournamentName} bestOf={bestOf} rounds={rounds} logoUrl={logoUrl} />
          ))}
        </Section>
      )}

      {/* Siegerehrung Fotos */}
      {matches.some(m => m.status === 'completed') && (
        <div className="bg-card rounded-lg p-4 card-shadow">
          <h3 className="text-lg font-bold mb-3">📸 Siegerehrung</h3>
          <MatchPhotos
            tournamentId={tournamentId}
            photoType="ceremony"
            maxPhotos={3}
          />
        </div>
      )}
    </div>
  );
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-bold">{title}</h3>
        {action}
      </div>
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

function ScoreEntry({ match, getPlayer, onUpdateScore, bestOf, getParticipantName, tournamentName, rounds, tournamentId }: {
  match: Match;
  getPlayer: (id: string | null) => Player | null;
  onUpdateScore: (matchId: string, sets: SetScore[], effectiveBestOf?: number) => void;
  bestOf: number;
  getParticipantName: (id: string | null) => string;
  tournamentName: string;
  rounds: number;
  tournamentId: string;
}) {
  const p1 = getPlayer(match.player1Id);
  const p2 = getPlayer(match.player2Id);

  // Ab Halbfinale: Option auf 3 Gewinnsätze wenn Turnier auf 2 steht
  const isSemiOrLater = rounds >= 2 && match.round >= rounds - 2;
  const canUpgradeBestOf = bestOf === 2 && isSemiOrLater;
  const [upgradedBestOf, setUpgradedBestOf] = useState(false);
  const effectiveBestOf = canUpgradeBestOf && upgradedBestOf ? 3 : bestOf;

  const [sets, setSets] = useState<SetScore[]>(
    match.sets.length > 0 ? match.sets : [{ player1: 0, player2: 0 }]
  );

  const maxSets = effectiveBestOf * 2 - 1;
  const p1Wins = sets.filter(s => s.player1 >= 11 && s.player1 - s.player2 >= 2).length;
  const p2Wins = sets.filter(s => s.player2 >= 11 && s.player2 - s.player1 >= 2).length;
  const matchOver = p1Wins >= effectiveBestOf || p2Wins >= effectiveBestOf;

  const updateSet = (idx: number, field: 'player1' | 'player2', value: number) => {
    const updated = [...sets];
    updated[idx] = { ...updated[idx], [field]: value };
    setSets(updated);
  };

  const addSet = () => {
    if (sets.length < maxSets && !matchOver) {
      setSets([...sets, { player1: 0, player2: 0 }]);
    }
  };

  const removeSet = (idx: number) => {
    if (sets.length > 1) {
      setSets(sets.filter((_, i) => i !== idx));
    }
  };

  const saveScore = () => {
    onUpdateScore(match.id, sets, effectiveBestOf);
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

      <div className="flex items-center justify-center gap-2 mb-3 flex-wrap">
        {match.table && (
          <span className="text-xs text-primary font-semibold">Tisch {match.table}</span>
        )}
        {canUpgradeBestOf && (
          <div className="flex items-center gap-1.5">
            <Switch id={`bo-${match.id}`} checked={upgradedBestOf} onCheckedChange={setUpgradedBestOf} />
            <Label htmlFor={`bo-${match.id}`} className="text-xs cursor-pointer">3 Gewinnsätze</Label>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs text-muted-foreground"
          onClick={() => printRefereeSheet({
            match,
            player1Name: getParticipantName(match.player1Id),
            player2Name: getParticipantName(match.player2Id),
            tournamentName,
            bestOf,
          })}
        >
          <Printer className="mr-1 h-3 w-3" />
          SR-Zettel
        </Button>
      </div>

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
        {!matchOver && sets.length < maxSets && (
          <Button variant="secondary" onClick={addSet} className="flex-1 h-12 font-semibold">
            + Satz
          </Button>
        )}
        <Button onClick={saveScore} className="flex-1 h-12 font-semibold glow-green">
          <Check className="mr-2 h-5 w-5" />
          Speichern
        </Button>
      </div>

      {matchOver && (
        <p className="text-center text-primary font-bold mt-3 text-sm">
          🏆 {p1Wins >= effectiveBestOf ? p1?.name : p2?.name} gewinnt {p1Wins}:{p2Wins}
        </p>
      )}

      <div className="mt-4">
        <MatchPhotos
          tournamentId={tournamentId}
          matchId={match.id}
          photoType="match"
          maxPhotos={3}
        />
      </div>
    </div>
  );
}

function CompletedMatch({ match, getPlayer, tournamentId, tournamentName, bestOf, rounds, logoUrl }: {
  match: Match;
  getPlayer: (id: string | null) => Player | null;
  tournamentId: string;
  tournamentName: string;
  bestOf: number;
  rounds: number;
  logoUrl?: string | null;
}) {
  const p1 = getPlayer(match.player1Id);
  const p2 = getPlayer(match.player2Id);
  const p1Wins = match.sets.filter(s => s.player1 >= 11 && s.player1 - s.player2 >= 2).length;
  const p2Wins = match.sets.filter(s => s.player2 >= 11 && s.player2 - s.player1 >= 2).length;
  const winner = getPlayer(match.winnerId);

  const getRoundName = (round: number, totalRounds: number): string => {
    const diff = totalRounds - round;
    if (diff === 1) return 'Finale';
    if (diff === 2) return 'Halbfinale';
    if (diff === 3) return 'Viertelfinale';
    if (diff === 4) return 'Achtelfinale';
    return `Runde ${round + 1}`;
  };

  return (
    <div className="bg-card/50 rounded-lg p-3 card-shadow space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-sm">
          <span className={match.winnerId === match.player1Id ? 'font-bold text-primary' : ''}>{p1?.name}</span>
          <span className="text-muted-foreground mx-2">{p1Wins} : {p2Wins}</span>
          <span className={match.winnerId === match.player2Id ? 'font-bold text-primary' : ''}>{p2?.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground"
            onClick={() => generateMatchReport({
              match, player1: p1, player2: p2,
              tournamentName, tournamentId,
              roundName: getRoundName(match.round, rounds),
              logoUrl, bestOf,
            })}
          >
            <FileText className="mr-1 h-3 w-3" />
            Spielbericht
          </Button>
          <span className="text-xs text-primary">🏆 {winner?.name}</span>
        </div>
      </div>
      <div className="text-xs text-muted-foreground">
        {match.sets.map((s, i) => `${s.player1}:${s.player2}`).join(', ')}
      </div>
      <MatchPhotos
        tournamentId={tournamentId}
        matchId={match.id}
        photoType="match"
        maxPhotos={3}
      />
    </div>
  );
}
