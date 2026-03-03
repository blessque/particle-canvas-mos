import { create } from 'zustand';
import type { ParticleConfig } from '@/types/particles';
import { DEFAULT_PARTICLE_CONFIG } from '@/types/particles';

interface ParticleStoreState {
  config: ParticleConfig;

  updateConfig: (partial: Partial<ParticleConfig>) => void;
  resetConfig: () => void;
  randomizeSeed: () => void;
}

export const useParticleStore = create<ParticleStoreState>((set) => ({
  config: { ...DEFAULT_PARTICLE_CONFIG },

  updateConfig: (partial) =>
    set((state) => ({
      config: { ...state.config, ...partial },
    })),

  resetConfig: () =>
    set({ config: { ...DEFAULT_PARTICLE_CONFIG } }),

  randomizeSeed: () =>
    set((state) => ({
      config: { ...state.config, seed: Math.floor(Math.random() * 2147483647) },
    })),
}));
