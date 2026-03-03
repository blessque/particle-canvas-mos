import type { Particle, ParticleConfig } from '@/types/particles';

/**
 * Export particles as an SVG file with a transparent background.
 * Each particle becomes a <circle> element in document coordinates.
 */
export function exportSVG(
  particles: Particle[],
  config: ParticleConfig,
  docWidth: number,
  docHeight: number,
): void {
  const circles = particles
    .map(
      (p) =>
        `  <circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="${p.radius.toFixed(2)}" fill="${config.color}" opacity="${p.opacity.toFixed(3)}"/>`,
    )
    .join('\n');

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${docWidth} ${docHeight}" width="${docWidth}" height="${docHeight}">`,
    circles,
    '</svg>',
  ].join('\n');

  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'particles.svg';
  a.click();
  URL.revokeObjectURL(url);
}
