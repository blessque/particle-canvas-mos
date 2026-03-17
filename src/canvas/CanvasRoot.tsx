import { useEffect, useRef, useCallback } from 'react';
import type { Particle, AnimatedParticle } from '@/types/particles';
import type { ToolCallbacks } from '@/types/tools';
import { useSceneStore } from '@/store/sceneStore';
import { useToolStore } from '@/store/toolStore';
import { useUIStore } from '@/store/uiStore';
import { useParticleStore } from '@/store/particleStore';
import { screenToCanvas, canvasToDocument } from '@/utils/coordinates';
import { getToolInstance } from '@/tools/toolRegistry';
import { computeFrame, isSpreadComplete } from '@/engine/animationEngine';
import { renderScene } from './SceneRenderer';
import { renderParticles } from './ParticleRenderer';
import { renderHandles } from './HandleRenderer';

interface CanvasRootProps {
  particlesRef: React.RefObject<Particle[]>;
  animatedParticlesRef: React.RefObject<AnimatedParticle[]>;
  renderTick: number;
  canvasColor: string;
}

export function CanvasRoot({ particlesRef, animatedParticlesRef, renderTick, canvasColor }: CanvasRootProps) {
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
  const animationConfig = useUIStore((s) => s.animationConfig);
  const animationPlaying = useUIStore((s) => s.animationPlaying);
  const setAnimationPlaying = useUIStore((s) => s.setAnimationPlaying);

  // Always-fresh ref for draw function (avoids stale closures in rAF)
  const drawFnRef = useRef<((particles: Particle[]) => void) | null>(null);
  // Always-fresh ref for animation config (avoids restarting loop on slider change)
  const animConfigRef = useRef(animationConfig);
  const rafRef = useRef(0);
  const startTimeRef = useRef(0);

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

  // Keep drawFnRef always pointing to latest closure (no deps = runs every render)
  useEffect(() => {
    drawFnRef.current = (particlesToDraw: Particle[]) => {
      const canvas = canvasRef.current;
      if (!canvas || viewport.canvasWidth === 0) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);

      const vp = viewport;
      const s = Math.min(vp.canvasWidth / vp.documentWidth, vp.canvasHeight / vp.documentHeight);
      const offsetX = (vp.canvasWidth - vp.documentWidth * s) / 2;
      const offsetY = (vp.canvasHeight - vp.documentHeight * s) / 2;
      ctx.fillStyle = canvasColor;
      ctx.fillRect(offsetX, offsetY, vp.documentWidth * s, vp.documentHeight * s);

      if (showOutlines) renderScene(ctx, objects, viewport);
      renderParticles(ctx, particlesToDraw, config, viewport);
      renderHandles(ctx, toolState, objects, viewport, ellipseMode);

      ctx.restore();
    };
  }); // intentionally no deps — keeps closure fresh without restarting rAF

  // Keep animConfigRef fresh for rAF loop
  useEffect(() => { animConfigRef.current = animationConfig; }); // no deps

  // Static render — skip when rAF loop is running
  useEffect(() => {
    if (animationPlaying && animationConfig.mode !== 'none') return;
    drawFnRef.current?.(particlesRef.current ?? []);
  }, [renderTick, objects, toolState, viewport, config, showOutlines, ellipseMode, canvasColor,
      animationPlaying, animationConfig.mode]);

  // rAF animation loop
  useEffect(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = 0; }

    if (!animationPlaying || animationConfig.mode === 'none') {
      drawFnRef.current?.(particlesRef.current ?? []);
      return;
    }

    startTimeRef.current = performance.now();

    function loop(now: number) {
      const elapsed = (now - startTimeRef.current) / 1000;
      const cfg = animConfigRef.current;

      if (cfg.mode !== 'spread' && elapsed > 30) {
        setAnimationPlaying(false);
        return;
      }
      if (cfg.mode === 'spread' && isSpreadComplete(elapsed)) {
        setAnimationPlaying(false);
        drawFnRef.current?.(particlesRef.current ?? []);
        return;
      }

      const animated = animatedParticlesRef.current;
      const displaced = animated?.length
        ? computeFrame(animated, cfg, elapsed)
        : (particlesRef.current ?? []);

      drawFnRef.current?.(displaced);
      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(rafRef.current); rafRef.current = 0; };
  }, [animationPlaying]); // Only animationPlaying triggers start/stop

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

      if (e.code === 'Space' && !inInput) {
        e.preventDefault();
        const { animationConfig, animationPlaying, setAnimationPlaying } = useUIStore.getState();
        if (animationConfig.mode !== 'none') setAnimationPlaying(!animationPlaying);
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
