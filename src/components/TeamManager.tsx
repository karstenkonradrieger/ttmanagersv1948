import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Users, ArrowUpDown } from 'lucide-react';
import { Player, Team, TeamPlayer, TeamMode, TEAM_GAME_SEQUENCES } from '@/types/tournament';
import { toast } from 'sonner';

interface Props {
  players: Player[];
  teams: Team[];
  teamPlayers: TeamPlayer[];
  teamMode: TeamMode | null;
  started: boolean;
  onAddTeam: (name: string) => Promise<void>;
  onRemoveTeam: (teamId: string) => Promise<void>;
  onAddPlayerToTeam: (teamId: string, playerId: string, position: number) => Promise<void>;
  onRemovePlayerFromTeam: (teamPlayerId: string) => Promise<void>;
  getPlayer: (id: string | null) => Player | null;
}

export function TeamManager({
  players, teams, teamPlayers, teamMode, started,
  onAddTeam, onRemoveTeam, onAddPlayerToTeam, onRemovePlayerFromTeam, getPlayer,
}: Props) {
  const [newTeamName, setNewTeamName] = useState('');

  const requiredSize = teamMode ? TEAM_GAME_SEQUENCES[teamMode].teamSize : 4;

  const assignedPlayerIds = new Set(teamPlayers.map(tp => tp.playerId));
  const unassignedPlayers = players.filter(p => !assignedPlayerIds.has(p.id));

  const getTeamPlayers = (teamId: string) =>
    teamPlayers
      .filter(tp => tp.teamId === teamId)
      .sort((a, b) => a.position - b.position);

  const handleAddTeam = async () => {
    if (!newTeamName.trim()) return;
    await onAddTeam(newTeamName.trim());
    setNewTeamName('');
  };

  const handleAssignPlayer = async (teamId: string, playerId: string) => {
    const currentPlayers = getTeamPlayers(teamId);
    if (currentPlayers.length >= requiredSize) {
      toast.error(`Maximal ${requiredSize} Spieler pro Team`);
      return;
    }
    const nextPosition = currentPlayers.length + 1;
    await onAddPlayerToTeam(teamId, playerId, nextPosition);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <Users className="h-5 w-5" />
          Mannschaften
          {teamMode && (
            <Badge variant="secondary" className="text-xs">
              {teamMode === 'bundessystem' ? 'Bundessystem (4er)' :
               teamMode === 'werner_scheffler' ? 'Werner-Scheffler (4er)' :
               teamMode === 'olympic' ? 'Olympisch (3er)' :
               'Corbillon-Cup (2er)'}
            </Badge>
          )}
        </h3>
      </div>

      {!started && (
        <div className="flex gap-2">
          <Input
            placeholder="Teamname..."
            value={newTeamName}
            onChange={e => setNewTeamName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddTeam()}
          />
          <Button onClick={handleAddTeam} disabled={!newTeamName.trim()} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Team
          </Button>
        </div>
      )}

      {teams.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          Erstelle mindestens 2 Mannschaften und weise Spieler zu.
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {teams.map(team => {
            const tPlayers = getTeamPlayers(team.id);
            const isFull = tPlayers.length >= requiredSize;

            return (
              <Card key={team.id} className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-sm">{team.name}</h4>
                  <div className="flex items-center gap-2">
                    <Badge variant={isFull ? 'default' : 'secondary'} className="text-xs">
                      {tPlayers.length}/{requiredSize}
                    </Badge>
                    {!started && (
                      <Button
                        variant="ghost" size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => onRemoveTeam(team.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  {tPlayers.map(tp => {
                    const player = getPlayer(tp.playerId);
                    return (
                      <div key={tp.id} className="flex items-center justify-between bg-secondary/50 rounded px-2 py-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-muted-foreground w-5">#{tp.position}</span>
                          <span className="text-sm font-medium">{player?.name || '—'}</span>
                          {player?.club && (
                            <span className="text-xs text-muted-foreground">({player.club})</span>
                          )}
                        </div>
                        {!started && (
                          <Button
                            variant="ghost" size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                            onClick={() => onRemovePlayerFromTeam(tp.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    );
                  })}

                  {!started && !isFull && unassignedPlayers.length > 0 && (
                    <Select onValueChange={(playerId) => handleAssignPlayer(team.id, playerId)}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Spieler hinzufügen..." />
                      </SelectTrigger>
                      <SelectContent>
                        {unassignedPlayers.map(p => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} {p.club ? `(${p.club})` : ''} — TTR {p.ttr}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {unassignedPlayers.length > 0 && !started && (
        <p className="text-xs text-muted-foreground">
          {unassignedPlayers.length} Spieler noch keinem Team zugeordnet
        </p>
      )}
    </div>
  );
}
