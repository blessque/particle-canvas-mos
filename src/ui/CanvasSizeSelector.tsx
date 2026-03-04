import { useUIStore } from '@/store/uiStore';

const SIZES = [
  { label: '1:1',  w: 1080, h: 1080 },
  { label: '16:9', w: 1920, h: 1080 },
  { label: '9:16', w: 1080, h: 1920 },
  { label: '4:5',  w: 1080, h: 1350 },
  { label: '3:4',  w: 1080, h: 1440 },
] as const;

export function CanvasSizeSelector() {
  const viewport = useUIStore((s) => s.viewport);
  const setDocumentSize = useUIStore((s) => s.setDocumentSize);

  return (
    <div className="p-2 border-b border-white/10">
      <p className="text-xs text-white/40 uppercase tracking-widest px-1 pb-2">Размер холста</p>
      <div className="flex flex-col gap-1">
        {SIZES.map(({ label, w, h }) => {
          const active = viewport.documentWidth === w && viewport.documentHeight === h;
          return (
            <button
              key={label}
              onClick={() => setDocumentSize(w, h)}
              className={[
                'flex items-center justify-between px-2 py-1.5 rounded text-sm transition-colors',
                active
                  ? 'bg-white/15 text-white'
                  : 'text-white/60 hover:bg-white/10 hover:text-white',
              ].join(' ')}
            >
              <span>{label}</span>
              <span className="text-xs text-white/30">{w}×{h}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
