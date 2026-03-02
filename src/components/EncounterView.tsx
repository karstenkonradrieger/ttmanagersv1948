import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Check, X, Users, User } from 'lucide-react';
import { EncounterGame, SetScore, Team, TeamPlayer, Player, TeamMode, TEAM_GAME_SEQUENCES } from '@/types/tournament';
import { toast } from 'sonner';

interface Props {
  encounterGames: EncounterGame[];
  homeTeam: Team | null;
  awayTeam: Team | null;
  teamPlayers: TeamPlayer[];
  teamMode: TeamMode;
  bestOf: number;
  earlyFinishEnabled: boolean;
  getPlayer: (id: string | null) => Player | null;
  onUpdateEncounterGame: (gameId: string, sets: SetScore[]) => Promise<void>;
}

export function EncounterView({
  encounterGames, homeTeam, awayTeam, teamPlayers, teamMode, bestOf,
  earlyFinishEnabled, getPlayer, onUpdateEncounterGame,
}: Props) {
  const sequence = TEAM_GAME_SEQUENCES[teamMode];
  
  // Count wins
  let homeWins = 0;
  let awayWins = 0;
  for (const g of encounterGames) {
    if (g.winnerSide === 'home') homeWins++;
    else if (g.winnerSide === 'away') awayWins++;
  }

  const isDecided = earlyFinishEnabled && (homeWins >= sequence.winsNeeded || awayWins >= sequence.winsNeeded);

  const getPlayerName = (id: string | null) => {
    if (!id) return '—';
    const p = getPlayer(id);
    return p?.name || '—';
  };

  return (
    <div className="space-y-4">
      {/* Score header */}
      <div className="flex items-center justify-center gap-6 py-4">
        <div className="text-center">
          <p className="font-bold text-lg">{homeTeam?.name || 'Heim'}</p>
          <p className="text-3xl font-extrabold text-primary">{homeWins}</p>
        </div>
        <span className="text-2xl text-muted-foreground font-light">:</span>
        <div className="text-center">
          <p className="font-bold text-lg">{awayTeam?.name || 'Gast'}</p>
          <p className="text-3xl font-extrabold text-primary">{awayWins}</p>
        </div>
      </div>

      {isDecided && (
        <div className="text-center">
          <Badge className="text-sm px-3 py-1">
            🏆 {homeWins >= sequence.winsNeeded ? homeTeam?.name : awayTeam?.name} gewinnt!
          </Badge>
        </div>
      )}

      {/* Game list */}
      <div className="space-y-2">
        {encounterGames.map((game, idx) => {
          const gameInfo = sequence.games[idx];
          const isSkipped = isDecided && game.status === 'pending';

          return (
            <EncounterGameCard
              key={game.id}
              game={game}
              gameLabel={gameInfo?.label || `Spiel ${idx + 1}`}
              gameType={gameInfo?.type || 'singles'}
              getPlayerName={getPlayerName}
              bestOf={bestOf}
              isSkipped={isSkipped}
              onUpdateSets={(sets) => onUpdateEncounterGame(game.id, sets)}
            />
          );
        })}
      </div>
    </div>
  );
}

function EncounterGameCard({
  game, gameLabel, gameType, getPlayerName, bestOf, isSkipped, onUpdateSets,
}: {
  game: EncounterGame;
  gameLabel: string;
  gameType: 'singles' | 'doubles';
  getPlayerName: (id: string | null) => string;
  bestOf: number;
  isSkipped: boolean;
  onUpdateSets: (sets: SetScore[]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [localSets, setLocalSets] = useState<SetScore[]>(game.sets.length > 0 ? game.sets : [{ player1: 0, player2: 0 }]);

  useEffect(() => {
    if (game.sets.length > 0) setLocalSets(game.sets);
  }, [game.sets]);

  const homeName = gameType === 'doubles'
    ? `${getPlayerName(game.homePlayer1Id)} / ${getPlayerName(game.homePlayer2Id)}`
    : getPlayerName(game.homePlayer1Id);

  const awayName = gameType === 'doubles'
    ? `${getPlayerName(game.awayPlayer1Id)} / ${getPlayerName(game.awayPlayer2Id)}`
    : getPlayerName(game.awayPlayer1Id);

  const handleSave = () => {
    onUpdateSets(localSets.filter(s => s.player1 > 0 || s.player2 > 0));
    setEditing(false);
  };

  const addSet = () => {
    if (localSets.length < bestOf * 2 - 1) {
      setLocalSets([...localSets, { player1: 0, player2: 0 }]);
    }
  };

  if (isSkipped) {
    return (
      <Card className="p-3 opacity-40">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">{gameLabel}</Badge>
          <span className="text-xs text-muted-foreground">Übersprungen</span>
        </div>
      </Card>
    );
  }

  return (
    <Card className={`p-3 ${game.status === 'completed' ? 'bg-muted/30' : ''}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {gameType === 'doubles' ? <Users className="h-3.5 w-3.5 text-muted-foreground" /> : <User className="h-3.5 w-3.5 text-muted-foreground" />}
          <Badge variant="outline" className="text-xs">{gameLabel}</Badge>
          {game.status === 'completed' && (
            <Badge variant="default" className="text-xs">
              {game.winnerSide === 'home' ? '← Heim' : 'Gast →'}
            </Badge>
          )}
        </div>
        {!editing && game.status !== 'completed' && (
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditing(true)}>
            Ergebnis
          </Button>
        )}
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center text-sm">
        <span className={`font-medium ${game.winnerSide === 'home' ? 'text-primary' : game.winnerSide === 'away' ? 'text-muted-foreground' : ''}`}>
          {homeName}
        </span>
        <span className="text-muted-foreground text-xs">vs</span>
        <span className={`font-medium text-right ${game.winnerSide === 'away' ? 'text-primary' : game.winnerSide === 'home' ? 'text-muted-foreground' : ''}`}>
          {awayName}
        </span>
      </div>

      {/* Sets display */}
      {game.sets.length > 0 && !editing && (
        <div className="flex gap-1 mt-2 justify-center">
          {game.sets.map((s, i) => (
            <Badge key={i} variant="secondary" className="text-xs font-mono">
              {s.player1}:{s.player2}
            </Badge>
          ))}
        </div>
      )}

      {/* Editing */}
      {editing && (
        <div className="mt-3 space-y-2">
          {localSets.map((s, i) => (
            <div key={i} className="flex items-center gap-2 justify-center">
              <span className="text-xs text-muted-foreground w-12">Satz {i + 1}</span>
              <Input
                type="number" min={0} max={99}
                className="w-14 h-7 text-center text-sm"
                value={s.player1 || ''}
                onChange={e => {
                  const v = parseInt(e.target.value) || 0;
                  setLocalSets(prev => prev.map((ps, pi) => pi === i ? { ...ps, player1: v } : ps));
                }}
              />
              <span className="text-xs">:</span>
              <Input
                type="number" min={0} max={99}
                className="w-14 h-7 text-center text-sm"
                value={s.player2 || ''}
                onChange={e => {
                  const v = parseInt(e.target.value) || 0;
                  setLocalSets(prev => prev.map((ps, pi) => pi === i ? { ...ps, player2: v } : ps));
                }}
              />
            </div>
          ))}
          <div className="flex justify-center gap-2">
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={addSet}>
              + Satz
            </Button>
            <Button size="sm" className="h-7 text-xs" onClick={handleSave}>
              <Check className="h-3 w-3 mr-1" /> Speichern
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditing(false)}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
