import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import type { ParticleConfig, AnimatedParticle, AnimationConfig } from '@/types/particles';
import { computeFrame } from '@/engine/animationEngine';
import { renderParticleFrame } from '@/export/frameRenderer';

export interface VideoExportOptions {
  scale: 1 | 2;
  fps: 30 | 60;
  duration: number;
  canvasColor: string;
}

function triggerDownload(data: Uint8Array, filename: string): void {
  const blob = new Blob([data], { type: 'video/mp4' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Delay revocation — Safari needs time to read the blob before it's released
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/**
 * Returns the first H.264 codec string that VideoEncoder reports as supported.
 * Safari 17 supports H.264 but not all profiles/levels that Chrome accepts.
 */
async function pickSupportedCodec(
  w: number,
  h: number,
  fps: number,
  bitrate: number,
): Promise<string> {
  const candidates = [
    'avc1.640034', // High Profile Level 5.2
    'avc1.4D0034', // Main Profile Level 5.2
    'avc1.420034', // Baseline Profile Level 5.2
    'avc1.64002A', // High Profile Level 4.2
    'avc1.4D401F', // Main Profile Level 3.1
    'avc1.42E01E', // Baseline Profile Level 3.0 — broadest Safari support
  ];
  for (const codec of candidates) {
    try {
      const result = await VideoEncoder.isConfigSupported({
        codec,
        width: w,
        height: h,
        bitrate,
        framerate: fps,
      });
      if (result.supported) return codec;
    } catch {
      // isConfigSupported not supported or codec rejected — try next
    }
  }
  // Last-resort fallback
  return 'avc1.42E01E';
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
  const duration = options.duration;
  const totalFrames = Math.ceil(duration * fps);
  const w = docWidth * scale;
  const h = docHeight * scale;

  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;

  const bitrate = 8_000_000;
  const codec = await pickSupportedCodec(w, h, fps, bitrate);

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

  const frameDuration = Math.round(1_000_000 / fps);

  let encoderError: unknown = null;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => {
      // Shallow-copy meta with colorSpace filled in (Safari sets it to null).
      // Mutation of the original would fail — Safari's WebCodecs objects are non-configurable.
      let safeMeta = meta;
      if (meta?.decoderConfig && meta.decoderConfig.colorSpace == null) {
        safeMeta = {
          ...meta,
          decoderConfig: {
            ...meta.decoderConfig,
            colorSpace: {
              primaries: 'bt709',
              transfer: 'bt709',
              matrix: 'bt709',
              fullRange: false,
            },
          },
        };
      }
      // Use addVideoChunkRaw so we can supply explicit duration.
      // addVideoChunk has no duration override — it always uses chunk.duration,
      // which Safari sets to null, causing mp4-muxer to throw.
      const data = new Uint8Array(chunk.byteLength);
      chunk.copyTo(data);
      const chunkDuration = chunk.duration ?? frameDuration;
      muxer.addVideoChunkRaw(data, chunk.type, chunk.timestamp, chunkDuration, safeMeta);
    },
    error: (e) => { encoderError = e; },
  });

  encoder.configure({
    codec,
    width: w,
    height: h,
    bitrate,
    framerate: fps,
  });

  // speed = preset × 2π / duration, so the animation completes exactly
  // `preset` full cycles in `duration` seconds — frame 0 and last frame are identical.
  // No crossfade needed.

  for (let i = 0; i < totalFrames; i++) {
    if (encoderError) throw encoderError;

    const elapsed = i / fps;

    const particles = computeFrame(animatedParticles, animationConfig, elapsed);

    renderParticleFrame(ctx, particles, particleConfig, options.canvasColor, w, h, scale);

    const timestamp = Math.round(i * (1_000_000 / fps));
    const frame = new VideoFrame(canvas, { timestamp });
    encoder.encode(frame, { keyFrame: i % 60 === 0 });
    frame.close();

    onProgress?.(i / totalFrames);

    // Yield to browser every 10 frames to avoid blocking UI
    if (i % 10 === 0) await new Promise((r) => setTimeout(r, 0));
  }

  await encoder.flush();
  if (encoderError) throw encoderError;
  encoder.close();
  muxer.finalize();

  const buffer = target.buffer;
  triggerDownload(new Uint8Array(buffer), 'particles.mp4');
  onProgress?.(1);
}
