/** Direction particles spawn relative to shape outlines */
export type SpawnDirection = 'inside' | 'outside' | 'both';

/** Falloff curve type for edge density */
export type FalloffType = 'linear' | 'exponential' | 'gaussian';

/** Global particle configuration (applies to entire scene) */
export interface ParticleConfig {
  count: number;
  minSize: number;
  maxSize: number;
  color: string;
  opacityRandomize: boolean;
  baseOpacity: number;
  spawnDirection: SpawnDirection;
  falloffType: FalloffType;
  falloffDistance: number;
  falloffMode: 'absolute' | 'proportional';
  falloffBias: number;
  seed: number;
}

/** A single computed particle (output of engine, input to renderer) */
export interface Particle {
  x: number;
  y: number;
  radius: number;
  opacity: number;
}

export type AnimationMode = 'none' | 'brownian' | 'directional' | 'spread';

/** Per-particle data baked when animation starts */
export interface AnimatedParticle {
  baseX: number; baseY: number;
  baseRadius: number; baseOpacity: number;
  normalX: number; normalY: number;
  tangentX: number; tangentY: number;
  phase: number;
  phase2: number;
}

export type SpeedPreset = 1 | 2 | 3 | 4;
export type AmpPreset = 1 | 2 | 3 | 4;

/** Amplitude (doc units) for each of the 4 presets */
export const AMP_PRESET_VALUES: Record<AmpPreset, number> = {
  1: 8,
  2: 20,
  3: 40,
  4: 70,
};

/** Compute loop-perfect speed: N complete cycles in `duration` seconds */
export function computeLoopSpeed(preset: SpeedPreset, duration: number): number {
  return (preset * 2 * Math.PI) / duration;
}

export interface AnimationConfig {
  mode: AnimationMode;
  speed: number;
  amplitude: number;
  speedPreset: SpeedPreset;
  ampPreset: AmpPreset;
}

export const DEFAULT_VIDEO_DURATION = 10;

export const DEFAULT_ANIMATION_CONFIG: AnimationConfig = {
  mode: 'none',
  speedPreset: 2,
  ampPreset: 2,
  speed: computeLoopSpeed(2, DEFAULT_VIDEO_DURATION),
  amplitude: AMP_PRESET_VALUES[2],
};

/** Default config to use when initializing the store */
export const DEFAULT_PARTICLE_CONFIG: ParticleConfig = {
  count: 3000,
  minSize: 1,
  maxSize: 1,
  color: '#ffffff',
  opacityRandomize: true,
  baseOpacity: 0.8,
  spawnDirection: 'both',
  falloffType: 'gaussian',
  falloffDistance: 40,
  falloffMode: 'absolute',
  falloffBias: 0.5,
  seed: 42,
};
