import jsPDF from 'jspdf';
import { Match, Player, SetScore } from '@/types/tournament';
import { computeGroupStandings, GroupStanding } from '@/components/GroupStageView';

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

interface GroupStageReportOptions {
  matches: Match[];
  players: Player[];
  getParticipantName: (id: string | null) => string;
  groupCount: number;
  tournamentName: string;
  bestOf: number;
  logoUrl?: string | null;
  tournamentDate?: string | null;
  venueString?: string;
  motto?: string;
}

export async function generateGroupStageReport({
  matches,
  players,
  getParticipantName,
  groupCount,
  tournamentName,
  bestOf,
  logoUrl,
  tournamentDate,
  venueString,
  motto,
}: GroupStageReportOptions) {
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
      const maxH = 10;
      const ratio = img.naturalWidth / img.naturalHeight || 1;
      const logoW = maxH * ratio;
      doc.addImage(logoData, 'JPEG', w - 10 - logoW, y, logoW, maxH);
    }
  }

  // Header
  doc.setFontSize(12);
  doc.setFont(undefined!, 'bold');
  doc.text('Gruppenphase – Ergebnisse', 10, y + 4);
  doc.setFontSize(8);
  doc.setFont(undefined!, 'normal');
  doc.setTextColor(100);
  const infoParts = [tournamentName];
  if (tournamentDate) {
    infoParts.push(new Date(tournamentDate + 'T00:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }));
  }
  doc.text(infoParts.join('  •  '), 10, y + 9);
  let extraY = 0;
  if (motto) {
    doc.setFont(undefined!, 'italic');
    doc.text(`"${motto}"`, 10, y + 13);
    extraY += 4;
  }
  if (venueString) {
    doc.setFont(undefined!, 'normal');
    doc.text(venueString, 10, y + 13 + extraY);
    y += 18 + extraY;
  } else {
    y += 14 + extraY;
  }

  doc.setDrawColor(200);
  doc.setLineWidth(0.3);
  doc.line(10, y, w - 10, y);
  y += 6;

  const maxSets = bestOf * 2 - 1;

  for (let g = 0; g < groupCount; g++) {
    const gMatches = matches.filter(m => m.groupNumber === g);
    const standings = computeGroupStandings(gMatches, getParticipantName);

    // Check if we need a new page (need ~60mm minimum for a group)
    if (y > pageH - 70) {
      doc.addPage();
      y = 15;
    }

    // Group title
    doc.setTextColor(0);
    doc.setFontSize(10);
    doc.setFont(undefined!, 'bold');
    doc.text(`Gruppe ${String.fromCharCode(65 + g)}`, 10, y);
    y += 5;

    // Standings table
    const cols = [
      { label: '#', x: 10, w: 8, align: 'center' as const },
      { label: 'Spieler', x: 18, w: 52, align: 'left' as const },
      { label: 'Sp.', x: 70, w: 12, align: 'center' as const },
      { label: 'S', x: 82, w: 12, align: 'center' as const },
      { label: 'N', x: 94, w: 12, align: 'center' as const },
      { label: 'Sätze', x: 106, w: 20, align: 'center' as const },
      { label: 'Punkte', x: 126, w: 24, align: 'center' as const },
    ];

    // Header row
    doc.setFillColor(230, 230, 230);
    doc.rect(10, y - 3, 140, 5, 'F');
    doc.setFontSize(7);
    doc.setFont(undefined!, 'bold');
    doc.setTextColor(80);
    for (const col of cols) {
      if (col.align === 'center') {
        doc.text(col.label, col.x + col.w / 2, y, { align: 'center' });
      } else {
        doc.text(col.label, col.x + 1, y);
      }
    }
    y += 5;

    // Data rows
    doc.setFont(undefined!, 'normal');
    doc.setTextColor(0);
    doc.setFontSize(7);
    standings.forEach((s, i) => {
      if (i % 2 === 1) {
        doc.setFillColor(248, 248, 248);
        doc.rect(10, y - 3, 140, 5, 'F');
      }
      if (i < 2) {
        doc.setFillColor(220, 240, 220);
        doc.rect(10, y - 3, 140, 5, 'F');
      }

      doc.text(`${i + 1}`, 14, y, { align: 'center' });
      const name = s.name.length > 24 ? s.name.substring(0, 23) + '…' : s.name;
      doc.setFont(undefined!, 'bold');
      doc.text(name, 19, y);
      doc.setFont(undefined!, 'normal');
      doc.text(`${s.played}`, 76, y, { align: 'center' });
      doc.text(`${s.won}`, 88, y, { align: 'center' });
      doc.text(`${s.lost}`, 100, y, { align: 'center' });
      doc.text(`${s.setsWon}:${s.setsLost}`, 116, y, { align: 'center' });
      doc.text(`${s.pointsWon}:${s.pointsLost}`, 138, y, { align: 'center' });
      y += 5;
    });

    y += 3;

    // Match results for this group
    doc.setFontSize(7);
    doc.setFont(undefined!, 'bold');
    doc.setTextColor(80);
    doc.text('Spiele:', 10, y);
    y += 4;

    doc.setFont(undefined!, 'normal');
    doc.setTextColor(0);
    for (const m of gMatches) {
      if (!m.player1Id || !m.player2Id) continue;
      const p1 = getParticipantName(m.player1Id);
      const p2 = getParticipantName(m.player2Id);
      const wins = getSetWins(m.sets);

      if (y > pageH - 15) {
        doc.addPage();
        y = 15;
      }

      if (m.status === 'completed') {
        const winnerMark1 = m.winnerId === m.player1Id ? '● ' : '  ';
        const winnerMark2 = m.winnerId === m.player2Id ? '● ' : '  ';
        const setsStr = m.sets.map(s => `${s.player1}:${s.player2}`).join(', ');
        const p1Short = p1.length > 18 ? p1.substring(0, 17) + '…' : p1;
        const p2Short = p2.length > 18 ? p2.substring(0, 17) + '…' : p2;
        doc.text(`${winnerMark1}${p1Short}  ${wins.p1}:${wins.p2}  ${winnerMark2}${p2Short}   (${setsStr})`, 12, y);
      } else {
        doc.text(`  ${p1}  vs  ${p2}  (ausstehend)`, 12, y);
      }
      y += 4;
    }

    y += 6;
  }

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(180);
  doc.text(
    `Erstellt am ${new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}  •  Best of ${bestOf * 2 - 1}`,
    w / 2,
    pageH - 8,
    { align: 'center' }
  );

  doc.save(`Gruppenphase_${tournamentName.replace(/\s+/g, '_')}.pdf`);
}
