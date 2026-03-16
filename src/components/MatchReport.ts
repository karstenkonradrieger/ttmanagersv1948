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
  tournamentDate?: string | null;
  venueString?: string;
  motto?: string;
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
  tournamentDate,
  venueString,
  motto,
}: MatchReportOptions) {
  const doc = new jsPDF({ orientation: 'portrait', format: 'a4' });
  const w = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  let y = 8;

  // Logo (small)
  if (logoUrl) {
    const logoData = await loadImage(logoUrl);
    if (logoData) {
      const img = new Image();
      img.src = logoData;
      const maxH = 8;
      const ratio = img.naturalWidth / img.naturalHeight || 1;
      const logoW = maxH * ratio;
      doc.addImage(logoData, 'JPEG', w - 10 - logoW, y, logoW, maxH);
    }
  }

  // Title + tournament info
  doc.setFontSize(11);
  doc.setFont(undefined!, 'bold');
  doc.text('Spielbericht', 10, y + 3);
  doc.setFontSize(7);
  doc.setFont(undefined!, 'normal');
  doc.setTextColor(100);
  const infoParts = [tournamentName, roundName];
  if (tournamentDate) {
    infoParts.push(new Date(tournamentDate + 'T00:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }));
  }
  doc.text(infoParts.join('  •  '), 10, y + 7);
  let extraY = 0;
  if (motto) {
    doc.setFont(undefined!, 'italic');
    doc.text(`"${motto}"`, 10, y + 10);
    extraY += 3;
  }
  if (venueString) {
    doc.setFont(undefined!, 'normal');
    doc.text(venueString, 10, y + 10 + extraY);
    y += 14 + extraY;
  } else {
    y += 11 + extraY;
  }

  // Separator
  doc.setDrawColor(200);
  doc.setLineWidth(0.3);
  doc.line(10, y, w - 10, y);
  y += 3;

  // Players + score
  doc.setTextColor(0);
  const p1Name = player1?.name || 'Unbekannt';
  const p2Name = player2?.name || 'Unbekannt';
  const wins = getSetWins(match.sets);
  const isP1Winner = match.winnerId === match.player1Id;

  doc.setFontSize(9);
  doc.setFont(undefined!, 'bold');
  doc.text(p1Name, 10, y);
  doc.text('vs', w / 2, y, { align: 'center' });
  doc.text(p2Name, w - 10, y, { align: 'right' });
  y += 3;

  // Clubs
  doc.setFontSize(6);
  doc.setFont(undefined!, 'normal');
  doc.setTextColor(120);
  if (player1?.club) doc.text(player1.club, 10, y);
  if (player2?.club) doc.text(player2.club, w - 10, y, { align: 'right' });
  y += 4;

  // Set score
  doc.setTextColor(0);
  doc.setFontSize(16);
  doc.setFont(undefined!, 'bold');
  doc.text(`${wins.p1} : ${wins.p2}`, w / 2, y, { align: 'center' });
  y += 4;

  // Winner
  const winner = isP1Winner ? player1 : player2;
  if (winner) {
    doc.setFontSize(7);
    doc.setFont(undefined!, 'normal');
    doc.setTextColor(34, 197, 94);
    doc.text(`Gewinner: ${winner.name}`, w / 2, y, { align: 'center' });
    y += 3;
  }

  // Separator
  doc.setDrawColor(200);
  doc.line(10, y, w - 10, y);
  y += 3;

  // Set details - compact inline
  doc.setTextColor(0);
  doc.setFontSize(7);
  doc.setFont(undefined!, 'bold');
  doc.text('Satzergebnisse', 10, y);
  y += 3;

  doc.setFontSize(6);
  // Table header
  doc.setFillColor(240, 240, 240);
  doc.rect(10, y - 2.5, w - 20, 4, 'F');
  doc.text('Satz', 14, y);
  doc.text(p1Name.length > 18 ? p1Name.substring(0, 18) + '…' : p1Name, 40, y);
  doc.text(p2Name.length > 18 ? p2Name.substring(0, 18) + '…' : p2Name, 110, y);
  doc.text('Gewinner', 165, y);
  y += 4;

  doc.setFont(undefined!, 'normal');
  match.sets.forEach((set, i) => {
    const setWinner = set.player1 >= 11 && set.player1 - set.player2 >= 2
      ? p1Name
      : set.player2 >= 11 && set.player2 - set.player1 >= 2
      ? p2Name
      : '–';

    if (i % 2 === 1) {
      doc.setFillColor(248, 248, 248);
      doc.rect(10, y - 2.5, w - 20, 4, 'F');
    }

    doc.text(`${i + 1}`, 17, y, { align: 'center' });
    doc.setFont(undefined!, 'bold');
    doc.text(`${set.player1}`, 55, y, { align: 'center' });
    doc.text(`${set.player2}`, 125, y, { align: 'center' });
    doc.setFont(undefined!, 'normal');
    doc.text(setWinner, 165, y);
    y += 4;
  });

  y += 1;

  // Match details
  doc.setFontSize(6);
  doc.setTextColor(120);
  const details: string[] = [];
  if (match.table) details.push(`Tisch: ${match.table}`);
  details.push(`Best-of: ${bestOf * 2 - 1}`);
  if (details.length > 0) {
    doc.text(details.join('  |  '), 10, y);
    y += 3;
  }

  // Photos - auto-scaled to fit remaining space on this page
  const { data: photos } = await supabase
    .from('match_photos')
    .select('*')
    .eq('tournament_id', tournamentId)
    .eq('match_id', match.id)
    .eq('photo_type', 'match')
    .order('created_at', { ascending: true });

  if (photos && photos.length > 0) {
    doc.setTextColor(0);
    doc.setFontSize(7);
    doc.setFont(undefined!, 'bold');
    doc.text('Fotos', 10, y);
    y += 3;

    const loaded: string[] = [];
    for (const photo of photos.slice(0, 2)) {
      const imgData = await loadImage(photo.photo_url);
      if (imgData) loaded.push(imgData);
    }

    if (loaded.length > 0) {
      const footerSpace = 10;
      const gap = 3;
      const availableH = pageH - y - footerSpace;
      const photoCount = loaded.length;
      const maxPhotoH = (availableH - (photoCount - 1) * gap) / photoCount;
      // 4:3 aspect ratio
      const photoRatio = 4 / 3;
      const maxPhotoW = w - 20;
      // Calculate dimensions respecting both max width and available height
      let photoW = maxPhotoH * photoRatio;
      let photoH = maxPhotoH;
      if (photoW > maxPhotoW) {
        photoW = maxPhotoW;
        photoH = photoW / photoRatio;
      }

      loaded.forEach((imgData) => {
        const x = (w - photoW) / 2;
        doc.addImage(imgData, 'JPEG', x, y, photoW, photoH);
        y += photoH + gap;
      });
    }
  }

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(180);
  doc.text(
    `Erstellt am ${new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}`,
    w / 2,
    pageH - 6,
    { align: 'center' }
  );

  doc.save(`Spielbericht_${p1Name}_vs_${p2Name}.pdf`.replace(/\s+/g, '_'));
}
