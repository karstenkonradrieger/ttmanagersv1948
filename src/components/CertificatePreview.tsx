import { Player } from '@/types/tournament';

const FONT_FAMILY_MAP: Record<string, string> = {
  Helvetica: 'Helvetica, Arial, sans-serif',
  Times: '"Times New Roman", Times, serif',
  Courier: '"Courier New", Courier, monospace',
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

  // Split resolved text into lines for rendering
  const textLines = resolvedText.split('\n').filter(l => l.trim());

  return (
    <div
      className="relative w-full border border-border rounded-lg overflow-hidden bg-white"
      style={{ aspectRatio: '210 / 297' }}
    >
      {/* Background image */}
      {certificateBgUrl && (
        <img
          src={certificateBgUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}

      {/* Content overlay */}
      <div className="relative z-10 flex flex-col items-center justify-between h-full px-6 py-8 text-center" style={{ fontFamily: FONT_FAMILY_MAP[fontFamily] || FONT_FAMILY_MAP.Helvetica }}>
        {/* Top section */}
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
            <p className="text-xs italic" style={{ color: '#505050' }}>"{motto}"</p>
          )}

          {/* Resolved certificate text */}
          <div className="mt-3 space-y-1">
            {textLines.map((line, i) => (
              <p key={i} className="leading-relaxed" style={{ color: '#1e1e1e', fontSize: `${Math.max(8, fontSize * 0.55)}px` }}>
                {line}
              </p>
            ))}
          </div>

          <p className="text-xs mt-4" style={{ color: '#1e1e1e' }}>{certDate}</p>
          {venueString && (
            <p className="text-xs" style={{ color: '#646464' }}>{venueString}</p>
          )}
        </div>

        {/* Footer / Signature area */}
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
              <div className="w-20 border-t" style={{ borderColor: '#999' }} />
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
                  <span className="text-[8px]" style={{ color: '#999' }}>{sponsorName}</span>
                )}
              </div>
              <span className="text-[7px]" style={{ color: '#999' }}>Sponsor</span>
            </div>
          )}

          <div className="flex flex-col items-center gap-1">
            <div className="w-24 border-t" style={{ borderColor: '#999' }} />
            {organizerName && (
              <span className="text-[8px]" style={{ color: '#999' }}>{organizerName}</span>
            )}
            <span className="text-[7px]" style={{ color: '#999' }}>Turnierleitung</span>
          </div>
        </div>
      </div>
    </div>
  );
}
