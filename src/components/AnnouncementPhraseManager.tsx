import { useState, useRef, useCallback } from 'react';
import { Mic, Square, Play, Trash2, Check, Loader2, Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAnnouncementPhrases, AnnouncementPhrase } from '@/hooks/useAnnouncementPhrases';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import JSZip from 'jszip';

function PhraseRecorderRow({ phrase, onUpload, onRemove }: {
  phrase: AnnouncementPhrase;
  onUpload: (id: string, key: string, blob: Blob) => Promise<string | null>;
  onRemove: (id: string) => Promise<void>;
}) {
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
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setPreviewUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(t => t.stop());
      };
      mediaRecorder.start();
      setRecording(true);
    } catch {
      toast.error('Mikrofon-Zugriff verweigert');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const playPreview = () => {
    const url = previewUrl || phrase.audioUrl;
    if (url) new Audio(url).play().catch(() => {});
  };

  const save = async () => {
    if (!audioBlob) return;
    setUploading(true);
    const result = await onUpload(phrase.id, phrase.phraseKey, audioBlob);
    if (result) {
      setAudioBlob(null);
      setPreviewUrl(null);
      toast.success(`"${phrase.label}" gespeichert`);
    }
    setUploading(false);
  };

  const remove = async () => {
    setUploading(true);
    await onRemove(phrase.id);
    setAudioBlob(null);
    setPreviewUrl(null);
    setUploading(false);
  };

  const hasExisting = !!phrase.audioUrl;
  const hasNew = !!previewUrl;

  return (
    <div className="flex items-center gap-2 py-2 border-b border-border last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{phrase.label}</p>
        <p className="text-xs text-muted-foreground">{phrase.phraseKey}</p>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {/* Status indicator */}
        <div className={cn(
          'h-2 w-2 rounded-full shrink-0',
          hasExisting ? 'bg-primary' : 'bg-destructive'
        )} title={hasExisting ? 'Aufnahme vorhanden' : 'Keine Aufnahme'} />

        {/* Play existing/preview */}
        {(hasExisting || hasNew) && (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={playPreview}>
            <Play className="h-3 w-3" />
          </Button>
        )}

        {/* Record */}
        {!recording ? (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={startRecording}>
            <Mic className={cn('h-3 w-3', !hasExisting && 'text-destructive')} />
          </Button>
        ) : (
          <Button variant="destructive" size="icon" className="h-7 w-7 animate-pulse" onClick={stopRecording}>
            <Square className="h-3 w-3" />
          </Button>
        )}

        {/* Save new recording */}
        {hasNew && (
          <Button variant="default" size="icon" className="h-7 w-7" onClick={save} disabled={uploading}>
            {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
          </Button>
        )}

        {/* Remove existing */}
        {hasExisting && !hasNew && (
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={remove} disabled={uploading}>
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}

export function AnnouncementPhraseManager({ inline = false }: { inline?: boolean } = {}) {
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const { phrases, loading, uploadPhraseAudio, removePhraseAudio, reload } = useAnnouncementPhrases();

  const recordedCount = phrases.filter(p => p.audioUrl).length;
  const totalCount = phrases.length;

  const handleExport = useCallback(async () => {
    const recorded = phrases.filter(p => p.audioUrl);
    if (recorded.length === 0) {
      toast.error('Keine Aufnahmen zum Exportieren');
      return;
    }
    setExporting(true);
    try {
      const zip = new JSZip();
      // Add manifest
      const manifest = recorded.map(p => ({ phraseKey: p.phraseKey, label: p.label, fileName: `${p.phraseKey}.webm` }));
      zip.file('manifest.json', JSON.stringify(manifest, null, 2));

      // Download and add each audio file
      for (const phrase of recorded) {
        try {
          const resp = await fetch(phrase.audioUrl!);
          if (!resp.ok) continue;
          const blob = await resp.blob();
          zip.file(`${phrase.phraseKey}.webm`, blob);
        } catch {
          console.warn(`Failed to fetch audio for ${phrase.phraseKey}`);
        }
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `durchsage-stimmen-${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${recorded.length} Aufnahmen exportiert`);
    } catch (err) {
      console.error('Export error:', err);
      toast.error('Fehler beim Export');
    } finally {
      setExporting(false);
    }
  }, [phrases]);

  const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const zip = await JSZip.loadAsync(file);
      const manifestFile = zip.file('manifest.json');
      if (!manifestFile) {
        toast.error('Ungültige ZIP-Datei: manifest.json fehlt');
        return;
      }
      const manifest: Array<{ phraseKey: string; fileName: string }> = JSON.parse(await manifestFile.async('text'));
      let imported = 0;

      for (const entry of manifest) {
        const audioFile = zip.file(entry.fileName);
        if (!audioFile) continue;
        const phrase = phrases.find(p => p.phraseKey === entry.phraseKey);
        if (!phrase) continue;

        const blob = await audioFile.async('blob');
        const result = await uploadPhraseAudio(phrase.id, phrase.phraseKey, blob);
        if (result) imported++;
      }

      await reload();
      toast.success(`${imported} Aufnahmen importiert`);
    } catch (err) {
      console.error('Import error:', err);
      toast.error('Fehler beim Import');
    } finally {
      setImporting(false);
      if (importRef.current) importRef.current.value = '';
    }
  }, [phrases, uploadPhraseAudio, reload]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn('h-8 w-8', recordedCount < totalCount ? 'text-destructive' : 'text-primary')}
          title={`Durchsage-Stimmen (${recordedCount}/${totalCount} aufgenommen)`}
        >
          <Mic className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Durchsage-Stimmen verwalten</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground mb-2">
          Nimm natürliche Sprachaufnahmen für die Turnier-Durchsagen auf. Aufnahmen ersetzen die synthetische Stimme.
        </p>
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-primary inline-block" /> aufgenommen</span>
            <span className="ml-3 inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-destructive inline-block" /> fehlt</span>
            <span className="ml-3">{recordedCount}/{totalCount}</span>
          </div>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={handleExport}
              disabled={exporting || recordedCount === 0}
            >
              {exporting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
              Export
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => importRef.current?.click()}
              disabled={importing}
            >
              {importing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
              Import
            </Button>
            <input
              ref={importRef}
              type="file"
              accept=".zip"
              className="hidden"
              onChange={handleImport}
            />
          </div>
        </div>
        <ScrollArea className="max-h-[60vh]">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-4">Laden...</p>
          ) : (
            phrases.map(phrase => (
              <PhraseRecorderRow
                key={phrase.id}
                phrase={phrase}
                onUpload={uploadPhraseAudio}
                onRemove={removePhraseAudio}
              />
            ))
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
