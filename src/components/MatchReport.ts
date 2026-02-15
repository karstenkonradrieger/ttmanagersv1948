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
  let y = 16;

  // Logo
  if (logoUrl) {
    const logoData = await loadImage(logoUrl);
    if (logoData) {
      const img = new Image();
      img.src = logoData;
      const maxH = 16;
      const ratio = img.naturalWidth / img.naturalHeight || 1;
      const logoW = maxH * ratio;
      doc.addImage(logoData, 'JPEG', w - 14 - logoW, y, logoW, maxH);
    }
  }

  // Title
  doc.setFontSize(18);
  doc.setFont(undefined!, 'bold');
  doc.text('Spielbericht', 14, y + 6);
  y += 14;

  doc.setFontSize(11);
  doc.setFont(undefined!, 'normal');
  doc.setTextColor(100);
  doc.text(tournamentName, 14, y);
  y += 6;
  doc.text(roundName, 14, y);
  y += 10;

  // Separator
  doc.setDrawColor(200);
  doc.setLineWidth(0.5);
  doc.line(14, y, w - 14, y);
  y += 8;

  // Players
  doc.setTextColor(0);
  doc.setFontSize(14);
  doc.setFont(undefined!, 'bold');

  const p1Name = player1?.name || 'Unbekannt';
  const p2Name = player2?.name || 'Unbekannt';
  const wins = getSetWins(match.sets);
  const isP1Winner = match.winnerId === match.player1Id;

  doc.text(p1Name, 14, y);
  doc.text('vs', w / 2, y, { align: 'center' });
  doc.text(p2Name, w - 14, y, { align: 'right' });
  y += 8;

  // Clubs
  doc.setFontSize(9);
  doc.setFont(undefined!, 'normal');
  doc.setTextColor(120);
  if (player1?.club) doc.text(player1.club, 14, y);
  if (player2?.club) doc.text(player2.club, w - 14, y, { align: 'right' });
  y += 10;

  // Set score big
  doc.setTextColor(0);
  doc.setFontSize(28);
  doc.setFont(undefined!, 'bold');
  doc.text(`${wins.p1} : ${wins.p2}`, w / 2, y, { align: 'center' });
  y += 12;

  // Winner
  const winner = isP1Winner ? player1 : player2;
  if (winner) {
    doc.setFontSize(11);
    doc.setFont(undefined!, 'normal');
    doc.setTextColor(34, 197, 94);
    doc.text(`Gewinner: ${winner.name}`, w / 2, y, { align: 'center' });
    y += 10;
  }

  // Separator
  doc.setDrawColor(200);
  doc.line(14, y, w - 14, y);
  y += 8;

  // Set details table
  doc.setTextColor(0);
  doc.setFontSize(11);
  doc.setFont(undefined!, 'bold');
  doc.text('Satzergebnisse', 14, y);
  y += 7;

  doc.setFontSize(10);
  doc.setFont(undefined!, 'normal');

  // Table header
  doc.setFillColor(240, 240, 240);
  doc.rect(14, y - 4, w - 28, 7, 'F');
  doc.setFont(undefined!, 'bold');
  doc.text('Satz', 20, y);
  doc.text(p1Name.length > 20 ? p1Name.substring(0, 20) + '…' : p1Name, 50, y);
  doc.text(p2Name.length > 20 ? p2Name.substring(0, 20) + '…' : p2Name, 120, y);
  doc.text('Gewinner', 170, y);
  y += 8;

  doc.setFont(undefined!, 'normal');
  match.sets.forEach((set, i) => {
    const setWinner = set.player1 >= 11 && set.player1 - set.player2 >= 2
      ? p1Name
      : set.player2 >= 11 && set.player2 - set.player1 >= 2
      ? p2Name
      : '–';

    if (i % 2 === 1) {
      doc.setFillColor(248, 248, 248);
      doc.rect(14, y - 4, w - 28, 7, 'F');
    }

    doc.text(`${i + 1}`, 24, y, { align: 'center' });
    doc.setFont(undefined!, 'bold');
    doc.text(`${set.player1}`, 65, y, { align: 'center' });
    doc.text(`${set.player2}`, 135, y, { align: 'center' });
    doc.setFont(undefined!, 'normal');
    doc.text(setWinner, 170, y);
    y += 7;
  });

  y += 6;

  // Match details
  doc.setFontSize(9);
  doc.setTextColor(120);
  const details: string[] = [];
  if (match.table) details.push(`Tisch: ${match.table}`);
  details.push(`Best-of: ${bestOf * 2 - 1}`);
  if (details.length > 0) {
    doc.text(details.join('  |  '), 14, y);
    y += 8;
  }

  // Photos
  const { data: photos } = await supabase
    .from('match_photos')
    .select('*')
    .eq('tournament_id', tournamentId)
    .eq('match_id', match.id)
    .eq('photo_type', 'match')
    .order('created_at', { ascending: true });

  if (photos && photos.length > 0) {
    // Check if we need a new page
    if (y > 200) {
      doc.addPage();
      y = 20;
    }

    doc.setTextColor(0);
    doc.setFontSize(11);
    doc.setFont(undefined!, 'bold');
    doc.text('Fotos', 14, y);
    y += 8;

    // 10x15cm = 100x150mm in jsPDF units
    const photoWidth = 100;
    const photoHeight = 150;

    for (const photo of photos.slice(0, 3)) {
      const imgData = await loadImage(photo.photo_url);
      if (imgData) {
        if (y + photoHeight > doc.internal.pageSize.getHeight() - 20) {
          doc.addPage();
          y = 20;
        }
        doc.addImage(imgData, 'JPEG', (w - photoWidth) / 2, y, photoWidth, photoHeight);
        y += photoHeight + 6;
      }
    }
    y += photoHeight + 6;
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
