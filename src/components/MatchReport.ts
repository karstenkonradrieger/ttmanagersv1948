import jsPDF from 'jspdf';
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

interface MatchReportOptions {
  match: Match;
  player1: Player | null;
  player2: Player | null;
  tournamentName: string;
  tournamentId: string;
  roundName: string;
  logoUrl?: string | null;
  bestOf: number;
}

export async function generateMatchReport({
  match,
  player1,
  player2,
  tournamentName,
  tournamentId,
  roundName,
  logoUrl,
  bestOf,
}: MatchReportOptions) {
  const doc = new jsPDF({ orientation: 'portrait', format: 'a4' });
  const w = doc.internal.pageSize.getWidth();
  let y = 10;

  // Logo (small)
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

  // Title + tournament info on one line area
  doc.setFontSize(12);
  doc.setFont(undefined!, 'bold');
  doc.text('Spielbericht', 10, y + 4);
  doc.setFontSize(8);
  doc.setFont(undefined!, 'normal');
  doc.setTextColor(100);
  doc.text(`${tournamentName}  •  ${roundName}`, 10, y + 9);
  y += 14;

  // Separator
  doc.setDrawColor(200);
  doc.setLineWidth(0.3);
  doc.line(10, y, w - 10, y);
  y += 4;

  // Players + score in compact layout
  doc.setTextColor(0);
  const p1Name = player1?.name || 'Unbekannt';
  const p2Name = player2?.name || 'Unbekannt';
  const wins = getSetWins(match.sets);
  const isP1Winner = match.winnerId === match.player1Id;

  doc.setFontSize(10);
  doc.setFont(undefined!, 'bold');
  doc.text(p1Name, 10, y);
  doc.text('vs', w / 2, y, { align: 'center' });
  doc.text(p2Name, w - 10, y, { align: 'right' });
  y += 4;

  // Clubs
  doc.setFontSize(7);
  doc.setFont(undefined!, 'normal');
  doc.setTextColor(120);
  if (player1?.club) doc.text(player1.club, 10, y);
  if (player2?.club) doc.text(player2.club, w - 10, y, { align: 'right' });
  y += 6;

  // Set score
  doc.setTextColor(0);
  doc.setFontSize(18);
  doc.setFont(undefined!, 'bold');
  doc.text(`${wins.p1} : ${wins.p2}`, w / 2, y, { align: 'center' });
  y += 6;

  // Winner
  const winner = isP1Winner ? player1 : player2;
  if (winner) {
    doc.setFontSize(8);
    doc.setFont(undefined!, 'normal');
    doc.setTextColor(34, 197, 94);
    doc.text(`Gewinner: ${winner.name}`, w / 2, y, { align: 'center' });
    y += 5;
  }

  // Separator
  doc.setDrawColor(200);
  doc.line(10, y, w - 10, y);
  y += 4;

  // Set details - compact inline
  doc.setTextColor(0);
  doc.setFontSize(8);
  doc.setFont(undefined!, 'bold');
  doc.text('Satzergebnisse', 10, y);
  y += 4;

  doc.setFontSize(7);
  // Table header
  doc.setFillColor(240, 240, 240);
  doc.rect(10, y - 3, w - 20, 5, 'F');
  doc.text('Satz', 14, y);
  doc.text(p1Name.length > 18 ? p1Name.substring(0, 18) + '…' : p1Name, 40, y);
  doc.text(p2Name.length > 18 ? p2Name.substring(0, 18) + '…' : p2Name, 110, y);
  doc.text('Gewinner', 165, y);
  y += 5;

  doc.setFont(undefined!, 'normal');
  match.sets.forEach((set, i) => {
    const setWinner = set.player1 >= 11 && set.player1 - set.player2 >= 2
      ? p1Name
      : set.player2 >= 11 && set.player2 - set.player1 >= 2
      ? p2Name
      : '–';

    if (i % 2 === 1) {
      doc.setFillColor(248, 248, 248);
      doc.rect(10, y - 3, w - 20, 5, 'F');
    }

    doc.text(`${i + 1}`, 17, y, { align: 'center' });
    doc.setFont(undefined!, 'bold');
    doc.text(`${set.player1}`, 55, y, { align: 'center' });
    doc.text(`${set.player2}`, 125, y, { align: 'center' });
    doc.setFont(undefined!, 'normal');
    doc.text(setWinner, 165, y);
    y += 5;
  });

  y += 2;

  // Match details
  doc.setFontSize(7);
  doc.setTextColor(120);
  const details: string[] = [];
  if (match.table) details.push(`Tisch: ${match.table}`);
  details.push(`Best-of: ${bestOf * 2 - 1}`);
  if (details.length > 0) {
    doc.text(details.join('  |  '), 10, y);
    y += 5;
  }

  // Photos - 6x9cm = 60x90mm, 2x2 grid
  const { data: photos } = await supabase
    .from('match_photos')
    .select('*')
    .eq('tournament_id', tournamentId)
    .eq('match_id', match.id)
    .eq('photo_type', 'match')
    .order('created_at', { ascending: true });

  if (photos && photos.length > 0) {
    doc.setTextColor(0);
    doc.setFontSize(8);
    doc.setFont(undefined!, 'bold');
    doc.text('Fotos', 10, y);
    y += 4;

    const photoWidth = 60;
    const photoHeight = 90;
    const gap = 4;
    const gridX = (w - (photoWidth * 2 + gap)) / 2;

    const loaded: string[] = [];
    for (const photo of photos.slice(0, 4)) {
      const imgData = await loadImage(photo.photo_url);
      if (imgData) loaded.push(imgData);
    }

    loaded.forEach((imgData, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = gridX + col * (photoWidth + gap);
      const py = y + row * (photoHeight + gap);
      doc.addImage(imgData, 'JPEG', x, py, photoWidth, photoHeight);
    });
  }

  // Footer
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(180);
  doc.text(
    `Erstellt am ${new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}`,
    w / 2,
    pageH - 10,
    { align: 'center' }
  );

  doc.save(`Spielbericht_${p1Name}_vs_${p2Name}.pdf`.replace(/\s+/g, '_'));
}
