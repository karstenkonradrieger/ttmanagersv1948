import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MatchPhotos } from '@/components/MatchPhotos';
import { Match, Player } from '@/types/tournament';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Camera, PartyPopper, Film, Loader2, Download, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';
import { collectTournamentMedia, generateSlideshowVideo, uploadGeneratedVideo } from '@/services/videoGenerationService';

interface Props {
  tournamentId: string;
  tournamentName: string;
  matches: Match[];
  getParticipantName?: (id: string | null) => string;
  started: boolean;
  logoUrl?: string | null;
}

interface TournamentVideoRow {
  id: string;
  video_url: string;
  created_at: string;
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

  useEffect(() => {
    fetchTournamentVideo();
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

  const handleGenerateVideo = async () => {
    setGeneratingVideo(true);
    setVideoProgress(0);
    try {
      const media = await collectTournamentMedia(tournamentId);
      const images = media.filter(m => m.type === 'image');
      
      if (images.length === 0) {
        toast.error('Keine Fotos vorhanden. Bitte zuerst Fotos aufnehmen.');
        return;
      }

      toast.info(`Erzeuge Video aus ${images.length} Fotos...`);
      
      const videoBlob = await generateSlideshowVideo(
        media,
        tournamentName,
        (pct) => setVideoProgress(pct)
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
          </p>

          {videoUrl ? (
            <div className="space-y-3">
              <video
                src={videoUrl}
                controls
                className="w-full max-w-2xl rounded-lg border border-border"
              />
              <div className="flex gap-2">
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
    </div>
  );
}
