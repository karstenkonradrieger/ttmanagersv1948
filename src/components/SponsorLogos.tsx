import { Sponsor } from '@/types/tournament';

interface Props {
  sponsors: Sponsor[];
}

export function SponsorLogos({ sponsors }: Props) {
  const withLogo = sponsors.filter(s => s.logoUrl);
  if (withLogo.length === 0) return null;

  return (
    <div className="border-t border-border/50 pt-4 mt-6">
      <p className="text-xs text-muted-foreground text-center mb-3 uppercase tracking-wider font-semibold">Sponsoren</p>
      <div className="flex items-center justify-center gap-6 flex-wrap">
        {withLogo.map(s => (
          <img
            key={s.id}
            src={s.logoUrl!}
            alt={s.name || 'Sponsor'}
            title={s.name}
            className="h-10 max-w-[120px] object-contain"
          />
        ))}
      </div>
    </div>
  );
}
