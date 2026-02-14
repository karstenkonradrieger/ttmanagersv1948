import { Match, Player, Tournament } from '@/types/tournament';
import jsPDF from 'jspdf';

interface RefereeSheetOptions {
  match: Match;
  player1Name: string;
  player2Name: string;
  tournamentName: string;
  bestOf: number;
}

export function printRefereeSheet({ match, player1Name, player2Name, tournamentName, bestOf }: RefereeSheetOptions) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a5' });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const maxSets = bestOf * 2 - 1;

  // Border
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.rect(5, 5, w - 10, h - 10);

  // Header
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(tournamentName, w / 2, 14, { align: 'center' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Schiedsrichterzettel', w / 2, 20, { align: 'center' });

  // Table info
  if (match.table) {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`Tisch ${match.table}`, w / 2, 28, { align: 'center' });
  }

  // Round info
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Runde ${match.round + 1} | Spiel ${match.position + 1}`, w / 2, 33, { align: 'center' });

  // Players
  const yPlayers = 42;
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');

  // Player 1 (left-aligned)
  doc.text('A:', 10, yPlayers);
  doc.setFont('helvetica', 'normal');
  doc.text(player1Name, 20, yPlayers);

  // Player 2
  doc.setFont('helvetica', 'bold');
  doc.text('B:', 10, yPlayers + 8);
  doc.setFont('helvetica', 'normal');
  doc.text(player2Name, 20, yPlayers + 8);

  // Score table
  const tableY = yPlayers + 16;
  const colW = (w - 40) / (maxSets + 2); // +2 for name col and result col
  const rowH = 10;
  const tableX = 10;
  const nameColW = 40;
  const resultColW = 16;
  const setColW = (w - 20 - nameColW - resultColW) / maxSets;

  // Header row
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.rect(tableX, tableY, nameColW, rowH);
  doc.text('Spieler', tableX + 2, tableY + 7);

  for (let s = 0; s < maxSets; s++) {
    const x = tableX + nameColW + s * setColW;
    doc.rect(x, tableY, setColW, rowH);
    doc.text(`${s + 1}`, x + setColW / 2, tableY + 7, { align: 'center' });
  }

  const resX = tableX + nameColW + maxSets * setColW;
  doc.rect(resX, tableY, resultColW, rowH);
  doc.text('Sätze', resX + resultColW / 2, tableY + 7, { align: 'center' });

  // Player rows
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  for (let row = 0; row < 2; row++) {
    const y = tableY + rowH + row * rowH;
    const label = row === 0 ? 'A' : 'B';
    const pName = row === 0 ? player1Name : player2Name;
    const truncated = pName.length > 18 ? pName.substring(0, 17) + '…' : pName;

    doc.rect(tableX, y, nameColW, rowH);
    doc.text(`${label}: ${truncated}`, tableX + 2, y + 7);

    for (let s = 0; s < maxSets; s++) {
      const x = tableX + nameColW + s * setColW;
      doc.rect(x, y, setColW, rowH);
    }

    doc.rect(resX, y, resultColW, rowH);
  }

  // Footer
  const footerY = tableY + rowH * 3 + 8;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Gewinner: ___________________________', 10, footerY);
  doc.text('Unterschrift SR: ___________________________', w / 2, footerY);

  doc.text(`Gewinnsätze: ${bestOf} (Best of ${maxSets})`, 10, footerY + 8);

  // Save as download (avoids popup blockers in Edge)
  const p1Short = player1Name.replace(/[^a-zA-Z0-9äöüÄÖÜß]/g, '_').substring(0, 15);
  const p2Short = player2Name.replace(/[^a-zA-Z0-9äöüÄÖÜß]/g, '_').substring(0, 15);
  doc.save(`SR_Tisch${match.table || 0}_${p1Short}_vs_${p2Short}.pdf`);
}

export function printAllRefereeSheets(
  matches: Match[],
  getParticipantName: (id: string | null) => string,
  tournamentName: string,
  bestOf: number
) {
  const activeMatches = matches.filter(m => m.status === 'active' && m.player1Id && m.player2Id);
  if (activeMatches.length === 0) return;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a5' });

  activeMatches.forEach((match, idx) => {
    if (idx > 0) doc.addPage();
    drawSheet(doc, match, getParticipantName(match.player1Id), getParticipantName(match.player2Id), tournamentName, bestOf);
  });

  doc.save(`SR_Zettel_alle.pdf`);
}

function drawSheet(doc: jsPDF, match: Match, player1Name: string, player2Name: string, tournamentName: string, bestOf: number) {
  const w = doc.internal.pageSize.getWidth();
  const maxSets = bestOf * 2 - 1;

  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.rect(5, 5, w - 10, doc.internal.pageSize.getHeight() - 10);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(tournamentName, w / 2, 14, { align: 'center' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Schiedsrichterzettel', w / 2, 20, { align: 'center' });

  if (match.table) {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`Tisch ${match.table}`, w / 2, 28, { align: 'center' });
  }

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Runde ${match.round + 1} | Spiel ${match.position + 1}`, w / 2, 33, { align: 'center' });

  const yPlayers = 42;
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('A:', 10, yPlayers);
  doc.setFont('helvetica', 'normal');
  doc.text(player1Name, 20, yPlayers);
  doc.setFont('helvetica', 'bold');
  doc.text('B:', 10, yPlayers + 8);
  doc.setFont('helvetica', 'normal');
  doc.text(player2Name, 20, yPlayers + 8);

  const tableY = yPlayers + 16;
  const tableX = 10;
  const nameColW = 40;
  const resultColW = 16;
  const setColW = (w - 20 - nameColW - resultColW) / maxSets;
  const rowH = 10;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.rect(tableX, tableY, nameColW, rowH);
  doc.text('Spieler', tableX + 2, tableY + 7);

  for (let s = 0; s < maxSets; s++) {
    const x = tableX + nameColW + s * setColW;
    doc.rect(x, tableY, setColW, rowH);
    doc.text(`${s + 1}`, x + setColW / 2, tableY + 7, { align: 'center' });
  }

  const resX = tableX + nameColW + maxSets * setColW;
  doc.rect(resX, tableY, resultColW, rowH);
  doc.text('Sätze', resX + resultColW / 2, tableY + 7, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  for (let row = 0; row < 2; row++) {
    const y = tableY + rowH + row * rowH;
    const label = row === 0 ? 'A' : 'B';
    const pName = row === 0 ? player1Name : player2Name;
    const truncated = pName.length > 18 ? pName.substring(0, 17) + '…' : pName;
    doc.rect(tableX, y, nameColW, rowH);
    doc.text(`${label}: ${truncated}`, tableX + 2, y + 7);
    for (let s = 0; s < maxSets; s++) {
      doc.rect(tableX + nameColW + s * setColW, y, setColW, rowH);
    }
    doc.rect(resX, y, resultColW, rowH);
  }

  const footerY = tableY + rowH * 3 + 8;
  doc.setFontSize(8);
  doc.text('Gewinner: ___________________________', 10, footerY);
  doc.text('Unterschrift SR: ___________________________', w / 2, footerY);
  doc.text(`Gewinnsätze: ${bestOf} (Best of ${maxSets})`, 10, footerY + 8);
}
