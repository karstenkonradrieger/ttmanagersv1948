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

function getRoundName(match: Match, koMaxRound: number, mode?: string): string {
  if (match.groupNumber != null) {
    return `Gruppe ${String.fromCharCode(65 + match.groupNumber)} – Runde ${match.round + 1}`;
  }
  if (mode === 'round_robin' || mode === 'swiss') return `Runde ${match.round + 1}`;
  const maxR = koMaxRound >= 0 ? koMaxRound : match.round;
  const diff = maxR - match.round;
  if (diff === 0) return 'Finale';
  if (diff === 1) return 'Halbfinale';
  if (diff === 2) return 'Viertelfinale';
  if (diff === 3) return 'Achtelfinale';
  return `Runde ${match.round + 1}`;
}

function isGroupMatch(m: Match): boolean {
  return m.groupNumber != null;
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

  // Header text first, logo drawn on top afterwards
  doc.setFontSize(22);
  doc.setFont(undefined!, 'bold');
  doc.text('Foto-Report', 14, y);
  y += 10;

  doc.setFontSize(14);
  doc.setFont(undefined!, 'normal');
  doc.text(tournamentName, 14, y);
  y += 7;

  // Logo (drawn after header to appear in foreground)
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

  // ---- Match photos grouped by phase/round ----
  if (matchPhotos.length > 0) {
    // Group by match_id
    const photosByMatch = new Map<string, typeof matchPhotos>();
    for (const p of matchPhotos) {
      if (!p.match_id) continue;
      const arr = photosByMatch.get(p.match_id) || [];
      arr.push(p);
      photosByMatch.set(p.match_id, arr);
    }

    // Compute koMaxRound: highest round number among non-group matches that have photos
    const koMatchesAll = matches.filter(m => !isGroupMatch(m));
    const koMaxRound = koMatchesAll.length > 0
      ? Math.max(...koMatchesAll.map(m => m.round))
      : -1;

    // Build buckets in display order: all groups first (A, B, …), then KO rounds ascending
    type Bucket = { label: string; matches: Match[] };
    const buckets: Bucket[] = [];

    const groupMatchesWithPhotos = matches.filter(m => isGroupMatch(m) && photosByMatch.has(m.id));
    if (groupMatchesWithPhotos.length > 0) {
      const groupNumbers = Array.from(new Set(groupMatchesWithPhotos.map(m => m.groupNumber!))).sort((a, b) => a - b);
      for (const g of groupNumbers) {
        const gm = groupMatchesWithPhotos
          .filter(m => m.groupNumber === g)
          .sort((a, b) => a.round - b.round || a.position - b.position);
        if (gm.length === 0) continue;
        buckets.push({ label: `Gruppenphase – Gruppe ${String.fromCharCode(65 + g)}`, matches: gm });
      }
    }

    const koMatchesWithPhotos = matches.filter(m => !isGroupMatch(m) && photosByMatch.has(m.id));
    if (koMatchesWithPhotos.length > 0) {
      const koRounds = Array.from(new Set(koMatchesWithPhotos.map(m => m.round))).sort((a, b) => a - b);
      for (const r of koRounds) {
        const rm = koMatchesWithPhotos
          .filter(m => m.round === r)
          .sort((a, b) => a.position - b.position);
        if (rm.length === 0) continue;
        const sample = rm[0];
        const label = (mode === 'round_robin' || mode === 'swiss')
          ? `Runde ${r + 1}`
          : getRoundName(sample, koMaxRound, mode);
        buckets.push({ label, matches: rm });
      }
    }

    for (const bucket of buckets) {
      doc.addPage();
      y = 16;

      doc.setFontSize(12);
      doc.setFont(undefined!, 'bold');
      doc.setTextColor(0);
      doc.text(bucket.label, margin, y);
      y += 3;
      // Decorative line under heading
      doc.setDrawColor(34, 197, 94);
      doc.setLineWidth(0.5);
      doc.line(margin, y, margin + doc.getTextWidth(bucket.label), y);
      doc.setDrawColor(0);
      y += 5;

      for (const match of bucket.matches) {
        const photos = photosByMatch.get(match.id);
        if (!photos || photos.length === 0) continue;

        const p1 = getPlayer(match.player1Id);
        const p2 = getPlayer(match.player2Id);

        // Check space for label + result + photo row
        if (y + photoH + 12 > pageH - 10) {
          doc.addPage();
          y = 16;
        }

        // Match label (players)
        doc.setFontSize(8);
        doc.setFont(undefined!, 'bold');
        doc.setTextColor(60);
        doc.text(`${p1?.name || '?'} vs ${p2?.name || '?'}`, margin, y);

        // Result on the right
        if (match.status === 'completed' && match.sets && match.sets.length > 0) {
          const wins = getSetWins(match.sets);
          const setsStr = match.sets.map(s => `${s.player1}:${s.player2}`).join(', ');
          const winnerName = match.winnerId === match.player1Id
            ? p1?.name
            : match.winnerId === match.player2Id
              ? p2?.name
              : null;
          const resultText = `${wins.p1}:${wins.p2}  (${setsStr})${winnerName ? `  •  Sieger: ${winnerName}` : ''}`;
          doc.setFont(undefined!, 'normal');
          doc.setTextColor(80);
          doc.text(resultText, pageW - margin, y, { align: 'right' });
        } else if (match.status !== 'completed') {
          doc.setFont(undefined!, 'italic');
          doc.setTextColor(140);
          doc.text('ausstehend', pageW - margin, y, { align: 'right' });
        }
        doc.setFont(undefined!, 'normal');
        doc.setTextColor(0);
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
