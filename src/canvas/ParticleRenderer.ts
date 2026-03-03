import type { Particle, ParticleConfig } from '@/types/particles';
import type { ViewportState } from '@/store/uiStore';
import { documentToCanvas, scaleToCanvas } from '@/utils/coordinates';

/**
 * Render all particles as filled circles on the canvas.
 * Batches by opacity level to minimise fillStyle changes.
 */
export function renderParticles(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  config: ParticleConfig,
  viewport: ViewportState,
): void {
  if (particles.length === 0) return;

  ctx.save();

  // Draw each particle — batching by exact opacity would be complex;
  // for MVP we accept the per-particle fillStyle cost (still fast at 3-5k particles)
  let lastOpacity = -1;

  for (const p of particles) {
    const cv = documentToCanvas({ x: p.x, y: p.y }, viewport);
    const r = scaleToCanvas(p.radius, viewport);
    if (r < 0.3) continue;

    if (p.opacity !== lastOpacity) {
      // Parse hex color to rgb for rgba() support
      ctx.fillStyle = hexToRgba(config.color, p.opacity);
      lastOpacity = p.opacity;
    }

    ctx.beginPath();
    ctx.arc(cv.x, cv.y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function hexToRgba(hex: string, opacity: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${opacity.toFixed(3)})`;
}
