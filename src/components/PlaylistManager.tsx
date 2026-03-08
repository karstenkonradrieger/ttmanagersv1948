import { useState, useRef } from 'react';
import { Upload, Trash2, ChevronUp, ChevronDown, Music, Bell, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { usePlaylistTracks, PlaylistTrack } from '@/hooks/usePlaylistTracks';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export function PlaylistManager() {
  const { tracks, gongTrack, loading, uploadTrack, deleteTrack, reorderTrack, getPublicUrl } = usePlaylistTracks();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [isGong, setIsGong] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [open, setOpen] = useState(false);

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file || !title.trim()) {
      toast({ title: 'Fehler', description: 'Bitte Titel und Datei angeben.', variant: 'destructive' });
      return;
    }
    if (!file.name.toLowerCase().endsWith('.mp3')) {
      toast({ title: 'Fehler', description: 'Nur MP3-Dateien werden unterstützt.', variant: 'destructive' });
      return;
    }

    setUploading(true);
    try {
      await uploadTrack(file, title.trim(), isGong);
      setTitle('');
      setIsGong(false);
      if (fileRef.current) fileRef.current.value = '';
      toast({ title: 'Erfolg', description: isGong ? 'Gong-Sound hochgeladen.' : 'Track zur Playlist hinzugefügt.' });
    } catch (e: any) {
      toast({ title: 'Upload-Fehler', description: e.message, variant: 'destructive' });
    } finally {
      setUploading(false);
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

        {/* Upload form */}
        <div className="space-y-3 border border-border rounded-lg p-4">
          <h3 className="text-sm font-semibold">Neue Datei hochladen</h3>
          <div className="space-y-2">
            <Label htmlFor="audio-title">Titel</Label>
            <Input
              id="audio-title"
              placeholder="z.B. Gong-Sound oder Ambient Music"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="audio-file">MP3-Datei</Label>
            <Input id="audio-file" type="file" accept=".mp3,audio/mpeg" ref={fileRef} onChange={(e) => {
              const file = e.target.files?.[0];
              if (file && !title.trim()) {
                setTitle(file.name.replace(/\.mp3$/i, ''));
              }
            }} />
          </div>
          <div className="flex items-center gap-2">
            <Switch id="is-gong" checked={isGong} onCheckedChange={setIsGong} />
            <Label htmlFor="is-gong" className="flex items-center gap-1.5 cursor-pointer">
              <Bell className="h-3.5 w-3.5" /> Als Gong-Sound verwenden
            </Label>
          </div>
          <Button onClick={handleUpload} disabled={uploading} className="w-full gap-2">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploading ? 'Wird hochgeladen…' : 'Hochladen'}
          </Button>
        </div>

        {/* Gong */}
        <div className="space-y-2">
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
            <p className="text-xs text-muted-foreground">Kein Gong hochgeladen – es wird der Standard-Platzhalter verwendet.</p>
          )}
        </div>

        {/* Playlist */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <Music className="h-4 w-4" /> Playlist-Tracks
          </h3>
          {loading ? (
            <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : tracks.length === 0 ? (
            <p className="text-xs text-muted-foreground">Keine Tracks vorhanden – es werden die Standard-Platzhalter verwendet.</p>
          ) : (
            <div className="space-y-1">
              {tracks.map((track, idx) => (
                <div key={track.id} className="flex items-center gap-2 bg-secondary/50 rounded-md p-2 text-sm">
                  <span className="text-muted-foreground text-xs w-5 text-center">{idx + 1}</span>
                  <span className="truncate flex-1">{track.title}</span>
                  <audio src={getPublicUrl(track.file_path)} controls className="h-8 w-28 shrink-0" />
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Button variant="ghost" size="icon" className="h-6 w-6" disabled={idx === 0} onClick={() => reorderTrack(track.id, 'up')}>
                      <ChevronUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" disabled={idx === tracks.length - 1} onClick={() => reorderTrack(track.id, 'down')}>
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleDelete(track)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
