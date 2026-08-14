import { useState } from 'react';
import type { ParticleConfig, AnimatedParticle, AnimationConfig } from '@/types/particles';
import { exportVideo } from '@/export/exportVideo';
import { ExportSizeDialog } from '@/ui/ExportSizeDialog';
import { Switcher } from '@/ui/Switcher';
import { InlineRow } from '@/ui/InlineRow';
import { useSequenceExport } from '@/ui/useSequenceExport';
import { useUIStore } from '@/store/uiStore';
import type { VideoDuration } from '@/store/uiStore';

type Scale = 1 | 2;
type FPS = 30 | 60;

const BUTTON_CLASS =
  'bg-[#202226] text-white rounded-[8px] h-[44px] w-full font-cond-regular text-[18px] hover:opacity-90 disabled:opacity-40 transition-opacity';

interface VideoExportCardProps {
  getAnimatedParticles: () => AnimatedParticle[];
  getConfig: () => ParticleConfig;
  getAnimationConfig: () => AnimationConfig;
  getCanvasColor: () => string;
  docWidth: number;
  docHeight: number;
}

export function VideoExportCard({
  getAnimatedParticles,
  getConfig,
  getAnimationConfig,
  getCanvasColor,
  docWidth,
  docHeight,
}: VideoExportCardProps) {
  const [exportingVideo, setExportingVideo] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);

  const videoDuration = useUIStore((s) => s.videoDuration);
  const setVideoDuration = useUIStore((s) => s.setVideoDuration);

  const [videoScale, setVideoScale] = useState<Scale>(1);
  const [videoFPS, setVideoFPS] = useState<FPS>(30);

  const sequence = useSequenceExport({
    getAnimatedParticles,
    getConfig,
    getAnimationConfig,
    getOptions: () => ({ scale: videoScale, fps: videoFPS, duration: videoDuration }),
    docWidth,
    docHeight,
  });

  const sequenceFrames = videoDuration * videoFPS;
  const busy = exportingVideo || sequence.exporting;

  async function handleVideo() {
    if (busy) return;
    setExportingVideo(true);
    setVideoProgress(0);
    try {
      await exportVideo(
        getAnimatedParticles(),
        getAnimationConfig(),
        getConfig(),
        docWidth,
        docHeight,
        { scale: videoScale, fps: videoFPS, duration: videoDuration, canvasColor: getCanvasColor() },
        setVideoProgress,
      );
    } catch (err) {
      console.error('Video export failed:', err);
      alert('Ошибка экспорта видео. Проверьте консоль.');
    } finally {
      setExportingVideo(false);
      setVideoProgress(0);
    }
  }

  const progress = exportingVideo ? videoProgress : sequence.progress;

  return (
    <>
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

        <div className="flex flex-col gap-[6px]">
          <button onClick={handleVideo} disabled={busy} className={BUTTON_CLASS}>
            {exportingVideo ? `Экспорт ${Math.round(videoProgress * 100)}%` : 'Скачать MP4'}
          </button>

          <button onClick={sequence.start} disabled={busy} className={BUTTON_CLASS}>
            {sequence.exporting
              ? `Экспорт ${Math.round(sequence.progress * 100)}%`
              : `Скачать ${sequenceFrames} кадров`}
          </button>
        </div>

        {busy && (
          <div className="w-full h-1 bg-[#202226] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#4d535e] transition-all"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
        )}
      </div>

      {sequence.pendingEstimate && (
        <ExportSizeDialog
          estimate={sequence.pendingEstimate}
          onConfirm={sequence.confirm}
          onCancel={sequence.cancel}
        />
      )}
    </>
  );
}
