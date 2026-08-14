import type { Particle, ParticleConfig } from '@/types/particles';

export type ExportCanvas = OffscreenCanvas | HTMLCanvasElement;
export type ExportContext = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

export function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}

/** OffscreenCanvas with an HTMLCanvasElement fallback for older browsers. */
export function createExportCanvas(w: number, h: number): { canvas: ExportCanvas; ctx: ExportContext } {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(w, h);
    return { canvas, ctx: canvas.getContext('2d') as OffscreenCanvasRenderingContext2D };
  }
  const el = document.createElement('canvas');
  el.width = w;
  el.height = h;
  return { canvas: el, ctx: el.getContext('2d') as CanvasRenderingContext2D };
}

export async function canvasToPNGBlob(canvas: ExportCanvas): Promise<Blob> {
  if (canvas instanceof OffscreenCanvas) {
    return canvas.convertToBlob({ type: 'image/png' });
  }
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error('toBlob failed'));
    }, 'image/png');
  });
}

/**
 * Draws one frame of particles in document coordinates.
 * `background` null means a transparent frame (PNG / PNG sequence);
 * a hex string fills an opaque background (video, which has no alpha channel).
 * resetTransform() first so the repeated scale() stays correct across frames.
 */
export function renderParticleFrame(
  ctx: ExportContext,
  particles: readonly Particle[],
  config: ParticleConfig,
  background: string | null,
  w: number,
  h: number,
  scale: number,
): void {
  ctx.resetTransform();

  if (background === null) {
    ctx.clearRect(0, 0, w, h);
  } else {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, w, h);
  }

  ctx.scale(scale, scale);

  const [r, g, b] = parseHex(config.color);
  for (const p of particles) {
    ctx.fillStyle = `rgba(${r},${g},${b},${p.opacity.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}
