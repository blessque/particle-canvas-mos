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
      <aside className="w-56 shrink-0 flex flex-col bg-slate-900 border-r border-slate-700/60 overflow-hidden">
        <div className="px-3 py-3 border-b border-white/10">
          <h1 className="text-sm font-semibold tracking-wide text-white/80">Particle Canvas</h1>
        </div>
        <Toolbar />
        <ParticlePanel />
        <CanvasSizeSelector />
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
