import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Camera, Video, X, Loader2, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { PhotoLightbox } from '@/components/PhotoLightbox';
import { VideoThumbnail } from '@/components/VideoThumbnail';
import { Dialog, DialogContent } from '@/components/ui/dialog';

interface MatchMedia {
  id: string;
  photo_url: string;
  photo_type: string;
  match_id: string | null;
  created_at: string;
}

const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.webm', '.avi', '.mkv', '.m4v', '.3gp'];

function isVideoUrl(url: string): boolean {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return VIDEO_EXTENSIONS.some(ext => pathname.endsWith(ext));
  } catch {
    return false;
  }
}

interface Props {
  tournamentId: string;
  matchId?: string | null;
  photoType: 'match' | 'ceremony';
  maxPhotos?: number;
  maxVideos?: number;
  readOnly?: boolean;
}

export function MatchPhotos({ tournamentId, matchId, photoType, maxPhotos = 2, maxVideos = 1, readOnly = false }: Props) {
  const [media, setMedia] = useState<MatchMedia[]>([]);
  const [uploading, setUploading] = useState<'photo' | 'video' | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [videoPlayerUrl, setVideoPlayerUrl] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const photos = media.filter(m => !isVideoUrl(m.photo_url));
  const videos = media.filter(m => isVideoUrl(m.photo_url));

  useEffect(() => {
    fetchMedia();
  }, [tournamentId, matchId, photoType]);

  const fetchMedia = async () => {
    let query = supabase
      .from('match_photos')
      .select('*')
      .eq('tournament_id', tournamentId)
      .eq('photo_type', photoType)
      .order('created_at', { ascending: true });

    if (matchId) {
      query = query.eq('match_id', matchId);
    } else if (photoType === 'ceremony') {
      query = query.is('match_id', null);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching media:', error);
      return;
    }
    setMedia((data || []) as MatchMedia[]);
  };

  const handleUpload = async (file: File, type: 'photo' | 'video') => {
    if (type === 'photo' && photos.length >= maxPhotos) {
      toast.error(`Maximal ${maxPhotos} Fotos erlaubt`);
      return;
    }
    if (type === 'video' && videos.length >= maxVideos) {
      toast.error(`Maximal ${maxVideos} Video${maxVideos > 1 ? 's' : ''} erlaubt`);
      return;
    }

    if (type === 'photo' && !file.type.startsWith('image/')) {
      toast.error('Nur Bilder sind erlaubt');
      return;
    }
    if (type === 'video' && !file.type.startsWith('video/')) {
      toast.error('Nur Videos sind erlaubt');
      return;
    }

    // 100MB limit for videos, 20MB for photos
    const maxSize = type === 'video' ? 100 * 1024 * 1024 : 20 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error(`Datei zu groß (max. ${type === 'video' ? '100' : '20'} MB)`);
      return;
    }

    setUploading(type);
    try {
      const ext = file.name.split('.').pop() || (type === 'video' ? 'mp4' : 'jpg');
      const fileName = `${tournamentId}/${matchId || 'ceremony'}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('match-photos')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('match-photos')
        .getPublicUrl(fileName);

      const { error: dbError } = await supabase
        .from('match_photos')
        .insert({
          tournament_id: tournamentId,
          match_id: matchId || null,
          photo_type: photoType,
          photo_url: urlData.publicUrl,
        });

      if (dbError) throw dbError;

      toast.success(type === 'video' ? 'Video hochgeladen' : 'Foto hochgeladen');
      fetchMedia();
    } catch (error) {
      console.error('Error uploading:', error);
      toast.error('Fehler beim Hochladen');
    } finally {
      setUploading(null);
      if (photoInputRef.current) photoInputRef.current.value = '';
      if (videoInputRef.current) videoInputRef.current.value = '';
    }
  };

  const handleDelete = async (item: MatchMedia) => {
    try {
      const url = new URL(item.photo_url);
      const pathParts = url.pathname.split('/match-photos/');
      if (pathParts[1]) {
        await supabase.storage.from('match-photos').remove([decodeURIComponent(pathParts[1])]);
      }

      await supabase.from('match_photos').delete().eq('id', item.id);
      setMedia(prev => prev.filter(p => p.id !== item.id));
      toast.success(isVideoUrl(item.photo_url) ? 'Video gelöscht' : 'Foto gelöscht');
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('Fehler beim Löschen');
    }
  };

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  if (readOnly && media.length === 0) return null;

  const lightboxImages = photos.map(p => ({ id: p.id, url: p.photo_url }));

  return (
    <div className="space-y-2">
      {/* Photos section */}
      <div className="flex items-center gap-2">
        <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold text-muted-foreground">
          Fotos ({photos.length}/{maxPhotos})
        </span>
      </div>

      <div className={`flex gap-2 flex-wrap ${readOnly ? 'gap-3' : ''}`}>
        {photos.map((photo, i) => (
          <div key={photo.id} className="relative group">
            <img
              src={photo.photo_url}
              alt="Spielfoto"
              className={`object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity border border-border ${
                readOnly ? 'h-32 w-48' : 'h-16 w-16'
              }`}
              onClick={() => openLightbox(i)}
            />
            {!readOnly && (
              <button
                onClick={() => handleDelete(photo)}
                className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full h-5 w-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}

        {!readOnly && photos.length < maxPhotos && (
          <button
            onClick={() => photoInputRef.current?.click()}
            disabled={uploading !== null}
            className="h-16 w-16 rounded-lg border-2 border-dashed border-border flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors"
          >
            {uploading === 'photo' ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Camera className="h-5 w-5" />
            )}
          </button>
        )}
      </div>

      {/* Videos section */}
      <div className="flex items-center gap-2 mt-3">
        <Video className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold text-muted-foreground">
          Videos ({videos.length}/{maxVideos})
        </span>
      </div>

      <div className={`flex gap-2 flex-wrap ${readOnly ? 'gap-3' : ''}`}>
        {videos.map((vid) => (
          <div key={vid.id} className="relative group">
            <VideoThumbnail
              src={vid.photo_url}
              className={`rounded-lg border border-border ${
                readOnly ? 'h-32 w-48' : 'h-16 w-24'
              }`}
              onClick={() => setVideoPlayerUrl(vid.photo_url)}
            />
            {!readOnly && (
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(vid); }}
                className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full h-5 w-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}

        {!readOnly && videos.length < maxVideos && (
          <button
            onClick={() => videoInputRef.current?.click()}
            disabled={uploading !== null}
            className="h-24 w-36 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors gap-1"
          >
            {uploading === 'video' ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <Video className="h-5 w-5" />
                <span className="text-[10px]">Video</span>
              </>
            )}
          </button>
        )}
      </div>

      <PhotoLightbox
        images={lightboxImages}
        initialIndex={lightboxIndex}
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
      />

      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], 'photo')}
        className="hidden"
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        capture="environment"
        onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], 'video')}
        className="hidden"
      />
    </div>
  );
}
