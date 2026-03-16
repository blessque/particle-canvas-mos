import { useEffect, useRef, useCallback } from 'react';
import type { Particle } from '@/types/particles';
import type { ToolCallbacks } from '@/types/tools';
import { useSceneStore } from '@/store/sceneStore';
import { useToolStore } from '@/store/toolStore';
import { useUIStore } from '@/store/uiStore';
import { useParticleStore } from '@/store/particleStore';
import { screenToCanvas, canvasToDocument } from '@/utils/coordinates';
import { getToolInstance } from '@/tools/toolRegistry';
import { renderScene } from './SceneRenderer';
import { renderParticles } from './ParticleRenderer';
import { renderHandles } from './HandleRenderer';

interface CanvasRootProps {
  particlesRef: React.RefObject<Particle[]>;
  renderTick: number;
  canvasColor: string;
}

export function CanvasRoot({ particlesRef, renderTick, canvasColor }: CanvasRootProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const objects = useSceneStore((s) => s.objects);
  const toolState = useToolStore((s) => ({
    activeTool: s.activeTool,
    isDrawing: s.isDrawing,
    drawStart: s.drawStart,
    drawCurrent: s.drawCurrent,
    shiftHeld: s.shiftHeld,
    selectedObjectIds: s.selectedObjectIds,
    pendingPath: s.pendingPath,
  }));
  const viewport = useUIStore((s) => s.viewport);
  const setViewport = useUIStore((s) => s.setViewport);
  const showOutlines = useUIStore((s) => s.showOutlines);
  const ellipseMode = useUIStore((s) => s.ellipseMode);
  const config = useParticleStore((s) => s.config);

  // Build tool callbacks (stable reference via useCallback)
  const getCallbacks = useCallback((): ToolCallbacks => ({
    addObject: (obj) => useSceneStore.getState().addObject(obj),
    updateObject: (id, partial) => useSceneStore.getState().updateObject(id, partial),
    deleteObject: (id) => useSceneStore.getState().removeObject(id),
    setToolState: (partial) => {
      const s = useToolStore.getState();
      if ('isDrawing'          in partial) s.setDrawing(partial.isDrawing!);
      if ('drawStart'          in partial) s.setDrawStart(partial.drawStart ?? null);
      if ('drawCurrent'        in partial) s.setDrawCurrent(partial.drawCurrent ?? null);
      if ('selectedObjectIds'  in partial) s.selectObjects(partial.selectedObjectIds!);
      if ('activeTool'         in partial) s.setActiveTool(partial.activeTool!);
      if ('pendingPath'        in partial) s.setPendingPath(partial.pendingPath ?? null);
    },
    getToolState: () => useToolStore.getState(),
    getObjects: () => useSceneStore.getState().objects,
    getScale: () => {
      const vp = useUIStore.getState().viewport;
      return Math.min(vp.canvasWidth / vp.documentWidth, vp.canvasHeight / vp.documentHeight);
    },
  }), []);

  // Resize observer — keeps canvas pixel size and viewport in sync
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      setViewport({ canvasWidth: width, canvasHeight: height });
    });

    observer.observe(wrapper);
    return () => observer.disconnect();
  }, [setViewport]);

  // Render loop — fires whenever tick, objects, toolState, or viewport changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || viewport.canvasWidth === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(dpr, dpr);

    // Draw dark document background
    const vp = viewport;
    const scale = Math.min(vp.canvasWidth / vp.documentWidth, vp.canvasHeight / vp.documentHeight);
    const offsetX = (vp.canvasWidth - vp.documentWidth * scale) / 2;
    const offsetY = (vp.canvasHeight - vp.documentHeight * scale) / 2;
    ctx.fillStyle = canvasColor;
    ctx.fillRect(offsetX, offsetY, vp.documentWidth * scale, vp.documentHeight * scale);

    if (showOutlines) renderScene(ctx, objects, viewport);
    renderParticles(ctx, particlesRef.current ?? [], config, viewport);
    renderHandles(ctx, toolState, objects, viewport, ellipseMode);

    ctx.restore();
  }, [renderTick, objects, toolState, viewport, config, particlesRef, showOutlines, ellipseMode, canvasColor]);

  // Pointer handlers
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    const canvasPt = screenToCanvas(e.nativeEvent, canvas);
    const docPt = canvasToDocument(canvasPt, useUIStore.getState().viewport);
    const tool = getToolInstance(useToolStore.getState().activeTool);
    tool.onPointerDown(e.nativeEvent, docPt, getCallbacks());
    canvas.style.cursor = tool.getCursor();
  }, [getCallbacks]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const canvasPt = screenToCanvas(e.nativeEvent, canvas);
    const docPt = canvasToDocument(canvasPt, useUIStore.getState().viewport);
    const tool = getToolInstance(useToolStore.getState().activeTool);
    tool.onPointerMove(e.nativeEvent, docPt, getCallbacks());
    // Update cursor imperatively so handle hover works without triggering a re-render
    canvas.style.cursor = tool.getCursor();
  }, [getCallbacks]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const canvasPt = screenToCanvas(e.nativeEvent, canvas);
    const docPt = canvasToDocument(canvasPt, useUIStore.getState().viewport);
    const tool = getToolInstance(useToolStore.getState().activeTool);
    tool.onPointerUp(e.nativeEvent, docPt, getCallbacks());
    canvas.style.cursor = tool.getCursor();
  }, [getCallbacks]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName;
      const inInput = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';

      // ⌥O cycles ellipse arc mode (full → half → quarter → full)
      if (e.code === 'KeyO' && e.altKey) {
        const modes = ['full', 'half', 'quarter'] as const;
        const current = useUIStore.getState().ellipseMode;
        const idx = modes.indexOf(current);
        useUIStore.getState().setEllipseMode(modes[(idx + 1) % modes.length]!);
        return;
      }

      // Tool hotkeys always work — even when a slider is focused
      const hotkeyMap: Record<string, 'select' | 'rectangle' | 'ellipse' | 'star' | 'freehand'> = {
        KeyV: 'select',
        KeyR: 'rectangle',
        KeyO: 'ellipse',
        KeyS: 'star',
        KeyF: 'freehand',
      };

      const nextTool = hotkeyMap[e.code];
      if (nextTool) {
        useToolStore.getState().setActiveTool(nextTool);
        return;
      }

      if (inInput) return; // block Delete/Backspace etc. in inputs

      if (e.key === 'Shift') {
        useToolStore.getState().setShiftHeld(true);
      }

      // Delegate to active tool
      const tool = getToolInstance(useToolStore.getState().activeTool);
      tool.onKeyDown?.(e, getCallbacks());
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        useToolStore.getState().setShiftHeld(false);
      }
      const tool = getToolInstance(useToolStore.getState().activeTool);
      tool.onKeyUp?.(e, getCallbacks());
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [getCallbacks]);

  const cursor = getToolInstance(toolState.activeTool).getCursor();

  return (
    <div ref={wrapperRef} className="w-full h-full">
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', cursor, display: 'block' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />
    </div>
  );
}
