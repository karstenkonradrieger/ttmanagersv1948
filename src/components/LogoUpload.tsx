import { useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ImagePlus } from 'lucide-react';

interface Props {
  tournamentId: string;
  logoUrl?: string | null;
  onLogoChange: (url: string | null) => void;
}

export function LogoUpload({ tournamentId, logoUrl, onLogoChange }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Bitte nur Bilddateien hochladen');
      return;
    }

    const ext = file.name.split('.').pop();
    const path = `${tournamentId}/logo.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('logos')
      .upload(path, file, { upsert: true });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      toast.error('Fehler beim Hochladen des Logos');
      return;
    }

    const { data } = supabase.storage.from('logos').getPublicUrl(path);
    // Add cache buster
    const url = `${data.publicUrl}?t=${Date.now()}`;
    onLogoChange(url);
    toast.success('Logo hochgeladen');
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleUpload}
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        className="flex-shrink-0 h-9 w-9 rounded-lg overflow-hidden border border-border hover:border-primary transition-colors flex items-center justify-center bg-secondary"
        title="Logo hochladen"
      >
        {logoUrl ? (
          <img src={logoUrl} alt="Logo" className="h-full w-full object-contain" />
        ) : (
          <ImagePlus className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
    </>
  );
}
