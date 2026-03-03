import { useState, useEffect } from 'react';
import { Match, Player, SetScore, Team, TeamPlayer, TeamMode, EncounterGame } from '@/types/tournament';
import { EncounterView } from '@/components/EncounterView';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Play, Settings, Zap, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  matches: Match[];
  teams: Team[];
  teamPlayers: TeamPlayer[];
  teamMode: TeamMode;
  bestOf: number;
  earlyFinishEnabled: boolean;
  getPlayer: (id: string | null) => Player | null;
  encounterGames: Record<string, EncounterGame[]>;
  loadEncounterGames: (matchId: string) => Promise<EncounterGame[]>;
  updateEncounterGameScore: (gameId: string, matchId: string, sets: SetScore[]) => Promise<void>;
  onSetActive: (matchId: string, table?: number) => void;
  tableCount: number;
  onTableCountChange: (count: number) => void;
  onAutoAssign: () => void;
}

export function TeamEncounterScoring({
  matches, teams, teamPlayers, teamMode, bestOf, earlyFinishEnabled,
  getPlayer, encounterGames, loadEncounterGames, updateEncounterGameScore,
  onSetActive, tableCount, onTableCountChange, onAutoAssign,
}: Props) {
  const [expandedMatch, setExpandedMatch] = useState<string | null>(null);

  const teamMatches = matches.filter(m => m.homeTeamId && m.awayTeamId);
  const pendingMatches = teamMatches.filter(m => m.status === 'pending');
  const activeMatches = teamMatches.filter(m => m.status === 'active');
  const completedMatches = teamMatches.filter(m => m.status === 'completed');

  const activeTables = new Set(activeMatches.filter(m => m.table).map(m => m.table));
  const freeTables = Array.from({ length: tableCount }, (_, i) => i + 1).filter(t => !activeTables.has(t));

  const getTeam = (id: string | null) => id ? teams.find(t => t.id === id) || null : null;

  const handleExpand = async (matchId: string) => {
    if (expandedMatch === matchId) {
      setExpandedMatch(null);
      return;
    }
    if (!encounterGames[matchId]) {
      await loadEncounterGames(matchId);
    }
    setExpandedMatch(matchId);
  };

  if (teamMatches.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-12">
        Starte zuerst das Turnier
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Table config */}
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
          {pendingMatches.length > 0 && freeTables.length > 0 && (
            <Button onClick={onAutoAssign} size="sm" className="h-9">
              <Zap className="mr-1 h-4 w-4" />
              Auto-Zuweisen
            </Button>
          )}
        </div>
      </div>

      {/* Active encounters */}
      {activeMatches.length > 0 && (
        <Section title="🏓 Laufende Begegnungen">
          {activeMatches.map(m => (
            <EncounterMatchCard
              key={m.id}
              match={m}
              homeTeam={getTeam(m.homeTeamId)}
              awayTeam={getTeam(m.awayTeamId)}
              expanded={expandedMatch === m.id}
              onToggle={() => handleExpand(m.id)}
              encounterGames={encounterGames[m.id] || []}
              teamPlayers={teamPlayers}
              teamMode={teamMode}
              bestOf={bestOf}
              earlyFinishEnabled={earlyFinishEnabled}
              getPlayer={getPlayer}
              updateEncounterGameScore={updateEncounterGameScore}
            />
          ))}
        </Section>
      )}

      {/* Pending encounters */}
      {pendingMatches.length > 0 && (
        <Section title="⏳ Anstehende Begegnungen">
          {pendingMatches.map(m => {
            const home = getTeam(m.homeTeamId);
            const away = getTeam(m.awayTeamId);
            return (
              <Card key={m.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm">
                    <span className="font-semibold">{home?.name || 'Heim'}</span>
                    <span className="text-muted-foreground mx-2">vs</span>
                    <span className="font-semibold">{away?.name || 'Gast'}</span>
                  </div>
                  <div className="flex gap-2">
                    <select
                      className="w-28 h-10 rounded-md border border-input bg-secondary px-3 text-sm"
                      onChange={e => {
                        const table = parseInt(e.target.value);
                        if (table) onSetActive(m.id, table);
                      }}
                      defaultValue=""
                    >
                      <option value="">Tisch...</option>
                      {freeTables.map(t => (
                        <option key={t} value={t}>Tisch {t}</option>
                      ))}
                    </select>
                    <Button
                      onClick={() => onSetActive(m.id, freeTables[0])}
                      disabled={freeTables.length === 0}
                    >
                      <Play className="mr-2 h-4 w-4" />
                      Starten
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </Section>
      )}

      {/* Completed encounters */}
      {completedMatches.length > 0 && (
        <Section title="✅ Abgeschlossene Begegnungen">
          {completedMatches.map(m => (
            <EncounterMatchCard
              key={m.id}
              match={m}
              homeTeam={getTeam(m.homeTeamId)}
              awayTeam={getTeam(m.awayTeamId)}
              expanded={expandedMatch === m.id}
              onToggle={() => handleExpand(m.id)}
              encounterGames={encounterGames[m.id] || []}
              teamPlayers={teamPlayers}
              teamMode={teamMode}
              bestOf={bestOf}
              earlyFinishEnabled={earlyFinishEnabled}
              getPlayer={getPlayer}
              updateEncounterGameScore={updateEncounterGameScore}
            />
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

function EncounterMatchCard({
  match, homeTeam, awayTeam, expanded, onToggle,
  encounterGames, teamPlayers, teamMode, bestOf, earlyFinishEnabled,
  getPlayer, updateEncounterGameScore,
}: {
  match: Match;
  homeTeam: Team | null;
  awayTeam: Team | null;
  expanded: boolean;
  onToggle: () => void;
  encounterGames: EncounterGame[];
  teamPlayers: TeamPlayer[];
  teamMode: TeamMode;
  bestOf: number;
  earlyFinishEnabled: boolean;
  getPlayer: (id: string | null) => Player | null;
  updateEncounterGameScore: (gameId: string, matchId: string, sets: SetScore[]) => Promise<void>;
}) {
  return (
    <Card className={`overflow-hidden ${match.status === 'completed' ? 'bg-muted/30' : 'border-primary/30 border-2'}`}>
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-center justify-between hover:bg-accent/50 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="text-center">
            <p className="font-bold">{homeTeam?.name || 'Heim'}</p>
          </div>
          <span className="text-muted-foreground">vs</span>
          <div className="text-center">
            <p className="font-bold">{awayTeam?.name || 'Gast'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {match.table && (
            <Badge variant="outline" className="text-xs">Tisch {match.table}</Badge>
          )}
          {match.status === 'completed' && (
            <Badge>Abgeschlossen</Badge>
          )}
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t px-4 pb-4">
          <EncounterView
            encounterGames={encounterGames}
            homeTeam={homeTeam}
            awayTeam={awayTeam}
            teamPlayers={teamPlayers}
            teamMode={teamMode}
            bestOf={bestOf}
            earlyFinishEnabled={earlyFinishEnabled}
            getPlayer={getPlayer}
            onUpdateEncounterGame={async (gameId, sets) => {
              await updateEncounterGameScore(gameId, match.id, sets);
            }}
          />
        </div>
      )}
    </Card>
  );
}
