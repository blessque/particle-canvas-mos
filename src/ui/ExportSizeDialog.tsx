import type { SequenceEstimate } from '@/export/exportPNGSequence';

function formatBytes(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(1)} ГБ`;
  return `${Math.round(bytes / (1024 * 1024))} МБ`;
}

function formatDuration(ms: number): string {
  if (ms < 60_000) return `${Math.max(1, Math.round(ms / 1000))} с`;
  return `${Math.round(ms / 60_000)} мин`;
}

interface ExportSizeDialogProps {
  estimate: SequenceEstimate;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ExportSizeDialog({ estimate, onConfirm, onCancel }: ExportSizeDialogProps) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6"
      onClick={onCancel}
    >
      <div
        className="bg-[#0e0f11] rounded-[22px] p-5 flex flex-col gap-4 w-[320px]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-cond-black font-black text-[24px] text-[#454a55] uppercase leading-none">
          Большой экспорт
        </h2>

        <div className="flex flex-col gap-1">
          <span className="font-cond-regular text-[18px] text-white leading-tight">
            ~{formatBytes(estimate.totalBytes)} · {estimate.totalFrames} файлов
          </span>
          <span className="font-cond-regular text-[14px] text-[#777e8c] leading-tight">
            Это может занять ~{formatDuration(estimate.totalMs)}
          </span>
        </div>

        <div className="flex gap-[6px]">
          <button
            onClick={onCancel}
            className="bg-[#202226] text-white rounded-[8px] h-[44px] flex-1 font-cond-regular text-[18px] hover:opacity-90 transition-opacity"
          >
            Отмена
          </button>
          <button
            onClick={onConfirm}
            className="bg-white text-[#0e0f11] rounded-[8px] h-[44px] flex-1 font-cond-regular text-[18px] hover:opacity-90 transition-opacity"
          >
            Скачать
          </button>
        </div>
      </div>
    </div>
  );
}
