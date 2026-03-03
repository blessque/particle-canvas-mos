import type { Particle, ParticleConfig } from '@/types/particles';

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
): Promise<void> {
  // OffscreenCanvas with HTMLCanvasElement fallback for older browsers
  let canvas: OffscreenCanvas | HTMLCanvasElement;
  let ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

  if (typeof OffscreenCanvas !== 'undefined') {
    canvas = new OffscreenCanvas(docWidth, docHeight);
    ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D;
  } else {
    const el = document.createElement('canvas');
    el.width = docWidth;
    el.height = docHeight;
    canvas = el;
    ctx = el.getContext('2d') as CanvasRenderingContext2D;
  }

  ctx.clearRect(0, 0, docWidth, docHeight);

  // Parse hex color once
  const hex = config.color.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  for (const p of particles) {
    ctx.fillStyle = `rgba(${r},${g},${b},${p.opacity.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  let blob: Blob;
  if (canvas instanceof OffscreenCanvas) {
    blob = await canvas.convertToBlob({ type: 'image/png' });
  } else {
    blob = await new Promise<Blob>((resolve, reject) => {
      (canvas as HTMLCanvasElement).toBlob((b) => {
        if (b) resolve(b);
        else reject(new Error('toBlob failed'));
      }, 'image/png');
    });
  }

  const url = URL.createObjectURL(blob);
  triggerDownload(url, 'particles.png');
}
