import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AnnouncementPhrase {
  id: string;
  phraseKey: string;
  label: string;
  audioUrl: string | null;
}

export function useAnnouncementPhrases() {
  const [phrases, setPhrases] = useState<AnnouncementPhrase[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPhrases = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('announcement_phrases' as any)
        .select('*')
        .order('phrase_key');
      if (error) throw error;
      setPhrases(
        (data || []).map((row: any) => ({
          id: row.id,
          phraseKey: row.phrase_key,
          label: row.label,
          audioUrl: row.audio_url,
        }))
      );
    } catch (error) {
      console.error('Error loading announcement phrases:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPhrases();
  }, [loadPhrases]);

  const uploadPhraseAudio = useCallback(async (phraseId: string, phraseKey: string, blob: Blob): Promise<string | null> => {
    try {
      const filePath = `voice-phrases/${phraseKey}-${Date.now()}.webm`;
      const { error: uploadError } = await supabase.storage
        .from('audio')
        .upload(filePath, blob, { contentType: 'audio/webm', upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('audio').getPublicUrl(filePath);
      const audioUrl = urlData.publicUrl;

      const { error: updateError } = await supabase
        .from('announcement_phrases' as any)
        .update({ audio_url: audioUrl } as any)
        .eq('id', phraseId);
      if (updateError) throw updateError;

      setPhrases(prev => prev.map(p => p.id === phraseId ? { ...p, audioUrl } : p));
      return audioUrl;
    } catch (error) {
      console.error('Error uploading phrase audio:', error);
      toast.error('Fehler beim Hochladen der Aufnahme');
      return null;
    }
  }, []);

  const removePhraseAudio = useCallback(async (phraseId: string) => {
    try {
      const { error } = await supabase
        .from('announcement_phrases' as any)
        .update({ audio_url: null } as any)
        .eq('id', phraseId);
      if (error) throw error;
      setPhrases(prev => prev.map(p => p.id === phraseId ? { ...p, audioUrl: null } : p));
    } catch (error) {
      console.error('Error removing phrase audio:', error);
      toast.error('Fehler beim Entfernen');
    }
  }, []);

  const getPhraseAudioUrl = useCallback((phraseKey: string): string | null => {
    return phrases.find(p => p.phraseKey === phraseKey)?.audioUrl || null;
  }, [phrases]);

  return { phrases, loading, uploadPhraseAudio, removePhraseAudio, getPhraseAudioUrl, reload: loadPhrases };
}
