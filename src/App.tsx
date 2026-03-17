import { useEffect, useRef, useState } from 'react';
import type { Particle, AnimatedParticle } from '@/types/particles';
import { useSceneStore } from '@/store/sceneStore';
import { useParticleStore } from '@/store/particleStore';
import { useUIStore } from '@/store/uiStore';
import { distributeParticles } from '@/engine/particleDistributor';
import { sampleShapeOutline } from '@/engine/shapeGeometry';
import { prepareAnimatedParticles } from '@/engine/animationEngine';
import { CanvasRoot } from '@/canvas/CanvasRoot';
import { ParticlePanel } from '@/ui/ParticlePanel';
import { RightPanel } from '@/ui/RightPanel';
import { ExportButton } from '@/ui/ExportButton';
import { BottomBar } from '@/ui/BottomBar';

export default function App() {
  const particlesRef = useRef<Particle[]>([]);
  const animatedParticlesRef = useRef<AnimatedParticle[]>([]);
  const [renderTick, setRenderTick] = useState(0);

  const objects = useSceneStore((s) => s.objects);
  const config = useParticleStore((s) => s.config);
  const viewport = useUIStore((s) => s.viewport);
  const canvasColor = useUIStore((s) => s.canvasColor);
  const animationConfig = useUIStore((s) => s.animationConfig);

  // Recompute particles whenever scene objects or particle config change
  useEffect(() => {
    particlesRef.current = distributeParticles(objects, config);
    setRenderTick((t) => t + 1);
  }, [objects, config]);

  // Re-prep animated particles whenever particles change or animation mode changes
  useEffect(() => {
    if (animationConfig.mode === 'none') { animatedParticlesRef.current = []; return; }
    const allSamples = objects.flatMap(sampleShapeOutline);
    if (!allSamples.length || !particlesRef.current.length) { animatedParticlesRef.current = []; return; }
    animatedParticlesRef.current = prepareAnimatedParticles(
      particlesRef.current, allSamples,
      config.falloffDistance, config.seed + 9999,
    );
  }, [renderTick, objects, animationConfig.mode, config.falloffDistance, config.seed]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#111112] text-white">
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left sidebar */}
        <aside className="w-56 shrink-0 flex flex-col border-r border-white/10 overflow-hidden">
          <div className="px-3 py-4 border-b border-white/10 shrink-0">
            <img src="/logo.svg" alt="Particle Canvas" className="h-9 w-auto" />
          </div>
          <div className="flex-1 overflow-y-auto no-scrollbar min-h-0">
            <ParticlePanel />
          </div>
        </aside>

        {/* Canvas area */}
        <main className="flex-1 overflow-hidden bg-[#111112] p-6">
          <CanvasRoot
            particlesRef={particlesRef}
            animatedParticlesRef={animatedParticlesRef}
            renderTick={renderTick}
            canvasColor={canvasColor}
          />
        </main>

        {/* Right panel */}
        <aside className="w-64 shrink-0 flex flex-col border-l border-white/10 overflow-hidden">
          <div className="flex-1 overflow-y-auto no-scrollbar min-h-0">
            <RightPanel />
          </div>
          <ExportButton
            getParticles={() => particlesRef.current}
            getAnimatedParticles={() => animatedParticlesRef.current}
            getConfig={() => useParticleStore.getState().config}
            getAnimationConfig={() => useUIStore.getState().animationConfig}
            getCanvasColor={() => useUIStore.getState().canvasColor}
            docWidth={viewport.documentWidth}
            docHeight={viewport.documentHeight}
          />
        </aside>
      </div>

      {/* Bottom bar */}
      <BottomBar />
    </div>
  );
}
