import { create } from 'zustand';
import type { SceneObject } from '@/types/scene';

interface SceneStoreState {
  objects: SceneObject[];
  booleanMode: 'union' | 'independent';
  past: SceneObject[][];
  future: SceneObject[][];

  addObject: (obj: SceneObject) => void;
  updateObject: (id: string, partial: Partial<SceneObject>) => void;
  removeObject: (id: string) => void;
  reorderObject: (id: string, direction: 'up' | 'down') => void;
  setBooleanMode: (mode: 'union' | 'independent') => void;
  clearAll: () => void;
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
}

function cloneObjects(objects: SceneObject[]): SceneObject[] {
  return objects.map((obj) => {
    if (obj.type === 'freehand')
      return { ...obj, path: { ...obj.path, segments: [...obj.path.segments] } };
    if (obj.type === 'svg-import')
      return { ...obj, paths: obj.paths.map((p) => ({ ...p, segments: [...p.segments] })) };
    return { ...obj };
  });
}

const MAX_HISTORY = 50;

export const useSceneStore = create<SceneStoreState>((set) => ({
  objects: [],
  booleanMode: 'independent',
  past: [],
  future: [],

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

  pushHistory: () =>
    set((s) => ({
      past: [...s.past, cloneObjects(s.objects)].slice(-MAX_HISTORY),
      future: [],
    })),

  undo: () =>
    set((s) => {
      if (!s.past.length) return s;
      const prev = s.past[s.past.length - 1]!;
      return {
        objects: prev,
        past: s.past.slice(0, -1),
        future: [cloneObjects(s.objects), ...s.future].slice(0, MAX_HISTORY),
      };
    }),

  redo: () =>
    set((s) => {
      if (!s.future.length) return s;
      const next = s.future[0]!;
      return {
        objects: next,
        past: [...s.past, cloneObjects(s.objects)].slice(-MAX_HISTORY),
        future: s.future.slice(1),
      };
    }),
}));
