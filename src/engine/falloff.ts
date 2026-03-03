import type { FalloffType } from '@/types/particles';
import { clamp } from '@/utils/clamp';

/**
 * Compute the probability (0–1) of placing a particle at `distance` from an outline,
 * given a maximum falloff distance and a curve type.
 * Returns 1.0 at distance=0, 0.0 at distance=maxDist (or beyond).
 */
export function computeFalloff(
  distance: number,
  maxDist: number,
  type: FalloffType,
): number {
  if (maxDist <= 0) return distance === 0 ? 1 : 0;
  const t = clamp(distance / maxDist, 0, 1);

  switch (type) {
    case 'linear':
      return 1 - t;

    case 'exponential':
      // Fast drop-off near the outline
      return Math.pow(1 - t, 3);

    case 'gaussian': {
      // Bell-curve centred at t=0, sigma ≈ 0.4 gives a smooth falloff
      const sigma = 0.4;
      return Math.exp(-(t * t) / (2 * sigma * sigma));
    }
  }
}
