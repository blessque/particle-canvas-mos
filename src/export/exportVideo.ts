import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import type { Particle, ParticleConfig, AnimatedParticle, AnimationConfig } from '@/types/particles';
import { computeFrame, SPREAD_DURATION } from '@/engine/animationEngine';

export interface VideoExportOptions {
  scale: 1 | 2;
  fps: 30 | 60;
  duration: number; // seconds; for 'spread' always SPREAD_DURATION
  canvasColor: string;
}

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

function renderFrame(
  ctx: OffscreenCanvasRenderingContext2D,
  particles: Particle[],
  config: ParticleConfig,
  canvasColor: string,
  w: number,
  h: number,
  scale: number,
): void {
  ctx.resetTransform();

  // Fill background
  ctx.fillStyle = canvasColor;
  ctx.fillRect(0, 0, w, h);

  ctx.scale(scale, scale);

  const [r, g, b] = parseHex(config.color);
  for (const p of particles) {
    ctx.fillStyle = `rgba(${r},${g},${b},${p.opacity.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function triggerDownload(data: Uint8Array, filename: string): void {
  const blob = new Blob([data], { type: 'video/mp4' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportVideo(
  animatedParticles: AnimatedParticle[],
  animationConfig: AnimationConfig,
  particleConfig: ParticleConfig,
  docWidth: number,
  docHeight: number,
  options: VideoExportOptions,
  onProgress?: (pct: number) => void,
): Promise<void> {
  if (typeof VideoEncoder === 'undefined') {
    alert('Экспорт видео требует Chrome, Edge или Safari 16.4+');
    return;
  }

  const scale = options.scale;
  const fps = options.fps;
  const duration = animationConfig.mode === 'spread' ? SPREAD_DURATION : options.duration;
  const totalFrames = Math.ceil(duration * fps);
  const w = docWidth * scale;
  const h = docHeight * scale;

  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;

  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: {
      codec: 'avc',
      width: w,
      height: h,
    },
    fastStart: 'in-memory',
  });

  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => { throw e; },
  });

  encoder.configure({
    codec: 'avc1.420034', // H.264 High Profile Level 5.2
    width: w,
    height: h,
    bitrate: 8_000_000,
    framerate: fps,
  });

  // speed = preset × 2π / duration, so the animation completes exactly
  // `preset` full cycles in `duration` seconds — frame 0 and last frame are identical.
  // No crossfade needed.

  for (let i = 0; i < totalFrames; i++) {
    const elapsed = animationConfig.mode === 'spread'
      ? (i / fps) % SPREAD_DURATION
      : i / fps;

    const particles = computeFrame(animatedParticles, animationConfig, elapsed);

    renderFrame(ctx, particles, particleConfig, options.canvasColor, w, h, scale);

    const timestamp = Math.round(i * (1_000_000 / fps));
    const frame = new VideoFrame(canvas, { timestamp });
    encoder.encode(frame, { keyFrame: i % 60 === 0 });
    frame.close();

    onProgress?.(i / totalFrames);

    // Yield to browser every 10 frames to avoid blocking UI
    if (i % 10 === 0) await new Promise((r) => setTimeout(r, 0));
  }

  await encoder.flush();
  encoder.close();
  muxer.finalize();

  const buffer = target.buffer;
  triggerDownload(new Uint8Array(buffer), 'particles.mp4');
  onProgress?.(1);
}
