import { Player, Tournament } from '@/types/tournament';
import jsPDF from 'jspdf';

interface PhotoConsentOptions {
  player: Player;
  tournamentName: string;
  tournamentDate: string | null;
  venueString: string;
  logoUrl?: string | null;
}

async function loadLogoAsDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function printPhotoConsentForm({ player, tournamentName, tournamentDate, venueString, logoUrl }: PhotoConsentOptions) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const w = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentW = w - margin * 2;
  let y = margin;

  // Logo
  if (logoUrl) {
    const logoData = await loadLogoAsDataUrl(logoUrl);
    if (logoData) {
      try {
        doc.addImage(logoData, 'PNG', w / 2 - 10, y, 20, 20);
        y += 24;
      } catch { /* ignore */ }
    }
  }

  // Title
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Einwilligungserklärung', w / 2, y, { align: 'center' });
  y += 7;
  doc.setFontSize(12);
  doc.text('Foto- und Videoaufnahmen', w / 2, y, { align: 'center' });
  y += 12;

  // Tournament info
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Turnier: ${tournamentName}`, margin, y);
  y += 6;
  if (tournamentDate) {
    const dateStr = new Date(tournamentDate).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    doc.text(`Datum: ${dateStr}`, margin, y);
    y += 6;
  }
  if (venueString) {
    doc.text(`Veranstaltungsort: ${venueString}`, margin, y);
    y += 6;
  }
  y += 4;

  // Horizontal line
  doc.setDrawColor(180);
  doc.setLineWidth(0.3);
  doc.line(margin, y, w - margin, y);
  y += 8;

  // Player info
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Angaben zur Person:', margin, y);
  y += 7;

  doc.setFont('helvetica', 'normal');
  const fields = [
    ['Name:', player.name],
    ['Verein:', player.club || '–'],
    ['Geburtsdatum:', player.birthDate ? new Date(player.birthDate).toLocaleDateString('de-DE') : '–'],
  ];

  for (const [label, value] of fields) {
    doc.setFont('helvetica', 'bold');
    doc.text(label, margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(value, margin + 35, y);
    y += 6;
  }
  y += 6;

  // Consent text
  doc.setFont('helvetica', 'bold');
  doc.text('Einwilligungserklärung:', margin, y);
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const consentText = [
    `Hiermit erkläre ich mich damit einverstanden, dass im Rahmen des Turniers "${tournamentName}" Foto- und Videoaufnahmen von mir angefertigt und wie folgt verwendet werden dürfen:`,
    '',
    '• Veröffentlichung auf der Webseite des Veranstalters',
    '• Veröffentlichung in sozialen Medien (z.B. Facebook, Instagram)',
    '• Verwendung in Vereinspublikationen und Presseberichten',
    '• Dokumentation des Turniergeschehens',
    '',
    'Die Einwilligung erfolgt freiwillig. Sie kann jederzeit ohne Angabe von Gründen mit Wirkung für die Zukunft widerrufen werden. Bereits veröffentlichte Aufnahmen werden im Falle eines Widerrufs nach Möglichkeit entfernt.',
    '',
    'Mir ist bekannt, dass ich ohne diese Einwilligung an dem Turnier teilnehmen kann, jedoch auf den Aufnahmen ggf. unkenntlich gemacht werde.',
  ];

  for (const line of consentText) {
    if (line === '') {
      y += 3;
      continue;
    }
    const splitLines = doc.splitTextToSize(line, contentW);
    doc.text(splitLines, margin, y);
    y += splitLines.length * 4.5;
  }
  y += 10;

  // Checkbox options
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  // Option 1: Consent
  doc.rect(margin, y - 3.5, 4, 4);
  doc.text('Ja, ich stimme der Anfertigung und Verwendung von Foto-/Videoaufnahmen zu.', margin + 7, y);
  y += 10;

  // Option 2: No consent
  doc.rect(margin, y - 3.5, 4, 4);
  doc.text('Nein, ich stimme nicht zu.', margin + 7, y);
  y += 16;

  // Signature area
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);

  // Date + location line
  doc.line(margin, y, margin + 60, y);
  doc.setFontSize(8);
  doc.text('Ort, Datum', margin, y + 4);

  // Signature line
  doc.line(margin + 80, y, w - margin, y);
  doc.text('Unterschrift (bei Minderjährigen: Erziehungsberechtigte/r)', margin + 80, y + 4);

  y += 16;

  // Minor info
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(120);
  const minorText = 'Bei minderjährigen Teilnehmern ist die Unterschrift eines/einer Erziehungsberechtigten erforderlich.';
  doc.text(minorText, margin, y);

  // Footer
  doc.setTextColor(160);
  doc.setFontSize(7);
  doc.text(`Generiert für: ${player.name} – ${tournamentName}`, w / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });

  doc.save(`Fotoerlaubnis_${player.name.replace(/\s+/g, '_')}.pdf`);
}

export async function printAllPhotoConsentForms(players: Player[], tournamentName: string, tournamentDate: string | null, venueString: string, logoUrl?: string | null) {
  for (const player of players) {
    await printPhotoConsentForm({ player, tournamentName, tournamentDate, venueString, logoUrl });
  }
}
