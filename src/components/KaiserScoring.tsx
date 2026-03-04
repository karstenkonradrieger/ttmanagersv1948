import { useState, useEffect, useRef } from 'react';
import { Match, Player, SetScore } from '@/types/tournament';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Crown, Timer, RotateCcw, Play, Check, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  matches: Match[];
  players: Player[];
  getPlayer: (id: string | null) => Player | null;
  getParticipantName: (id: string | null) => string;
  onUpdateScore: (matchId: string, sets: SetScore[], effectiveBestOf?: number) => void;
  onSetActive: (matchId: string, table?: number) => void;
  onGenerateNextRound: () => void;
  kaiserDurationMinutes: number;
  onUpdateDuration: (minutes: number) => void;
  currentRound: number;
  bestOf: number;
  tableCount: number;
  onTableCountChange: (count: number) => void;
  started: boolean;
}

export function KaiserScoring({
  matches, players, getPlayer, getParticipantName,
  onUpdateScore, onSetActive, onGenerateNextRound,
  kaiserDurationMinutes, onUpdateDuration,
  currentRound, bestOf, tableCount, onTableCountChange, started,
}: Props) {
  const [timerRunning, setTimerRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(kaiserDurationMinutes * 60);
  const [timerStarted, setTimerStarted] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Local scoring state per match
  const [editingSets, setEditingSets] = useState<Record<string, SetScore[]>>({});

  useEffect(() => {
    setTimeLeft(kaiserDurationMinutes * 60);
  }, [kaiserDurationMinutes]);

  useEffect(() => {
    if (timerRunning && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            setTimerRunning(false);
            toast.info('⏰ Zeit abgelaufen! Aktuelle Runde noch fertig spielen.');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [timerRunning, timeLeft]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const currentRoundMatches = matches
    .filter(m => m.round === currentRound - 1)
    .sort((a, b) => a.position - b.position);

  const allCurrentDone = currentRoundMatches.every(m => m.status === 'completed');
  const canRotate = allCurrentDone && currentRoundMatches.length > 0 && (timerRunning || timeLeft > 0);

  // Compute Kaiser standings (wins across all rounds)
  const standings = new Map<string, { wins: number; losses: number; kaiserRounds: number }>();
  for (const p of players) {
    standings.set(p.id, { wins: 0, losses: 0, kaiserRounds: 0 });
  }
  for (const m of matches) {
    if (m.status !== 'completed' || !m.winnerId) continue;
    const w = standings.get(m.winnerId);
    if (w) w.wins++;
    const loserId = m.player1Id === m.winnerId ? m.player2Id : m.player1Id;
    if (loserId) {
      const l = standings.get(loserId);
      if (l) l.losses++;
    }
    // Track kaiser rounds (wins at table 0)
    if (m.position === 0 && m.winnerId) {
      const k = standings.get(m.winnerId);
      if (k) k.kaiserRounds++;
    }
  }

  const sortedStandings = [...standings.entries()]
    .sort(([, a], [, b]) => b.kaiserRounds - a.kaiserRounds || b.wins - a.wins || a.losses - b.losses);

  const handleSetChange = (matchId: string, setIndex: number, field: 'player1' | 'player2', value: number) => {
    const current = editingSets[matchId] || [];
    const sets = [...current];
    while (sets.length <= setIndex) sets.push({ player1: 0, player2: 0 });
    sets[setIndex] = { ...sets[setIndex], [field]: value };
    setEditingSets(prev => ({ ...prev, [matchId]: sets }));
  };

  const confirmScore = (matchId: string) => {
    const sets = editingSets[matchId];
    if (!sets || sets.length === 0) return;
    onUpdateScore(matchId, sets, bestOf);
    setEditingSets(prev => {
      const next = { ...prev };
      delete next[matchId];
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* Timer */}
      <div className="bg-card rounded-xl p-4 card-shadow">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Crown className="h-6 w-6 text-yellow-500" />
            <h3 className="text-lg font-bold">Kaiserspiel</h3>
          </div>
          <div className="flex items-center gap-3">
            {!timerStarted && (
              <div className="flex items-center gap-2">
                <Label className="text-sm">Dauer (Min.):</Label>
                <Input
                  type="number"
                  min={1}
                  max={60}
                  value={kaiserDurationMinutes}
                  onChange={e => onUpdateDuration(Math.max(1, parseInt(e.target.value) || 10))}
                  className="w-20 h-8"
                />
              </div>
            )}
            <div className={`text-3xl font-mono font-bold tabular-nums ${timeLeft <= 60 ? 'text-destructive animate-pulse' : 'text-primary'}`}>
              {formatTime(timeLeft)}
            </div>
            {!timerStarted ? (
              <Button onClick={() => { setTimerRunning(true); setTimerStarted(true); }} className="gap-1" disabled={!started}>
                <Play className="h-4 w-4" /> Timer starten
              </Button>
            ) : timerRunning ? (
              <Button variant="outline" onClick={() => setTimerRunning(false)} className="gap-1">
                <Timer className="h-4 w-4" /> Pausieren
              </Button>
            ) : timeLeft > 0 ? (
              <Button onClick={() => setTimerRunning(true)} className="gap-1">
                <Play className="h-4 w-4" /> Fortsetzen
              </Button>
            ) : (
              <span className="text-sm font-semibold text-destructive">Beendet</span>
            )}
          </div>
        </div>
      </div>

      {/* Current round matches */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold">Runde {currentRound} — Tischbelegung</h4>
          {canRotate && (
            <Button onClick={onGenerateNextRound} className="gap-1" size="sm">
              <RotateCcw className="h-4 w-4" /> Rotation
            </Button>
          )}
          {timeLeft === 0 && allCurrentDone && (
            <span className="text-sm text-muted-foreground font-medium">🏆 Turnier beendet!</span>
          )}
        </div>

        <div className="space-y-3">
          {currentRoundMatches.map((match, idx) => {
            const p1 = getPlayer(match.player1Id);
            const p2 = getPlayer(match.player2Id);
            const isKaiserTable = idx === 0;
            const sets = editingSets[match.id] || match.sets || [];
            const isCompleted = match.status === 'completed';

            return (
              <div key={match.id} className={`bg-card rounded-lg p-3 card-shadow ${isKaiserTable ? 'ring-2 ring-yellow-500/50 bg-yellow-500/5' : ''}`}>
                <div className="flex items-center gap-2 mb-2">
                  {isKaiserTable && <Crown className="h-4 w-4 text-yellow-500" />}
                  <span className="text-sm font-semibold">Tisch {idx + 1}{isKaiserTable ? ' (Kaiser)' : ''}</span>
                  {isCompleted && <Check className="h-4 w-4 text-green-500" />}
                  {match.status === 'active' && <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">Aktiv</span>}
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className={`font-medium ${match.winnerId === match.player1Id ? 'text-green-600 font-bold' : ''}`}>
                    {p1?.name || '—'} {p1 ? `(${p1.ttr})` : ''}
                  </span>
                  <span className="text-muted-foreground">vs</span>
                  <span className={`font-medium ${match.winnerId === match.player2Id ? 'text-green-600 font-bold' : ''}`}>
                    {p2?.name || '—'} {p2 ? `(${p2.ttr})` : ''}
                  </span>
                </div>

                {!isCompleted && match.player1Id && match.player2Id && (
                  <div className="mt-2 space-y-2">
                    {match.status === 'pending' && (
                      <Button size="sm" variant="outline" onClick={() => onSetActive(match.id, idx + 1)} className="gap-1">
                        <Play className="h-3 w-3" /> Starten
                      </Button>
                    )}
                    {match.status === 'active' && (
                      <>
                        <div className="flex gap-2 flex-wrap">
                          {Array.from({ length: bestOf * 2 - 1 }).map((_, si) => (
                            <div key={si} className="flex flex-col gap-1">
                              <span className="text-[10px] text-muted-foreground text-center">S{si + 1}</span>
                              <div className="flex gap-1">
                                <Input
                                  type="number"
                                  min={0}
                                  className="w-10 h-7 text-xs text-center p-0"
                                  value={sets[si]?.player1 ?? ''}
                                  onChange={e => handleSetChange(match.id, si, 'player1', parseInt(e.target.value) || 0)}
                                />
                                <Input
                                  type="number"
                                  min={0}
                                  className="w-10 h-7 text-xs text-center p-0"
                                  value={sets[si]?.player2 ?? ''}
                                  onChange={e => handleSetChange(match.id, si, 'player2', parseInt(e.target.value) || 0)}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                        <Button size="sm" onClick={() => confirmScore(match.id)} className="gap-1">
                          <Check className="h-3 w-3" /> Bestätigen
                        </Button>
                      </>
                    )}
                  </div>
                )}

                {isCompleted && match.sets.length > 0 && (
                  <div className="mt-1 flex gap-2 text-xs text-muted-foreground">
                    {match.sets.map((s, i) => (
                      <span key={i}>{s.player1}:{s.player2}</span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Standings */}
      <div>
        <h4 className="font-semibold mb-2">🏆 Kaiser-Rangliste</h4>
        <div className="bg-card rounded-lg card-shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-2">#</th>
                <th className="text-left p-2">Spieler</th>
                <th className="text-center p-2">Siege</th>
                <th className="text-center p-2">Niederlagen</th>
                <th className="text-center p-2">👑 Kaiser</th>
              </tr>
            </thead>
            <tbody>
              {sortedStandings.map(([id, stats], i) => {
                const player = getPlayer(id);
                return (
                  <tr key={id} className="border-b border-border/50 last:border-0">
                    <td className="p-2 font-medium">{i + 1}</td>
                    <td className="p-2">
                      {player?.name || '—'}
                      <span className="text-xs text-muted-foreground ml-1">({player?.ttr})</span>
                    </td>
                    <td className="text-center p-2 text-green-600 font-medium">{stats.wins}</td>
                    <td className="text-center p-2 text-destructive font-medium">{stats.losses}</td>
                    <td className="text-center p-2 font-bold">{stats.kaiserRounds}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
