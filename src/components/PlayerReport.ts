import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Match, Player, SetScore } from '@/types/tournament';

function getSetWins(sets: SetScore[]): { p1: number; p2: number } {
  let p1 = 0, p2 = 0;
  for (const s of sets) {
    if (s.player1 >= 11 && s.player1 - s.player2 >= 2) p1++;
    else if (s.player2 >= 11 && s.player2 - s.player1 >= 2) p2++;
  }
  return { p1, p2 };
}

async function loadImage(url: string): Promise<string | null> {
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject();
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext('2d')!.drawImage(img, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.85);
  } catch {
    return null;
  }
}

export type PlayerReportPhaseFilter = 'all' | 'group' | 'ko';

interface PlayerReportOptions {
  player: Player;
  matches: Match[];
  getPlayer: (id: string | null) => Player | null;
  getParticipantName?: (id: string | null) => string;
  tournamentName: string;
  tournamentId: string;
  totalRounds: number;
  logoUrl?: string | null;
  bestOf: number;
  tournamentDate?: string | null;
  venueString?: string;
  motto?: string;
  mode?: string;
  phaseFilter?: PlayerReportPhaseFilter;
}

function getRoundName(match: Match, totalRounds: number, koRounds: number, mode?: string): string {
  // Group phase match
  if (match.groupNumber != null) {
    return `Gruppe ${match.groupNumber} – Runde ${match.round + 1}`;
  }
  if (mode === 'round_robin' || mode === 'swiss') return `Runde ${match.round + 1}`;
  // KO phase: use koRounds for correct naming
  const rounds = koRounds > 0 ? koRounds : totalRounds;
  const diff = rounds - match.round;
  if (diff === 1) return 'Finale';
  if (diff === 2) return 'Halbfinale';
  if (diff === 3) return 'Viertelfinale';
  if (diff === 4) return 'Achtelfinale';
  return `Runde ${match.round + 1}`;
}

export async function generatePlayerReport({
  player,
  matches,
  getPlayer,
  getParticipantName,
  tournamentName,
  tournamentId,
  totalRounds,
  logoUrl,
  bestOf,
  tournamentDate,
  venueString,
  motto,
  mode,
  phaseFilter = 'all',
}: PlayerReportOptions) {
  const getName = (id: string | null) =>
    getParticipantName ? getParticipantName(id) : (getPlayer(id)?.name || 'Unbekannt');

  const allPlayerMatches = matches.filter(
    m => (m.player1Id === player.id || m.player2Id === player.id) && m.status === 'completed' && m.sets.length > 0
  ).sort((a, b) => a.round - b.round || a.position - b.position);

  const playerMatches = phaseFilter === 'group'
    ? allPlayerMatches.filter(m => m.groupNumber != null)
    : phaseFilter === 'ko'
      ? allPlayerMatches.filter(m => m.groupNumber == null)
      : allPlayerMatches;

  const doc = new jsPDF({ orientation: 'portrait', format: 'a4' });
  const w = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  let y = 10;
  const logoStartY = y;

  // Filter label top-right
  const filterLabel = phaseFilter === 'group' ? 'Nur Gruppenphase' : phaseFilter === 'ko' ? 'Nur K.O.-Runde' : 'Alle Spiele';
  doc.setFontSize(8);
  doc.setFont(undefined!, 'italic');
  doc.setTextColor(120);
  doc.text(filterLabel, w - 10, y + 2, { align: 'right' });

  // Header
  doc.setFontSize(14);
  doc.setFont(undefined!, 'bold');
  doc.setTextColor(0);
  doc.text('Spielerbericht', 10, y + 5);
  y += 10;

  doc.setFontSize(9);
  doc.setFont(undefined!, 'normal');
  doc.setTextColor(100);
  const infoParts = [tournamentName];
  if (tournamentDate) {
    infoParts.push(new Date(tournamentDate + 'T00:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }));
  }
  if (venueString) infoParts.push(venueString);
  doc.text(infoParts.join('  •  '), 10, y);
  y += 4;
  if (motto) {
    doc.setFont(undefined!, 'italic');
    doc.text(`"${motto}"`, 10, y);
    y += 4;
  }

  // Separator
  doc.setDrawColor(200);
  doc.setLineWidth(0.3);
  doc.line(10, y, w - 10, y);
  y += 6;

  // Logo (drawn last to appear in foreground, overlaying separator)
  if (logoUrl) {
    const logoData = await loadImage(logoUrl);
    if (logoData) {
      const img = new Image();
      img.src = logoData;
      const maxH = 36;
      const ratio = img.naturalWidth / img.naturalHeight || 1;
      const logoW = maxH * ratio;
      doc.addImage(logoData, 'JPEG', w - 10 - logoW, logoStartY, logoW, maxH);
    }
  }

  // Player info
  doc.setTextColor(0);
  doc.setFontSize(16);
  doc.setFont(undefined!, 'bold');
  doc.text(player.name, 10, y);
  y += 6;

  doc.setFontSize(9);
  doc.setFont(undefined!, 'normal');
  doc.setTextColor(80);
  const playerInfo: string[] = [];
  if (player.club) playerInfo.push(player.club);
  if (player.ttr) playerInfo.push(`TTR: ${player.ttr}`);
  if (player.gender) playerInfo.push(player.gender === 'm' ? 'Männlich' : player.gender === 'w' ? 'Weiblich' : 'Divers');
  if (playerInfo.length > 0) {
    doc.text(playerInfo.join('  |  '), 10, y);
    y += 6;
  }

  // Stats summary
  const won = playerMatches.filter(m => m.winnerId === player.id).length;
  const lost = playerMatches.length - won;
  let setsWon = 0, setsLost = 0, ptsWon = 0, ptsLost = 0;
  for (const m of playerMatches) {
    const isP1 = m.player1Id === player.id;
    for (const s of m.sets) {
      const my = isP1 ? s.player1 : s.player2;
      const opp = isP1 ? s.player2 : s.player1;
      ptsWon += my;
      ptsLost += opp;
      if (my >= 11 && my - opp >= 2) setsWon++;
      else if (opp >= 11 && opp - my >= 2) setsLost++;
    }
  }

  doc.setTextColor(0);
  doc.setFontSize(10);
  doc.setFont(undefined!, 'bold');
  doc.text('Übersicht', 10, y);
  y += 5;

  doc.setFontSize(9);
  doc.setFont(undefined!, 'normal');
  const statsLine = `${playerMatches.length} Spiele  |  ${won} Siege  |  ${lost} Niederlagen  |  Sätze ${setsWon}:${setsLost}  |  Punkte ${ptsWon}:${ptsLost}`;
  doc.text(statsLine, 10, y);
  y += 4;

  const winRate = playerMatches.length > 0 ? ((won / playerMatches.length) * 100).toFixed(0) : '0';
  doc.text(`Siegquote: ${winRate}%`, 10, y);
  y += 6;

  // Match results table
  doc.setDrawColor(200);
  doc.line(10, y, w - 10, y);
  y += 4;

  // Separate group and KO matches
  const groupMatches = playerMatches.filter(m => m.groupNumber != null);
  const koMatches = playerMatches.filter(m => m.groupNumber == null);
  const koRounds = koMatches.length > 0 ? Math.max(...koMatches.map(m => m.round)) + 1 : 0;

  const renderMatchTable = (title: string, sectionMatches: Match[]) => {
    if (sectionMatches.length === 0) return;

    doc.setFontSize(10);
    doc.setFont(undefined!, 'bold');
    doc.setTextColor(0);
    doc.text(title, 10, y);
    y += 2;

    const tableData = sectionMatches.map((m) => {
      const isP1 = m.player1Id === player.id;
      const opponentId = isP1 ? m.player2Id : m.player1Id;
      const wins = getSetWins(m.sets);
      const mySets = isP1 ? wins.p1 : wins.p2;
      const oppSets = isP1 ? wins.p2 : wins.p1;
      const isWinner = m.winnerId === player.id;
      const setsStr = m.sets.map(s => {
        const my = isP1 ? s.player1 : s.player2;
        const opp = isP1 ? s.player2 : s.player1;
        return `${my}:${opp}`;
      }).join(', ');

      return [
        getRoundName(m, totalRounds, koRounds, mode),
        getName(opponentId),
        `${mySets}:${oppSets}`,
        setsStr,
        isWinner ? 'Sieg' : 'Niederlage',
      ];
    });

    autoTable(doc, {
      startY: y,
      head: [['Runde', 'Gegner', 'Sätze', 'Ergebnisse', 'Resultat']],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [34, 197, 94],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
      },
      styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
      columnStyles: {
        0: { cellWidth: 36 },
        2: { cellWidth: 16, halign: 'center' },
        4: { cellWidth: 24 },
      },
      didParseCell(data) {
        if (data.section === 'body' && data.column.index === 4) {
          if (data.cell.raw === 'Sieg') {
            data.cell.styles.textColor = [34, 197, 94];
            data.cell.styles.fontStyle = 'bold';
          } else {
            data.cell.styles.textColor = [220, 38, 38];
          }
        }
      },
    });

    y = (doc as any).lastAutoTable.finalY + 8;
  };

  if (groupMatches.length > 0 && koMatches.length > 0) {
    renderMatchTable('Gruppenphase', groupMatches);
    renderMatchTable('K.O.-Runde', koMatches);
  } else {
    renderMatchTable('Spielergebnisse', playerMatches);
  }

  // Footer on every page
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(180);
    doc.text(
      `Spielerbericht: ${player.name} – ${tournamentName} – Seite ${i}/${totalPages}`,
      w / 2,
      pageH - 8,
      { align: 'center' }
    );
  }

  doc.save(`Spielerbericht_${player.name.replace(/\s+/g, '_')}.pdf`);
}
