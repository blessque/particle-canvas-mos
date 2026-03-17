import { useState } from 'react';
import type { Particle, ParticleConfig, AnimatedParticle, AnimationConfig } from '@/types/particles';
import { exportPNG } from '@/export/exportPNG';
import { exportSVG } from '@/export/exportSVG';
import { exportVideo } from '@/export/exportVideo';
import { SPREAD_DURATION } from '@/engine/animationEngine';

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
type Duration = 5 | 10 | 30;

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

  const [pngScale, setPngScale] = useState<Scale>(1);
  const [videoScale, setVideoScale] = useState<Scale>(1);
  const [videoFPS, setVideoFPS] = useState<FPS>(30);
  const [videoDuration, setVideoDuration] = useState<Duration>(10);

  const animConfig = getAnimationConfig();
  const hasAnimation = animConfig.mode !== 'none';
  const isSpread = animConfig.mode === 'spread';

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
          duration: isSpread ? SPREAD_DURATION : videoDuration,
          canvasColor: getCanvasColor(),
        },
        setVideoProgress,
      );
    } finally {
      setExportingVideo(false);
      setVideoProgress(0);
    }
  }

  function ScaleToggle({ value, onChange }: { value: Scale; onChange: (v: Scale) => void }) {
    return (
      <div className="flex gap-1">
        {([1, 2] as Scale[]).map((s) => (
          <button
            key={s}
            onClick={() => onChange(s)}
            className={`text-xs px-2 py-1 rounded transition-colors ${
              value === s
                ? 'bg-white/20 text-white'
                : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/70'
            }`}
          >
            {s}×
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-3 border-t border-white/10">
      {/* PNG section */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-white/40 uppercase tracking-widest">PNG</p>
          <ScaleToggle value={pngScale} onChange={setPngScale} />
        </div>
        <button
          onClick={handlePNG}
          disabled={exportingPNG}
          className="w-full text-base bg-white hover:bg-white/90 disabled:opacity-40 text-black font-medium rounded px-3 py-2.5 transition-colors"
        >
          {exportingPNG ? 'Экспорт...' : 'Скачать PNG'}
        </button>
        <button
          onClick={handleSVG}
          className="w-full text-base bg-white/10 hover:bg-white/20 text-white/80 rounded px-3 py-2.5 transition-colors"
        >
          Скачать SVG
        </button>
      </div>

      {/* Video section — visible only when animation is active */}
      {hasAnimation && (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] text-white/40 uppercase tracking-widest">Видео</p>

          <div className="flex items-center justify-between text-[13px] text-white/60">
            <span>Масштаб</span>
            <ScaleToggle value={videoScale} onChange={setVideoScale} />
          </div>

          <div className="flex items-center justify-between text-[13px] text-white/60">
            <span>Кадров/с</span>
            <div className="flex gap-1">
              {([30, 60] as FPS[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setVideoFPS(f)}
                  className={`text-xs px-2 py-1 rounded transition-colors ${
                    videoFPS === f
                      ? 'bg-white/20 text-white'
                      : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/70'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {!isSpread && (
            <div className="flex items-center justify-between text-[13px] text-white/60">
              <span>Длительность</span>
              <div className="flex gap-1">
                {([5, 10, 30] as Duration[]).map((d) => (
                  <button
                    key={d}
                    onClick={() => setVideoDuration(d)}
                    className={`text-xs px-2 py-1 rounded transition-colors ${
                      videoDuration === d
                        ? 'bg-white/20 text-white'
                        : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/70'
                    }`}
                  >
                    {d}с
                  </button>
                ))}
              </div>
            </div>
          )}

          {isSpread && (
            <p className="text-[11px] text-white/30">Длительность: {SPREAD_DURATION}с (фиксировано)</p>
          )}

          <button
            onClick={handleVideo}
            disabled={exportingVideo}
            className="w-full text-base bg-white/10 hover:bg-white/20 disabled:opacity-40 text-white/80 rounded px-3 py-2.5 transition-colors"
          >
            {exportingVideo
              ? `Экспорт ${Math.round(videoProgress * 100)}%`
              : 'Скачать MP4'}
          </button>

          {exportingVideo && (
            <div className="w-full h-1 bg-white/10 rounded overflow-hidden">
              <div
                className="h-full bg-white/60 transition-all"
                style={{ width: `${Math.round(videoProgress * 100)}%` }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
