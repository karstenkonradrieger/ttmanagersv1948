import { useState, useRef } from 'react';
import { Mic, Square, Play, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  playerId: string;
  playerName: string;
  voiceNameUrl: string | null;
  onSaved: (url: string | null) => void;
  storagePrefix?: string;
}

export function VoiceRecorder({ playerId, playerName, voiceNameUrl, onSaved, storagePrefix = 'voice-names' }: Props) {
  const [open, setOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setPreviewUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorder.start();
      setRecording(true);
    } catch {
      toast.error('Mikrofon-Zugriff nicht möglich');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const playPreview = () => {
    const url = previewUrl || voiceNameUrl;
    if (!url) return;
    new Audio(url).play();
  };

  const saveRecording = async () => {
    if (!audioBlob) return;
    setUploading(true);
    try {
      const filePath = `voice-names/${playerId}.webm`;

      // Delete old file if exists
      await supabase.storage.from('audio').remove([filePath]);

      const { error: uploadError } = await supabase.storage
        .from('audio')
        .upload(filePath, audioBlob, { contentType: 'audio/webm', upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('audio').getPublicUrl(filePath);
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      const { error: dbError } = await supabase
        .from('players')
        .update({ voice_name_url: publicUrl } as any)
        .eq('id', playerId);
      if (dbError) throw dbError;

      onSaved(publicUrl);
      toast.success(`Sprachaufnahme für ${playerName} gespeichert`);
      setOpen(false);
      setAudioBlob(null);
      setPreviewUrl(null);
    } catch (err: any) {
      toast.error('Fehler beim Speichern: ' + (err.message || ''));
    } finally {
      setUploading(false);
    }
  };

  const deleteRecording = async () => {
    setUploading(true);
    try {
      const filePath = `voice-names/${playerId}.webm`;
      await supabase.storage.from('audio').remove([filePath]);
      await supabase.from('players').update({ voice_name_url: null } as any).eq('id', playerId);
      onSaved(null);
      setAudioBlob(null);
      setPreviewUrl(null);
      toast.success('Aufnahme gelöscht');
    } catch (err: any) {
      toast.error('Fehler: ' + (err.message || ''));
    } finally {
      setUploading(false);
    }
  };

  const hasExisting = !!voiceNameUrl;
  const hasNew = !!previewUrl;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={hasExisting ? 'text-primary hover:text-primary' : 'text-destructive hover:text-destructive'}
          title={hasExisting ? 'Sprachaufnahme vorhanden – klicken zum Ändern' : '⚠ Keine Sprachaufnahme – klicken zum Aufnehmen'}
        >
          <Mic className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sprachaufnahme: {playerName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Nimm den Namen des Spielers auf, um ihn bei Ansagen abzuspielen.
          </p>

          {/* Existing recording */}
          {hasExisting && !hasNew && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
              <span className="text-sm flex-1">Vorhandene Aufnahme</span>
              <Button variant="outline" size="sm" onClick={playPreview}>
                <Play className="h-3 w-3 mr-1" /> Abspielen
              </Button>
              <Button variant="destructive" size="sm" onClick={deleteRecording} disabled={uploading}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          )}

          {/* Recording controls */}
          <div className="flex justify-center gap-3">
            {!recording ? (
              <Button onClick={startRecording} variant="outline" className="gap-2">
                <Mic className="h-4 w-4 text-destructive" />
                {hasNew ? 'Erneut aufnehmen' : 'Aufnahme starten'}
              </Button>
            ) : (
              <Button onClick={stopRecording} variant="destructive" className="gap-2 animate-pulse">
                <Square className="h-4 w-4" />
                Aufnahme stoppen
              </Button>
            )}
          </div>

          {/* New recording preview */}
          {hasNew && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10">
              <span className="text-sm flex-1">Neue Aufnahme</span>
              <Button variant="outline" size="sm" onClick={playPreview}>
                <Play className="h-3 w-3 mr-1" /> Abspielen
              </Button>
              <Button onClick={saveRecording} size="sm" disabled={uploading}>
                {uploading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                Speichern
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
