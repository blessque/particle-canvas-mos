import { create } from 'zustand';
import type { AnimationConfig, SpeedPreset, AmpPreset } from '@/types/particles';
import {
  DEFAULT_ANIMATION_CONFIG,
  DEFAULT_VIDEO_DURATION,
  AMP_PRESET_VALUES,
  computeLoopSpeed,
} from '@/types/particles';

export type VideoDuration = 5 | 10 | 30;

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
  ellipseMode: 'full' | 'half' | 'quarter';
  canvasColor: string;

  animationConfig: AnimationConfig;
  animationPlaying: boolean;
  videoDuration: VideoDuration;

  setViewport: (partial: Partial<ViewportState>) => void;
  toggleLeftPanel: () => void;
  setExportDialogOpen: (open: boolean) => void;
  setDocumentSize: (w: number, h: number) => void;
  setEllipseMode: (mode: 'full' | 'half' | 'quarter') => void;
  setCanvasColor: (c: string) => void;
  setAnimationConfig: (partial: Partial<AnimationConfig>) => void;
  setAnimationPlaying: (playing: boolean) => void;
  setVideoDuration: (d: VideoDuration) => void;
  setAnimationPresets: (speedPreset: SpeedPreset, ampPreset: AmpPreset) => void;
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
  ellipseMode: 'full',
  canvasColor: '#000000',
  animationConfig: { ...DEFAULT_ANIMATION_CONFIG, mode: 'brownian' as const },
  animationPlaying: false,
  videoDuration: DEFAULT_VIDEO_DURATION as VideoDuration,

  setViewport: (partial) =>
    set((state) => ({
      viewport: { ...state.viewport, ...partial },
    })),

  toggleLeftPanel: () =>
    set((state) => ({ leftPanelOpen: !state.leftPanelOpen })),

  setExportDialogOpen: (open) => set({ exportDialogOpen: open }),

  setDocumentSize: (w, h) =>
    set((state) => ({
      viewport: { ...state.viewport, documentWidth: w, documentHeight: h },
    })),

  setEllipseMode: (mode) => set({ ellipseMode: mode }),

  setCanvasColor: (c) => set({ canvasColor: c }),

  setAnimationConfig: (partial) =>
    set((state) => ({ animationConfig: { ...state.animationConfig, ...partial } })),

  setAnimationPlaying: (playing) => set({ animationPlaying: playing }),

  setVideoDuration: (d) =>
    set((state) => ({
      videoDuration: d,
      animationConfig: {
        ...state.animationConfig,
        speed: computeLoopSpeed(state.animationConfig.speedPreset, d),
      },
    })),

  setAnimationPresets: (speedPreset, ampPreset) =>
    set((state) => ({
      animationConfig: {
        ...state.animationConfig,
        speedPreset,
        ampPreset,
        speed: computeLoopSpeed(speedPreset, state.videoDuration),
        amplitude: AMP_PRESET_VALUES[ampPreset],
      },
    })),
}));
