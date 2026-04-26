import { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { toast } from 'sonner';
import { DoublesPair, Match, Player, SetScore, Sponsor, getHandicap } from '@/types/tournament';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Check, Play, X, Zap, Settings, Printer, FileText, Clock, ChevronDown } from 'lucide-react';
import { printRefereeSheet, printAllRefereeSheets } from '@/components/RefereeSheet';
import { MatchPhotos } from '@/components/MatchPhotos';
import { generateMatchReport } from '@/components/MatchReport';
import { useAnnouncementPhrases } from '@/hooks/useAnnouncementPhrases';

interface Props {
  matches: Match[];
  getPlayer: (id: string | null) => Player | null;
  getParticipantName: (id: string | null) => string;
  onUpdateScore: (matchId: string, sets: SetScore[], effectiveBestOf?: number) => void;
  onSetActive: (matchId: string, table?: number) => Promise<boolean> | void;
  tableCount: number;
  onTableCountChange: (count: number) => void;
  onAutoAssign: () => Promise<Array<{ id: string; table: number }>>;
  bestOf: number;
  tournamentName: string;
  rounds: number;
  tournamentId: string;
  logoUrl?: string | null;
  tournamentDate?: string | null;
  venueString?: string;
  motto?: string;
  sponsors?: Sponsor[];
  isHandicap?: boolean;
  players?: Player[];
  doublesPairs?: DoublesPair[];
  mode?: string;
  breakMinutes?: number;
  onUpdatePlayer?: (id: string, updates: Partial<Omit<Player, 'id'>>) => void;
}

let announcementQueue: Promise<void> = Promise.resolve();
let queueLength = 0;

const enqueueAnnouncement = (job: () => Promise<void>, label: string) => {
  queueLength++;
  const position = queueLength;
  announcementQueue = announcementQueue.then(async () => {
    const toastId = toast.loading(`🔊 Durchsage: ${label}`, {
      description: queueLength > 1 ? `Noch ${queueLength - 1} in Warteschlange` : undefined,
      duration: Infinity,
    });
    try {
      await job();
    } finally {
      queueLength--;
      toast.dismiss(toastId);
    }
  }).catch((err) => {
    queueLength--;
    console.error('Announcement queue error:', err);
  });
  return announcementQueue;
};

const playAudioFile = (url: string): Promise<boolean> => {
  return new Promise((resolve) => {
    try {
      const audio = new Audio();
      audio.preload = 'auto';

      audio.oncanplaythrough = () => {
        audio.play().catch(() => {
          resolve(false);
        });
      };

      audio.onended = () => {
        resolve(true);
      };

      audio.onerror = () => {
        resolve(false);
      };

      audio.src = url;
      audio.load();
    } catch {
      resolve(false);
    }
  });
};

const announceMatch = async (
  table: number | undefined,
  player1Name: string,
  player2Name: string,
  nextPlayer1Name?: string,
  nextPlayer2Name?: string,
  player1VoiceUrls: string[] = [],
  player2VoiceUrls: string[] = [],
  nextPlayer1VoiceUrls: string[] = [],
  nextPlayer2VoiceUrls: string[] = [],
  getPhraseAudio?: (key: string) => string | null,
): Promise<void> => {
  return new Promise((resolve) => {
    const playPhrase = async (phraseKey: string) => {
      const url = getPhraseAudio?.(phraseKey);
      if (url) {
        await playAudioFile(url);
      }
    };

    const playParticipant = async (voiceUrls: string[]) => {
      for (let i = 0; i < voiceUrls.length; i++) {
        await playAudioFile(voiceUrls[i]);
        if (i < voiceUrls.length - 1) {
          await playPhrase('und');
        }
      }
    };

    const onGongReady = async () => {
      try {
        if (table) {
          await playPhrase('naechstes_spiel_tisch');
          await playPhrase(`tisch_${table}`);
        } else {
          await playPhrase('naechstes_spiel');
        }

        await playPhrase('es_spielt');
        await playParticipant(player1VoiceUrls);
        await playPhrase('gegen');
        await playParticipant(player2VoiceUrls);

        if (nextPlayer1Name && nextPlayer2Name) {
          await playPhrase('vorbereitung');
          await playParticipant(nextPlayer1VoiceUrls);
          await playPhrase('gegen');
          await playParticipant(nextPlayer2VoiceUrls);
        }
      } catch (err) {
        console.error('Announcement playback error:', err);
      } finally {
        window.dispatchEvent(new CustomEvent('announcement-end'));
        resolve();
      }
    };

    window.addEventListener('announcement-gong-done', onGongReady, { once: true });
    window.dispatchEvent(new CustomEvent('announcement-start'));
  });
};

export function MatchScoring({ matches, getPlayer, getParticipantName, onUpdateScore, onSetActive, tableCount, onTableCountChange, onAutoAssign, bestOf, tournamentName, rounds, tournamentId, logoUrl, tournamentDate, venueString, motto, sponsors = [], isHandicap = false, players = [], doublesPairs = [], mode, breakMinutes = 0, onUpdatePlayer }: Props) {
  const [autoPrint, setAutoPrint] = useState(true);
  const { getPhraseAudioUrl } = useAnnouncementPhrases();

  const computeHandicap = (match: Match, gp: (id: string | null) => Player | null) => {
    const p1 = gp(match.player1Id);
    const p2 = gp(match.player2Id);
    if (!p1 || !p2) return null;
    return getHandicap(p1.ttr, p2.ttr);
  };

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

  const getVoiceUrlByPlayerId = (id: string | null) => {
    if (!id) return null;
    const player = players.find(p => p.id === id);
    return player?.voiceNameUrl || null;
  };

  const getAnnouncementVoiceUrls = (participantId: string | null): string[] => {
    if (!participantId) return [];

    const pair = doublesPairs.find(dp => dp.player1Id === participantId);
    if (pair) {
      return [
        getVoiceUrlByPlayerId(pair.player1Id),
        getVoiceUrlByPlayerId(pair.player2Id),
      ].filter((url): url is string => Boolean(url));
    }

    const single = getVoiceUrlByPlayerId(participantId);
    return single ? [single] : [];
  };

  const handleSetActive = async (matchId: string, table?: number) => {
    const result = await onSetActive(matchId, table);
    if (!result) return;

    const match = matches.find(m => m.id === matchId);
    if (match) {
      const next = getNextPendingAfter(matchId);
      const p1 = getParticipantName(match.player1Id);
      const p2 = getParticipantName(match.player2Id);
      enqueueAnnouncement(() => announceMatch(
        table,
        p1,
        p2,
        next ? getParticipantName(next.player1Id) : undefined,
        next ? getParticipantName(next.player2Id) : undefined,
        getAnnouncementVoiceUrls(match.player1Id),
        getAnnouncementVoiceUrls(match.player2Id),
        next ? getAnnouncementVoiceUrls(next.player1Id) : [],
        next ? getAnnouncementVoiceUrls(next.player2Id) : [],
        getPhraseAudioUrl,
      ), `${p1} vs ${p2}${table ? ` · Tisch ${table}` : ''}`);
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
  const handleAutoAssign = async () => {
    const assignedUpdates = await onAutoAssign();
    if (!assignedUpdates || assignedUpdates.length === 0) return;

    // Build assigned matches from the actual results
    const assignedMatches = assignedUpdates.map(u => {
      const m = matches.find(match => match.id === u.id);
      return m ? { ...m, table: u.table, status: 'active' as const } : null;
    }).filter((m): m is Match & { table: number; status: 'active' } => m !== null);

    if (assignedMatches.length > 0) {
      const assignedIds = new Set(assignedMatches.map(m => m.id));
      const remainingPending = matches.filter(
        m => m.status === 'pending' && m.player1Id && m.player2Id && !assignedIds.has(m.id)
      );

      assignedMatches.forEach((m, i) => {
        const nextPrep = i === assignedMatches.length - 1 ? remainingPending[0] : undefined;
        const ap1 = getParticipantName(m.player1Id);
        const ap2 = getParticipantName(m.player2Id);
        enqueueAnnouncement(() => announceMatch(
          m.table,
          ap1,
          ap2,
          nextPrep ? getParticipantName(nextPrep.player1Id) : undefined,
          nextPrep ? getParticipantName(nextPrep.player2Id) : undefined,
          getAnnouncementVoiceUrls(m.player1Id),
          getAnnouncementVoiceUrls(m.player2Id),
          nextPrep ? getAnnouncementVoiceUrls(nextPrep.player1Id) : [],
          nextPrep ? getAnnouncementVoiceUrls(nextPrep.player2Id) : [],
          getPhraseAudioUrl,
        ), `${ap1} vs ${ap2}${m.table ? ` · Tisch ${m.table}` : ''}`);
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
                className={`px-3 py-1 rounded-full text-xs font-semibold ${isActive
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
          <PhaseGroupedMatches
            matches={activeMatches}
            mode={mode}
            renderMatch={(m) => {
              const handicapInfo = isHandicap ? computeHandicap(m, getPlayer) : null;
              return <ScoreEntry key={m.id} match={m} getPlayer={getPlayer} onUpdateScore={onUpdateScore} bestOf={bestOf} getParticipantName={getParticipantName} tournamentName={tournamentName} rounds={rounds} tournamentId={tournamentId} handicapInfo={handicapInfo} />;
            }}
          />
        </Section>
      )}

      {pendingMatches.filter(m => m.status === 'pending').length > 0 && (
        <Section title="⏳ Anstehende Spiele">
          <PhaseGroupedMatches
            matches={pendingMatches
              .filter(m => m.status === 'pending')
              .sort((a, b) => {
                const waitA = Math.max(
                  getPlayerWaitRemaining(a.player1Id, matches, breakMinutes, getPlayer(a.player1Id)),
                  getPlayerWaitRemaining(a.player2Id, matches, breakMinutes, getPlayer(a.player2Id))
                );
                const waitB = Math.max(
                  getPlayerWaitRemaining(b.player1Id, matches, breakMinutes, getPlayer(b.player1Id)),
                  getPlayerWaitRemaining(b.player2Id, matches, breakMinutes, getPlayer(b.player2Id))
                );
                return waitA - waitB;
              })}
            mode={mode}
            renderMatch={(m) => {
              const handicapInfo = isHandicap ? computeHandicap(m, getPlayer) : null;
              return <PendingMatch key={m.id} match={m} getPlayer={getPlayer} onSetActive={handleSetActive} freeTables={freeTables} handicapInfo={handicapInfo} allMatches={matches} breakMinutes={breakMinutes} onUpdatePlayer={onUpdatePlayer} />;
            }}
          />
        </Section>
      )}

      {completedMatches.length > 0 && (
        <Section title="✅ Abgeschlossene Spiele">
          <PhaseGroupedMatches
            matches={completedMatches}
            mode={mode}
            renderMatch={(m) => (
              <CompletedMatch key={m.id} match={m} getPlayer={getPlayer} tournamentId={tournamentId} tournamentName={tournamentName} bestOf={bestOf} rounds={rounds} logoUrl={logoUrl} tournamentDate={tournamentDate} venueString={venueString} motto={motto} mode={mode} sponsors={sponsors} onUpdateScore={onUpdateScore} getParticipantName={getParticipantName} isHandicap={isHandicap} players={players} />
            )}
          />
        </Section>
      )}

      {/* Siegerehrung Fotos */}
      {matches.some(m => m.status === 'completed') && (
        <div className="bg-card rounded-lg p-4 card-shadow">
          <h3 className="text-lg font-bold mb-3">📸 Siegerehrung</h3>
          <MatchPhotos
            tournamentId={tournamentId}
            photoType="ceremony"
            maxPhotos={2}
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

function PhaseGroupedMatches({ matches, mode, renderMatch }: {
  matches: Match[];
  mode?: string;
  renderMatch: (m: Match) => React.ReactNode;
}) {
  const isGroupKnockout = mode === 'group_knockout';
  const groupMatches = matches.filter(m => m.groupNumber !== undefined && m.groupNumber !== null);
  const koMatches = matches.filter(m => m.groupNumber === undefined || m.groupNumber === null);

  // Default: Gruppenphase eingeklappt, K.O. ausgeklappt
  const [groupOpen, setGroupOpen] = useState(false);
  const [koOpen, setKoOpen] = useState(true);

  // No split needed: not group+KO, or only one phase present
  if (!isGroupKnockout || groupMatches.length === 0 || koMatches.length === 0) {
    return <>{matches.map(renderMatch)}</>;
  }

  return (
    <div className="space-y-3">
      <CollapsiblePhase
        number={1}
        label="Gruppenphase"
        count={groupMatches.length}
        tone="muted"
        open={groupOpen}
        onOpenChange={setGroupOpen}
      >
        {groupMatches.map(renderMatch)}
      </CollapsiblePhase>
      <CollapsiblePhase
        number={2}
        label="K.O.-Runde"
        count={koMatches.length}
        tone="primary"
        open={koOpen}
        onOpenChange={setKoOpen}
      >
        {koMatches.map(renderMatch)}
      </CollapsiblePhase>
    </div>
  );
}

function CollapsiblePhase({ number, label, count, tone, open, onOpenChange, children }: {
  number: number;
  label: string;
  count: number;
  tone: 'muted' | 'primary';
  open: boolean;
  onOpenChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  const isPrimary = tone === 'primary';
  return (
    <div>
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-md border transition-colors text-left ${
          isPrimary
            ? 'border-primary/30 bg-primary/5 hover:bg-primary/10'
            : 'border-border/60 bg-muted/30 hover:bg-muted/50'
        }`}
      >
        <span className={`flex items-center justify-center h-5 w-5 rounded text-[10px] font-bold flex-shrink-0 ${
          isPrimary ? 'bg-primary text-primary-foreground' : 'bg-muted-foreground/20 text-muted-foreground'
        }`}>
          {number}
        </span>
        <h4 className={`text-xs font-bold uppercase tracking-wider ${
          isPrimary ? 'text-primary' : 'text-muted-foreground'
        }`}>
          {label}
        </h4>
        <span className="text-[10px] text-muted-foreground ml-auto">
          {count} {count === 1 ? 'Spiel' : 'Spiele'}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="space-y-3 mt-2 pl-1">{children}</div>
      )}
    </div>
  );
}
function getPlayerWaitRemaining(playerId: string | null, allMatches: Match[], breakMinutes: number, player: Player | null): number {
  if (!playerId) return 0;
  const now = Date.now();
  let maxRemaining = 0;

  // Break-based wait
  if (breakMinutes > 0) {
    const pauseMs = breakMinutes * 60 * 1000;
    for (const m of allMatches) {
      if (m.status === 'completed' && m.completedAt &&
        (m.player1Id === playerId || m.player2Id === playerId)) {
        const remaining = pauseMs - (now - new Date(m.completedAt).getTime());
        if (remaining > maxRemaining) maxRemaining = remaining;
      }
    }
  }

  // Delay-based wait (relative to tournament start = earliest completed match time)
  const delayMs = (player?.delayMinutes ?? 0) * 60 * 1000;
  if (delayMs > 0) {
    let tournamentStart: number | null = null;
    for (const m of allMatches) {
      if ((m.status === 'active' || m.status === 'completed') && m.completedAt) {
        const t = new Date(m.completedAt).getTime();
        if (!tournamentStart || t < tournamentStart) tournamentStart = t;
      }
    }
    if (tournamentStart) {
      const delayRemaining = (tournamentStart + delayMs) - now;
      if (delayRemaining > maxRemaining) maxRemaining = delayRemaining;
    }
  }

  return maxRemaining;
}

function PendingMatch({ match, getPlayer, onSetActive, freeTables, handicapInfo, allMatches, breakMinutes, onUpdatePlayer }: {
  match: Match;
  getPlayer: (id: string | null) => Player | null;
  onSetActive: (id: string, table?: number) => void;
  freeTables: number[];
  handicapInfo?: { player1Handicap: number; player2Handicap: number } | null;
  allMatches: Match[];
  breakMinutes: number;
  onUpdatePlayer?: (id: string, updates: Partial<Omit<Player, 'id'>>) => void;
}) {
  const p1 = getPlayer(match.player1Id);
  const p2 = getPlayer(match.player2Id);
  const [selectedTable, setSelectedTable] = useState<number | ''>(freeTables[0] || '');
  const [, setTick] = useState(0);

  const p1Wait = getPlayerWaitRemaining(match.player1Id, allMatches, breakMinutes, p1);
  const p2Wait = getPlayerWaitRemaining(match.player2Id, allMatches, breakMinutes, p2);
  const maxWait = Math.max(p1Wait, p2Wait);

  // Re-render every second while wait is active
  useEffect(() => {
    if (maxWait <= 0) return;
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, [maxWait > 0]);

  const formatTime = (ms: number) => {
    if (ms <= 0) return '';
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const p1Delay = p1?.delayMinutes ?? 0;
  const p2Delay = p2?.delayMinutes ?? 0;

  return (
    <div className={`bg-card rounded-lg p-4 card-shadow ${maxWait > 0 ? 'border border-destructive/40' : ''}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm">
          <span className="font-semibold">{p1?.name}</span>
          {p1Wait > 0 && (
            <span className="ml-1 text-xs bg-destructive/15 text-destructive px-1.5 py-0.5 rounded-full font-mono">⏸ {formatTime(p1Wait)}</span>
          )}
          {handicapInfo && handicapInfo.player1Handicap > 0 && (
            <span className="ml-1 text-xs bg-accent text-accent-foreground px-1.5 py-0.5 rounded">+{handicapInfo.player1Handicap}</span>
          )}
          <span className="text-muted-foreground mx-2">vs</span>
          <span className="font-semibold">{p2?.name}</span>
          {p2Wait > 0 && (
            <span className="ml-1 text-xs bg-destructive/15 text-destructive px-1.5 py-0.5 rounded-full font-mono">⏸ {formatTime(p2Wait)}</span>
          )}
          {handicapInfo && handicapInfo.player2Handicap > 0 && (
            <span className="ml-1 text-xs bg-accent text-accent-foreground px-1.5 py-0.5 rounded">+{handicapInfo.player2Handicap}</span>
          )}
        </div>
        {maxWait > 0 && (
          <span className="text-xs font-mono text-destructive">bereit in {formatTime(maxWait)}</span>
        )}
      </div>
      {/* Inline delay editor */}
      {onUpdatePlayer && (
        <div className="flex flex-wrap gap-3 mb-3 text-xs">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">{p1?.name?.split(' ')[0]}:</span>
            <Input
              type="number"
              min={0}
              value={p1Delay}
              onChange={e => {
                if (match.player1Id) onUpdatePlayer(match.player1Id, { delayMinutes: parseInt(e.target.value) || 0 });
              }}
              className="w-16 h-7 text-xs bg-secondary"
              title="Zeitverzögerung in Minuten"
            />
            <span className="text-muted-foreground">Min.</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">{p2?.name?.split(' ')[0]}:</span>
            <Input
              type="number"
              min={0}
              value={p2Delay}
              onChange={e => {
                if (match.player2Id) onUpdatePlayer(match.player2Id, { delayMinutes: parseInt(e.target.value) || 0 });
              }}
              className="w-16 h-7 text-xs bg-secondary"
              title="Zeitverzögerung in Minuten"
            />
            <span className="text-muted-foreground">Min.</span>
          </div>
        </div>
      )}
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
          {freeTables.length === 0 ? 'Kein Tisch frei' : maxWait > 0 ? `Warten (${formatTime(maxWait)})` : 'Spiel starten'}
        </Button>
      </div>
    </div>
  );
}

function ScoreEntry({ match, getPlayer, onUpdateScore, bestOf, getParticipantName, tournamentName, rounds, tournamentId, handicapInfo }: {
  match: Match;
  getPlayer: (id: string | null) => Player | null;
  onUpdateScore: (matchId: string, sets: SetScore[], effectiveBestOf?: number) => void;
  bestOf: number;
  getParticipantName: (id: string | null) => string;
  tournamentName: string;
  rounds: number;
  tournamentId: string;
  handicapInfo?: { player1Handicap: number; player2Handicap: number } | null;
}) {
  const p1 = getPlayer(match.player1Id);
  const p2 = getPlayer(match.player2Id);

  // Ab Halbfinale: Option auf 3 Gewinnsätze wenn Turnier auf 2 steht
  const isSemiOrLater = rounds >= 2 && match.round >= rounds - 2;
  const canUpgradeBestOf = bestOf === 2 && isSemiOrLater;
  const [upgradedBestOf, setUpgradedBestOf] = useState(false);
  const effectiveBestOf = canUpgradeBestOf && upgradedBestOf ? 3 : bestOf;

  const handicapP1 = handicapInfo?.player1Handicap || 0;
  const handicapP2 = handicapInfo?.player2Handicap || 0;

  const [sets, setSets] = useState<SetScore[]>(
    match.sets.length > 0 ? match.sets : [{ player1: handicapP1, player2: handicapP2 }]
  );

  const [validationError, setValidationError] = useState<string | null>(null);

  // Refs for fast keyboard navigation between set inputs
  const inputRefs = useRef<Array<{ p1: HTMLInputElement | null; p2: HTMLInputElement | null }>>([]);
  const registerRef = (idx: number, field: 'p1' | 'p2') => (el: HTMLInputElement | null) => {
    if (!inputRefs.current[idx]) inputRefs.current[idx] = { p1: null, p2: null };
    inputRefs.current[idx][field] = el;
  };
  const focusInput = (idx: number, field: 'p1' | 'p2') => {
    requestAnimationFrame(() => {
      const el = inputRefs.current[idx]?.[field];
      if (el) { el.focus(); el.select(); }
    });
  };

  const maxSets = effectiveBestOf * 2 - 1;
  const p1Wins = sets.filter(s => s.player1 >= 11 && s.player1 - s.player2 >= 2).length;
  const p2Wins = sets.filter(s => s.player2 >= 11 && s.player2 - s.player1 >= 2).length;
  const matchOver = p1Wins >= effectiveBestOf || p2Wins >= effectiveBestOf;

  const isSetComplete = (s: SetScore) =>
    (s.player1 >= 11 || s.player2 >= 11) && Math.abs(s.player1 - s.player2) >= 2;

  const updateSet = (idx: number, field: 'player1' | 'player2', value: number) => {
    const updated = [...sets];
    updated[idx] = { ...updated[idx], [field]: Math.max(0, Math.min(99, value)) };
    setSets(updated);
  };

  const addSet = () => {
    if (sets.length < maxSets && !matchOver) {
      setSets([...sets, { player1: handicapP1, player2: handicapP2 }]);
      focusInput(sets.length, 'p1');
    }
  };

  const removeSet = (idx: number) => {
    if (sets.length > 1) {
      setSets(sets.filter((_, i) => i !== idx));
    }
  };

  const saveScore = () => {
    // Logic Agent: Validate ITTF 2-point rule
    for (let i = 0; i < sets.length; i++) {
      const s = sets[i];
      if (s.player1 >= 11 || s.player2 >= 11) {
        const diff = Math.abs(s.player1 - s.player2);
        if (diff === 1) {
          // Intervene!
          setValidationError(`[Logic Agent]: Satz ${i + 1} ist ungültig (${s.player1}:${s.player2}). Laut ITTF-Regeln müssen bei Erreichen von 11 Punkten mindestens 2 Punkte Vorsprung bestehen.`);
          return;
        }
      }
    }
    setValidationError(null);
    onUpdateScore(match.id, sets, effectiveBestOf);
  };

  // Keyboard handler: Enter advances or saves; Tab on p2 -> next set p1
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, idx: number, field: 'player1' | 'player2') => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const current = sets[idx];
      // If current set complete, jump to next set or save
      if (isSetComplete(current)) {
        const willMatchEnd =
          sets.slice(0, idx + 1).filter(s => s.player1 >= 11 && s.player1 - s.player2 >= 2).length >= effectiveBestOf ||
          sets.slice(0, idx + 1).filter(s => s.player2 >= 11 && s.player2 - s.player1 >= 2).length >= effectiveBestOf;
        if (willMatchEnd) {
          saveScore();
          return;
        }
        if (idx + 1 < sets.length) {
          focusInput(idx + 1, 'p1');
        } else if (sets.length < maxSets) {
          addSet();
        } else {
          saveScore();
        }
      } else if (field === 'player1') {
        focusInput(idx, 'p2');
      } else {
        // p2 not complete yet, stay
        focusInput(idx, 'p2');
      }
    } else if (e.key === 'Tab' && !e.shiftKey && field === 'player2' && idx === sets.length - 1 && isSetComplete(sets[idx]) && !matchOver && sets.length < maxSets) {
      e.preventDefault();
      addSet();
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
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

      <p className="text-[10px] text-muted-foreground text-center mb-2">
        💡 Tipp: Zahlen tippen, <kbd className="px-1 py-0.5 rounded border border-border bg-muted text-[10px] font-mono">Enter</kbd> springt zum nächsten Feld bzw. speichert. <kbd className="px-1 py-0.5 rounded border border-border bg-muted text-[10px] font-mono">11</kbd>-Buttons für Schnellsieg.
      </p>
      <div className="space-y-2">
        {sets.map((set, i) => {
          const setComplete = isSetComplete(set);
          return (
          <div key={i} className={`flex items-center gap-2 rounded-md transition-colors ${setComplete ? 'bg-primary/5 ring-1 ring-primary/20 p-1' : ''}`}>
            <span className="text-xs text-muted-foreground w-8 text-center">S{i + 1}</span>
            <div className="flex-1 flex flex-col gap-1">
              <Input
                ref={registerRef(i, 'p1')}
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                value={set.player1 || ''}
                onChange={e => updateSet(i, 'player1', parseInt(e.target.value) || 0)}
                onFocus={handleFocus}
                onKeyDown={e => handleKeyDown(e, i, 'player1')}
                className="h-12 text-center text-lg font-bold bg-secondary"
                min={0}
                max={99}
                aria-label={`Satz ${i + 1} – Spieler 1 Punkte`}
              />
              <div className="flex gap-0.5 justify-center">
                <Button type="button" variant="ghost" size="sm" className="h-6 px-1.5 text-[10px] flex-1 min-w-0" onClick={() => { updateSet(i, 'player1', 11); focusInput(i, 'p2'); }}>11</Button>
                <Button type="button" variant="ghost" size="sm" className="h-6 px-1.5 text-[10px]" onClick={() => updateSet(i, 'player1', Math.max(0, set.player1 - 1))}>−</Button>
                <Button type="button" variant="ghost" size="sm" className="h-6 px-1.5 text-[10px]" onClick={() => updateSet(i, 'player1', set.player1 + 1)}>+</Button>
              </div>
            </div>
            <span className="text-muted-foreground text-lg">:</span>
            <div className="flex-1 flex flex-col gap-1">
              <Input
                ref={registerRef(i, 'p2')}
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                value={set.player2 || ''}
                onChange={e => updateSet(i, 'player2', parseInt(e.target.value) || 0)}
                onFocus={handleFocus}
                onKeyDown={e => handleKeyDown(e, i, 'player2')}
                className="h-12 text-center text-lg font-bold bg-secondary"
                min={0}
                max={99}
                aria-label={`Satz ${i + 1} – Spieler 2 Punkte`}
              />
              <div className="flex gap-0.5 justify-center">
                <Button type="button" variant="ghost" size="sm" className="h-6 px-1.5 text-[10px] flex-1 min-w-0" onClick={() => { updateSet(i, 'player2', 11); focusInput(i, 'p1'); }}>11</Button>
                <Button type="button" variant="ghost" size="sm" className="h-6 px-1.5 text-[10px]" onClick={() => updateSet(i, 'player2', Math.max(0, set.player2 - 1))}>−</Button>
                <Button type="button" variant="ghost" size="sm" className="h-6 px-1.5 text-[10px]" onClick={() => updateSet(i, 'player2', set.player2 + 1)}>+</Button>
              </div>
            </div>
            {sets.length > 1 && (
              <Button variant="ghost" size="icon" onClick={() => removeSet(i)} className="h-10 w-10 text-muted-foreground self-start" aria-label={`Satz ${i + 1} entfernen`}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          );
        })}
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

      {validationError && (
        <div className="mt-3 p-3 bg-destructive/10 border border-destructive/50 text-destructive text-sm rounded-md flex items-start gap-2 animate-slide-up">
          <Settings className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <p>{validationError}</p>
        </div>
      )}

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
          maxPhotos={2}
        />
      </div>
    </div>
  );
}

function CompletedMatch({ match, getPlayer, tournamentId, tournamentName, bestOf, rounds, logoUrl, tournamentDate, venueString, motto, mode, sponsors = [], onUpdateScore, getParticipantName, isHandicap, players = [] }: {
  match: Match;
  getPlayer: (id: string | null) => Player | null;
  tournamentId: string;
  tournamentName: string;
  bestOf: number;
  rounds: number;
  logoUrl?: string | null;
  tournamentDate?: string | null;
  venueString?: string;
  motto?: string;
  mode?: string;
  sponsors?: Sponsor[];
  onUpdateScore: (matchId: string, sets: SetScore[], effectiveBestOf?: number) => void;
  getParticipantName: (id: string | null) => string;
  isHandicap?: boolean;
  players?: Player[];
}) {
  const p1 = getPlayer(match.player1Id);
  const p2 = getPlayer(match.player2Id);
  const p1Wins = match.sets.filter(s => s.player1 >= 11 && s.player1 - s.player2 >= 2).length;
  const p2Wins = match.sets.filter(s => s.player2 >= 11 && s.player2 - s.player1 >= 2).length;
  const winner = getPlayer(match.winnerId);
  const [editing, setEditing] = useState(false);

  const getRoundName = (round: number, totalRounds: number): string => {
    if (mode === 'round_robin' || mode === 'swiss') return `Runde ${round + 1}`;
    const diff = totalRounds - round;
    if (diff === 1) return 'Finale';
    if (diff === 2) return 'Halbfinale';
    if (diff === 3) return 'Viertelfinale';
    if (diff === 4) return 'Achtelfinale';
    return `Runde ${round + 1}`;
  };

  if (editing) {
    const handicapInfo = isHandicap ? (() => {
      if (!p1 || !p2) return null;
      return getHandicap(p1.ttr, p2.ttr);
    })() : null;

    return (
      <div className="relative">
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-2 right-2 z-10 h-7 text-xs text-muted-foreground"
          onClick={() => setEditing(false)}
        >
          <X className="mr-1 h-3 w-3" />
          Abbrechen
        </Button>
        <ScoreEntry
          match={{ ...match, status: 'active' }}
          getPlayer={getPlayer}
          onUpdateScore={(id, sets, ebo) => {
            onUpdateScore(id, sets, ebo);
            setEditing(false);
          }}
          bestOf={bestOf}
          getParticipantName={getParticipantName}
          tournamentName={tournamentName}
          rounds={rounds}
          tournamentId={tournamentId}
          handicapInfo={handicapInfo}
        />
      </div>
    );
  }

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
            onClick={() => setEditing(true)}
          >
            <Settings className="mr-1 h-3 w-3" />
            Korrigieren
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground"
            onClick={() => generateMatchReport({
              match, player1: p1, player2: p2,
              tournamentName, tournamentId,
              roundName: getRoundName(match.round, rounds),
              logoUrl, bestOf, tournamentDate, venueString, motto, sponsors,
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
        maxPhotos={2}
      />
    </div>
  );
}
