import { useState } from 'react';
import { Player, DoublesPair } from '@/types/tournament';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Shuffle, TrendingUp, Plus, Users } from 'lucide-react';

interface Props {
  players: Player[];
  doublesPairs: DoublesPair[];
  onAddPair: (player1Id: string, player2Id: string, pairName: string) => void;
  onRemovePair: (pairId: string) => void;
  onAutoGenerate: (method: 'ttr' | 'random') => void;
  started: boolean;
  getPlayer: (id: string | null) => Player | null;
}

export function DoublesManager({ players, doublesPairs, onAddPair, onRemovePair, onAutoGenerate, started, getPlayer }: Props) {
  const [player1Id, setPlayer1Id] = useState('');
  const [player2Id, setPlayer2Id] = useState('');

  // Players already in a pair
  const pairedPlayerIds = new Set(
    doublesPairs.flatMap(dp => [dp.player1Id, dp.player2Id])
  );

  const availablePlayers = players.filter(p => !pairedPlayerIds.has(p.id));

  const handleAddPair = () => {
    if (!player1Id || !player2Id || player1Id === player2Id) return;
    const p1 = players.find(p => p.id === player1Id);
    const p2 = players.find(p => p.id === player2Id);
    const pairName = `${p1?.name || '?'} / ${p2?.name || '?'}`;
    onAddPair(player1Id, player2Id, pairName);
    setPlayer1Id('');
    setPlayer2Id('');
  };

  return (
    <div className="space-y-4 animate-slide-up">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Doppelpaare ({doublesPairs.length})
        </h3>
        {!started && players.length >= 2 && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onAutoGenerate('ttr')} className="gap-1 text-xs">
              <TrendingUp className="h-3 w-3" />
              Nach TTR
            </Button>
            <Button variant="outline" size="sm" onClick={() => onAutoGenerate('random')} className="gap-1 text-xs">
              <Shuffle className="h-3 w-3" />
              Zufällig
            </Button>
          </div>
        )}
      </div>

      {/* Manual pair creation */}
      {!started && availablePlayers.length >= 2 && (
        <div className="bg-card rounded-lg p-4 card-shadow">
          <p className="text-sm font-semibold mb-3">Manuell zuordnen</p>
          <div className="flex flex-wrap gap-2">
            <Select value={player1Id} onValueChange={setPlayer1Id}>
              <SelectTrigger className="w-[180px] bg-secondary">
                <SelectValue placeholder="Spieler 1" />
              </SelectTrigger>
              <SelectContent>
                {availablePlayers.filter(p => p.id !== player2Id).map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={player2Id} onValueChange={setPlayer2Id}>
              <SelectTrigger className="w-[180px] bg-secondary">
                <SelectValue placeholder="Spieler 2" />
              </SelectTrigger>
              <SelectContent>
                {availablePlayers.filter(p => p.id !== player1Id).map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleAddPair} disabled={!player1Id || !player2Id} className="gap-1">
              <Plus className="h-4 w-4" />
              Hinzufügen
            </Button>
          </div>
        </div>
      )}

      {/* Pairs list */}
      {doublesPairs.length === 0 ? (
        <div className="text-center text-muted-foreground py-8">
          <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
          <p>Noch keine Doppelpaare erstellt</p>
          <p className="text-xs">Erstelle Paare manuell oder automatisch</p>
        </div>
      ) : (
        <div className="space-y-2">
          {doublesPairs.map((pair, i) => {
            const p1 = getPlayer(pair.player1Id);
            const p2 = getPlayer(pair.player2Id);
            return (
              <div key={pair.id} className="bg-card rounded-lg p-3 card-shadow flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground font-mono w-6">{i + 1}.</span>
                  <div>
                    <p className="font-semibold text-sm">{pair.pairName}</p>
                    <div className="flex gap-3 text-xs text-muted-foreground">
                      <span>TTR: {p1?.ttr || '?'} + {p2?.ttr || '?'} = {(p1?.ttr || 0) + (p2?.ttr || 0)}</span>
                      {p1?.club && <span>{p1.club}</span>}
                    </div>
                  </div>
                </div>
                {!started && (
                  <Button variant="ghost" size="icon" onClick={() => onRemovePair(pair.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Unpaired players */}
      {availablePlayers.length > 0 && availablePlayers.length < players.length && (
        <div className="text-xs text-muted-foreground">
          <span className="font-semibold">{availablePlayers.length}</span> Spieler noch ohne Paar: {availablePlayers.map(p => p.name).join(', ')}
        </div>
      )}
    </div>
  );
}
