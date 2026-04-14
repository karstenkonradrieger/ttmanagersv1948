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
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.heic', '.heif'];

const MIME_EXTENSION_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/bmp': 'bmp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'video/x-msvideo': 'avi',
  'video/x-matroska': 'mkv',
  'video/x-m4v': 'm4v',
  'video/3gpp': '3gp',
};

const EXTENSION_MIME_TYPE_MAP: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  bmp: 'image/bmp',
  heic: 'image/heic',
  heif: 'image/heif',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  avi: 'video/x-msvideo',
  mkv: 'video/x-matroska',
  m4v: 'video/x-m4v',
  '3gp': 'video/3gpp',
};

function isVideoUrl(url: string): boolean {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return VIDEO_EXTENSIONS.some(ext => pathname.endsWith(ext));
  } catch {
    return false;
  }
}

function getFileExtension(file: File): string | null {
  const match = file.name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? null;
}

function inferFileKind(file: File): 'photo' | 'video' | null {
  const mimeType = file.type.toLowerCase();

  if (mimeType.startsWith('image/')) return 'photo';
  if (mimeType.startsWith('video/')) return 'video';

  const extension = getFileExtension(file);
  if (!extension) return null;

  const dottedExtension = `.${extension}`;
  if (IMAGE_EXTENSIONS.includes(dottedExtension)) return 'photo';
  if (VIDEO_EXTENSIONS.includes(dottedExtension)) return 'video';

  return null;
}

function getUploadContentType(file: File, type: 'photo' | 'video'): string {
  const mimeType = file.type.toLowerCase();
  if (mimeType && mimeType !== 'application/octet-stream') {
    return file.type;
  }

  const extension = getFileExtension(file);
  if (extension && EXTENSION_MIME_TYPE_MAP[extension]) {
    return EXTENSION_MIME_TYPE_MAP[extension];
  }

  return type === 'video' ? 'video/mp4' : 'image/jpeg';
}

interface Props {
  tournamentId: string;
  matchId?: string | null;
  photoType: 'match' | 'ceremony' | 'pre_tournament';
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
    } else if (photoType === 'ceremony' || photoType === 'pre_tournament') {
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

    const inferredType = inferFileKind(file);
    if (inferredType && inferredType !== type) {
      toast.error(type === 'photo' ? 'Nur Bilder sind erlaubt' : 'Nur Videos sind erlaubt');
      return;
    }

    const maxSize = type === 'video' ? 100 * 1024 * 1024 : 20 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error(`Datei zu groß (max. ${type === 'video' ? '100' : '20'} MB)`);
      return;
    }

    setUploading(type);
    try {
      const ext = getFileExtension(file)
        ?? MIME_EXTENSION_MAP[file.type.toLowerCase()]
        ?? (type === 'video' ? 'mp4' : 'jpg');
      const fileName = `${tournamentId}/${matchId || 'ceremony'}/${Date.now()}.${ext}`;
      const contentType = getUploadContentType(file, type);

      const { error: uploadError } = await supabase.storage
        .from('match-photos')
        .upload(fileName, file, { contentType });

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
    } catch (error: any) {
      console.error('Error uploading:', error);
      const msg = error?.message || error?.error_description || String(error);
      toast.error(`Fehler beim Hochladen: ${msg}`);
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

      <Dialog open={!!videoPlayerUrl} onOpenChange={(open) => !open && setVideoPlayerUrl(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-none overflow-hidden flex items-center justify-center">
          {videoPlayerUrl && (
            <video
              src={videoPlayerUrl}
              controls
              autoPlay
              className="max-w-full max-h-[90vh] rounded"
            />
          )}
        </DialogContent>
      </Dialog>

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
