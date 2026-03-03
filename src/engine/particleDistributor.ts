import type { Particle, ParticleConfig } from '@/types/particles';
import type { SceneObject } from '@/types/scene';
import { sampleShapeOutline } from './shapeGeometry';
import { add, scale } from './vectorMath';
import { computeFalloff } from './falloff';

/** Mulberry32 seeded PRNG — returns a function that yields floats in [0, 1) */
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Spatial hash for Poisson-disk minimum-distance check */
class SpatialHash {
  private cells = new Map<string, { x: number; y: number }[]>();
  private cellSize: number;

  constructor(cellSize: number) {
    this.cellSize = cellSize;
  }

  private key(x: number, y: number): string {
    return `${Math.floor(x / this.cellSize)},${Math.floor(y / this.cellSize)}`;
  }

  add(x: number, y: number): void {
    const k = this.key(x, y);
    const cell = this.cells.get(k) ?? [];
    cell.push({ x, y });
    this.cells.set(k, cell);
  }

  /** Returns true if any existing point is closer than minDist */
  hasTooClose(x: number, y: number, minDist: number): boolean {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const neighbours = this.cells.get(`${cx + dx},${cy + dy}`);
        if (!neighbours) continue;
        for (const p of neighbours) {
          const ddx = p.x - x;
          const ddy = p.y - y;
          if (ddx * ddx + ddy * ddy < minDist * minDist) return true;
        }
      }
    }
    return false;
  }
}

/**
 * Distribute particles across all visible scene objects.
 * Pure function — given the same inputs always returns the same output.
 */
export function distributeParticles(
  objects: SceneObject[],
  config: ParticleConfig,
): Particle[] {
  const visibleObjects = objects.filter((o) => o.visible);
  if (visibleObjects.length === 0) return [];

  // Collect all outline samples from all visible objects
  const allSamples = visibleObjects.flatMap(sampleShapeOutline);
  if (allSamples.length === 0) return [];

  const rng = mulberry32(config.seed);
  const particles: Particle[] = [];
  // Use minSize as the single particle size (no randomization in MVP)
  const radius = config.minSize;
  const minDist = radius * 2;
  const hash = new SpatialHash(minDist);
  const maxAttempts = config.count * 12;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (particles.length >= config.count) break;

    // 1. Pick a random outline sample
    const sampleIdx = Math.floor(rng() * allSamples.length);
    const sample = allSamples[sampleIdx];
    if (!sample) continue;

    // 2. Random offset distance within falloffDistance
    const d = rng() * config.falloffDistance;

    // 3. Reject based on falloff probability
    const prob = computeFalloff(d, config.falloffDistance, config.falloffType);
    if (rng() > prob) continue;

    // 4. Determine sign (inside = toward center = negative normal, outside = positive)
    let sign: number;
    if (config.spawnDirection === 'outside') {
      sign = 1;
    } else if (config.spawnDirection === 'inside') {
      sign = -1;
    } else {
      sign = rng() < 0.5 ? 1 : -1;
    }

    // 5. Compute candidate position
    const offset = scale(sample.normal, d * sign);
    const candidate = add(sample.point, offset);

    // 6. Poisson disk check
    if (hash.hasTooClose(candidate.x, candidate.y, minDist)) continue;

    // 7. Accept particle
    hash.add(candidate.x, candidate.y);
    const opacity = config.opacityRandomize
      ? config.baseOpacity * (0.4 + rng() * 0.6)
      : config.baseOpacity;

    particles.push({ x: candidate.x, y: candidate.y, radius, opacity });
  }

  return particles;
}
