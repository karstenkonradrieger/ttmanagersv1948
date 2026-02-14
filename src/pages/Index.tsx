import { useState } from 'react';
import { useTournamentDb } from '@/hooks/useTournamentDb';
import { useAuth } from '@/hooks/useAuth';
import { useClubs } from '@/hooks/useClubs';
import { TournamentSelector } from '@/components/TournamentSelector';
import { PlayerManager } from '@/components/PlayerManager';
import { PlayerImportExport } from '@/components/PlayerImportExport';
import { ClubManager } from '@/components/ClubManager';
import { TournamentBracket } from '@/components/TournamentBracket';
import { MatchScoring } from '@/components/MatchScoring';
import { LiveDashboard } from '@/components/LiveDashboard';
import { TournamentOverview } from '@/components/TournamentOverview';
import { LogoUpload } from '@/components/LogoUpload';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Swords, PenLine, Monitor, RotateCcw, Play, ArrowLeft, Loader2, ClipboardList, LogOut, Building2 } from 'lucide-react';

const Index = () => {
  const { signOut } = useAuth();
  const { clubs, addClub, removeClub } = useClubs();
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null);
  const {
    tournament,
    loading,
    addPlayer,
    removePlayer,
    updatePlayer,
    importPlayers,
    generateBracket,
    updateMatchScore,
    setMatchActive,
    getPlayer,
    setTableCount,
    autoAssignTables,
    updateLogoUrl,
  } = useTournamentDb(selectedTournamentId);

  const [tab, setTab] = useState('players');

  // If no tournament selected, show tournament list
  if (!selectedTournamentId) {
    return (
      <div className="min-h-screen bg-background">
        <header className="gradient-sport border-b border-border sticky top-0 z-50">
           <div className="container py-3 flex items-center gap-2">
            <span className="text-2xl">🏓</span>
            <h1 className="text-sm sm:text-lg font-extrabold tracking-tight leading-tight flex-1">
              <span className="text-gradient">TT</span> Turniermanager
              <span className="hidden sm:inline"> SV Straßgräbchen 1948 e.V</span>
              <span className="block text-xs font-semibold text-muted-foreground sm:inline sm:text-sm"> Sektion Tischtennis</span>
            </h1>
            <Button variant="ghost" size="icon" onClick={signOut} className="h-8 w-8 text-muted-foreground">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>
        <div className="container py-6">
          <TournamentSelector
            selectedId={selectedTournamentId}
            onSelect={(id) => setSelectedTournamentId(id || null)}
          />
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="gradient-sport border-b border-border sticky top-0 z-50">
        <div className="container py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedTournamentId(null)}
              className="h-8 w-8 flex-shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <LogoUpload
              tournamentId={selectedTournamentId}
              logoUrl={tournament.logoUrl}
              onLogoChange={updateLogoUrl}
            />
            <div className="min-w-0">
              <h1 className="text-sm sm:text-lg font-extrabold tracking-tight leading-tight truncate">
                {tournament.name || 'Turnier'}
              </h1>
            </div>
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
                onClick={() => setSelectedTournamentId(null)}
                className="text-muted-foreground"
              >
                <RotateCcw className="mr-1 h-4 w-4" />
                Zurück
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
          <TabsList className="w-full bg-secondary h-12 p-1 rounded-xl grid grid-cols-6">
            <TabsTrigger value="players" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold text-xs gap-1">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Spieler</span>
            </TabsTrigger>
            <TabsTrigger value="clubs" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold text-xs gap-1">
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">Vereine</span>
            </TabsTrigger>
            <TabsTrigger value="bracket" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold text-xs gap-1">
              <Swords className="h-4 w-4" />
              <span className="hidden sm:inline">Bracket</span>
            </TabsTrigger>
            <TabsTrigger value="scoring" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold text-xs gap-1">
              <PenLine className="h-4 w-4" />
              <span className="hidden sm:inline">Ergebnis</span>
            </TabsTrigger>
            <TabsTrigger value="overview" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold text-xs gap-1">
              <ClipboardList className="h-4 w-4" />
              <span className="hidden sm:inline">Übersicht</span>
            </TabsTrigger>
            <TabsTrigger value="live" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold text-xs gap-1">
              <Monitor className="h-4 w-4" />
              <span className="hidden sm:inline">Live</span>
            </TabsTrigger>
          </TabsList>
          <div className="flex justify-end mt-2">
            {tab === 'live' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`/live/${selectedTournamentId}`, '_blank')}
                className="gap-1 text-xs"
              >
                <Monitor className="h-3 w-3" />
                Im neuen Fenster öffnen
              </Button>
            )}
          </div>

          <div className="mt-4">
            <TabsContent value="players">
              <div className="mb-3">
                <PlayerImportExport
                  players={tournament.players}
                  onImport={importPlayers}
                  started={tournament.started}
                />
              </div>
              <PlayerManager
                players={tournament.players}
                onAdd={addPlayer}
                onRemove={removePlayer}
                onUpdate={updatePlayer}
                started={tournament.started}
                clubs={clubs}
                onAddClub={addClub}
              />
            </TabsContent>

            <TabsContent value="clubs">
              <ClubManager
                clubs={clubs}
                onAdd={addClub}
                onRemove={removeClub}
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
                tableCount={tournament.tableCount}
                onTableCountChange={setTableCount}
                onAutoAssign={autoAssignTables}
              />
            </TabsContent>

            <TabsContent value="overview">
              <TournamentOverview
                tournamentName={tournament.name}
                matches={tournament.matches}
                rounds={tournament.rounds}
                getPlayer={getPlayer}
                players={tournament.players}
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
