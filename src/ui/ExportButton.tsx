import { useState } from 'react';
import type { Particle, ParticleConfig } from '@/types/particles';
import { exportPNG } from '@/export/exportPNG';
import { exportSVG } from '@/export/exportSVG';

interface ExportButtonProps {
  getParticles: () => Particle[];
  getConfig: () => ParticleConfig;
  docWidth: number;
  docHeight: number;
}

export function ExportButton({ getParticles, getConfig, docWidth, docHeight }: ExportButtonProps) {
  const [exporting, setExporting] = useState(false);

  async function handlePNG() {
    if (exporting) return;
    setExporting(true);
    try {
      await exportPNG(getParticles(), getConfig(), docWidth, docHeight);
    } finally {
      setExporting(false);
    }
  }

  function handleSVG() {
    exportSVG(getParticles(), getConfig(), docWidth, docHeight);
  }

  return (
    <div className="flex flex-col gap-2 p-3 border-t border-white/10">
      <p className="text-xs text-white/40 uppercase tracking-widest">Export</p>
      <button
        onClick={handlePNG}
        disabled={exporting}
        className="w-full text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded px-3 py-2 transition-colors"
      >
        {exporting ? 'Exporting…' : 'Download PNG'}
      </button>
      <button
        onClick={handleSVG}
        className="w-full text-sm bg-white/10 hover:bg-white/20 text-white/80 rounded px-3 py-2 transition-colors"
      >
        Download SVG
      </button>
    </div>
  );
}
