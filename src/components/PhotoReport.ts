import jsPDF from 'jspdf';
import { supabase } from '@/integrations/supabase/client';
import { Match, Player } from '@/types/tournament';

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

interface PhotoReportOptions {
  tournamentId: string;
  tournamentName: string;
  tournamentDate?: string | null;
  venueString?: string;
  motto?: string;
  logoUrl?: string | null;
  matches: Match[];
  getPlayer: (id: string | null) => Player | null;
  rounds: number;
  mode?: string;
}

function getRoundName(round: number, totalRounds: number, mode?: string): string {
  if (mode === 'round_robin' || mode === 'swiss') return `Runde ${round + 1}`;
  const diff = totalRounds - round;
  if (diff === 1) return 'Finale';
  if (diff === 2) return 'Halbfinale';
  if (diff === 3) return 'Viertelfinale';
  if (diff === 4) return 'Achtelfinale';
  return `Runde ${round + 1}`;
}

export async function generatePhotoReport({
  tournamentId,
  tournamentName,
  tournamentDate,
  venueString,
  motto,
  logoUrl,
  matches,
  getPlayer,
  rounds,
  mode,
}: PhotoReportOptions) {
  // Fetch all photos for this tournament
  const { data: allPhotos } = await supabase
    .from('match_photos')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('created_at', { ascending: true });

  if (!allPhotos || allPhotos.length === 0) {
    throw new Error('Keine Fotos vorhanden');
  }

  const matchPhotos = allPhotos.filter(p => p.photo_type === 'match' && p.match_id);
  const ceremonyPhotos = allPhotos.filter(p => p.photo_type === 'ceremony');

  const doc = new jsPDF({ orientation: 'landscape', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // ---- Title page ----
  let y = 30;

  // Logo
  if (logoUrl) {
    const logoData = await loadImage(logoUrl);
    if (logoData) {
      const img = new Image();
      img.src = logoData;
      const maxH = 60;
      const ratio = img.naturalWidth / img.naturalHeight || 1;
      const logoW = maxH * ratio;
      doc.addImage(logoData, 'JPEG', pageW - 14 - logoW, 14, logoW, maxH);
    }
  }

  doc.setFontSize(22);
  doc.setFont(undefined!, 'bold');
  doc.text('Foto-Report', 14, y);
  y += 10;

  doc.setFontSize(14);
  doc.setFont(undefined!, 'normal');
  doc.text(tournamentName, 14, y);
  y += 7;

  if (motto) {
    doc.setFontSize(10);
    doc.setFont(undefined!, 'italic');
    doc.setTextColor(80);
    doc.text(`"${motto}"`, 14, y);
    doc.setFont(undefined!, 'normal');
    y += 5;
  }

  doc.setFontSize(9);
  doc.setTextColor(120);
  const subParts: string[] = [];
  if (tournamentDate) {
    subParts.push(new Date(tournamentDate + 'T00:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }));
  }
  if (venueString) subParts.push(venueString);
  subParts.push(`${allPhotos.length} Fotos`);
  doc.text(subParts.join('  |  '), 14, y);
  doc.setTextColor(0);

  // Photo dimensions
  const photoRatio = 4 / 3;
  const photoW = 80;
  const photoH = photoW / photoRatio;
  const gap = 4;
  const margin = 14;
  const colCount = Math.floor((pageW - 2 * margin + gap) / (photoW + gap));
  const totalRowW = colCount * photoW + (colCount - 1) * gap;
  const startX = (pageW - totalRowW) / 2;

  // ---- Match photos by round ----
  if (matchPhotos.length > 0) {
    // Group by match_id
    const photosByMatch = new Map<string, typeof matchPhotos>();
    for (const p of matchPhotos) {
      if (!p.match_id) continue;
      const arr = photosByMatch.get(p.match_id) || [];
      arr.push(p);
      photosByMatch.set(p.match_id, arr);
    }

    // Group matches by round
    for (let r = 0; r < rounds; r++) {
      const roundMatches = matches
        .filter(m => m.round === r && photosByMatch.has(m.id))
        .sort((a, b) => a.position - b.position);

      if (roundMatches.length === 0) continue;

      doc.addPage();
      y = 16;

      const roundName = getRoundName(r, rounds, mode);
      doc.setFontSize(12);
      doc.setFont(undefined!, 'bold');
      doc.setTextColor(0);
      doc.text(roundName, margin, y);
      y += 3;
      // Decorative line under heading
      doc.setDrawColor(34, 197, 94);
      doc.setLineWidth(0.5);
      doc.line(margin, y, margin + doc.getTextWidth(roundName), y);
      doc.setDrawColor(0);
      y += 5;

      for (const match of roundMatches) {
        const photos = photosByMatch.get(match.id);
        if (!photos || photos.length === 0) continue;

        const p1 = getPlayer(match.player1Id);
        const p2 = getPlayer(match.player2Id);

        // Check space for label + photo row
        if (y + photoH + 8 > pageH - 10) {
          doc.addPage();
          y = 16;
        }

        // Match label
        doc.setFontSize(8);
        doc.setFont(undefined!, 'bold');
        doc.setTextColor(60);
        doc.text(`${p1?.name || '?'} vs ${p2?.name || '?'}`, margin, y);
        doc.setFont(undefined!, 'normal');
        y += 4;

        // Load and render photos
        const loaded: string[] = [];
        for (const photo of photos.slice(0, 2)) {
          const imgData = await loadImage(photo.photo_url);
          if (imgData) loaded.push(imgData);
        }

        if (loaded.length === 1) {
          const x = startX;
          doc.addImage(loaded[0], 'JPEG', x, y, photoW, photoH);
        } else if (loaded.length >= 2) {
          doc.addImage(loaded[0], 'JPEG', startX, y, photoW, photoH);
          doc.addImage(loaded[1], 'JPEG', startX + photoW + gap, y, photoW, photoH);
        }

        if (loaded.length > 0) {
          y += photoH + gap + 2;
        }
      }
    }
  }

  // ---- Ceremony photos ----
  if (ceremonyPhotos.length > 0) {
    doc.addPage();
    y = 16;

    doc.setFontSize(12);
    doc.setFont(undefined!, 'bold');
    doc.setTextColor(0);
    doc.text('Siegerehrung', margin, y);
    y += 3;
    doc.setDrawColor(59, 130, 246);
    doc.setLineWidth(0.5);
    doc.line(margin, y, margin + doc.getTextWidth('Siegerehrung'), y);
    doc.setDrawColor(0);
    y += 5;

    const loaded: string[] = [];
    for (const photo of ceremonyPhotos) {
      const imgData = await loadImage(photo.photo_url);
      if (imgData) loaded.push(imgData);
    }

    for (let i = 0; i < loaded.length; i += colCount) {
      if (y + photoH > pageH - 10) {
        doc.addPage();
        y = 16;
      }

      const rowPhotos = loaded.slice(i, i + colCount);
      rowPhotos.forEach((imgData, j) => {
        const x = startX + j * (photoW + gap);
        doc.addImage(imgData, 'JPEG', x, y, photoW, photoH);
      });

      y += photoH + gap;
    }
  }

  // Footer on last page
  doc.setFontSize(7);
  doc.setTextColor(180);
  doc.text(
    `Erstellt am ${new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}`,
    pageW / 2,
    pageH - 6,
    { align: 'center' }
  );

  doc.save(`${tournamentName.replace(/\s+/g, '_')}_Foto-Report.pdf`);
}
