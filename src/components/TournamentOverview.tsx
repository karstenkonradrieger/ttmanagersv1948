import { Match, Player, SetScore } from '@/types/tournament';
import { Button } from '@/components/ui/button';
import { FileDown } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Props {
  tournamentName: string;
  matches: Match[];
  rounds: number;
  getPlayer: (id: string | null) => Player | null;
}

function getRoundName(round: number, totalRounds: number): string {
  const diff = totalRounds - round;
  if (diff === 1) return 'Finale';
  if (diff === 2) return 'Halbfinale';
  if (diff === 3) return 'Viertelfinale';
  if (diff === 4) return 'Achtelfinale';
  return `Runde ${round + 1}`;
}

function formatSets(sets: SetScore[]): string {
  if (sets.length === 0) return '–';
  return sets.map(s => `${s.player1}:${s.player2}`).join(', ');
}

function getSetWins(sets: SetScore[]): { p1: number; p2: number } {
  let p1 = 0, p2 = 0;
  for (const s of sets) {
    if (s.player1 >= 11 && s.player1 - s.player2 >= 2) p1++;
    else if (s.player2 >= 11 && s.player2 - s.player1 >= 2) p2++;
  }
  return { p1, p2 };
}

export function TournamentOverview({ tournamentName, matches, rounds, getPlayer }: Props) {
  if (matches.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-12">
        Noch keine Spiele vorhanden
      </div>
    );
  }

  const matchesByRound: Match[][] = [];
  for (let r = 0; r < rounds; r++) {
    matchesByRound.push(
      matches
        .filter(m => m.round === r)
        .sort((a, b) => a.position - b.position)
    );
  }

  const exportPdf = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    
    doc.setFontSize(18);
    doc.text(tournamentName, 14, 20);
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(`Erstellt am ${new Date().toLocaleDateString('de-DE')}`, 14, 28);
    doc.setTextColor(0);

    let startY = 36;

    for (let r = 0; r < rounds; r++) {
      const roundMatches = matchesByRound[r];
      if (!roundMatches || roundMatches.length === 0) continue;

      const roundName = getRoundName(r, rounds);

      const tableData = roundMatches.map((m, idx) => {
        const p1 = getPlayer(m.player1Id);
        const p2 = getPlayer(m.player2Id);
        const wins = getSetWins(m.sets);
        const winner = getPlayer(m.winnerId);
        const isBye = !m.player2Id && m.player1Id;
        
        return [
          `${idx + 1}`,
          p1?.name || (isBye ? '–' : 'TBD'),
          p2?.name || (isBye ? 'Freilos' : 'TBD'),
          isBye ? '–' : `${wins.p1}:${wins.p2}`,
          isBye ? '–' : formatSets(m.sets),
          isBye ? (p1?.name || '–') : (winner?.name || '–'),
          m.status === 'completed' ? '✓' : m.status === 'active' ? '▶' : '○',
        ];
      });

      autoTable(doc, {
        startY,
        head: [[roundName, 'Spieler 1', 'Spieler 2', 'Sätze', 'Satzergebnisse', 'Gewinner', '']],
        body: tableData,
        theme: 'grid',
        headStyles: { 
          fillColor: [34, 197, 94],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 10,
        },
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: {
          0: { cellWidth: 12, halign: 'center' },
          4: { cellWidth: 55 },
          6: { cellWidth: 10, halign: 'center' },
        },
      });

      startY = (doc as any).lastAutoTable.finalY + 10;

      if (startY > 170 && r < rounds - 1) {
        doc.addPage();
        startY = 20;
      }
    }

    // Summary
    const totalMatches = matches.length;
    const completed = matches.filter(m => m.status === 'completed').length;
    const finalMatch = matches.find(m => m.round === rounds - 1);
    const champion = finalMatch?.winnerId ? getPlayer(finalMatch.winnerId) : null;

    doc.setFontSize(11);
    doc.setFont(undefined!, 'bold');
    doc.text('Zusammenfassung', 14, startY);
    doc.setFont(undefined!, 'normal');
    doc.setFontSize(10);
    doc.text(`Spiele gesamt: ${totalMatches} | Abgeschlossen: ${completed}`, 14, startY + 7);
    if (champion) {
      doc.setFontSize(12);
      doc.text(`🏆 Turniersieger: ${champion.name}`, 14, startY + 16);
    }

    doc.save(`${tournamentName.replace(/\s+/g, '_')}_Ergebnisse.pdf`);
  };

  const finalMatch = matches.find(m => m.round === rounds - 1);
  const champion = finalMatch?.winnerId ? getPlayer(finalMatch.winnerId) : null;

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header with export */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">Spielübersicht</h3>
        <Button onClick={exportPdf} size="sm" className="h-9 font-semibold">
          <FileDown className="mr-1 h-4 w-4" />
          PDF Export
        </Button>
      </div>

      {/* Champion banner */}
      {champion && (
        <div className="bg-primary/10 border border-primary/30 rounded-lg p-4 text-center">
          <p className="text-sm text-muted-foreground">Turniersieger</p>
          <p className="text-xl font-extrabold text-primary">🏆 {champion.name}</p>
          {champion.club && (
            <p className="text-sm text-muted-foreground">{champion.club}</p>
          )}
        </div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card rounded-lg p-3 card-shadow text-center">
          <p className="text-2xl font-extrabold text-primary">{matches.length}</p>
          <p className="text-xs text-muted-foreground">Spiele</p>
        </div>
        <div className="bg-card rounded-lg p-3 card-shadow text-center">
          <p className="text-2xl font-extrabold text-primary">{matches.filter(m => m.status === 'completed').length}</p>
          <p className="text-xs text-muted-foreground">Abgeschlossen</p>
        </div>
        <div className="bg-card rounded-lg p-3 card-shadow text-center">
          <p className="text-2xl font-extrabold text-primary">{rounds}</p>
          <p className="text-xs text-muted-foreground">Runden</p>
        </div>
      </div>

      {/* Rounds */}
      {matchesByRound.map((roundMatches, r) => {
        if (roundMatches.length === 0) return null;
        const roundName = getRoundName(r, rounds);

        return (
          <div key={r}>
            <h4 className="font-bold text-sm mb-2 text-primary">{roundName}</h4>
            <div className="space-y-2">
              {roundMatches.map((m, idx) => {
                const p1 = getPlayer(m.player1Id);
                const p2 = getPlayer(m.player2Id);
                const wins = getSetWins(m.sets);
                const winner = getPlayer(m.winnerId);
                const isBye = !m.player2Id && m.player1Id;

                return (
                  <div
                    key={m.id}
                    className={`bg-card rounded-lg p-3 card-shadow border-l-4 ${
                      m.status === 'completed'
                        ? 'border-l-primary'
                        : m.status === 'active'
                        ? 'border-l-yellow-500'
                        : 'border-l-muted'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-sm">
                          <span className={`font-semibold ${m.winnerId === m.player1Id ? 'text-primary' : ''}`}>
                            {p1?.name || 'TBD'}
                          </span>
                          <span className="text-muted-foreground">vs</span>
                          <span className={`font-semibold ${m.winnerId === m.player2Id ? 'text-primary' : ''}`}>
                            {isBye ? 'Freilos' : (p2?.name || 'TBD')}
                          </span>
                        </div>

                        {m.sets.length > 0 && !isBye && (
                          <div className="mt-1 flex items-center gap-2">
                            <span className="text-xs font-bold text-primary">{wins.p1}:{wins.p2}</span>
                            <span className="text-xs text-muted-foreground">
                              ({formatSets(m.sets)})
                            </span>
                          </div>
                        )}
                        {isBye && (
                          <p className="text-xs text-muted-foreground mt-1">Freilos</p>
                        )}
                      </div>

                      <div className="text-right flex-shrink-0 ml-3">
                        {winner && !isBye && (
                          <span className="text-xs font-bold text-primary">🏆 {winner.name}</span>
                        )}
                        {m.status === 'active' && (
                          <span className="text-xs font-semibold text-yellow-500">▶ Live</span>
                        )}
                        {m.status === 'pending' && !isBye && (
                          <span className="text-xs text-muted-foreground">Ausstehend</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
