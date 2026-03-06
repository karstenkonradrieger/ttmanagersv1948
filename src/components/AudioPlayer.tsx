import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Play, Pause, Radio, Music, Volume2, VolumeX, SkipBack, SkipForward, Megaphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { usePlaylistTracks } from '@/hooks/usePlaylistTracks';
import { PlaylistManager } from '@/components/PlaylistManager';

type AudioSource = 'radio' | 'playlist';

const RADIO_URL = 'https://icecast.v09.absolutradio.de/absolut-oldieclassics/live/mp3/high';

const DEFAULT_PLAYLIST = [
  { title: 'Ambient Background', src: '/audio/track1.mp3' },
  { title: 'Soft Ambient', src: '/audio/track2.mp3' },
  { title: 'Relaxing Ambient', src: '/audio/track3.mp3' },
];

const DEFAULT_GONG = '/audio/gong.mp3';

export function AudioPlayer() {
  const [source, setSource] = useState<AudioSource>('radio');
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [muted, setMuted] = useState(false);
  const [trackIndex, setTrackIndex] = useState(0);
  const [announcing, setAnnouncing] = useState(false);
  const [gongPlaying, setGongPlaying] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const gongRef = useRef<HTMLAudioElement | null>(null);
  const fadeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const savedVolumeRef = useRef(0.7);

  const { tracks: dbTracks, gongTrack, getPublicUrl } = usePlaylistTracks();

  // Build effective playlist from DB tracks or fallback to defaults
  const playlist = useMemo(() => {
    if (dbTracks.length > 0) {
      return dbTracks.map(t => ({ title: t.title, src: getPublicUrl(t.file_path) }));
    }
    return DEFAULT_PLAYLIST;
  }, [dbTracks, getPublicUrl]);

  const gongSrc = useMemo(() => {
    if (gongTrack) return getPublicUrl(gongTrack.file_path);
    return DEFAULT_GONG;
  }, [gongTrack, getPublicUrl]);

  const safeTrackIndex = trackIndex >= playlist.length ? 0 : trackIndex;
  const currentSrc = source === 'radio' ? RADIO_URL : playlist[safeTrackIndex]?.src || '';

  // Apply volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = muted ? 0 : volume;
    }
  }, [volume, muted]);

  // Change source
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.src = currentSrc;
    if (playing) {
      audio.play().catch(() => {});
    }
  }, [currentSrc]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.src = currentSrc;
      audio.play().catch(() => {});
      setPlaying(true);
    }
  }, [playing, currentSrc]);

  const nextTrack = () => {
    if (source !== 'playlist') return;
    setTrackIndex((i) => (i + 1) % playlist.length);
  };

  const prevTrack = () => {
    if (source !== 'playlist') return;
    setTrackIndex((i) => (i - 1 + playlist.length) % playlist.length);
  };

  const switchSource = (s: AudioSource) => {
    if (s === source) return;
    setSource(s);
    setTrackIndex(0);
    setPlaying(true);
  };

  // --- Durchsage ---
  const playGongAndMute = useCallback((isAutomatic: boolean) => {
    if (announcing) return;
    setAnnouncing(true);
    savedVolumeRef.current = volume;

    if (audioRef.current) {
      audioRef.current.volume = 0;
    }

    const gong = gongRef.current;
    if (gong) {
      gong.src = gongSrc;
      gong.currentTime = 0;
      setGongPlaying(true);
      gong.play().catch(() => {});
      gong.onended = () => {
        setGongPlaying(false);
        if (isAutomatic) {
          window.dispatchEvent(new CustomEvent('announcement-gong-done'));
        }
      };
    } else if (isAutomatic) {
      window.dispatchEvent(new CustomEvent('announcement-gong-done'));
    }
  }, [announcing, volume, gongSrc]);

  const startAnnouncement = () => playGongAndMute(false);

  const fadeBackIn = useCallback(() => {
    setAnnouncing(false);
    setGongPlaying(false);

    const audio = audioRef.current;
    if (!audio) return;
    let currentVol = 0;
    const target = muted ? 0 : savedVolumeRef.current;
    const step = target / 20;

    if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
    fadeIntervalRef.current = setInterval(() => {
      currentVol = Math.min(currentVol + step, target);
      if (audio) audio.volume = currentVol;
      if (currentVol >= target) {
        if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);
      }
    }, 50);
  }, [muted]);

  const endAnnouncement = () => fadeBackIn();

  // Listen for automatic announcements
  useEffect(() => {
    const handleAutoStart = () => playGongAndMute(true);
    const handleAutoEnd = () => fadeBackIn();

    window.addEventListener('announcement-start', handleAutoStart);
    window.addEventListener('announcement-end', handleAutoEnd);
    return () => {
      window.removeEventListener('announcement-start', handleAutoStart);
      window.removeEventListener('announcement-end', handleAutoEnd);
    };
  }, [playGongAndMute, fadeBackIn]);

  return (
    <>
      <audio ref={audioRef} preload="none" />
      <audio ref={gongRef} src={gongSrc} preload="auto" />

      <footer className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-md">
        <div className="container flex items-center gap-3 py-2 flex-wrap sm:flex-nowrap">

          {/* Source toggle */}
          <div className="flex rounded-lg overflow-hidden border border-border shrink-0">
            <button
              onClick={() => switchSource('radio')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors',
                source === 'radio'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-muted'
              )}
            >
              <Radio className="h-3.5 w-3.5" /> Radio
            </button>
            <button
              onClick={() => switchSource('playlist')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors',
                source === 'playlist'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-muted'
              )}
            >
              <Music className="h-3.5 w-3.5" /> Playlist
            </button>
          </div>

          {/* Track info */}
          <div className="text-xs text-muted-foreground truncate min-w-0 flex-1">
            {source === 'radio' ? (
              <span className="flex items-center gap-1.5">
                <span className={cn('h-2 w-2 rounded-full shrink-0', playing ? 'bg-destructive animate-pulse' : 'bg-muted-foreground')} />
                Absolut Oldie Classics
              </span>
            ) : (
              <span>{playlist[safeTrackIndex]?.title ?? '—'}</span>
            )}
          </div>

          {/* Transport controls */}
          <div className="flex items-center gap-1 shrink-0">
            {source === 'playlist' && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevTrack}>
                <SkipBack className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full border border-border"
              onClick={togglePlay}
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
            </Button>
            {source === 'playlist' && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={nextTrack}>
                <SkipForward className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Volume */}
          <div className="hidden sm:flex items-center gap-2 shrink-0 w-32">
            <button onClick={() => setMuted(!muted)} className="text-muted-foreground hover:text-foreground transition-colors">
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <Slider
              value={[muted ? 0 : volume * 100]}
              max={100}
              step={1}
              onValueChange={([v]) => { setVolume(v / 100); if (muted) setMuted(false); }}
              className="flex-1"
            />
          </div>

          {/* Playlist manager */}
          <PlaylistManager />

          {/* Durchsage button */}
          {!announcing ? (
            <Button
              onClick={startAnnouncement}
              className={cn(
                'shrink-0 gap-1.5 font-bold text-xs uppercase tracking-wider',
                'bg-tt-gold text-primary-foreground hover:bg-tt-gold/90'
              )}
              size="sm"
            >
              <Megaphone className="h-4 w-4" />
              Durchsage
            </Button>
          ) : (
            <Button
              onClick={endAnnouncement}
              size="sm"
              className={cn(
                'shrink-0 gap-1.5 font-bold text-xs uppercase tracking-wider',
                'bg-destructive text-destructive-foreground hover:bg-destructive/90',
                gongPlaying && 'animate-pulse ring-2 ring-tt-gold/60'
              )}
            >
              <Megaphone className="h-4 w-4" />
              Beenden
            </Button>
          )}
        </div>
      </footer>
    </>
  );
}
