import { useState } from 'react';
import type { Particle, ParticleConfig, AnimatedParticle, AnimationConfig } from '@/types/particles';
import { exportPNG } from '@/export/exportPNG';
import { exportSVG } from '@/export/exportSVG';
import { exportVideo } from '@/export/exportVideo';
import { useUIStore } from '@/store/uiStore';
import type { VideoDuration } from '@/store/uiStore';

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
type FPS = 30 | 60;

function Switcher<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  function radius(i: number) {
    const last = options.length - 1;
    if (options.length === 1) return 'rounded-[8px]';
    if (i === 0) return 'rounded-tl-[8px] rounded-bl-[8px] rounded-tr-[2px] rounded-br-[2px]';
    if (i === last) return 'rounded-tr-[8px] rounded-br-[8px] rounded-tl-[2px] rounded-bl-[2px]';
    return 'rounded-[2px]';
  }

  return (
    <div className="flex gap-[2px]">
      {options.map((opt, i) => (
        <button
          key={String(opt.value)}
          onClick={() => onChange(opt.value)}
          className={[
            'font-cond-regular text-[14px] leading-none p-[6px] flex-1 transition-colors',
            radius(i),
            value === opt.value
              ? 'bg-[#33373f] text-white'
              : 'bg-[#202226] text-[#777e8c] hover:bg-[#2a2e35] hover:text-[#9ca3b1]',
          ].join(' ')}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function InlineRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="font-cond-regular text-[14px] text-[#454a55] uppercase flex-1">{label}</span>
      {children}
    </div>
  );
}

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
  const [exportingVideo, setExportingVideo] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);

  const videoDuration = useUIStore((s) => s.videoDuration);
  const setVideoDuration = useUIStore((s) => s.setVideoDuration);

  const [pngScale, setPngScale] = useState<Scale>(1);
  const [videoScale, setVideoScale] = useState<Scale>(1);
  const [videoFPS, setVideoFPS] = useState<FPS>(30);

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

  async function handleVideo() {
    if (exportingVideo) return;
    setExportingVideo(true);
    setVideoProgress(0);
    try {
      await exportVideo(
        getAnimatedParticles(),
        getAnimationConfig(),
        getConfig(),
        docWidth,
        docHeight,
        {
          scale: videoScale,
          fps: videoFPS,
          duration: videoDuration,
          canvasColor: getCanvasColor(),
        },
        setVideoProgress,
      );
    } finally {
      setExportingVideo(false);
      setVideoProgress(0);
    }
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
      <div className="bg-[#0e0f11] rounded-[22px] p-3 flex flex-col gap-4">
        <h2 className="font-cond-black font-black text-[24px] text-[#252931] uppercase leading-none">Видео</h2>

        <InlineRow label="Масштаб MP4">
          <Switcher<Scale>
            value={videoScale}
            options={[{ value: 1, label: '1×' }, { value: 2, label: '2×' }]}
            onChange={setVideoScale}
          />
        </InlineRow>

        <InlineRow label="Кадров / с">
          <Switcher<FPS>
            value={videoFPS}
            options={[{ value: 30, label: '30' }, { value: 60, label: '60' }]}
            onChange={setVideoFPS}
          />
        </InlineRow>

        <div className="flex flex-col gap-2">
          <span className="font-cond-regular text-[14px] text-[#454a55] uppercase">Длительность</span>
          <Switcher<VideoDuration>
            value={videoDuration}
            options={[
              { value: 5, label: '5с' },
              { value: 10, label: '10с' },
              { value: 30, label: '30с' },
            ]}
            onChange={setVideoDuration}
          />
        </div>

        <button
          onClick={handleVideo}
          disabled={exportingVideo}
          className="bg-[#202226] text-white rounded-[8px] h-[44px] w-full font-cond-regular text-[18px] hover:opacity-90 disabled:opacity-40 transition-opacity"
        >
          {exportingVideo
            ? `Экспорт ${Math.round(videoProgress * 100)}%`
            : 'Скачать MP4'}
        </button>

        {exportingVideo && (
          <div className="w-full h-1 bg-[#202226] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#4d535e] transition-all"
              style={{ width: `${Math.round(videoProgress * 100)}%` }}
            />
          </div>
        )}
      </div>
    </>
  );
}
