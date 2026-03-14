import { Player } from '@/types/tournament';

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
  player: Player;
  placementLabel: string;
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
  player,
  placementLabel,
}: Props) {
  const certDate = tournamentDate
    ? new Date(tournamentDate + 'T00:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });

  const hasSponsorSection = (sponsorConsent && sponsorSignatureUrl && sponsorName) || (sponsorName && sponsorLogoUrl);

  return (
    <div
      className="relative w-full border border-border rounded-lg overflow-hidden"
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
      <div className="relative z-10 flex flex-col items-center justify-between h-full px-6 py-8 text-center">
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
            <p className="text-xs italic text-muted-foreground">"{motto}"</p>
          )}

          <p className="text-sm mt-2" style={{ color: '#1e1e1e' }}>
            Beim "{tournamentName}" hat
          </p>

          <p className="text-xl font-bold" style={{ color: '#1e1e1e' }}>
            {player.name}
          </p>

          {player.club && (
            <p className="text-xs text-muted-foreground">({player.club})</p>
          )}

          <p className="text-sm" style={{ color: '#1e1e1e' }}>
            den {placementLabel} belegt.
          </p>

          <p className="text-xs mt-4" style={{ color: '#1e1e1e' }}>{certDate}</p>
          {venueString && (
            <p className="text-xs text-muted-foreground">{venueString}</p>
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
              <div className="w-20 border-t border-muted-foreground/40" />
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
                  <span className="text-[8px] text-muted-foreground">{sponsorName}</span>
                )}
              </div>
              <span className="text-[7px] text-muted-foreground">Sponsor</span>
            </div>
          )}

          <div className="flex flex-col items-center gap-1">
            <div className="w-24 border-t border-muted-foreground/40" />
            {organizerName && (
              <span className="text-[8px] text-muted-foreground">{organizerName}</span>
            )}
            <span className="text-[7px] text-muted-foreground">Turnierleitung</span>
          </div>
        </div>
      </div>
    </div>
  );
}
