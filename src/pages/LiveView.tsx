import { useParams } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { useTournamentDb } from '@/hooks/useTournamentDb';
import { LiveDashboard } from '@/components/LiveDashboard';
import { SponsorLogos } from '@/components/SponsorLogos';
import { Loader2 } from 'lucide-react';

const LiveView = () => {
  const { id } = useParams<{ id: string }>();
  const { tournament, loading, getPlayer, getParticipantName } = useTournamentDb(id || null);
  const isDoubles = tournament.type === 'doubles';
  const sponsorRef = useRef<HTMLDivElement>(null);
  const [sponsorHeight, setSponsorHeight] = useState(0);
  const [audioFooterHeight, setAudioFooterHeight] = useState(0);

  useEffect(() => {
    const el = sponsorRef.current;
    if (!el) return;
    const update = () => setSponsorHeight(el.offsetHeight);
    const ro = new ResizeObserver(update);
    ro.observe(el);
    update();
    return () => ro.disconnect();
  }, [tournament.sponsors]);

  useEffect(() => {
    const findFooter = () =>
      document.querySelector<HTMLElement>('[data-audio-player-footer]');
    let ro: ResizeObserver | null = null;
    const attach = () => {
      const el = findFooter();
      if (!el) {
        setAudioFooterHeight(0);
        return false;
      }
      const update = () => setAudioFooterHeight(el.offsetHeight);
      ro = new ResizeObserver(update);
      ro.observe(el);
      update();
      return true;
    };
    if (!attach()) {
      const mo = new MutationObserver(() => {
        if (attach()) mo.disconnect();
      });
      mo.observe(document.body, { childList: true, subtree: true });
      return () => {
        mo.disconnect();
        ro?.disconnect();
      };
    }
    return () => ro?.disconnect();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="glass border-b border-border/50">
        <div className="container py-3 flex items-center gap-2">
          {tournament.logoUrl && (
            <img src={tournament.logoUrl} alt="Logo" className="h-10 w-10 rounded-lg object-cover" />
          )}
          <h1 className="text-lg font-bold tracking-tight font-display">
            {tournament.name || 'Turnier'}
          </h1>
          <span className="ml-auto text-xs text-muted-foreground font-medium">Live-Ansicht</span>
        </div>
      </header>
      <div className="container py-6" style={{ paddingBottom: sponsorHeight ? sponsorHeight + 24 : 24 }}>
        <LiveDashboard
          matches={tournament.matches}
          rounds={tournament.rounds}
          getPlayer={isDoubles
            ? (id) => id ? { id, name: getParticipantName(id), club: '', gender: '', birthDate: null, ttr: 0, postalCode: '', city: '', street: '', houseNumber: '', phone: '' } : null
            : getPlayer
          }
          getParticipantName={getParticipantName}
          mode={tournament.mode}
          phase={tournament.phase}
          players={tournament.players}
          groupCount={Math.max(...tournament.players.map(p => (p.groupNumber ?? -1) + 1), 0)}
          tournamentDate={tournament.tournamentDate}
          started={tournament.started}
        />
      </div>
      <div ref={sponsorRef} className="fixed bottom-0 left-0 right-0 z-40 glass border-t border-border/50">
        <div className="container py-3">
          <SponsorLogos sponsors={tournament.sponsors} />
        </div>
      </div>
    </div>
  );
};

export default LiveView;
