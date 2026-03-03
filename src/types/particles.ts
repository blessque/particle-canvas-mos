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

/** Default config to use when initializing the store */
export const DEFAULT_PARTICLE_CONFIG: ParticleConfig = {
  count: 3000,
  minSize: 1,
  maxSize: 3,
  color: '#ffffff',
  opacityRandomize: true,
  baseOpacity: 0.8,
  spawnDirection: 'outside',
  falloffType: 'gaussian',
  falloffDistance: 40,
  falloffBias: 0.5,
  seed: 42,
};
