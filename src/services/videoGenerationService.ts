import { supabase } from '@/integrations/supabase/client';

interface MediaItem {
  url: string;
  type: 'image' | 'video';
  label: string;
  section: 'pre_tournament' | 'match' | 'ceremony';
}

export async function collectTournamentMedia(tournamentId: string): Promise<MediaItem[]> {
  const { data: photos } = await supabase
    .from('match_photos')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('created_at', { ascending: true });

  if (!photos) return [];

  const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.webm', '.avi', '.mkv', '.m4v', '.3gp'];

  return photos.map(p => {
    const isVideo = (() => {
      try {
        const pathname = new URL(p.photo_url).pathname.toLowerCase();
        return VIDEO_EXTENSIONS.some(ext => pathname.endsWith(ext));
      } catch { return false; }
    })();

    return {
      url: p.photo_url,
      type: isVideo ? 'video' as const : 'image' as const,
      label: p.photo_type === 'pre_tournament' ? 'Vor dem Turnier' :
             p.photo_type === 'ceremony' ? 'Siegerehrung' : 'Spielfoto',
      section: p.photo_type as MediaItem['section'],
    };
  });
}

/**
 * Generates a WebM video slideshow from images and video clips using
 * Canvas + MediaRecorder (client-side).
 */
export async function generateSlideshowVideo(
  media: MediaItem[],
  tournamentName: string,
  onProgress?: (pct: number) => void
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = 1920;
  canvas.height = 1080;
  const ctx = canvas.getContext('2d')!;

  const stream = canvas.captureStream(30);
  const recorder = new MediaRecorder(stream, {
    mimeType: 'video/webm;codecs=vp9',
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

  // Intro slide
  await drawTextSlide(ctx, canvas.width, canvas.height, tournamentName, 'Turnier-Highlights', 2000);
  onProgress?.(5);

  // Section slides
  const sections: { key: MediaItem['section']; title: string }[] = [
    { key: 'pre_tournament', title: '🎬 Vor dem Turnier' },
    { key: 'match', title: '🏓 Spielszenen' },
    { key: 'ceremony', title: '🏆 Siegerehrung' },
  ];

  const images = media.filter(m => m.type === 'image');
  const totalSteps = images.length + sections.length + 2;
  let step = 1;

  for (const section of sections) {
    const sectionMedia = media.filter(m => m.section === section.key && m.type === 'image');
    if (sectionMedia.length === 0) continue;

    // Section title
    await drawTextSlide(ctx, canvas.width, canvas.height, section.title, '', 1500);
    step++;
    onProgress?.(Math.round((step / totalSteps) * 100));

    // Show each image with a ken burns effect
    for (const item of sectionMedia) {
      try {
        const img = await loadImage(item.url);
        await drawImageSlide(ctx, canvas.width, canvas.height, img, 3000);
      } catch (e) {
        console.warn('Failed to load image:', item.url, e);
      }
      step++;
      onProgress?.(Math.round((step / totalSteps) * 100));
    }
  }

  // Outro slide
  await drawTextSlide(ctx, canvas.width, canvas.height, 'Danke!', tournamentName, 2000);
  onProgress?.(100);

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

async function drawTextSlide(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  title: string, subtitle: string,
  durationMs: number
) {
  const frames = Math.round((durationMs / 1000) * 30);
  for (let f = 0; f < frames; f++) {
    const progress = f / frames;

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#1a1a2e');
    grad.addColorStop(1, '#16213e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Fade in/out
    const alpha = progress < 0.15 ? progress / 0.15 :
                  progress > 0.85 ? (1 - progress) / 0.15 : 1;

    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 72px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, w / 2, h / 2 - (subtitle ? 30 : 0));

    // Subtitle
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
  durationMs: number
) {
  const frames = Math.round((durationMs / 1000) * 30);
  for (let f = 0; f < frames; f++) {
    const progress = f / frames;

    // Background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, w, h);

    // Ken Burns: slow zoom from 1.0 to 1.1
    const scale = 1 + progress * 0.1;

    // Fit image to canvas while maintaining aspect ratio
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

    // Fade in/out
    const alpha = progress < 0.1 ? progress / 0.1 :
                  progress > 0.9 ? (1 - progress) / 0.1 : 1;
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

    ctx.drawImage(img, x, y, drawW, drawH);
    ctx.globalAlpha = 1;

    await waitFrame();
  }
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

  // Store reference in DB
  await supabase
    .from('tournament_videos' as any)
    .insert({
      tournament_id: tournamentId,
      video_url: urlData.publicUrl,
    } as any);

  return urlData.publicUrl;
}
