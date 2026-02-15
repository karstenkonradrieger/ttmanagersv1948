import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Camera, X, Loader2, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { PhotoLightbox } from '@/components/PhotoLightbox';

interface MatchPhoto {
  id: string;
  photo_url: string;
  photo_type: string;
  match_id: string | null;
  created_at: string;
}

interface Props {
  tournamentId: string;
  matchId?: string | null;
  photoType: 'match' | 'ceremony';
  maxPhotos?: number;
  readOnly?: boolean;
}

export function MatchPhotos({ tournamentId, matchId, photoType, maxPhotos = 3, readOnly = false }: Props) {
  const [photos, setPhotos] = useState<MatchPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchPhotos();
  }, [tournamentId, matchId, photoType]);

  const fetchPhotos = async () => {
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
      console.error('Error fetching photos:', error);
      return;
    }
    setPhotos((data || []) as MatchPhoto[]);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (photos.length >= maxPhotos) {
      toast.error(`Maximal ${maxPhotos} Fotos erlaubt`);
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast.error('Nur Bilder sind erlaubt');
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
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

      toast.success('Foto hochgeladen');
      fetchPhotos();
    } catch (error) {
      console.error('Error uploading photo:', error);
      toast.error('Fehler beim Hochladen');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (photo: MatchPhoto) => {
    try {
      const url = new URL(photo.photo_url);
      const pathParts = url.pathname.split('/match-photos/');
      if (pathParts[1]) {
        await supabase.storage.from('match-photos').remove([decodeURIComponent(pathParts[1])]);
      }

      await supabase.from('match_photos').delete().eq('id', photo.id);
      setPhotos(prev => prev.filter(p => p.id !== photo.id));
      toast.success('Foto gelöscht');
    } catch (error) {
      console.error('Error deleting photo:', error);
      toast.error('Fehler beim Löschen');
    }
  };

  const handleCapture = () => {
    fileInputRef.current?.click();
  };

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  if (readOnly && photos.length === 0) return null;

  const lightboxImages = photos.map(p => ({ id: p.id, url: p.photo_url }));

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold text-muted-foreground">
          Fotos ({photos.length}/{maxPhotos})
        </span>
      </div>

      <div className="flex gap-2 flex-wrap">
        {photos.map((photo, i) => (
          <div key={photo.id} className="relative group">
            <img
              src={photo.photo_url}
              alt="Spielfoto"
              className="h-16 w-16 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity border border-border"
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
            onClick={handleCapture}
            disabled={uploading}
            className="h-16 w-16 rounded-lg border-2 border-dashed border-border flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors"
          >
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Camera className="h-5 w-5" />
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
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleUpload}
        className="hidden"
      />
    </div>
  );
}
