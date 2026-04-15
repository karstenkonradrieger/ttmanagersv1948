import { useMemo, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Match, Player, SetScore, Sponsor, getHandicap } from '@/types/tournament';
import { Button } from '@/components/ui/button';
import { FileDown, Award, FileText, User, ImageIcon, ImageOff, Eye, Printer, Save, Download, Settings, X, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import html2canvas from 'html2canvas';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { MatchPhotos } from '@/components/MatchPhotos';
import { generateMatchReport } from '@/components/MatchReport';
import { generatePhotoReport } from '@/components/PhotoReport';
import { generatePlayerReport } from '@/components/PlayerReport';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CertificatePreview } from '@/components/CertificatePreview';
import { Checkbox } from '@/components/ui/checkbox';

interface Props {
  tournamentName: string;
  matches: Match[];
  rounds: number;
  getPlayer: (id: string | null) => Player | null;
  getParticipantName?: (id: string | null) => string;
  players: Player[];
  logoUrl?: string | null;
  bestOf: number;
  tournamentId: string;
  tournamentDate?: string | null;
  venueString?: string;
  motto?: string;
  mode?: string;
  organizerName?: string;
  sponsors?: Sponsor[];
  certificateBgUrl?: string | null;
  certificateText?: string;
  certificateFontFamily?: string;
  certificateFontSize?: number;
  certificateTextColor?: string;
  certificateLineSizes?: number[];
  certificateExtraSizes?: Record<string, number>;
  certificateHiddenFields?: string[];
  onSaveCertificateSettings?: (settings: {
    certificateText: string;
    certificateLineSizes: number[];
    certificateExtraSizes: Record<string, number>;
    certificateHiddenFields: string[];
    motto: string;
    venueString: string;
    organizerName: string;
  }) => void;
  onUpdateScore?: (matchId: string, sets: SetScore[], effectiveBestOf?: number) => void;
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

interface PlayerStats {
  player: Player;
  matchesPlayed: number;
  matchesWon: number;
  winRate: number;
  setsWon: number;
  setsLost: number;
  pointsWon: number;
  pointsLost: number;
  avgSetDiff: number;
}

function computePlayerStats(players: Player[], matches: Match[]): PlayerStats[] {
  const realMatches = matches.filter(m => m.status === 'completed' && m.player1Id && m.player2Id && m.sets.length > 0);

  return players.map(player => {
    const played = realMatches.filter(m => m.player1Id === player.id || m.player2Id === player.id);
    const won = played.filter(m => m.winnerId === player.id).length;

    let setsWon = 0, setsLost = 0, pointsWon = 0, pointsLost = 0;
    for (const m of played) {
      const isP1 = m.player1Id === player.id;
      for (const s of m.sets) {
        const my = isP1 ? s.player1 : s.player2;
        const opp = isP1 ? s.player2 : s.player1;
        pointsWon += my;
        pointsLost += opp;
        if (my >= 11 && my - opp >= 2) setsWon++;
        else if (opp >= 11 && opp - my >= 2) setsLost++;
      }
    }

    const totalSets = setsWon + setsLost;
    return {
      player,
      matchesPlayed: played.length,
      matchesWon: won,
      winRate: played.length > 0 ? (won / played.length) * 100 : 0,
      setsWon,
      setsLost,
      pointsWon,
      pointsLost,
      avgSetDiff: totalSets > 0 ? (setsWon - setsLost) / played.length : 0,
    };
  }).sort((a, b) => b.winRate - a.winRate || b.avgSetDiff - a.avgSetDiff);
}

function wasUpgradedBestOf(match: Match, tournamentBestOf: number): boolean {
  if (tournamentBestOf !== 2) return false;
  const wins = getSetWins(match.sets);
  return Math.max(wins.p1, wins.p2) >= 3;
}

export function TournamentOverview({ tournamentName, matches, rounds, getPlayer, getParticipantName, players, logoUrl, bestOf, tournamentId, tournamentDate, venueString, motto, mode, organizerName, sponsors = [], certificateBgUrl, certificateText = 'Beim {turniername} hat {spieler} ({verein}) den {platz} belegt.', certificateFontFamily = 'Helvetica', certificateFontSize = 20, certificateTextColor = '#1e1e1e', certificateLineSizes = [], certificateExtraSizes = {}, certificateHiddenFields = [], onSaveCertificateSettings, onUpdateScore }: Props) {
  const [showMatchPhotos, setShowMatchPhotos] = useState(false);
  const [showCertPreview, setShowCertPreview] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [localCertText, setLocalCertText] = useState(certificateText);
  const [localLineSizes, setLocalLineSizes] = useState<number[]>(certificateLineSizes);
  const [localMotto, setLocalMotto] = useState(motto || '');
  const [localVenue, setLocalVenue] = useState(venueString || '');
  const [localOrganizer, setLocalOrganizer] = useState(organizerName || '');
  const [localExtraSizes, setLocalExtraSizes] = useState<Record<string, number>>(certificateExtraSizes);
  const [localHiddenFields, setLocalHiddenFields] = useState<string[]>(certificateHiddenFields);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);

  // Visible sponsors for certificate
  const visibleSponsors = sponsors.filter(s => s.name);

  // Sync local state when props change (e.g. after DB load)
  useEffect(() => {
    setLocalCertText(certificateText);
    setLocalLineSizes(certificateLineSizes);
    setLocalMotto(motto || '');
    setLocalVenue(venueString || '');
    setLocalOrganizer(organizerName || '');
    setLocalExtraSizes(certificateExtraSizes);
    setLocalHiddenFields(certificateHiddenFields);
    setHasPendingChanges(false);
  }, [certificateText, certificateLineSizes, motto, venueString, organizerName, sponsors, certificateExtraSizes, certificateHiddenFields]);
  const playerStats = useMemo(() => computePlayerStats(players, matches), [players, matches]);

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

  const exportPdf = async () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const pageW = doc.internal.pageSize.getWidth();

    let headerY = 14;

    // Logo
    if (logoUrl) {
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject();
          img.src = logoUrl;
        });
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext('2d')!.drawImage(img, 0, 0);
        const logoData = canvas.toDataURL('image/png');
        const maxH = 18;
        const ratio = img.naturalWidth / img.naturalHeight;
        const logoW = maxH * ratio;
        doc.addImage(logoData, 'PNG', pageW - 14 - logoW, headerY, logoW, maxH);
      } catch {
        // ignore
      }
    }

    doc.setFontSize(18);
    doc.text(tournamentName, 14, 20);
    if (motto) {
      doc.setFontSize(11);
      doc.setFont(undefined!, 'italic');
      doc.setTextColor(80);
      doc.text(`"${motto}"`, 14, 26);
      doc.setFont(undefined!, 'normal');
    }
    doc.setFontSize(10);
    doc.setTextColor(120);
    const subParts: string[] = [];
    if (tournamentDate) {
      subParts.push(new Date(tournamentDate + 'T00:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }));
    }
    if (venueString) {
      subParts.push(venueString);
    }
    subParts.push(`Erstellt am ${new Date().toLocaleDateString('de-DE')}`);
    doc.text(subParts.join('  |  '), 14, motto ? 32 : 28);
    doc.setTextColor(0);

    let startY = motto ? 40 : 36;

    for (let r = 0; r < rounds; r++) {
      const roundMatches = matchesByRound[r];
      if (!roundMatches || roundMatches.length === 0) continue;

      const roundName = getRoundName(r, rounds, mode);

      const tableData = roundMatches.map((m, idx) => {
        const p1 = getPlayer(m.player1Id);
        const p2 = getPlayer(m.player2Id);
        const wins = getSetWins(m.sets);
        const winner = getPlayer(m.winnerId);
        const isBye = !m.player2Id && m.player1Id;
        const upgraded = wasUpgradedBestOf(m, bestOf);
        
        return [
          `${idx + 1}`,
          p1?.name || (isBye ? '–' : 'TBD'),
          p2?.name || (isBye ? 'Freilos' : 'TBD'),
          isBye ? '–' : `${wins.p1}:${wins.p2}${upgraded ? ' (Bo5)' : ''}`,
          isBye ? '–' : formatSets(m.sets),
          isBye ? (p1?.name || '–') : (winner?.name || '–'),
        ];
      });

      autoTable(doc, {
        startY,
        head: [[roundName, 'Spieler 1', 'Spieler 2', 'Sätze', 'Ergebnisse', 'Gewinner']],
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
          0: { cellWidth: 10, halign: 'center' },
          1: { cellWidth: 'auto' },
          2: { cellWidth: 'auto' },
          3: { cellWidth: 16, halign: 'center' },
          4: { cellWidth: 50 },
          5: { cellWidth: 'auto' },
        },
      });

      startY = (doc as any).lastAutoTable.finalY + 4;

      // Load and render photos for completed matches in this round
      const completedInRound = roundMatches.filter(m => m.status === 'completed' && m.player1Id && m.player2Id);
      if (completedInRound.length > 0) {
        const matchIds = completedInRound.map(m => m.id);
        const { data: roundPhotos } = await supabase
          .from('match_photos')
          .select('*')
          .eq('tournament_id', tournamentId)
          .eq('photo_type', 'match')
          .in('match_id', matchIds)
          .order('created_at', { ascending: true });

        if (roundPhotos && roundPhotos.length > 0) {
          // Group photos by match
          const photosByMatch = new Map<string, typeof roundPhotos>();
          for (const photo of roundPhotos) {
            if (!photo.match_id) continue;
            const existing = photosByMatch.get(photo.match_id) || [];
            existing.push(photo);
            photosByMatch.set(photo.match_id, existing);
          }

          const pageH = doc.internal.pageSize.getHeight();
          const photoRatio = 4 / 3;
          const photoW = 55; // compact width per photo
          const photoH = photoW / photoRatio;
          const gap = 3;

          for (const [matchId, photos] of photosByMatch) {
            const matchObj = completedInRound.find(m => m.id === matchId);
            if (!matchObj) continue;

            // Check if we need a new page
            if (startY + photoH + 6 > pageH - 10) {
              doc.addPage();
              startY = 20;
            }

            // Match label
            const p1 = getPlayer(matchObj.player1Id);
            const p2 = getPlayer(matchObj.player2Id);
            doc.setFontSize(6);
            doc.setTextColor(120);
            doc.text(`${p1?.name || '?'} vs ${p2?.name || '?'}`, 14, startY + 2);
            doc.setTextColor(0);
            startY += 4;

            // Load and render up to 2 photos side by side
            const loaded: string[] = [];
            for (const photo of photos.slice(0, 2)) {
              try {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                await new Promise<void>((resolve, reject) => {
                  img.onload = () => resolve();
                  img.onerror = () => reject();
                  img.src = photo.photo_url;
                });
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                canvas.getContext('2d')!.drawImage(img, 0, 0);
                loaded.push(canvas.toDataURL('image/jpeg', 0.8));
              } catch {
                // skip
              }
            }

            if (loaded.length === 1) {
              const x = (pageW - photoW) / 2;
              doc.addImage(loaded[0], 'JPEG', x, startY, photoW, photoH);
            } else if (loaded.length >= 2) {
              const totalW = photoW * 2 + gap;
              const startX = (pageW - totalW) / 2;
              doc.addImage(loaded[0], 'JPEG', startX, startY, photoW, photoH);
              doc.addImage(loaded[1], 'JPEG', startX + photoW + gap, startY, photoW, photoH);
            }

            if (loaded.length > 0) {
              startY += photoH + gap;
            }
          }
          startY += 4;
        }
      }

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
      doc.text(`Turniersieger: ${champion.name}`, 14, startY + 16);
    }

    // Player statistics table
    startY = champion ? startY + 26 : startY + 16;
    if (startY > 150) {
      doc.addPage();
      startY = 20;
    }

    if (playerStats.length > 0) {
      const statsData = playerStats.map((s, i) => [
        `${i + 1}`,
        s.player.name,
        s.player.club || '–',
        `${s.matchesPlayed}`,
        `${s.matchesWon}`,
        `${s.winRate.toFixed(0)}%`,
        `${s.setsWon}:${s.setsLost}`,
        `${s.avgSetDiff > 0 ? '+' : ''}${s.avgSetDiff.toFixed(1)}`,
        `${s.pointsWon}:${s.pointsLost}`,
      ]);

      autoTable(doc, {
        startY,
        head: [['#', 'Spieler', 'Verein', 'Spiele', 'Siege', 'Quote', 'Sätze (G:V)', 'Ø Satzdiff.', 'Punkte']],
        body: statsData,
        theme: 'grid',
        headStyles: {
          fillColor: [59, 130, 246],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 8,
        },
        styles: { fontSize: 8, cellPadding: 2 },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          5: { halign: 'center' },
          7: { halign: 'center' },
        },
      });
    }

    // Ceremony photos at the end
    const { data: ceremonyPhotos } = await supabase
      .from('match_photos')
      .select('*')
      .eq('tournament_id', tournamentId)
      .eq('photo_type', 'ceremony')
      .is('match_id', null)
      .order('created_at', { ascending: true });

    if (ceremonyPhotos && ceremonyPhotos.length > 0) {
      let cerY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 10 : startY + 10;
      const pageH = doc.internal.pageSize.getHeight();
      const photoRatio = 4 / 3;
      const photoW = 55;
      const photoH = photoW / photoRatio;
      const gap = 3;

      if (cerY + photoH + 10 > pageH - 10) {
        doc.addPage();
        cerY = 20;
      }

      doc.setFontSize(11);
      doc.setFont(undefined!, 'bold');
      doc.setTextColor(0);
      doc.text('Siegerehrung', 14, cerY);
      cerY += 6;

      // Load all ceremony photos
      const loaded: string[] = [];
      for (const photo of ceremonyPhotos) {
        try {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject();
            img.src = photo.photo_url;
          });
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          canvas.getContext('2d')!.drawImage(img, 0, 0);
          loaded.push(canvas.toDataURL('image/jpeg', 0.8));
        } catch {
          // skip
        }
      }

      // Render photos in pairs side by side
      for (let i = 0; i < loaded.length; i += 2) {
        if (cerY + photoH > pageH - 10) {
          doc.addPage();
          cerY = 20;
        }

        if (i + 1 < loaded.length) {
          const totalW = photoW * 2 + gap;
          const startX = (pageW - totalW) / 2;
          doc.addImage(loaded[i], 'JPEG', startX, cerY, photoW, photoH);
          doc.addImage(loaded[i + 1], 'JPEG', startX + photoW + gap, cerY, photoW, photoH);
        } else {
          const x = (pageW - photoW) / 2;
          doc.addImage(loaded[i], 'JPEG', x, cerY, photoW, photoH);
        }
        cerY += photoH + gap;
      }
    }

    doc.save(`${tournamentName.replace(/\s+/g, '_')}_Ergebnisse.pdf`);
  };

  const finalMatch = matches.find(m => m.round === rounds - 1);
  const champion = finalMatch?.winnerId ? getPlayer(finalMatch.winnerId) : null;
  const secondPlace = finalMatch ? getPlayer(finalMatch.winnerId === finalMatch.player1Id ? finalMatch.player2Id : finalMatch.player1Id) : null;

  // Place 3: losers of the semi-finals
  const semiRound = rounds - 2;
  const semiMatches = semiRound >= 0 ? matches.filter(m => m.round === semiRound && m.status === 'completed') : [];
  const thirdPlacePlayers = semiMatches
    .map(m => {
      const loserId = m.winnerId === m.player1Id ? m.player2Id : m.player1Id;
      return loserId ? getPlayer(loserId) : null;
    })
    .filter((p): p is Player => p !== null);

  const exportCertificates = async () => {
    const placements: { rank: number; label: string; player: Player }[] = [];
    if (champion) placements.push({ rank: 1, label: '1. Platz', player: champion });
    if (secondPlace) placements.push({ rank: 2, label: '2. Platz', player: secondPlace });
    thirdPlacePlayers.forEach(p => placements.push({ rank: 3, label: '3. Platz', player: p }));

    if (placements.length === 0) return;

    // Pre-load logo if available
    let logoData: string | null = null;
    let logoWidth = 0;
    let logoHeight = 0;
    if (logoUrl) {
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject();
          img.src = logoUrl;
        });
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext('2d')!.drawImage(img, 0, 0);
        logoData = canvas.toDataURL('image/png');
        // Scale logo to max 30mm height
        const maxH = 30;
        const ratio = img.naturalWidth / img.naturalHeight;
        logoHeight = maxH;
        logoWidth = maxH * ratio;
      } catch {
        // Ignore logo loading errors
      }
    }

    // Pre-load sponsor signature if available
    let sigData: string | null = null;
    let sigWidth = 0;
    let sigHeight = 0;
    if (false) {
      try {
        const sigImg = new Image();
        sigImg.crossOrigin = 'anonymous';
        await new Promise<void>((resolve, reject) => {
          sigImg.onload = () => resolve();
          sigImg.onerror = () => reject();
          sigImg.src = null;
        });
        const sigCanvas = document.createElement('canvas');
        sigCanvas.width = sigImg.naturalWidth;
        sigCanvas.height = sigImg.naturalHeight;
        sigCanvas.getContext('2d')!.drawImage(sigImg, 0, 0);
        sigData = sigCanvas.toDataURL('image/png');
        const sigMaxH = 20;
        const sigRatio = sigImg.naturalWidth / sigImg.naturalHeight;
        sigHeight = sigMaxH;
        sigWidth = sigMaxH * sigRatio;
      } catch {
        // ignore
      }
    }

    // Pre-load sponsor logos
    const sponsorLogos: Array<{ name: string; data: string; w: number; h: number }> = [];
    for (const sponsor of visibleSponsors) {
      if (sponsor.logoUrl) {
        try {
          const slImg = new Image();
          slImg.crossOrigin = 'anonymous';
          await new Promise<void>((resolve, reject) => {
            slImg.onload = () => resolve();
            slImg.onerror = () => reject();
            slImg.src = sponsor.logoUrl!;
          });
          const slCanvas = document.createElement('canvas');
          slCanvas.width = slImg.naturalWidth;
          slCanvas.height = slImg.naturalHeight;
          slCanvas.getContext('2d')!.drawImage(slImg, 0, 0);
          const slMaxH = 16;
          const slRatio = slImg.naturalWidth / slImg.naturalHeight;
          sponsorLogos.push({ name: sponsor.name, data: slCanvas.toDataURL('image/png'), w: slMaxH * slRatio, h: slMaxH });
        } catch {
          sponsorLogos.push({ name: sponsor.name, data: '', w: 0, h: 0 });
        }
      } else {
        sponsorLogos.push({ name: sponsor.name, data: '', w: 0, h: 0 });
      }
    }

    // Pre-load certificate background if available
    let certBgData: string | null = null;
    if (certificateBgUrl) {
      try {
        const bgImg = new Image();
        bgImg.crossOrigin = 'anonymous';
        await new Promise<void>((resolve, reject) => {
          bgImg.onload = () => resolve();
          bgImg.onerror = () => reject();
          bgImg.src = certificateBgUrl;
        });
        const bgCanvas = document.createElement('canvas');
        bgCanvas.width = bgImg.naturalWidth;
        bgCanvas.height = bgImg.naturalHeight;
        bgCanvas.getContext('2d')!.drawImage(bgImg, 0, 0);
        certBgData = bgCanvas.toDataURL('image/png');
      } catch {
        // ignore
      }
    }

    // Map font families to jsPDF built-in fonts
    const JSPDF_FONT_MAP: Record<string, string> = {
      Helvetica: 'helvetica',
      Times: 'times',
      Courier: 'courier',
      'Dancing Script': 'times',
      'Great Vibes': 'times',
      'Playfair Display': 'times',
      Montserrat: 'helvetica',
      Lora: 'times',
      Raleway: 'helvetica',
    };
    const pdfFont = JSPDF_FONT_MAP[certificateFontFamily] || 'helvetica';

    const doc = new jsPDF({ orientation: 'portrait', format: 'a4' });

    const resolvePlaceholders = (template: string, vars: Record<string, string>): string => {
      return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
    };

    const hexToRgb = (hex: string) => {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return [r, g, b] as const;
    };
    const [tr, tg, tb] = hexToRgb(certificateTextColor);
    // Muted version of textColor (70% opacity simulated)
    const mutedRgb: [number, number, number] = [
      Math.round(tr + (255 - tr) * 0.3),
      Math.round(tg + (255 - tg) * 0.3),
      Math.round(tb + (255 - tb) * 0.3),
    ];

    const certDate = tournamentDate
      ? new Date(tournamentDate + 'T00:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })
      : new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });

    placements.forEach((placement, idx) => {
      if (idx > 0) doc.addPage();
      const w = doc.internal.pageSize.getWidth();
      const h = doc.internal.pageSize.getHeight();

      // Background image
      if (certBgData) {
        doc.addImage(certBgData, 'PNG', 0, 0, w, h);
      }

      // Resolve certificate text with placeholders
      const resolvedText = resolvePlaceholders(certificateText, {
        turniername: tournamentName,
        spieler: placement.player.name,
        verein: placement.player.club || '–',
        platz: placement.label,
      });
      const textLines = resolvedText.split('\n').filter(l => l.trim());

      // Calculate vertical center for content
      // Content area: from top margin to signature area
      const sigY = h - 40;
      const topMargin = 40;
      const contentAreaH = sigY - topMargin - 20;

      // Calculate total content height
      let totalContentH = 0;
      if (logoData) totalContentH += logoHeight + 12;
      if (!certificateHiddenFields.includes('motto') && motto) totalContentH += (certificateExtraSizes.motto ?? 12) * 0.7 + 8;
      textLines.forEach((_, i) => {
        const lineSize = certificateLineSizes[i] ?? certificateFontSize;
        totalContentH += lineSize * 0.6 + 4;
      });
      if (!certificateHiddenFields.includes('date')) totalContentH += (certificateExtraSizes.organizer ?? 12) * 0.6 + 10;
      if (!certificateHiddenFields.includes('venue') && venueString) totalContentH += (certificateExtraSizes.venue ?? 12) * 0.6 + 4;

      let yOffset = topMargin + Math.max(0, (contentAreaH - totalContentH) / 2);

      // Logo
      if (logoData) {
        doc.addImage(logoData, 'PNG', w / 2 - logoWidth / 2, yOffset, logoWidth, logoHeight);
        yOffset += logoHeight + 12;
      }

      // Motto
      if (!certificateHiddenFields.includes('motto') && motto) {
        const mottoSize = certificateExtraSizes.motto ?? 12;
        doc.setFontSize(mottoSize);
        doc.setFont(pdfFont, 'italic');
        doc.setTextColor(tr, tg, tb);
        doc.text(`"${motto}"`, w / 2, yOffset, { align: 'center' });
        yOffset += mottoSize * 0.7 + 8;
      }

      // Main certificate text lines with individual sizes
      const fontStyle = certificateExtraSizes.fontBold ? 'bold' : 'normal';
      doc.setFont(pdfFont, fontStyle);
      textLines.forEach((line, i) => {
        const lineSize = certificateLineSizes[i] ?? certificateFontSize;
        doc.setFontSize(lineSize);
        doc.setTextColor(tr, tg, tb);
        doc.text(line, w / 2, yOffset, { align: 'center' });
        yOffset += lineSize * 0.6 + 4;
      });

      // Date
      if (!certificateHiddenFields.includes('date')) {
        const dateSize = certificateExtraSizes.organizer ?? 12;
        doc.setFontSize(dateSize);
        doc.setFont(pdfFont, 'normal');
        doc.setTextColor(tr, tg, tb);
        yOffset += 8;
        doc.text(certDate, w / 2, yOffset, { align: 'center' });
        yOffset += dateSize * 0.5 + 4;
      }

      // Venue
      if (!certificateHiddenFields.includes('venue') && venueString) {
        const venueSize = certificateExtraSizes.venue ?? 12;
        doc.setFontSize(venueSize);
        doc.setTextColor(tr, tg, tb);
        doc.text(venueString, w / 2, yOffset, { align: 'center' });
      }

      // Footer / Signature area
      const hasSponsorSection = (!certificateHiddenFields.includes('sponsor')) && sponsorLogos.length > 0;

      doc.setDrawColor(...mutedRgb);
      doc.setLineWidth(0.5);

      // Sponsor section (left)
      if (hasSponsorSection) {
        doc.line(w / 4 - 40, sigY, w / 4 + 40, sigY);
        const sponsorSize = certificateExtraSizes.sponsor ?? 8;
        doc.setFontSize(sponsorSize);
        doc.setTextColor(tr, tg, tb);
        let sponsorTextY = sigY + 4;
        for (const sl of sponsorLogos) {
          if (sl.data) {
            const totalW = sl.w + 2 + doc.getTextWidth(sl.name);
            const startX = w / 4 - totalW / 2;
            doc.addImage(sl.data, 'PNG', startX, sponsorTextY, sl.w, sl.h);
            doc.text(sl.name, startX + sl.w + 2, sponsorTextY + sl.h * 0.7);
          } else {
            doc.text(sl.name, w / 4, sponsorTextY + 4, { align: 'center' });
          }
          sponsorTextY += Math.max(sl.h, 6) + 2;
        }
        doc.setFontSize(Math.max(6, sponsorSize * 0.8));
        doc.setTextColor(...mutedRgb);
        doc.text(sponsorLogos.length === 1 ? 'Sponsor' : 'Sponsoren', w / 4, sponsorTextY + 2, { align: 'center' });
      }

      // Organizer / Turnierleitung (right or center)
      if (!certificateHiddenFields.includes('organizer')) {
        const orgX = hasSponsorSection ? (3 * w / 4) : (w / 2);
        doc.line(orgX - 50, sigY, orgX + 50, sigY);
        const orgSize = certificateExtraSizes.organizer ?? 8;
        doc.setTextColor(tr, tg, tb);
        if (organizerName) {
          doc.setFontSize(orgSize);
          doc.text(organizerName, orgX, sigY + 7, { align: 'center' });
          doc.setFontSize(Math.max(6, orgSize * 0.8));
          doc.setTextColor(...mutedRgb);
          doc.text('Turnierleitung', orgX, sigY + 13, { align: 'center' });
        } else {
          doc.setFontSize(orgSize);
          doc.setTextColor(...mutedRgb);
          doc.text('Turnierleitung', orgX, sigY + 7, { align: 'center' });
        }
      }
    });

    doc.save(`${tournamentName.replace(/\s+/g, '_')}_Urkunden.pdf`);
  };

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header with export */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">Spielübersicht</h3>
        <div className="flex gap-2">
          {champion && (
            <>
              <Button onClick={() => setShowCertPreview(true)} size="sm" variant="outline" className="h-9 font-semibold">
                <Eye className="mr-1 h-4 w-4" />
                Vorschau
              </Button>
              <Button onClick={exportCertificates} size="sm" variant="outline" className="h-9 font-semibold">
                <Award className="mr-1 h-4 w-4" />
                Urkunden
              </Button>
            </>
          )}
          <Button onClick={exportPdf} size="sm" className="h-9 font-semibold">
            <FileDown className="mr-1 h-4 w-4" />
            PDF Export
          </Button>
          <Button
            onClick={async () => {
              try {
                await generatePhotoReport({
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
                });
              } catch (err: any) {
                toast.error(err.message || 'Fehler beim Erstellen des Foto-Reports');
              }
            }}
            size="sm"
            variant="outline"
            className="h-9 font-semibold"
          >
            <ImageIcon className="mr-1 h-4 w-4" />
            Foto-Report
          </Button>
        </div>
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
        const roundName = getRoundName(r, rounds, mode);

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
                            {wasUpgradedBestOf(m, bestOf) && (
                              <span className="text-xs bg-accent text-accent-foreground px-1.5 py-0.5 rounded font-semibold">
                                Bo5
                              </span>
                            )}
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

      {/* Photo Retrospective */}
      {matches.filter(m => m.status === 'completed').length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-bold text-sm text-primary">📸 Rückschau</h4>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs text-muted-foreground"
              onClick={() => setShowMatchPhotos(prev => !prev)}
            >
              {showMatchPhotos ? <ImageOff className="mr-1 h-3 w-3" /> : <ImageIcon className="mr-1 h-3 w-3" />}
              {showMatchPhotos ? 'Fotos ausblenden' : 'Fotos einblenden'}
            </Button>
          </div>
          <div className="space-y-3">
            {matchesByRound.map((roundMatches, r) => {
              const completedInRound = roundMatches.filter(m => m.status === 'completed' && m.player1Id && m.player2Id);
              if (completedInRound.length === 0) return null;
              return (
                <div key={`photos-${r}`}>
                  <h5 className="text-xs font-semibold text-muted-foreground mb-2">{getRoundName(r, rounds, mode)}</h5>
                  {completedInRound.map(m => {
                    const p1 = getPlayer(m.player1Id);
                    const p2 = getPlayer(m.player2Id);
                    return (
                      <div key={`photo-${m.id}`} className="bg-card rounded-lg p-3 card-shadow mb-2">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-semibold">{p1?.name} vs {p2?.name}</p>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs text-muted-foreground"
                            onClick={() => generateMatchReport({
                              match: m, player1: p1, player2: p2,
                              tournamentName, tournamentId,
                              roundName: getRoundName(r, rounds, mode),
                              logoUrl, bestOf, sponsors,
                            })}
                          >
                            <FileText className="mr-1 h-3 w-3" />
                            Spielbericht
                          </Button>
                        </div>
                        {showMatchPhotos && (
                          <MatchPhotos
                            tournamentId={tournamentId}
                            matchId={m.id}
                            photoType="match"
                            readOnly
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
            <div className="bg-card rounded-lg p-3 card-shadow">
              <p className="text-xs font-semibold mb-2">🏆 Siegerehrung</p>
              <MatchPhotos
                tournamentId={tournamentId}
                photoType="ceremony"
                readOnly
              />
            </div>
          </div>
        </div>
      )}

      {/* Player Reports */}
      {playerStats.length > 0 && matches.filter(m => m.status === 'completed').length > 0 && (
        <div>
          <h4 className="font-bold text-sm mb-2 text-primary">📄 Spielerberichte</h4>
          <p className="text-xs text-muted-foreground mb-3">
            Erstelle individuelle PDF-Berichte mit Spielübersicht und allen Spielberichten eines Spielers.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {playerStats.map((s) => {
              const playerMatchCount = matches.filter(
                m => (m.player1Id === s.player.id || m.player2Id === s.player.id) && m.status === 'completed'
              ).length;
              if (playerMatchCount === 0) return null;
              return (
                <Button
                  key={s.player.id}
                  variant="outline"
                  size="sm"
                  className="h-auto py-2 px-3 justify-start text-left"
                  onClick={() => generatePlayerReport({
                    player: s.player,
                    matches,
                    getPlayer,
                    getParticipantName,
                    tournamentName,
                    tournamentId,
                    totalRounds: rounds,
                    logoUrl,
                    bestOf,
                    tournamentDate,
                    venueString,
                    motto,
                    mode,
                  })}
                >
                  <User className="h-4 w-4 mr-2 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="font-semibold text-xs truncate">{s.player.name}</p>
                    <p className="text-xs text-muted-foreground">{playerMatchCount} Spiele · {s.matchesWon} Siege</p>
                  </div>
                </Button>
              );
            })}
          </div>
        </div>
      )}

      {/* Player Statistics */}
      {playerStats.length > 0 && (
        <div>
          <h4 className="font-bold text-sm mb-2 text-primary">📊 Spielerstatistiken</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-2 font-bold text-muted-foreground">#</th>
                  <th className="text-left py-2 px-2 font-bold text-muted-foreground">Spieler</th>
                  <th className="text-center py-2 px-2 font-bold text-muted-foreground">Spiele</th>
                  <th className="text-center py-2 px-2 font-bold text-muted-foreground">Siege</th>
                  <th className="text-center py-2 px-2 font-bold text-muted-foreground">Quote</th>
                  <th className="text-center py-2 px-2 font-bold text-muted-foreground">Sätze</th>
                  <th className="text-center py-2 px-2 font-bold text-muted-foreground">Ø Diff.</th>
                  <th className="text-center py-2 px-2 font-bold text-muted-foreground">Punkte</th>
                </tr>
              </thead>
              <tbody>
                {playerStats.map((s, i) => (
                  <tr key={s.player.id} className="border-b border-border/50 hover:bg-secondary/50">
                    <td className="py-2 px-2 text-muted-foreground">{i + 1}</td>
                    <td className="py-2 px-2">
                      <span className="font-semibold">{s.player.name}</span>
                      {s.player.club && (
                        <span className="text-xs text-muted-foreground ml-1">({s.player.club})</span>
                      )}
                    </td>
                    <td className="text-center py-2 px-2">{s.matchesPlayed}</td>
                    <td className="text-center py-2 px-2 font-semibold">{s.matchesWon}</td>
                    <td className="text-center py-2 px-2">
                      <span className={`font-bold ${s.winRate >= 50 ? 'text-primary' : 'text-destructive'}`}>
                        {s.winRate.toFixed(0)}%
                      </span>
                    </td>
                    <td className="text-center py-2 px-2">{s.setsWon}:{s.setsLost}</td>
                    <td className="text-center py-2 px-2">
                      <span className={`font-semibold ${s.avgSetDiff > 0 ? 'text-primary' : s.avgSetDiff < 0 ? 'text-destructive' : ''}`}>
                        {s.avgSetDiff > 0 ? '+' : ''}{s.avgSetDiff.toFixed(1)}
                      </span>
                    </td>
                    <td className="text-center py-2 px-2 text-muted-foreground">{s.pointsWon}:{s.pointsLost}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Certificate Preview Dialog */}
      {champion && (() => {
        const placements: { label: string; player: Player }[] = [];
        if (champion) placements.push({ label: '1. Platz', player: champion });
        if (secondPlace) placements.push({ label: '2. Platz', player: secondPlace });
        thirdPlacePlayers.forEach(p => placements.push({ label: '3. Platz', player: p }));
        const current = placements[previewIndex] || placements[0];
        if (!current) return null;
        return (
          <Dialog open={showCertPreview} onOpenChange={setShowCertPreview}>
            <DialogContent className="max-w-2xl max-h-[95vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Urkundenvorschau</DialogTitle>
              </DialogHeader>
              {placements.length > 1 && (
                <div className="flex gap-1 justify-center">
                  {placements.map((p, i) => (
                    <Button
                      key={i}
                      variant={i === previewIndex ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setPreviewIndex(i)}
                      className="text-xs"
                    >
                      {p.label}
                    </Button>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
                  <label className="text-sm font-semibold">Urkundentext bearbeiten</label>
                  <textarea
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[120px] resize-y"
                    value={localCertText}
                    onChange={e => {
                      setLocalCertText(e.target.value);
                      setHasPendingChanges(true);
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    Platzhalter: <code className="bg-muted px-1 rounded">{'{turniername}'}</code>{' '}
                    <code className="bg-muted px-1 rounded">{'{spieler}'}</code>{' '}
                    <code className="bg-muted px-1 rounded">{'{verein}'}</code>{' '}
                    <code className="bg-muted px-1 rounded">{'{platz}'}</code>
                  </p>

                  {/* Per-line font size editor */}
                  {(() => {
                    const lines = localCertText.split('\n').filter(l => l.trim());
                    if (lines.length === 0) return null;
                    return (
                      <div className="space-y-1 mt-3">
                        <label className="text-xs font-semibold text-muted-foreground">Schriftgröße je Zeile</label>
                        {lines.map((line, i) => {
                          const currentSize = localLineSizes[i] ?? certificateFontSize;
                          return (
                            <div key={i} className="flex items-center gap-2">
                              <span className="text-xs truncate max-w-[120px] text-muted-foreground" title={line}>
                                {line.length > 20 ? line.slice(0, 20) + '…' : line}
                              </span>
                              <select
                                className="h-7 rounded border border-input bg-background px-1 text-xs flex-shrink-0"
                                value={currentSize}
                                onChange={e => {
                                  const newSizes = [...localLineSizes];
                                  while (newSizes.length <= i) newSizes.push(certificateFontSize);
                                  newSizes[i] = Number(e.target.value);
                                  setLocalLineSizes(newSizes);
                                  setHasPendingChanges(true);
                                }}
                              >
                                {[10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 32, 36].map(s => (
                                  <option key={s} value={s}>{s}pt</option>
                                ))}
                              </select>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}

                  {/* Extra fields editor with visibility toggles */}
                  <div className="border-t border-border pt-3 space-y-2">
                    <label className="text-xs font-semibold text-muted-foreground">Weitere Urkundenfelder</label>
                    
                    {/* Date visibility toggle */}
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={!localHiddenFields.includes('date')}
                        onCheckedChange={(checked) => {
                          const newHidden = checked
                            ? localHiddenFields.filter(f => f !== 'date')
                            : [...localHiddenFields, 'date'];
                          setLocalHiddenFields(newHidden);
                          setHasPendingChanges(true);
                        }}
                      />
                      <span className="text-xs text-muted-foreground">Datum anzeigen</span>
                    </div>

                    {[
                      { key: 'motto', label: 'Motto', value: localMotto, setter: setLocalMotto },
                      { key: 'venue', label: 'Austragungsort', value: localVenue, setter: setLocalVenue },
                      { key: 'organizer', label: 'Veranstalter', value: localOrganizer, setter: setLocalOrganizer },
                      { key: 'sponsor', label: 'Sponsoren', value: sponsors.map(s => s.name).join(', '), setter: (() => {}) },
                    ].map(field => (
                      <div key={field.key} className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={!localHiddenFields.includes(field.key)}
                            onCheckedChange={(checked) => {
                              const newHidden = checked
                                ? localHiddenFields.filter(f => f !== field.key)
                                : [...localHiddenFields, field.key];
                              setLocalHiddenFields(newHidden);
                              setHasPendingChanges(true);
                            }}
                          />
                          <input
                            className="flex-1 h-8 rounded-md border border-input bg-background px-2 text-sm"
                            value={field.value}
                            placeholder={field.label}
                            onChange={e => {
                              field.setter(e.target.value);
                              setHasPendingChanges(true);
                            }}
                          />
                          <select
                            className="h-8 rounded border border-input bg-background px-1 text-xs flex-shrink-0 w-[70px]"
                            value={localExtraSizes[field.key] ?? certificateFontSize}
                            onChange={e => {
                              const newSizes = { ...localExtraSizes, [field.key]: Number(e.target.value) };
                              setLocalExtraSizes(newSizes);
                              setHasPendingChanges(true);
                            }}
                          >
                            {[8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 32, 36].map(s => (
                              <option key={s} value={s}>{s}pt</option>
                            ))}
                          </select>
                        </div>
                        <span className="text-[10px] text-muted-foreground">{field.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div id="cert-preview-print">
                  <CertificatePreview
                    tournamentName={tournamentName}
                    logoUrl={logoUrl}
                    motto={localMotto}
                    tournamentDate={tournamentDate}
                    venueString={localVenue}
                    organizerName={localOrganizer}
                    sponsors={sponsors}
                    certificateBgUrl={certificateBgUrl}
                    certificateText={localCertText}
                    player={current.player}
                    placementLabel={current.label}
                    fontFamily={certificateFontFamily}
                    fontSize={certificateFontSize}
                    textColor={certificateTextColor}
                    fontBold={!!localExtraSizes.fontBold}
                    lineSizes={localLineSizes}
                    extraSizes={localExtraSizes}
                    hiddenFields={localHiddenFields}
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-2">
                <Button
                  size="sm"
                  className="flex-1"
                  disabled={!hasPendingChanges}
                  onClick={() => {
                    onSaveCertificateSettings?.({
                      certificateText: localCertText,
                      certificateLineSizes: localLineSizes,
                      certificateExtraSizes: localExtraSizes,
                      certificateHiddenFields: localHiddenFields,
                      motto: localMotto,
                      venueString: localVenue,
                      organizerName: localOrganizer,
                    });
                    setHasPendingChanges(false);
                  }}
                >
                  <Save className="h-4 w-4 mr-2" />
                  Änderungen speichern
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    const printContent = document.getElementById('cert-preview-print');
                    if (!printContent) return;
                    const win = window.open('', '_blank');
                    if (!win) return;
                    const FONT_FAMILY_MAP: Record<string, string> = {
                      Helvetica: 'Helvetica, Arial, sans-serif',
                      Times: '"Times New Roman", Times, serif',
                      Courier: '"Courier New", Courier, monospace',
                      'Dancing Script': '"Dancing Script", cursive',
                      'Great Vibes': '"Great Vibes", cursive',
                      'Playfair Display': '"Playfair Display", serif',
                      Montserrat: 'Montserrat, sans-serif',
                      Lora: 'Lora, serif',
                      Raleway: 'Raleway, sans-serif',
                    };
                    const printFontFamily = FONT_FAMILY_MAP[certificateFontFamily] || 'Helvetica, Arial, sans-serif';
                    
                    // Get the preview element and measure its actual size
                    const sourceEl = printContent.firstElementChild as HTMLElement;
                    if (!sourceEl) return;
                    const previewRect = sourceEl.getBoundingClientRect();

                    // Clone the preview HTML
                    const clone = sourceEl.cloneNode(true) as HTMLElement;

                    // Build the print window with a CSS transform to scale the small preview up to A4
                    // A4 = 210mm x 297mm. We scale the preview proportionally.
                    win.document.write(`<!DOCTYPE html><html><head><title>Urkunde drucken</title>
                      <link rel="preconnect" href="https://fonts.googleapis.com" />
                      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
                      <link href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400;700&family=Great+Vibes&family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Montserrat:wght@400;600;700&family=Lora:ital,wght@0,400;0,700;1,400&family=Raleway:wght@400;600;700&display=swap" rel="stylesheet" />
                      <style>
                        @page { size: A4 portrait; margin: 0; }
                        * { margin: 0; padding: 0; box-sizing: border-box; }
                        html, body { width: 210mm; height: 297mm; overflow: hidden; }
                        .cert-wrapper {
                          width: ${previewRect.width}px;
                          height: ${previewRect.height}px;
                          transform-origin: top left;
                          /* scale preview to fill 210mm width; 210mm ≈ 793.7px at 96dpi */
                          transform: scale(calc(793.7 / ${previewRect.width}));
                        }
                        .cert-wrapper img { display: block; }
                      </style>
                      ${document.querySelector('style') ? '' : ''}
                    </head><body><div class="cert-wrapper">`);

                    // Copy Tailwind/app stylesheets into print window
                    const sheets = Array.from(document.styleSheets);
                    let cssText = '';
                    for (const sheet of sheets) {
                      try {
                        for (const rule of Array.from(sheet.cssRules)) {
                          cssText += rule.cssText + '\n';
                        }
                      } catch { /* cross-origin sheets */ }
                    }
                    const styleEl = win.document.createElement('style');
                    styleEl.textContent = cssText;
                    win.document.head.appendChild(styleEl);

                    win.document.write(sourceEl.innerHTML);
                    win.document.write('</div></body></html>');
                    win.document.close();

                    // Copy classes from original onto wrapper's first child
                    const wrapperChild = win.document.querySelector('.cert-wrapper > *') as HTMLElement;
                    if (wrapperChild && sourceEl.firstElementChild) {
                      wrapperChild.className = (sourceEl.firstElementChild as HTMLElement).className;
                    }

                    win.onload = () => { setTimeout(() => { win.print(); win.close(); }, 600); };
                  }}
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Urkunde drucken
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={async () => {
                    const sourceEl = document.getElementById('cert-preview-print')?.firstElementChild as HTMLElement;
                    if (!sourceEl) return;
                    toast.info('PDF wird erstellt…');
                    try {
                      // Render preview at high resolution
                      const canvas = await html2canvas(sourceEl, {
                        scale: 3,
                        useCORS: true,
                        allowTaint: false,
                        backgroundColor: '#ffffff',
                      });
                      const imgData = canvas.toDataURL('image/jpeg', 0.95);
                      const pdf = new jsPDF({ orientation: 'portrait', format: 'a4', unit: 'mm' });
                      pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
                      pdf.save(`Urkunde_${current.player.name.replace(/\s+/g, '_')}.pdf`);
                      toast.success('PDF gespeichert');
                    } catch (err) {
                      console.error(err);
                      toast.error('PDF-Export fehlgeschlagen');
                    }
                  }}
                >
                  <Download className="h-4 w-4 mr-2" />
                  PDF Export
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}
    </div>
  );
}
