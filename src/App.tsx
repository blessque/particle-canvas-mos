import { useEffect, useRef, useState } from 'react';
import type { Particle } from '@/types/particles';
import { useSceneStore } from '@/store/sceneStore';
import { useParticleStore } from '@/store/particleStore';
import { useUIStore } from '@/store/uiStore';
import { distributeParticles } from '@/engine/particleDistributor';
import { CanvasRoot } from '@/canvas/CanvasRoot';
import { Toolbar } from '@/ui/Toolbar';
import { ParticlePanel } from '@/ui/ParticlePanel';
import { ExportButton } from '@/ui/ExportButton';
import { CanvasSizeSelector } from '@/ui/CanvasSizeSelector';

export default function App() {
  const particlesRef = useRef<Particle[]>([]);
  const [renderTick, setRenderTick] = useState(0);

  const objects = useSceneStore((s) => s.objects);
  const config = useParticleStore((s) => s.config);
  const viewport = useUIStore((s) => s.viewport);

  // Recompute particles whenever scene objects or particle config change
  useEffect(() => {
    particlesRef.current = distributeParticles(objects, config);
    setRenderTick((t) => t + 1);
  }, [objects, config]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#111112] text-white">
      {/* Left sidebar */}
      <aside className="w-56 shrink-0 flex flex-col border-r border-white/10 overflow-hidden">
        <div className="px-3 py-4 border-b border-white/10">
          <img src="/logo.svg" alt="Particle Canvas" className="h-9 w-auto" />
        </div>
        <div className="flex-1 overflow-y-auto min-h-0">
          <Toolbar />
          <ParticlePanel />
          <CanvasSizeSelector />
        </div>
        <ExportButton
          getParticles={() => particlesRef.current}
          getConfig={() => useParticleStore.getState().config}
          docWidth={viewport.documentWidth}
          docHeight={viewport.documentHeight}
        />
      </aside>

      {/* Canvas area */}
      <main className="flex-1 overflow-hidden bg-[#111112] p-6">
        <CanvasRoot particlesRef={particlesRef} renderTick={renderTick} />
      </main>
    </div>
  );
}
