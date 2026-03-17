import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PlaylistTrack {
  id: string;
  title: string;
  file_path: string;
  sort_order: number;
  is_gong: boolean;
  created_at: string;
}

export function usePlaylistTracks() {
  const [tracks, setTracks] = useState<PlaylistTrack[]>([]);
  const [gongTrack, setGongTrack] = useState<PlaylistTrack | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchTracks = useCallback(async () => {
    const { data, error } = await supabase
      .from('playlist_tracks')
      .select('*')
      .order('sort_order', { ascending: true });

    if (!error && data) {
      const playlist = data.filter((t: any) => !t.is_gong) as PlaylistTrack[];
      const gong = (data as PlaylistTrack[]).find((t) => t.is_gong) || null;
      setTracks(playlist);
      setGongTrack(gong);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTracks();
  }, [fetchTracks]);

  const getPublicUrl = useCallback((filePath: string) => {
    const { data } = supabase.storage.from('audio').getPublicUrl(filePath);
    return data.publicUrl;
  }, []);

  const uploadTrack = useCallback(async (file: File, title: string, isGong: boolean) => {
    const ext = file.name.split('.').pop();
    const fileName = `${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('audio')
      .upload(fileName, file, { contentType: file.type });

    if (uploadError) throw uploadError;

    // If uploading a gong, remove the old gong entry
    if (isGong && gongTrack) {
      await supabase.storage.from('audio').remove([gongTrack.file_path]);
      await supabase.from('playlist_tracks').delete().eq('id', gongTrack.id);
    }

    const maxOrder = tracks.length > 0 ? Math.max(...tracks.map(t => t.sort_order)) + 1 : 0;

    const { error: dbError } = await supabase
      .from('playlist_tracks')
      .insert({
        title,
        file_path: fileName,
        sort_order: isGong ? 0 : maxOrder,
        is_gong: isGong,
      });

    if (dbError) throw dbError;
    await fetchTracks();
  }, [tracks, gongTrack, fetchTracks]);

  const deleteTrack = useCallback(async (track: PlaylistTrack) => {
    await supabase.storage.from('audio').remove([track.file_path]);
    await supabase.from('playlist_tracks').delete().eq('id', track.id);
    await fetchTracks();
  }, [fetchTracks]);

  const reorderTrack = useCallback(async (trackId: string, direction: 'up' | 'down') => {
    const idx = tracks.findIndex(t => t.id === trackId);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= tracks.length) return;

    const a = tracks[idx];
    const b = tracks[swapIdx];

    await Promise.all([
      supabase.from('playlist_tracks').update({ sort_order: b.sort_order }).eq('id', a.id),
      supabase.from('playlist_tracks').update({ sort_order: a.sort_order }).eq('id', b.id),
    ]);
    await fetchTracks();
  }, [tracks, fetchTracks]);

  const reorderAll = useCallback(async (orderedIds: string[]) => {
    // Optimistic update
    const reordered = orderedIds.map((id, i) => {
      const t = tracks.find(tr => tr.id === id);
      return t ? { ...t, sort_order: i } : null;
    }).filter(Boolean) as PlaylistTrack[];
    setTracks(reordered);

    // Persist
    await Promise.all(
      orderedIds.map((id, i) =>
        supabase.from('playlist_tracks').update({ sort_order: i }).eq('id', id)
      )
    );
    await fetchTracks();
  }, [tracks, fetchTracks]);

  return { tracks, gongTrack, loading, uploadTrack, deleteTrack, reorderTrack, reorderAll, getPublicUrl, refetch: fetchTracks };
}
