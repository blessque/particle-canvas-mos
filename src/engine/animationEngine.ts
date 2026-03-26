import type { OutlineSample } from '@/types/geometry';
import type { Particle, AnimatedParticle, AnimationConfig } from '@/types/particles';

export const SPREAD_DURATION = 2.5;

export function isSpreadComplete(elapsed: number): boolean {
  return elapsed >= SPREAD_DURATION;
}

/** Seeded pseudo-random number generator (mulberry32) */
function makePrng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Build spatial grid over outline samples for fast nearest-sample lookup.
 * Returns a function that finds the nearest OutlineSample to a given point.
 */
function buildSpatialLookup(
  samples: OutlineSample[],
  cellSize: number,
): (x: number, y: number) => OutlineSample | null {
  const grid = new Map<string, OutlineSample[]>();

  function key(gx: number, gy: number) { return `${gx},${gy}`; }
  function cell(v: number) { return Math.floor(v / cellSize); }

  for (const s of samples) {
    const k = key(cell(s.point.x), cell(s.point.y));
    let bucket = grid.get(k);
    if (!bucket) { bucket = []; grid.set(k, bucket); }
    bucket.push(s);
  }

  return (x: number, y: number) => {
    const gx = cell(x);
    const gy = cell(y);
    let best: OutlineSample | null = null;
    let bestDist = Infinity;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const bucket = grid.get(key(gx + dx, gy + dy));
        if (!bucket) continue;
        for (const s of bucket) {
          const ddx = s.point.x - x;
          const ddy = s.point.y - y;
          const d = ddx * ddx + ddy * ddy;
          if (d < bestDist) { bestDist = d; best = s; }
        }
      }
    }
    return best;
  };
}

/**
 * Bake per-particle animation data (normal/tangent/phase) from outline samples.
 * Call this once when animation starts or particles change.
 */
export function prepareAnimatedParticles(
  particles: Particle[],
  samples: OutlineSample[],
  falloffDistance: number,
  seed: number,
): AnimatedParticle[] {
  const cellSize = Math.max(falloffDistance, 10);
  const nearest = buildSpatialLookup(samples, cellSize);
  const rng = makePrng(seed);

  return particles.map((p) => {
    const sample = nearest(p.x, p.y);
    const nx = sample?.normal.x ?? 0;
    const ny = sample?.normal.y ?? 1;
    return {
      baseX: p.x,
      baseY: p.y,
      baseRadius: p.radius,
      baseOpacity: p.opacity,
      normalX: nx,
      normalY: ny,
      tangentX: -ny,
      tangentY: nx,
      phase: rng() * Math.PI * 2,
      phase2: rng() * Math.PI * 2,
    };
  });
}

function brownianFrame(animated: AnimatedParticle[], cfg: AnimationConfig, elapsed: number): Particle[] {
  const t = elapsed * cfg.speed;
  const amp = cfg.amplitude;
  return animated.map((p) => {
    const dn = amp * 0.7 * (0.6 * Math.sin(t + p.phase) + 0.4 * Math.sin(2 * t + p.phase * 1.37));
    const dt = amp * 0.3 * (0.6 * Math.sin(t + p.phase2) + 0.4 * Math.sin(2 * t + p.phase2 * 1.37));
    return {
      x: p.baseX + dn * p.normalX + dt * p.tangentX,
      y: p.baseY + dn * p.normalY + dt * p.tangentY,
      radius: p.baseRadius,
      opacity: p.baseOpacity,
    };
  });
}

function directionalFrame(animated: AnimatedParticle[], cfg: AnimationConfig, elapsed: number): Particle[] {
  const t = elapsed * cfg.speed;
  const amp = cfg.amplitude;
  return animated.map((p) => {
    const flowDisp = amp * Math.sin(t + p.phase);
    const wobble = amp * 0.15 * Math.sin(2 * t + p.phase2);
    return {
      x: p.baseX + flowDisp * p.tangentX + wobble * p.normalX,
      y: p.baseY + flowDisp * p.tangentY + wobble * p.normalY,
      radius: p.baseRadius,
      opacity: p.baseOpacity,
    };
  });
}

function spreadFrame(animated: AnimatedParticle[], cfg: AnimationConfig, elapsed: number): Particle[] {
  const progress = Math.min(elapsed / SPREAD_DURATION, 1);
  const eased = 1 - Math.pow(1 - progress, 3);
  const opacityFactor = progress < 0.6 ? 1 : 1 - (progress - 0.6) / 0.4;
  const amp = cfg.amplitude;
  return animated.map((p) => {
    const particleAmp = amp * (0.8 + 0.2 * Math.sin(p.phase));
    return {
      x: p.baseX + eased * particleAmp * p.normalX,
      y: p.baseY + eased * particleAmp * p.normalY,
      radius: p.baseRadius,
      opacity: p.baseOpacity * opacityFactor,
    };
  });
}

/**
 * Compute displaced particle positions for the current animation frame.
 */
export function computeFrame(
  animated: AnimatedParticle[],
  cfg: AnimationConfig,
  elapsed: number,
): Particle[] {
  switch (cfg.mode) {
    case 'brownian':    return brownianFrame(animated, cfg, elapsed);
    case 'directional': return directionalFrame(animated, cfg, elapsed);
    case 'spread':      return spreadFrame(animated, cfg, elapsed);
    default:            return animated.map((p) => ({ x: p.baseX, y: p.baseY, radius: p.baseRadius, opacity: p.baseOpacity }));
  }
}
