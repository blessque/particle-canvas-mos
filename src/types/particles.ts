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

export interface AnimationConfig {
  mode: AnimationMode;
  speed: number;
  amplitude: number;
}

export const DEFAULT_ANIMATION_CONFIG: AnimationConfig = {
  mode: 'none',
  speed: 1.0,
  amplitude: 15,
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
  falloffBias: 0.5,
  seed: 42,
};
