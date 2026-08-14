import type { ParticleConfig, AnimatedParticle, AnimationConfig } from '@/types/particles';
import { computeFrame } from '@/engine/animationEngine';
import { createExportCanvas, canvasToPNGBlob, renderParticleFrame } from '@/export/frameRenderer';
import { createStoredZip } from '@/export/zipBuilder';

export interface PNGSequenceOptions {
  scale: 1 | 2;
  fps: 30 | 60;
  duration: number;
}

export interface SequenceEstimate {
  totalFrames: number;
  bytesPerFrame: number;
  totalBytes: number;
  totalMs: number;
}

function frameCount(options: PNGSequenceOptions): number {
  return Math.ceil(options.duration * options.fps);
}

/** e.g. 20260814-BM_Sequence-10s-60fps-1x.zip */
function sequenceFilename(options: PNGSequenceOptions): string {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('');
  return `${stamp}-BM_Sequence-${options.duration}s-${options.fps}fps-${options.scale}x.zip`;
}

function triggerDownload(blob: Blob, filename: string): void {
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
 * Renders and encodes frame 0 only, then extrapolates size and duration.
 *
 * Deliberately a measurement of the actual scene rather than a heuristic: PNG size
 * depends on particle count, radius and overlap in ways no formula predicts well.
 */
export async function probePNGSequence(
  animatedParticles: AnimatedParticle[],
  animationConfig: AnimationConfig,
  particleConfig: ParticleConfig,
  docWidth: number,
  docHeight: number,
  options: PNGSequenceOptions,
): Promise<SequenceEstimate> {
  const totalFrames = frameCount(options);
  const w = docWidth * options.scale;
  const h = docHeight * options.scale;

  const { canvas, ctx } = createExportCanvas(w, h);

  const started = performance.now();
  const particles = computeFrame(animatedParticles, animationConfig, 0);
  renderParticleFrame(ctx, particles, particleConfig, null, w, h, options.scale);
  const blob = await canvasToPNGBlob(canvas);
  const msPerFrame = performance.now() - started;

  return {
    totalFrames,
    bytesPerFrame: blob.size,
    totalBytes: blob.size * totalFrames,
    totalMs: msPerFrame * totalFrames,
  };
}

/**
 * Exports the animation as a ZIP of numbered PNG frames.
 *
 * Frames are always transparent, regardless of the editor's canvas color — the
 * sequence is meant for compositing, where a baked-in background is never wanted.
 */
export async function exportPNGSequence(
  animatedParticles: AnimatedParticle[],
  animationConfig: AnimationConfig,
  particleConfig: ParticleConfig,
  docWidth: number,
  docHeight: number,
  options: PNGSequenceOptions,
  onProgress?: (pct: number) => void,
): Promise<void> {
  const { scale, fps } = options;
  const totalFrames = frameCount(options);
  const w = docWidth * scale;
  const h = docHeight * scale;

  const { canvas, ctx } = createExportCanvas(w, h);
  const zip = createStoredZip();
  const pad = Math.max(4, String(totalFrames - 1).length);

  // speed = preset × 2π / duration, so frame 0 and the last frame coincide —
  // the sequence loops seamlessly for free, same as the video export.
  for (let i = 0; i < totalFrames; i++) {
    const elapsed = i / fps;

    const particles = computeFrame(animatedParticles, animationConfig, elapsed);
    renderParticleFrame(ctx, particles, particleConfig, null, w, h, scale);

    const blob = await canvasToPNGBlob(canvas);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    zip.addFile(`frame_${String(i).padStart(pad, '0')}.png`, bytes);

    onProgress?.(i / totalFrames);

    // Yield to browser every 10 frames to avoid blocking UI
    if (i % 10 === 0) await new Promise((r) => setTimeout(r, 0));
  }

  const archive = await zip.finish();
  triggerDownload(archive, sequenceFilename(options));
  onProgress?.(1);
}
