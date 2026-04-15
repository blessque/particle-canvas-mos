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


  // Recompute particles whenever scene objects or particle config change
  useEffect(() => {
    particlesRef.current = distributeParticles(objects, config);
    setRenderTick((t) => t + 1);
  }, [objects, config]);

  // Re-prep animated particles whenever particles change
  useEffect(() => {
    const allSamples = objects.flatMap(sampleShapeOutline);
    if (!allSamples.length || !particlesRef.current.length) { animatedParticlesRef.current = []; return; }
    animatedParticlesRef.current = prepareAnimatedParticles(
      particlesRef.current, allSamples,
      config.falloffDistance, config.seed + 9999,
    );
  }, [renderTick, objects, config.falloffDistance, config.seed]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-black text-white">
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left sidebar */}
        <aside className="w-60 shrink-0 overflow-y-auto no-scrollbar">
          <div className="flex flex-col gap-2 px-2 py-3">
            <ParticlePanel />
          </div>
        </aside>

        {/* Canvas area */}
        <main className="flex-1 overflow-hidden bg-black p-6">
          <CanvasRoot
            particlesRef={particlesRef}
            animatedParticlesRef={animatedParticlesRef}
            renderTick={renderTick}
            canvasColor={canvasColor}
          />
        </main>

        {/* Right panel */}
        <aside className="w-60 shrink-0 overflow-y-auto no-scrollbar">
          <div className="flex flex-col gap-2 px-2 py-3">
            <RightPanel />
            <ExportButton
              getParticles={() => particlesRef.current}
              getAnimatedParticles={() => animatedParticlesRef.current}
              getConfig={() => useParticleStore.getState().config}
              getAnimationConfig={() => useUIStore.getState().animationConfig}
              getCanvasColor={() => useUIStore.getState().canvasColor}
              docWidth={viewport.documentWidth}
              docHeight={viewport.documentHeight}
            />
          </div>
        </aside>
      </div>

      {/* Bottom bar */}
      <BottomBar />
    </div>
  );
}
