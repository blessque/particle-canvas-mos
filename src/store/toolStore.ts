import { create } from 'zustand';
import type { Point } from '@/types/geometry';
import type { ToolType } from '@/types/tools';

interface ToolStoreState {
  activeTool: ToolType;
  isDrawing: boolean;
  drawStart: Point | null;
  drawCurrent: Point | null;
  shiftHeld: boolean;
  selectedObjectIds: string[];

  setActiveTool: (tool: ToolType) => void;
  setDrawing: (isDrawing: boolean) => void;
  setDrawStart: (point: Point | null) => void;
  setDrawCurrent: (point: Point | null) => void;
  setShiftHeld: (held: boolean) => void;
  selectObjects: (ids: string[]) => void;
  clearSelection: () => void;
}

export const useToolStore = create<ToolStoreState>((set) => ({
  activeTool: 'select',
  isDrawing: false,
  drawStart: null,
  drawCurrent: null,
  shiftHeld: false,
  selectedObjectIds: [],

  setActiveTool: (tool) => set({ activeTool: tool }),
  setDrawing: (isDrawing) => set({ isDrawing }),
  setDrawStart: (point) => set({ drawStart: point }),
  setDrawCurrent: (point) => set({ drawCurrent: point }),
  setShiftHeld: (held) => set({ shiftHeld: held }),
  selectObjects: (ids) => set({ selectedObjectIds: ids }),
  clearSelection: () => set({ selectedObjectIds: [] }),
}));
