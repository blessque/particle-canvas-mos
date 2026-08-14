import { useState } from 'react';
import type { ParticleConfig, AnimatedParticle, AnimationConfig } from '@/types/particles';
import { exportPNGSequence, probePNGSequence } from '@/export/exportPNGSequence';
import type { SequenceEstimate, PNGSequenceOptions } from '@/export/exportPNGSequence';

/** Above this projected archive size, confirm with the user before starting. */
const SIZE_WARN_BYTES = 500 * 1024 * 1024;

interface SequenceExportArgs {
  getAnimatedParticles: () => AnimatedParticle[];
  getConfig: () => ParticleConfig;
  getAnimationConfig: () => AnimationConfig;
  getOptions: () => PNGSequenceOptions;
  docWidth: number;
  docHeight: number;
}

export function useSequenceExport(args: SequenceExportArgs) {
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [pendingEstimate, setPendingEstimate] = useState<SequenceEstimate | null>(null);

  function callArgs() {
    return [
      args.getAnimatedParticles(),
      args.getAnimationConfig(),
      args.getConfig(),
      args.docWidth,
      args.docHeight,
      args.getOptions(),
    ] as const;
  }

  async function run() {
    setPendingEstimate(null);
    setExporting(true);
    setProgress(0);
    try {
      await exportPNGSequence(...callArgs(), setProgress);
    } catch (err) {
      console.error('PNG sequence export failed:', err);
      alert('Ошибка покадрового экспорта. Проверьте консоль.');
    } finally {
      setExporting(false);
      setProgress(0);
    }
  }

  async function start() {
    if (exporting) return;
    setExporting(true);

    // Encode a single frame to measure real bytes/ms for this scene, then extrapolate.
    let estimate: SequenceEstimate;
    try {
      estimate = await probePNGSequence(...callArgs());
    } catch (err) {
      console.error('PNG sequence probe failed:', err);
      alert('Ошибка покадрового экспорта. Проверьте консоль.');
      setExporting(false);
      return;
    }

    if (estimate.totalBytes > SIZE_WARN_BYTES) {
      setExporting(false);
      setPendingEstimate(estimate);
      return;
    }

    await run();
  }

  return {
    exporting,
    progress,
    pendingEstimate,
    start,
    confirm: run,
    cancel: () => setPendingEstimate(null),
  };
}
