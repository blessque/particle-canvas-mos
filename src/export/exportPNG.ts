import type { Particle, ParticleConfig } from '@/types/particles';
import { createExportCanvas, canvasToPNGBlob, renderParticleFrame } from '@/export/frameRenderer';

function triggerDownload(url: string, filename: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Export particles as a PNG file with a transparent background.
 * Renders directly in document coordinates — no viewport transform.
 */
export async function exportPNG(
  particles: Particle[],
  config: ParticleConfig,
  docWidth: number,
  docHeight: number,
  scale: 1 | 2 = 1,
): Promise<void> {
  const w = docWidth * scale;
  const h = docHeight * scale;

  const { canvas, ctx } = createExportCanvas(w, h);
  renderParticleFrame(ctx, particles, config, null, w, h, scale);

  const blob = await canvasToPNGBlob(canvas);
  const url = URL.createObjectURL(blob);
  triggerDownload(url, 'particles.png');
}
