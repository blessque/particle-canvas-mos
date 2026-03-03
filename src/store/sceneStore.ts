import { create } from 'zustand';
import type { SceneObject } from '@/types/scene';

interface SceneStoreState {
  objects: SceneObject[];
  booleanMode: 'union' | 'independent';

  addObject: (obj: SceneObject) => void;
  updateObject: (id: string, partial: Partial<SceneObject>) => void;
  removeObject: (id: string) => void;
  reorderObject: (id: string, direction: 'up' | 'down') => void;
  setBooleanMode: (mode: 'union' | 'independent') => void;
  clearAll: () => void;
}

export const useSceneStore = create<SceneStoreState>((set) => ({
  objects: [],
  booleanMode: 'independent',

  addObject: (obj) =>
    set((state) => ({
      objects: [...state.objects, obj],
    })),

  updateObject: (id, partial) =>
    set((state) => ({
      objects: state.objects.map((obj) =>
        obj.id === id ? ({ ...obj, ...partial } as SceneObject) : obj
      ),
    })),

  removeObject: (id) =>
    set((state) => ({
      objects: state.objects.filter((obj) => obj.id !== id),
    })),

  reorderObject: (id, direction) =>
    set((state) => {
      const idx = state.objects.findIndex((obj) => obj.id === id);
      if (idx === -1) return state;
      const newIdx = direction === 'up' ? idx + 1 : idx - 1;
      if (newIdx < 0 || newIdx >= state.objects.length) return state;
      const next = [...state.objects];
      [next[idx]!, next[newIdx]!] = [next[newIdx]!, next[idx]!];
      return { objects: next };
    }),

  setBooleanMode: (mode) => set({ booleanMode: mode }),

  clearAll: () => set({ objects: [] }),
}));
