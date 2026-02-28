import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/integrations/supabase/client';
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
}

function getRoundName(round: number, totalRounds: number): string {
  const diff = totalRounds - round;
  if (diff === 1) return 'Finale';
  if (diff === 2) return 'Halbfinale';
  if (diff === 3) return 'Viertelfinale';
  if (diff === 4) return 'Achtelfinale';
  return `Runde ${round + 1}`;
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
}: PlayerReportOptions) {
  const getName = (id: string | null) =>
    getParticipantName ? getParticipantName(id) : (getPlayer(id)?.name || 'Unbekannt');

  const playerMatches = matches.filter(
    m => (m.player1Id === player.id || m.player2Id === player.id) && m.status === 'completed' && m.sets.length > 0
  ).sort((a, b) => a.round - b.round || a.position - b.position);

  const doc = new jsPDF({ orientation: 'portrait', format: 'a4' });
  const w = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  let y = 10;

  // Logo
  if (logoUrl) {
    const logoData = await loadImage(logoUrl);
    if (logoData) {
      const img = new Image();
      img.src = logoData;
      const maxH = 12;
      const ratio = img.naturalWidth / img.naturalHeight || 1;
      const logoW = maxH * ratio;
      doc.addImage(logoData, 'JPEG', w - 10 - logoW, y, logoW, maxH);
    }
  }

  // Header
  doc.setFontSize(14);
  doc.setFont(undefined!, 'bold');
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

  doc.setFontSize(10);
  doc.setFont(undefined!, 'bold');
  doc.setTextColor(0);
  doc.text('Spielergebnisse', 10, y);
  y += 2;

  if (playerMatches.length > 0) {
    const tableData = playerMatches.map((m) => {
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
        getRoundName(m.round, totalRounds),
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
        0: { cellWidth: 30 },
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
  }

  // Individual match reports with photos
  for (const m of playerMatches) {
    const p1 = getPlayer(m.player1Id);
    const p2 = getPlayer(m.player2Id);
    const isP1 = m.player1Id === player.id;
    const opponent = isP1 ? p2 : p1;
    const wins = getSetWins(m.sets);

    // Check if we need a new page
    if (y > pageH - 60) {
      doc.addPage();
      y = 15;
    }

    doc.setDrawColor(220);
    doc.line(10, y, w - 10, y);
    y += 5;

    doc.setFontSize(9);
    doc.setFont(undefined!, 'bold');
    doc.setTextColor(0);
    doc.text(`${getRoundName(m.round, totalRounds)}: ${getName(m.player1Id)} vs ${getName(m.player2Id)}`, 10, y);
    y += 4;

    doc.setFontSize(14);
    doc.text(`${wins.p1} : ${wins.p2}`, w / 2, y, { align: 'center' });
    y += 5;

    // Set details inline
    doc.setFontSize(8);
    doc.setFont(undefined!, 'normal');
    doc.setTextColor(80);
    const setLine = m.sets.map((s, i) => `S${i + 1}: ${s.player1}:${s.player2}`).join('   ');
    doc.text(setLine, w / 2, y, { align: 'center' });
    y += 3;

    const isWinner = m.winnerId === player.id;
    doc.setFontSize(8);
    doc.setFont(undefined!, 'bold');
    if (isWinner) {
      doc.setTextColor(34, 197, 94);
      doc.text('✓ Sieg', w / 2, y, { align: 'center' });
    } else {
      doc.setTextColor(220, 38, 38);
      doc.text('✗ Niederlage', w / 2, y, { align: 'center' });
    }
    y += 5;

    // Photos for this match
    const { data: photos } = await supabase
      .from('match_photos')
      .select('*')
      .eq('tournament_id', tournamentId)
      .eq('match_id', m.id)
      .eq('photo_type', 'match')
      .order('created_at', { ascending: true });

    if (photos && photos.length > 0) {
      const photoWidth = 150;
      const photoHeight = 112.5;

      for (const photo of photos.slice(0, 2)) {
        const imgData = await loadImage(photo.photo_url);
        if (imgData) {
          if (y + photoHeight > pageH - 15) {
            doc.addPage();
            y = 15;
          }
          const x = (w - photoWidth) / 2;
          doc.addImage(imgData, 'JPEG', x, y, photoWidth, photoHeight);
          y += photoHeight + 4;
        }
      }
    }
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
