import { useState, useRef, useCallback } from 'react';
import { Upload, Trash2, GripVertical, Music, Bell, Loader2, X, FileAudio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { usePlaylistTracks, PlaylistTrack } from '@/hooks/usePlaylistTracks';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface UploadItem {
  id: string;
  file: File;
  title: string;
  progress: number;
  status: 'pending' | 'uploading' | 'done' | 'error';
  error?: string;
}

export function PlaylistManager() {
  const { tracks, gongTrack, loading, uploadTrack, deleteTrack, reorderAll, getPublicUrl, refetch } = usePlaylistTracks();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [isGong, setIsGong] = useState(false);
  const [open, setOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<UploadItem[]>([]);
  const [isBulkUploading, setIsBulkUploading] = useState(false);

  // Single gong upload state
  const gongFileRef = useRef<HTMLInputElement>(null);
  const [gongTitle, setGongTitle] = useState('');
  const [uploadingGong, setUploadingGong] = useState(false);

  const addFilesToQueue = useCallback((files: FileList | File[]) => {
    const mp3Files = Array.from(files).filter(f => f.name.toLowerCase().endsWith('.mp3'));
    if (mp3Files.length === 0) {
      toast({ title: 'Fehler', description: 'Nur MP3-Dateien werden unterstützt.', variant: 'destructive' });
      return;
    }
    const newItems: UploadItem[] = mp3Files.map(file => ({
      id: crypto.randomUUID(),
      file,
      title: file.name.replace(/\.mp3$/i, ''),
      progress: 0,
      status: 'pending',
    }));
    setUploadQueue(prev => [...prev, ...newItems]);
  }, [toast]);

  const removeFromQueue = (id: string) => {
    setUploadQueue(prev => prev.filter(i => i.id !== id));
  };

  const updateQueueItem = (id: string, updates: Partial<UploadItem>) => {
    setUploadQueue(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const startBulkUpload = async () => {
    const pending = uploadQueue.filter(i => i.status === 'pending');
    if (pending.length === 0) return;
    setIsBulkUploading(true);

    for (const item of pending) {
      updateQueueItem(item.id, { status: 'uploading', progress: 10 });
      try {
        const ext = item.file.name.split('.').pop();
        const fileName = `${crypto.randomUUID()}.${ext}`;

        updateQueueItem(item.id, { progress: 30 });

        const { error: uploadError } = await supabase.storage
          .from('audio')
          .upload(fileName, item.file, { contentType: item.file.type });

        if (uploadError) throw uploadError;

        updateQueueItem(item.id, { progress: 70 });

        const maxOrder = tracks.length > 0 ? Math.max(...tracks.map(t => t.sort_order)) + 1 : 0;
        const { error: dbError } = await supabase
          .from('playlist_tracks')
          .insert({
            title: item.title,
            file_path: fileName,
            sort_order: maxOrder + pending.indexOf(item),
            is_gong: false,
          });

        if (dbError) throw dbError;

        updateQueueItem(item.id, { progress: 100, status: 'done' });
      } catch (e: any) {
        updateQueueItem(item.id, { status: 'error', error: e.message });
      }
    }

    await refetch();
    setIsBulkUploading(false);

    const doneCount = uploadQueue.filter(i => i.status === 'done' || pending.some(p => p.id === i.id)).length;
    toast({ title: 'Upload abgeschlossen', description: `${pending.length} Datei(en) verarbeitet.` });

    // Clear completed after short delay
    setTimeout(() => {
      setUploadQueue(prev => prev.filter(i => i.status !== 'done'));
    }, 2000);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      addFilesToQueue(e.dataTransfer.files);
    }
  }, [addFilesToQueue]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => setDragOver(false), []);

  const handleGongUpload = async () => {
    const file = gongFileRef.current?.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.mp3')) {
      toast({ title: 'Fehler', description: 'Nur MP3-Dateien.', variant: 'destructive' });
      return;
    }
    setUploadingGong(true);
    try {
      const title = gongTitle.trim() || file.name.replace(/\.mp3$/i, '');
      await uploadTrack(file, title, true);
      setGongTitle('');
      if (gongFileRef.current) gongFileRef.current.value = '';
      toast({ title: 'Erfolg', description: 'Gong-Sound hochgeladen.' });
    } catch (e: any) {
      toast({ title: 'Fehler', description: e.message, variant: 'destructive' });
    } finally {
      setUploadingGong(false);
    }
  };

  const handleDelete = async (track: PlaylistTrack) => {
    try {
      await deleteTrack(track);
      toast({ title: 'Gelöscht', description: `"${track.title}" wurde entfernt.` });
    } catch (e: any) {
      toast({ title: 'Fehler', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" title="Playlist verwalten">
          <Music className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Music className="h-5 w-5" /> Playlist & Gong verwalten
          </DialogTitle>
        </DialogHeader>

        {/* Drag & Drop Upload Zone */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileRef.current?.click()}
          className={cn(
            'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors',
            dragOver
              ? 'border-primary bg-primary/10'
              : 'border-border hover:border-primary/50 hover:bg-muted/50'
          )}
        >
          <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm font-medium">MP3-Dateien hierher ziehen</p>
          <p className="text-xs text-muted-foreground mt-1">oder klicken zum Auswählen (Mehrfachauswahl möglich)</p>
          <input
            ref={fileRef}
            type="file"
            accept=".mp3,audio/mpeg"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                addFilesToQueue(e.target.files);
                e.target.value = '';
              }
            }}
          />
        </div>

        {/* Upload Queue */}
        {uploadQueue.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Upload-Warteschlange ({uploadQueue.length})</h3>
              <Button
                size="sm"
                onClick={startBulkUpload}
                disabled={isBulkUploading || uploadQueue.filter(i => i.status === 'pending').length === 0}
                className="gap-1.5"
              >
                {isBulkUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                {isBulkUploading ? 'Wird hochgeladen…' : 'Alle hochladen'}
              </Button>
            </div>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {uploadQueue.map(item => (
                <div key={item.id} className="flex items-center gap-2 bg-secondary/50 rounded-md p-2 text-sm">
                  <FileAudio className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-xs font-medium">{item.title}</div>
                    {(item.status === 'uploading' || item.status === 'done') && (
                      <Progress value={item.progress} className="h-1.5 mt-1" />
                    )}
                    {item.status === 'error' && (
                      <p className="text-xs text-destructive mt-0.5 truncate">{item.error}</p>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {item.status === 'pending' && 'Wartend'}
                    {item.status === 'uploading' && `${item.progress}%`}
                    {item.status === 'done' && '✓'}
                    {item.status === 'error' && '✗'}
                  </span>
                  {item.status === 'pending' && (
                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={(e) => { e.stopPropagation(); removeFromQueue(item.id); }}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Gong */}
        <div className="space-y-2 border border-border rounded-lg p-3">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <Bell className="h-4 w-4" /> Gong-Sound
          </h3>
          {gongTrack ? (
            <div className="flex items-center justify-between bg-secondary/50 rounded-md p-2.5 text-sm">
              <span className="truncate">{gongTrack.title}</span>
              <div className="flex items-center gap-1">
                <audio src={getPublicUrl(gongTrack.file_path)} controls className="h-8 w-32" />
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(gongTrack)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Kein Gong hochgeladen – Standard-Platzhalter wird verwendet.</p>
          )}
          <div className="flex gap-2 items-end">
            <div className="flex-1 space-y-1">
              <Label htmlFor="gong-file" className="text-xs">Neuen Gong hochladen</Label>
              <Input id="gong-file" type="file" accept=".mp3,audio/mpeg" ref={gongFileRef} className="h-8 text-xs"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f && !gongTitle.trim()) setGongTitle(f.name.replace(/\.mp3$/i, ''));
                }}
              />
            </div>
            <Button size="sm" onClick={handleGongUpload} disabled={uploadingGong} className="gap-1 shrink-0">
              {uploadingGong ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>

        {/* Playlist Tracks with Drag & Drop */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <Music className="h-4 w-4" /> Playlist-Tracks ({tracks.length})
          </h3>
          {loading ? (
            <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : tracks.length === 0 ? (
            <p className="text-xs text-muted-foreground">Keine Tracks vorhanden – Standard-Platzhalter werden verwendet.</p>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={tracks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-1">
                  {tracks.map((track, idx) => (
                    <SortableTrackItem
                      key={track.id}
                      track={track}
                      index={idx}
                      audioSrc={getPublicUrl(track.file_path)}
                      onDelete={() => handleDelete(track)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SortableTrackItem({ track, index, audioSrc, onDelete }: {
  track: PlaylistTrack;
  index: number;
  audioSrc: string;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: track.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 bg-secondary/50 rounded-md p-2 text-sm"
    >
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing touch-none text-muted-foreground hover:text-foreground">
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="text-muted-foreground text-xs w-5 text-center font-mono">{index + 1}</span>
      <span className="truncate flex-1">{track.title}</span>
      <audio src={audioSrc} controls className="h-8 w-28 shrink-0" />
      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive shrink-0" onClick={onDelete}>
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
