import { supabase } from '@/integrations/supabase/client';

interface MediaItem {
  url: string;
  type: 'image' | 'video';
  label: string;
  section: 'pre_tournament' | 'match' | 'ceremony';
  overlay?: {
    player1?: string;
    player2?: string;
    score?: string;
    roundLabel?: string;
  };
}

const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.webm', '.avi', '.mkv', '.m4v', '.3gp'];

function isVideoUrl(url: string): boolean {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return VIDEO_EXTENSIONS.some(ext => pathname.endsWith(ext));
  } catch { return false; }
}

export async function collectTournamentMedia(
  tournamentId: string,
  getParticipantName?: (id: string | null) => string
): Promise<MediaItem[]> {
  const { data: photos } = await supabase
    .from('match_photos')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('created_at', { ascending: true });

  if (!photos) return [];

  // Load match data for overlay info
  let matchMap: Record<string, any> = {};
  if (getParticipantName) {
    const { data: matches } = await supabase
      .from('matches')
      .select('*')
      .eq('tournament_id', tournamentId);
    if (matches) {
      for (const m of matches) {
        matchMap[m.id] = m;
      }
    }
  }

  return photos.map(p => {
    const match = p.match_id ? matchMap[p.match_id] : null;
    let overlay: MediaItem['overlay'] = undefined;

    if (match && getParticipantName) {
      const sets = (match.sets || []) as Array<{ player1: number; player2: number }>;
      let w1 = 0, w2 = 0;
      for (const s of sets) {
        if (s.player1 >= 11 && s.player1 - s.player2 >= 2) w1++;
        else if (s.player2 >= 11 && s.player2 - s.player1 >= 2) w2++;
      }
      overlay = {
        player1: getParticipantName(match.player1_id),
        player2: getParticipantName(match.player2_id),
        score: match.winner_id ? `${w1} : ${w2}` : undefined,
      };
    }

    return {
      url: p.photo_url,
      type: isVideoUrl(p.photo_url) ? 'video' as const : 'image' as const,
      label: p.photo_type === 'pre_tournament' ? 'Vor dem Turnier' :
             p.photo_type === 'ceremony' ? 'Siegerehrung' : 'Spielfoto',
      section: p.photo_type as MediaItem['section'],
      overlay,
    };
  });
}

/**
 * Generates a WebM video slideshow from images AND video clips using
 * Canvas + MediaRecorder (client-side). Optionally mixes in a soundtrack.
 */
export async function generateSlideshowVideo(
  media: MediaItem[],
  tournamentName: string,
  soundtrackUrl?: string | null,
  onProgress?: (pct: number) => void
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = 1920;
  canvas.height = 1080;
  const ctx = canvas.getContext('2d')!;

  // Set up audio context for soundtrack mixing
  let audioCtx: AudioContext | null = null;
  let audioDestination: MediaStreamAudioDestinationNode | null = null;
  let audioSource: AudioBufferSourceNode | null = null;

  if (soundtrackUrl) {
    try {
      audioCtx = new AudioContext();
      audioDestination = audioCtx.createMediaStreamDestination();

      const response = await fetch(soundtrackUrl);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

      audioSource = audioCtx.createBufferSource();
      audioSource.buffer = audioBuffer;
      audioSource.loop = true;

      // Add a gain node to control volume
      const gainNode = audioCtx.createGain();
      gainNode.gain.value = 0.4; // 40% volume for background music
      audioSource.connect(gainNode);
      gainNode.connect(audioDestination);
    } catch (e) {
      console.warn('Failed to load soundtrack:', e);
      audioCtx = null;
      audioDestination = null;
    }
  }

  // Combine video + audio streams
  const videoStream = canvas.captureStream(30);
  const combinedStream = new MediaStream();
  videoStream.getVideoTracks().forEach(t => combinedStream.addTrack(t));
  if (audioDestination) {
    audioDestination.stream.getAudioTracks().forEach(t => combinedStream.addTrack(t));
  }

  const recorder = new MediaRecorder(combinedStream, {
    mimeType: 'video/webm;codecs=vp9,opus',
    videoBitsPerSecond: 5_000_000,
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const finished = new Promise<Blob>((resolve) => {
    recorder.onstop = () => {
      resolve(new Blob(chunks, { type: 'video/webm' }));
    };
  });

  recorder.start();

  // Start soundtrack playback
  if (audioSource) {
    audioSource.start(0);
  }

  // Count total steps for progress
  const allItems = media.length;
  const sections: { key: MediaItem['section']; title: string }[] = [
    { key: 'pre_tournament', title: '🎬 Vor dem Turnier' },
    { key: 'match', title: '🏓 Spielszenen' },
    { key: 'ceremony', title: '🏆 Siegerehrung' },
  ];
  const activeSections = sections.filter(s => media.some(m => m.section === s.key));
  const totalSteps = allItems + activeSections.length + 2; // +2 for intro/outro
  let step = 0;

  // Intro slide
  await drawTextSlide(ctx, canvas.width, canvas.height, tournamentName, 'Turnier-Highlights', 2000);
  step++;
  onProgress?.(Math.round((step / totalSteps) * 100));

  for (const section of sections) {
    const sectionMedia = media.filter(m => m.section === section.key);
    if (sectionMedia.length === 0) continue;

    // Section title
    await drawTextSlide(ctx, canvas.width, canvas.height, section.title, '', 1500);
    step++;
    onProgress?.(Math.round((step / totalSteps) * 100));

    for (const item of sectionMedia) {
      try {
        if (item.type === 'video') {
          await drawVideoClip(ctx, canvas.width, canvas.height, item.url, item.overlay, tournamentName);
        } else {
          const img = await loadImage(item.url);
          await drawImageSlide(ctx, canvas.width, canvas.height, img, 3000, item.overlay, tournamentName);
        }
      } catch (e) {
        console.warn('Failed to process media:', item.url, e);
      }
      step++;
      onProgress?.(Math.round((step / totalSteps) * 100));
    }
  }

  // Outro slide
  await drawTextSlide(ctx, canvas.width, canvas.height, 'Danke!', tournamentName, 2000);
  onProgress?.(100);

  // Stop soundtrack
  if (audioSource) {
    try { audioSource.stop(); } catch {}
  }
  if (audioCtx) {
    try { await audioCtx.close(); } catch {}
  }

  recorder.stop();
  return finished;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function loadVideo(url: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true; // mute source video (soundtrack provides audio)
    video.preload = 'auto';
    video.oncanplaythrough = () => resolve(video);
    video.onerror = () => reject(new Error(`Failed to load video: ${url}`));
    video.src = url;
  });
}

/**
 * Draws a video clip onto the canvas, frame by frame.
 * Limits to max 10 seconds per clip.
 */
async function drawVideoClip(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  url: string,
  overlay?: MediaItem['overlay'],
  tournamentName?: string
) {
  const video = await loadVideo(url);
  const maxDuration = Math.min(video.duration, 10); // cap at 10s
  const totalFrames = Math.round(maxDuration * 30);

  video.currentTime = 0;
  await new Promise<void>(r => { video.onseeked = () => r(); });

  // Start playback
  await video.play();

  for (let f = 0; f < totalFrames; f++) {
    // Background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, w, h);

    // Fit video to canvas
    const vAspect = video.videoWidth / video.videoHeight;
    const cAspect = w / h;
    let drawW: number, drawH: number;
    if (vAspect > cAspect) {
      drawW = w;
      drawH = w / vAspect;
    } else {
      drawH = h;
      drawW = h * vAspect;
    }
    const x = (w - drawW) / 2;
    const y = (h - drawH) / 2;

    // Fade in/out
    const progress = f / totalFrames;
    const alpha = progress < 0.05 ? progress / 0.05 :
                  progress > 0.95 ? (1 - progress) / 0.05 : 1;
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

    ctx.drawImage(video, x, y, drawW, drawH);
    ctx.globalAlpha = 1;

    drawOverlay(ctx, w, h, overlay, tournamentName);

    await waitFrame();
  }

  video.pause();
  video.src = '';
}

async function drawTextSlide(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  title: string, subtitle: string,
  durationMs: number
) {
  const frames = Math.round((durationMs / 1000) * 30);
  for (let f = 0; f < frames; f++) {
    const progress = f / frames;

    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#1a1a2e');
    grad.addColorStop(1, '#16213e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    const alpha = progress < 0.15 ? progress / 0.15 :
                  progress > 0.85 ? (1 - progress) / 0.15 : 1;
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 72px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, w / 2, h / 2 - (subtitle ? 30 : 0));

    if (subtitle) {
      ctx.font = '36px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillText(subtitle, w / 2, h / 2 + 50);
    }

    ctx.globalAlpha = 1;
    await waitFrame();
  }
}

async function drawImageSlide(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  img: HTMLImageElement,
  durationMs: number,
  overlay?: MediaItem['overlay'],
  tournamentName?: string
) {
  const frames = Math.round((durationMs / 1000) * 30);
  for (let f = 0; f < frames; f++) {
    const progress = f / frames;

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, w, h);

    const scale = 1 + progress * 0.1;
    const imgAspect = img.width / img.height;
    const canvasAspect = w / h;

    let drawW: number, drawH: number;
    if (imgAspect > canvasAspect) {
      drawH = h * scale;
      drawW = drawH * imgAspect;
    } else {
      drawW = w * scale;
      drawH = drawW / imgAspect;
    }

    const x = (w - drawW) / 2;
    const y = (h - drawH) / 2;

    const alpha = progress < 0.1 ? progress / 0.1 :
                  progress > 0.9 ? (1 - progress) / 0.1 : 1;
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

    ctx.drawImage(img, x, y, drawW, drawH);
    ctx.globalAlpha = 1;

    drawOverlay(ctx, w, h, overlay, tournamentName);

    await waitFrame();
  }
}

/**
 * Draws overlay text: tournament name (top-right), player names + score (bottom bar)
 */
function drawOverlay(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  overlay?: MediaItem['overlay'],
  tournamentName?: string
) {
  ctx.save();

  // Tournament name watermark (top-right)
  if (tournamentName) {
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillText(tournamentName, w - 28, 28);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(tournamentName, w - 30, 26);
  }

  // Match info bar (bottom)
  if (overlay && (overlay.player1 || overlay.player2)) {
    const barH = 80;
    const barY = h - barH;

    // Semi-transparent gradient bar
    const grad = ctx.createLinearGradient(0, barY, 0, h);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.3, 'rgba(0,0,0,0.7)');
    grad.addColorStop(1, 'rgba(0,0,0,0.85)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, barY, w, barH);

    const textY = h - 28;

    // Player 1 name (left)
    if (overlay.player1) {
      ctx.font = 'bold 32px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(overlay.player1, 40, textY);
    }

    // Score (center)
    if (overlay.score) {
      ctx.font = 'bold 40px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fbbf24'; // amber accent
      ctx.fillText(overlay.score, w / 2, textY);
    }

    // Player 2 name (right)
    if (overlay.player2) {
      ctx.font = 'bold 32px sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(overlay.player2, w - 40, textY);
    }
  }

  ctx.restore();
}

function waitFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

export async function uploadGeneratedVideo(
  tournamentId: string,
  videoBlob: Blob
): Promise<string> {
  const fileName = `${tournamentId}/${Date.now()}.webm`;

  const { error: uploadError } = await supabase.storage
    .from('tournament-videos')
    .upload(fileName, videoBlob, { contentType: 'video/webm' });

  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage
    .from('tournament-videos')
    .getPublicUrl(fileName);

  await supabase
    .from('tournament_videos' as any)
    .insert({
      tournament_id: tournamentId,
      video_url: urlData.publicUrl,
    } as any);

  return urlData.publicUrl;
}

// Soundtrack management
export async function uploadSoundtrack(
  tournamentId: string,
  file: File
): Promise<string> {
  const ext = file.name.split('.').pop() || 'mp3';
  const fileName = `${tournamentId}/soundtrack.${ext}`;

  // Remove existing soundtrack
  await supabase.storage.from('tournament-videos').remove([fileName]).catch(() => {});

  const { error } = await supabase.storage
    .from('tournament-videos')
    .upload(fileName, file, { contentType: file.type, upsert: true });

  if (error) throw error;

  const { data: urlData } = supabase.storage
    .from('tournament-videos')
    .getPublicUrl(fileName);

  return urlData.publicUrl;
}

export async function getSoundtrackUrl(tournamentId: string): Promise<string | null> {
  // List files in the tournament folder looking for soundtrack
  const { data } = await supabase.storage
    .from('tournament-videos')
    .list(tournamentId);

  if (!data) return null;

  const soundtrackFile = data.find(f => f.name.startsWith('soundtrack.'));
  if (!soundtrackFile) return null;

  const { data: urlData } = supabase.storage
    .from('tournament-videos')
    .getPublicUrl(`${tournamentId}/${soundtrackFile.name}`);

  return urlData.publicUrl;
}

export async function removeSoundtrack(tournamentId: string): Promise<void> {
  const { data } = await supabase.storage
    .from('tournament-videos')
    .list(tournamentId);

  if (!data) return;

  const soundtrackFiles = data.filter(f => f.name.startsWith('soundtrack.'));
  if (soundtrackFiles.length > 0) {
    await supabase.storage
      .from('tournament-videos')
      .remove(soundtrackFiles.map(f => `${tournamentId}/${f.name}`));
  }
}
