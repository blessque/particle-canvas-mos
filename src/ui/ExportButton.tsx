import { useState } from 'react';
import type { Particle, ParticleConfig, AnimatedParticle, AnimationConfig } from '@/types/particles';
import { exportPNG } from '@/export/exportPNG';
import { exportSVG } from '@/export/exportSVG';
import { VideoExportCard } from '@/ui/VideoExportCard';
import { Switcher } from '@/ui/Switcher';
import { InlineRow } from '@/ui/InlineRow';

interface ExportButtonProps {
  getParticles: () => Particle[];
  getAnimatedParticles: () => AnimatedParticle[];
  getConfig: () => ParticleConfig;
  getAnimationConfig: () => AnimationConfig;
  getCanvasColor: () => string;
  docWidth: number;
  docHeight: number;
}

type Scale = 1 | 2;

export function ExportButton({
  getParticles,
  getAnimatedParticles,
  getConfig,
  getAnimationConfig,
  getCanvasColor,
  docWidth,
  docHeight,
}: ExportButtonProps) {
  const [exportingPNG, setExportingPNG] = useState(false);
  const [pngScale, setPngScale] = useState<Scale>(1);

  async function handlePNG() {
    if (exportingPNG) return;
    setExportingPNG(true);
    try {
      await exportPNG(getParticles(), getConfig(), docWidth, docHeight, pngScale);
    } finally {
      setExportingPNG(false);
    }
  }

  function handleSVG() {
    exportSVG(getParticles(), getConfig(), docWidth, docHeight);
  }

  return (
    <>
      {/* Картинка card */}
      <div className="bg-[#0e0f11] rounded-[22px] p-3 flex flex-col gap-4">
        <h2 className="font-cond-black font-black text-[24px] text-[#252931] uppercase leading-none">Картинка</h2>

        <InlineRow label="Масштаб PNG">
          <Switcher<Scale>
            value={pngScale}
            options={[{ value: 1, label: '1×' }, { value: 2, label: '2×' }]}
            onChange={setPngScale}
          />
        </InlineRow>

        <div className="flex flex-col gap-[6px]">
          <button
            onClick={handlePNG}
            disabled={exportingPNG}
            className="bg-white text-[#0e0f11] rounded-[8px] h-[44px] w-full font-cond-regular text-[18px] hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            {exportingPNG ? 'Экспорт...' : 'Скачать PNG'}
          </button>

          <button
            onClick={handleSVG}
            className="bg-[#202226] text-white rounded-[8px] h-[44px] w-full font-cond-regular text-[18px] hover:opacity-90 transition-opacity"
          >
            Скачать SVG
          </button>
        </div>
      </div>

      {/* Видео card */}
      <VideoExportCard
        getAnimatedParticles={getAnimatedParticles}
        getConfig={getConfig}
        getAnimationConfig={getAnimationConfig}
        getCanvasColor={getCanvasColor}
        docWidth={docWidth}
        docHeight={docHeight}
      />
    </>
  );
}
