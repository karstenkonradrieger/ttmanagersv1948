import { useState } from 'react';
import { useTournament } from '@/hooks/useTournament';
import { PlayerManager } from '@/components/PlayerManager';
import { TournamentBracket } from '@/components/TournamentBracket';
import { MatchScoring } from '@/components/MatchScoring';
import { LiveDashboard } from '@/components/LiveDashboard';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Swords, PenLine, Monitor, RotateCcw, Play } from 'lucide-react';

const Index = () => {
  const {
    tournament,
    addPlayer,
    removePlayer,
    generateBracket,
    updateMatchScore,
    setMatchActive,
    resetTournament,
    getPlayer,
  } = useTournament();

  const [tab, setTab] = useState('players');

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="gradient-sport border-b border-border sticky top-0 z-50">
        <div className="container py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🏓</span>
            <h1 className="text-lg font-extrabold tracking-tight">
              <span className="text-gradient">TT</span> Turnier
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {!tournament.started && tournament.players.length >= 2 && (
              <Button
                onClick={() => {
                  generateBracket();
                  setTab('bracket');
                }}
                className="h-9 font-semibold glow-green"
                size="sm"
              >
                <Play className="mr-1 h-4 w-4" />
                Start
              </Button>
            )}
            {tournament.started && (
              <Button
                variant="ghost"
                size="sm"
                onClick={resetTournament}
                className="text-destructive hover:text-destructive"
              >
                <RotateCcw className="mr-1 h-4 w-4" />
                Neu
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Info bar */}
      <div className="container py-2">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>{tournament.players.length} Spieler</span>
          {tournament.started && (
            <>
              <span>·</span>
              <span>{tournament.matches.filter(m => m.status === 'completed').length}/{tournament.matches.length} Spiele</span>
            </>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="container pb-24">
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="w-full bg-secondary h-12 p-1 rounded-xl grid grid-cols-4">
            <TabsTrigger value="players" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold text-xs gap-1">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Spieler</span>
            </TabsTrigger>
            <TabsTrigger value="bracket" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold text-xs gap-1">
              <Swords className="h-4 w-4" />
              <span className="hidden sm:inline">Bracket</span>
            </TabsTrigger>
            <TabsTrigger value="scoring" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold text-xs gap-1">
              <PenLine className="h-4 w-4" />
              <span className="hidden sm:inline">Ergebnis</span>
            </TabsTrigger>
            <TabsTrigger value="live" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold text-xs gap-1">
              <Monitor className="h-4 w-4" />
              <span className="hidden sm:inline">Live</span>
            </TabsTrigger>
          </TabsList>

          <div className="mt-4">
            <TabsContent value="players">
              <PlayerManager
                players={tournament.players}
                onAdd={addPlayer}
                onRemove={removePlayer}
                started={tournament.started}
              />
            </TabsContent>

            <TabsContent value="bracket">
              <TournamentBracket
                matches={tournament.matches}
                rounds={tournament.rounds}
                getPlayer={getPlayer}
              />
            </TabsContent>

            <TabsContent value="scoring">
              <MatchScoring
                matches={tournament.matches}
                getPlayer={getPlayer}
                onUpdateScore={updateMatchScore}
                onSetActive={setMatchActive}
              />
            </TabsContent>

            <TabsContent value="live">
              <LiveDashboard
                matches={tournament.matches}
                rounds={tournament.rounds}
                getPlayer={getPlayer}
              />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;
