import { create } from 'zustand';

export interface ViewportState {
  zoom: number;
  panX: number;
  panY: number;
  documentWidth: number;
  documentHeight: number;
  canvasWidth: number;
  canvasHeight: number;
}

interface UIStoreState {
  viewport: ViewportState;
  leftPanelOpen: boolean;
  exportDialogOpen: boolean;
  showOutlines: boolean;
  ellipseMode: 'full' | 'half' | 'quarter';

  setViewport: (partial: Partial<ViewportState>) => void;
  toggleLeftPanel: () => void;
  setExportDialogOpen: (open: boolean) => void;
  setShowOutlines: (v: boolean) => void;
  setDocumentSize: (w: number, h: number) => void;
  setEllipseMode: (mode: 'full' | 'half' | 'quarter') => void;
}

export const useUIStore = create<UIStoreState>((set) => ({
  viewport: {
    zoom: 1,
    panX: 0,
    panY: 0,
    documentWidth: 1080,
    documentHeight: 1080,
    canvasWidth: 0,
    canvasHeight: 0,
  },
  leftPanelOpen: true,
  exportDialogOpen: false,
  showOutlines: true,
  ellipseMode: 'full',

  setViewport: (partial) =>
    set((state) => ({
      viewport: { ...state.viewport, ...partial },
    })),

  toggleLeftPanel: () =>
    set((state) => ({ leftPanelOpen: !state.leftPanelOpen })),

  setExportDialogOpen: (open) => set({ exportDialogOpen: open }),

  setShowOutlines: (v) => set({ showOutlines: v }),

  setDocumentSize: (w, h) =>
    set((state) => ({
      viewport: { ...state.viewport, documentWidth: w, documentHeight: h },
    })),

  setEllipseMode: (mode) => set({ ellipseMode: mode }),
}));
