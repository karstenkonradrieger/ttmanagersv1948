import { Player } from '@/types/tournament';

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

interface Props {
  tournamentName: string;
  logoUrl?: string | null;
  motto?: string;
  tournamentDate?: string | null;
  venueString?: string;
  organizerName?: string;
  sponsorName?: string;
  sponsorSignatureUrl?: string | null;
  sponsorLogoUrl?: string | null;
  sponsorConsent?: boolean;
  certificateBgUrl?: string | null;
  certificateText: string;
  player: Player;
  placementLabel: string;
  fontFamily?: string;
  fontSize?: number;
  textColor?: string;
  lineSizes?: number[];
}

function resolvePlaceholders(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}

export function CertificatePreview({
  tournamentName,
  logoUrl,
  motto,
  tournamentDate,
  venueString,
  organizerName,
  sponsorName,
  sponsorSignatureUrl,
  sponsorLogoUrl,
  sponsorConsent,
  certificateBgUrl,
  certificateText,
  player,
  placementLabel,
  fontFamily = 'Helvetica',
  fontSize = 20,
  textColor = '#1e1e1e',
  lineSizes = [],
}: Props) {
  const certDate = tournamentDate
    ? new Date(tournamentDate + 'T00:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });

  const hasSponsorSection = (sponsorConsent && sponsorSignatureUrl && sponsorName) || (sponsorName && sponsorLogoUrl);

  const resolvedText = resolvePlaceholders(certificateText, {
    turniername: tournamentName,
    spieler: player.name,
    verein: player.club || '–',
    platz: placementLabel,
  });

  const textLines = resolvedText.split('\n').filter(l => l.trim());

  // Muted color derived from textColor with reduced opacity
  const mutedColor = textColor + '99';
  const subtleColor = textColor + '70';

  return (
    <div
      className="relative w-full border border-border rounded-lg overflow-hidden bg-white"
      style={{ aspectRatio: '210 / 297' }}
    >
      {certificateBgUrl && (
        <img
          src={certificateBgUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}

      <div className="relative z-10 flex flex-col items-center justify-between h-full px-6 py-8 text-center" style={{ fontFamily: FONT_FAMILY_MAP[fontFamily] || FONT_FAMILY_MAP.Helvetica }}>
        <div className="flex flex-col items-center gap-2 flex-1 justify-center">
          {logoUrl && (
            <img
              src={logoUrl}
              alt="Logo"
              className="max-h-12 object-contain"
              crossOrigin="anonymous"
            />
          )}

          {motto && (
            <p className="text-xs italic" style={{ color: mutedColor }}>"{motto}"</p>
          )}

          <div className="mt-3 space-y-1">
            {textLines.map((line, i) => {
              const lineSize = lineSizes[i] ?? fontSize;
              return (
                <p key={i} className="leading-relaxed" style={{ color: textColor, fontSize: `${Math.max(8, lineSize * 0.55)}px` }}>
                  {line}
                </p>
              );
            })}
          </div>

          <p className="text-xs mt-4" style={{ color: textColor }}>{certDate}</p>
          {venueString && (
            <p className="text-xs" style={{ color: mutedColor }}>{venueString}</p>
          )}
        </div>

        <div className="w-full flex items-end justify-center gap-8 mt-4">
          {hasSponsorSection && (
            <div className="flex flex-col items-center gap-1">
              {sponsorConsent && sponsorSignatureUrl && (
                <img
                  src={sponsorSignatureUrl}
                  alt="Unterschrift"
                  className="max-h-8 object-contain"
                  crossOrigin="anonymous"
                />
              )}
              <div className="w-20 border-t" style={{ borderColor: subtleColor }} />
              <div className="flex items-center gap-1">
                {sponsorLogoUrl && (
                  <img
                    src={sponsorLogoUrl}
                    alt="Sponsor"
                    className="max-h-4 object-contain"
                    crossOrigin="anonymous"
                  />
                )}
                {sponsorName && (
                  <span className="text-[8px]" style={{ color: mutedColor }}>{sponsorName}</span>
                )}
              </div>
              <span className="text-[7px]" style={{ color: mutedColor }}>Sponsor</span>
            </div>
          )}

          <div className="flex flex-col items-center gap-1">
            <div className="w-24 border-t" style={{ borderColor: subtleColor }} />
            {organizerName && (
              <span className="text-[8px]" style={{ color: mutedColor }}>{organizerName}</span>
            )}
            <span className="text-[7px]" style={{ color: mutedColor }}>Turnierleitung</span>
          </div>
        </div>
      </div>
    </div>
  );
}
