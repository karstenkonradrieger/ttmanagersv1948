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

function getRoundLabel(round: number, totalRounds: number, mode?: string): string {
  if (mode === 'round_robin' || mode === 'swiss') return `Runde ${round + 1}`;
  const diff = totalRounds - round;
  if (diff === 1) return 'Finale';
  if (diff === 2) return 'Halbfinale';
  if (diff === 3) return 'Viertelfinale';
  return `Runde ${round + 1}`;
}

interface PlacementEntry {
  rank: number;
  name: string;
}

export async function collectTournamentMedia(
  tournamentId: string,
  getParticipantName?: (id: string | null) => string
): Promise<{ media: MediaItem[]; placements: PlacementEntry[] }> {
  const { data: photos } = await supabase
    .from('match_photos')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('created_at', { ascending: true });

  if (!photos) return { media: [], placements: [] };

  // Load match data for overlay info
  let matchMap: Record<string, any> = {};
  let matchList: any[] = [];
  let totalRounds = 0;
  let tournamentMode = 'knockout';
  if (getParticipantName) {
    const { data: matches } = await supabase
      .from('matches')
      .select('*')
      .eq('tournament_id', tournamentId);
    if (matches) {
      matchList = matches;
      for (const m of matches) {
        matchMap[m.id] = m;
        if (m.round > totalRounds) totalRounds = m.round;
      }
      const koMatches = matches.filter(m => m.group_number === null || m.group_number === undefined);
      koTotalRounds = koMatches.length > 0 ? Math.max(0, ...koMatches.map(m => m.round)) : 0;
    }
    const { data: tournament } = await supabase
      .from('tournaments')
      .select('mode')
      .eq('id', tournamentId)
      .single();
    if (tournament) tournamentMode = tournament.mode;
  }

  const media = photos.map(p => {
    const match = p.match_id ? matchMap[p.match_id] : null;
    let overlay: MediaItem['overlay'] = undefined;

    if (match && getParticipantName) {
      const sets = (match.sets || []) as Array<{ player1: number; player2: number }>;
      let w1 = 0, w2 = 0;
      for (const s of sets) {
        if (s.player1 >= 11 && s.player1 - s.player2 >= 2) w1++;
        else if (s.player2 >= 11 && s.player2 - s.player1 >= 2) w2++;
      }
      const isGroupMatch = match.group_number !== null && match.group_number !== undefined;
      const roundLabel = isGroupMatch
        ? `Gruppe ${String.fromCharCode(65 + match.group_number)}`
        : getRoundLabel(match.round, koTotalRounds + 1, tournamentMode);
      overlay = {
        player1: getParticipantName(match.player1_id),
        player2: getParticipantName(match.player2_id),
        score: match.winner_id ? `${w1} : ${w2}` : undefined,
        roundLabel,
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

  // Compute placements from completed matches
  const placements = computePlacements(matchList, tournamentMode, getParticipantName);

  return { media, placements };
}

function computePlacements(
  matches: any[],
  mode: string,
  getName?: (id: string | null) => string
): PlacementEntry[] {
  if (!getName || matches.length === 0) return [];
  const completed = matches.filter(m => m.status === 'completed' && m.winner_id);
  if (completed.length === 0) return [];

  if (mode === 'round_robin' || mode === 'swiss') {
    // Standings-based ranking
    const stats = new Map<string, { won: number; setsWon: number; setsLost: number; pointsWon: number; pointsLost: number }>();
    const ensure = (id: string) => {
      if (!stats.has(id)) stats.set(id, { won: 0, setsWon: 0, setsLost: 0, pointsWon: 0, pointsLost: 0 });
      return stats.get(id)!;
    };
    for (const m of completed) {
      if (!m.player1_id || !m.player2_id) continue;
      const s1 = ensure(m.player1_id);
      const s2 = ensure(m.player2_id);
      if (m.winner_id === m.player1_id) s1.won++;
      else s2.won++;
      const sets = (m.sets || []) as Array<{ player1: number; player2: number }>;
      for (const s of sets) {
        s1.pointsWon += s.player1; s1.pointsLost += s.player2;
        s2.pointsWon += s.player2; s2.pointsLost += s.player1;
        if (s.player1 >= 11 && s.player1 - s.player2 >= 2) { s1.setsWon++; s2.setsLost++; }
        else if (s.player2 >= 11 && s.player2 - s.player1 >= 2) { s2.setsWon++; s1.setsLost++; }
      }
    }
    const sorted = [...stats.entries()].sort((a, b) =>
      b[1].won - a[1].won ||
      (b[1].setsWon - b[1].setsLost) - (a[1].setsWon - a[1].setsLost) ||
      (b[1].pointsWon - b[1].pointsLost) - (a[1].pointsWon - a[1].pointsLost)
    );
    return sorted.map(([id], i) => ({ rank: i + 1, name: getName(id) }));
  }

  // Knockout: derive from bracket
  const maxRound = Math.max(0, ...completed.map(m => m.round));
  const finalMatch = completed.find(m => m.round === maxRound);
  if (!finalMatch) return [];

  const result: PlacementEntry[] = [];
  // 1st: winner of final
  result.push({ rank: 1, name: getName(finalMatch.winner_id) });
  // 2nd: loser of final
  const loserId = finalMatch.player1_id === finalMatch.winner_id ? finalMatch.player2_id : finalMatch.player1_id;
  result.push({ rank: 2, name: getName(loserId) });
  // 3rd/4th: losers of semifinal
  const semis = completed.filter(m => m.round === maxRound - 1);
  let rank = 3;
  for (const s of semis) {
    const sLoser = s.player1_id === s.winner_id ? s.player2_id : s.player1_id;
    if (sLoser) result.push({ rank: rank++, name: getName(sLoser) });
  }
  return result;
}

/**
 * Picks the best supported video MIME type for MediaRecorder.
 * Prefers MP4 (h264) for broad device/player compatibility, falls back to WebM.
 */
function pickMimeType(): { mimeType: string; extension: string } {
  const candidates = [
    { mimeType: 'video/mp4;codecs=avc1,opus', extension: 'mp4' },
    { mimeType: 'video/mp4;codecs=avc1,mp4a.40.2', extension: 'mp4' },
    { mimeType: 'video/mp4', extension: 'mp4' },
    { mimeType: 'video/webm;codecs=vp9,opus', extension: 'webm' },
    { mimeType: 'video/webm;codecs=vp8,opus', extension: 'webm' },
    { mimeType: 'video/webm', extension: 'webm' },
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c.mimeType)) return c;
  }
  return { mimeType: 'video/webm', extension: 'webm' };
}

/**
 * Generates a video slideshow from images AND video clips using
 * Canvas + MediaRecorder (client-side). Optionally mixes in a soundtrack.
 * Outputs MP4 when the browser supports it, WebM otherwise.
 */
export async function generateSlideshowVideo(
  media: MediaItem[],
  tournamentName: string,
  soundtrackUrl?: string | null,
  onProgress?: (pct: number) => void,
  soundtrackVolume: number = 0.4,
  placements: PlacementEntry[] = [],
  photoDurationMs: number = 3000
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
      gainNode.gain.value = soundtrackVolume;
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

  const { mimeType: recorderMime, extension: videoExtension } = pickMimeType();
  console.log(`MediaRecorder using: ${recorderMime} (.${videoExtension})`);

  const recorder = new MediaRecorder(combinedStream, {
    mimeType: recorderMime,
    videoBitsPerSecond: 5_000_000,
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const finished = new Promise<Blob>((resolve) => {
    recorder.onstop = () => {
      const contentType = videoExtension === 'mp4' ? 'video/mp4' : 'video/webm';
      resolve(new Blob(chunks, { type: contentType }));
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
  const hasCredits = placements.length > 0;
  const totalSteps = allItems + activeSections.length + 2 + (hasCredits ? 1 : 0);
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
          await drawImageSlide(ctx, canvas.width, canvas.height, img, photoDurationMs, item.overlay, tournamentName);
        }
      } catch (e) {
        console.warn('Failed to process media:', item.url, e);
      }
      step++;
      onProgress?.(Math.round((step / totalSteps) * 100));
    }
  }

  // Credits slide with placements
  if (hasCredits) {
    await drawCreditsSlide(ctx, canvas.width, canvas.height, tournamentName, placements);
    step++;
    onProgress?.(Math.round((step / totalSteps) * 100));
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
  const maxDuration = Math.min(video.duration, 30); // cap at 30s
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

async function drawCreditsSlide(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  tournamentName: string,
  placements: PlacementEntry[]
) {
  const medals = ['🥇', '🥈', '🥉'];
  const displayCount = Math.min(placements.length, 8);
  const durationMs = 4000 + displayCount * 500;
  const frames = Math.round((durationMs / 1000) * 30);

  for (let f = 0; f < frames; f++) {
    const progress = f / frames;

    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#1a1a2e');
    grad.addColorStop(0.5, '#0f3460');
    grad.addColorStop(1, '#1a1a2e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    const alpha = progress < 0.1 ? progress / 0.1 :
                  progress > 0.9 ? (1 - progress) / 0.1 : 1;
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 56px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🏆 Platzierungen', w / 2, 120);

    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '28px sans-serif';
    ctx.fillText(tournamentName, w / 2, 175);

    const startY = 260;
    const lineH = 70;

    for (let i = 0; i < displayCount; i++) {
      const p = placements[i];
      const itemProgress = Math.max(0, Math.min(1, (progress - 0.05 - i * 0.06) / 0.12));
      if (itemProgress <= 0) continue;

      ctx.globalAlpha = Math.max(0, Math.min(1, alpha)) * itemProgress;
      const y = startY + i * lineH;
      const slideX = (1 - itemProgress) * 100;

      const medal = medals[i] || '';
      const rankText = medal || `${p.rank}.`;
      ctx.font = i < 3 ? 'bold 44px sans-serif' : 'bold 36px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillStyle = i === 0 ? '#fbbf24' : i === 1 ? '#cbd5e1' : i === 2 ? '#d97706' : '#94a3b8';
      ctx.fillText(rankText, w / 2 - 80 + slideX, y);

      ctx.font = i < 3 ? 'bold 40px sans-serif' : '34px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillStyle = i < 3 ? '#ffffff' : '#e2e8f0';
      ctx.fillText(p.name, w / 2 - 50 + slideX, y);
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
    const hasRoundLabel = !!overlay.roundLabel;
    const barH = hasRoundLabel ? 110 : 80;
    const barY = h - barH;

    // Semi-transparent gradient bar
    const grad = ctx.createLinearGradient(0, barY, 0, h);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.3, 'rgba(0,0,0,0.7)');
    grad.addColorStop(1, 'rgba(0,0,0,0.85)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, barY, w, barH);

    // Round label (above player names)
    if (overlay.roundLabel) {
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#94a3b8'; // slate-400
      ctx.fillText(overlay.roundLabel, w / 2, h - 68);
    }

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
  const isMP4 = videoBlob.type.includes('mp4');
  const ext = isMP4 ? 'mp4' : 'webm';
  const contentType = isMP4 ? 'video/mp4' : 'video/webm';
  const fileName = `${tournamentId}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('tournament-videos')
    .upload(fileName, videoBlob, { contentType });

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
