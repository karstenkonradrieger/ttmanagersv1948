import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MatchPhotos } from '@/components/MatchPhotos';
import { Match } from '@/types/tournament';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Camera, PartyPopper, Film, Loader2, Download, Trash2, Music, Upload, X, Play } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';
import {
  collectTournamentMedia,
  generateSlideshowVideo,
  uploadGeneratedVideo,
  uploadSoundtrack,
  getSoundtrackUrl,
  removeSoundtrack,
} from '@/services/videoGenerationService';

interface Props {
  tournamentId: string;
  tournamentName: string;
  matches: Match[];
  getParticipantName?: (id: string | null) => string;
  started: boolean;
  logoUrl?: string | null;
}

function getRoundLabel(round: number, totalRounds: number, mode?: string): string {
  if (mode === 'round_robin' || mode === 'swiss') return `Runde ${round + 1}`;
  const diff = totalRounds - round;
  if (diff === 1) return 'Finale';
  if (diff === 2) return 'Halbfinale';
  if (diff === 3) return 'Viertelfinale';
  return `Runde ${round + 1}`;
}

export function TournamentMediaTab({ tournamentId, tournamentName, matches, getParticipantName, started, logoUrl }: Props) {
  const [generatingVideo, setGeneratingVideo] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoDialogOpen, setVideoDialogOpen] = useState(false);
  const [soundtrackUrl, setSoundtrackUrl] = useState<string | null>(null);
  const [uploadingSoundtrack, setUploadingSoundtrack] = useState(false);
  const [soundtrackVolume, setSoundtrackVolume] = useState<number>(0.4);
  const [photoDuration, setPhotoDuration] = useState<number>(3000);
  const soundtrackInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchTournamentVideo();
    loadSoundtrack();
  }, [tournamentId]);

  const fetchTournamentVideo = async () => {
    const { data } = await supabase
      .from('tournament_videos' as any)
      .select('*')
      .eq('tournament_id', tournamentId)
      .order('created_at', { ascending: false })
      .limit(1);
    if (data && data.length > 0) {
      setVideoUrl((data[0] as any).video_url);
    } else {
      setVideoUrl(null);
    }
  };

  const loadSoundtrack = async () => {
    const url = await getSoundtrackUrl(tournamentId);
    setSoundtrackUrl(url);
  };

  const handleSoundtrackUpload = async (file: File) => {
    if (!file.type.startsWith('audio/')) {
      toast.error('Nur Audiodateien sind erlaubt (MP3, WAV, etc.)');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast.error('Datei zu groß (max. 50 MB)');
      return;
    }

    setUploadingSoundtrack(true);
    try {
      const url = await uploadSoundtrack(tournamentId, file);
      setSoundtrackUrl(url);
      toast.success('Soundtrack hochgeladen');
    } catch (err) {
      console.error('Soundtrack upload error:', err);
      toast.error('Fehler beim Hochladen des Soundtracks');
    } finally {
      setUploadingSoundtrack(false);
      if (soundtrackInputRef.current) soundtrackInputRef.current.value = '';
    }
  };

  const handleRemoveSoundtrack = async () => {
    try {
      await removeSoundtrack(tournamentId);
      setSoundtrackUrl(null);
      toast.success('Soundtrack entfernt');
    } catch {
      toast.error('Fehler beim Entfernen');
    }
  };

  const handleGenerateVideo = async () => {
    setGeneratingVideo(true);
    setVideoProgress(0);
    try {
      const { media, placements } = await collectTournamentMedia(tournamentId, getParticipantName);

      if (media.length === 0) {
        toast.error('Keine Medien vorhanden. Bitte zuerst Fotos oder Videos aufnehmen.');
        return;
      }

      const imageCount = media.filter(m => m.type === 'image').length;
      const videoCount = media.filter(m => m.type === 'video').length;
      toast.info(`Erzeuge Video aus ${imageCount} Fotos und ${videoCount} Videos...`);

      const videoBlob = await generateSlideshowVideo(
        media,
        tournamentName,
        soundtrackUrl,
        (pct) => setVideoProgress(pct),
        soundtrackVolume,
        placements,
        photoDuration
      );

      const url = await uploadGeneratedVideo(tournamentId, videoBlob);
      setVideoUrl(url);
      toast.success('Videoclip wurde erfolgreich erzeugt!');
    } catch (err) {
      console.error('Video generation error:', err);
      toast.error('Fehler beim Erzeugen des Videoclips');
    } finally {
      setGeneratingVideo(false);
      setVideoProgress(0);
    }
  };

  const handleDeleteVideo = async () => {
    if (!window.confirm('Videoclip wirklich löschen?')) return;
    try {
      await supabase
        .from('tournament_videos' as any)
        .delete()
        .eq('tournament_id', tournamentId);

      if (videoUrl) {
        try {
          const url = new URL(videoUrl);
          const pathParts = url.pathname.split('/tournament-videos/');
          if (pathParts[1]) {
            await supabase.storage.from('tournament-videos').remove([decodeURIComponent(pathParts[1])]);
          }
        } catch {}
      }

      setVideoUrl(null);
      toast.success('Videoclip gelöscht');
    } catch {
      toast.error('Fehler beim Löschen');
    }
  };

  const completedMatches = matches.filter(m => m.status === 'completed');
  const rounds = Math.max(0, ...matches.map(m => m.round));

  return (
    <div className="space-y-6">
      {/* Pre-tournament photos/videos */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Camera className="h-4 w-4 text-primary" />
            Vor dem Turnier
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">
            Fotos und Videos von der Ankunft, dem Aufbau und der Eröffnung.
          </p>
          <MatchPhotos
            tournamentId={tournamentId}
            matchId={null}
            photoType="pre_tournament"
            maxPhotos={10}
            maxVideos={3}
          />
        </CardContent>
      </Card>

      {/* Match photos - grouped by round */}
      {started && completedMatches.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Film className="h-4 w-4 text-primary" />
              Spielfotos & Videos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from({ length: rounds + 1 }, (_, r) => {
              const roundMatches = completedMatches.filter(m => m.round === r);
              if (roundMatches.length === 0) return null;

              return (
                <div key={r}>
                  <h4 className="text-sm font-semibold text-muted-foreground mb-2">
                    {getRoundLabel(r, rounds + 1)}
                  </h4>
                  <div className="space-y-3 pl-2 border-l-2 border-border">
                    {roundMatches.map(match => {
                      const p1 = getParticipantName?.(match.player1Id) || '?';
                      const p2 = getParticipantName?.(match.player2Id) || '?';
                      return (
                        <div key={match.id} className="pl-3">
                          <p className="text-xs font-medium mb-1">{p1} vs {p2}</p>
                          <MatchPhotos
                            tournamentId={tournamentId}
                            matchId={match.id}
                            photoType="match"
                            maxPhotos={2}
                            maxVideos={1}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Ceremony photos/videos */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <PartyPopper className="h-4 w-4 text-primary" />
            Siegerehrung
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">
            Fotos und Videos von der Siegerehrung und Preisverleihung.
          </p>
          <MatchPhotos
            tournamentId={tournamentId}
            matchId={null}
            photoType="ceremony"
            maxPhotos={10}
            maxVideos={3}
          />
        </CardContent>
      </Card>

      {/* Soundtrack */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Music className="h-4 w-4 text-primary" />
            Soundtrack
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Lade eine Audiodatei hoch, die als musikalische Untermalung im Videoclip verwendet wird.
          </p>

          {/* Volume selection */}
          <div className="space-y-1">
            <label className="text-xs font-medium">Lautstärke im Videoclip</label>
            <div className="flex gap-2">
              {[
                { label: 'Leise', value: 0.2 },
                { label: 'Mittel', value: 0.4 },
                { label: 'Laut', value: 0.7 },
              ].map((opt) => (
                <Button
                  key={opt.value}
                  variant={soundtrackVolume === opt.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSoundtrackVolume(opt.value)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Photo duration selection */}
          <div className="space-y-1">
            <label className="text-xs font-medium">Anzeigedauer pro Foto</label>
            <div className="flex gap-2">
              {[
                { label: '3 Sek.', value: 3000 },
                { label: '5 Sek.', value: 5000 },
                { label: '8 Sek.', value: 8000 },
              ].map((opt) => (
                <Button
                  key={opt.value}
                  variant={photoDuration === opt.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPhotoDuration(opt.value)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>

          {soundtrackUrl ? (
            <div className="space-y-2">
              <audio src={soundtrackUrl} controls className="w-full max-w-md" />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => soundtrackInputRef.current?.click()}
                  disabled={uploadingSoundtrack}
                  className="gap-1"
                >
                  {uploadingSoundtrack ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  Ersetzen
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveSoundtrack}
                  className="gap-1 text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Entfernen
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              onClick={() => soundtrackInputRef.current?.click()}
              disabled={uploadingSoundtrack}
              className="gap-2"
            >
              {uploadingSoundtrack ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Wird hochgeladen...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Soundtrack hochladen
                </>
              )}
            </Button>
          )}

          <input
            ref={soundtrackInputRef}
            type="file"
            accept="audio/*"
            onChange={(e) => e.target.files?.[0] && handleSoundtrackUpload(e.target.files[0])}
            className="hidden"
          />
        </CardContent>
      </Card>

      {/* Video generation */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Film className="h-4 w-4 text-primary" />
            Turnier-Videoclip
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Erstelle einen professionellen Videoclip aus allen gesammelten Fotos und Videos des Turniers.
            {soundtrackUrl && ' Der hochgeladene Soundtrack wird als Hintergrundmusik eingebunden.'}
          </p>

          {videoUrl ? (
            <div className="space-y-3">
              <video
                src={videoUrl}
                controls
                className="w-full max-w-2xl rounded-lg border border-border"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setVideoDialogOpen(true)}
                  className="gap-1"
                >
                  <Play className="h-3.5 w-3.5" />
                  Abspielen
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(videoUrl, '_blank')}
                  className="gap-1"
                >
                  <Download className="h-3.5 w-3.5" />
                  Herunterladen
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateVideo}
                  disabled={generatingVideo}
                  className="gap-1"
                >
                  {generatingVideo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Film className="h-3.5 w-3.5" />}
                  Neu erzeugen
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDeleteVideo}
                  className="gap-1 text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <Button
                onClick={handleGenerateVideo}
                disabled={generatingVideo}
                className="gap-2"
              >
                {generatingVideo ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Video wird erzeugt...
                  </>
                ) : (
                  <>
                    <Film className="h-4 w-4" />
                    Videoclip erzeugen
                  </>
                )}
              </Button>
              {generatingVideo && videoProgress > 0 && (
                <div className="max-w-md space-y-1">
                  <Progress value={videoProgress} className="h-2" />
                  <p className="text-xs text-muted-foreground">{videoProgress}% abgeschlossen</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Video playback dialog */}
      <Dialog open={videoDialogOpen} onOpenChange={setVideoDialogOpen}>
        <DialogContent className="max-w-4xl w-[95vw] p-0 bg-black border-none">
          {videoUrl && (
            <video
              src={videoUrl}
              controls
              autoPlay
              className="w-full h-auto max-h-[85vh] rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
