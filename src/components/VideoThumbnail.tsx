import { useState, useEffect, useRef } from 'react';
import { Play, Loader2 } from 'lucide-react';

interface Props {
  src: string;
  className?: string;
  onClick?: () => void;
}

export function VideoThumbnail({ src, className = '', onClick }: Props) {
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.preload = 'metadata';
    video.muted = true;

    video.onloadeddata = () => {
      video.currentTime = 0.5;
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0);
          setThumbnail(canvas.toDataURL('image/jpeg', 0.7));
        }
      } catch {
        setError(true);
      }
      setLoading(false);
    };

    video.onerror = () => {
      setError(true);
      setLoading(false);
    };

    video.src = src;

    return () => {
      video.src = '';
    };
  }, [src]);

  return (
    <button
      onClick={onClick}
      className={`relative overflow-hidden bg-muted flex items-center justify-center group ${className}`}
    >
      {loading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
      {!loading && thumbnail && (
        <img src={thumbnail} alt="Video" className="w-full h-full object-cover" />
      )}
      {!loading && error && (
        <div className="text-muted-foreground text-[10px] text-center px-1">Video</div>
      )}
      {!loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
          <Play className="h-5 w-5 text-white fill-white" />
        </div>
      )}
    </button>
  );
}
