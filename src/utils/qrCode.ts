import QRCode from 'qrcode';

/**
 * Generate a QR code data URL pointing to the live view of a tournament.
 */
export async function generateMatchQrDataUrl(tournamentId: string): Promise<string | null> {
  try {
    const baseUrl = window.location.origin;
    const url = `${baseUrl}/live/${tournamentId}`;
    return await QRCode.toDataURL(url, {
      width: 200,
      margin: 1,
      color: { dark: '#000000', light: '#ffffff' },
    });
  } catch {
    return null;
  }
}
