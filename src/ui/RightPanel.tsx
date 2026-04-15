import { useEffect, useRef, useState } from 'react';
import { useParticleStore } from '@/store/particleStore';
import { useUIStore } from '@/store/uiStore';
import { CanvasSizeSelector } from './CanvasSizeSelector';

function ColorSlot({
  label,
  color,
  onChange,
}: {
  label: string;
  color: string;
  onChange: (c: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const colorOnOpenRef = useRef<string>(color);
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    const handleCommit = () => {
      const prev = colorOnOpenRef.current;
      if (input.value !== prev) {
        setHistory((h) => [prev, ...h.filter((x) => x !== prev)].slice(0, 5));
      }
    };
    input.addEventListener('change', handleCommit);
    return () => input.removeEventListener('change', handleCommit);
  }, []);

  function handleOpen() {
    colorOnOpenRef.current = color;
    inputRef.current?.click();
  }

  const hex = color.replace('#', '').toUpperCase();

  return (
    <div className="flex flex-col gap-[6px]">
      <div
        className="bg-[#33373f] rounded-[8px] pl-[3px] pr-[6px] py-[3px] flex items-center gap-2 cursor-pointer"
        onClick={handleOpen}
      >
        <div
          className="w-8 h-8 rounded-[5px] shrink-0 border border-white/5"
          style={{ backgroundColor: color }}
        />
        <span className="font-cond-regular text-[14px] text-white flex-1">{label}</span>
        <span className="font-mono-book text-[14px] text-white opacity-50 uppercase">{hex}</span>
      </div>
      <input
        ref={inputRef}
        type="color"
        value={color}
        onChange={(e) => onChange(e.target.value)}
        className="sr-only"
      />
      {history.length > 0 && (
        <div className="flex gap-[2px] flex-wrap">
          {history.map((c) => (
            <button
              key={c}
              onClick={() => {
                setHistory((h) => h.map((x) => x === c ? color : x));
                onChange(c);
              }}
              className="w-4 h-4 rounded-[5px] border border-white/10 cursor-pointer shrink-0 hover:opacity-80 transition-opacity"
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function RightPanel() {
  const config = useParticleStore((s) => s.config);
  const updateConfig = useParticleStore((s) => s.updateConfig);
  const canvasColor = useUIStore((s) => s.canvasColor);
  const setCanvasColor = useUIStore((s) => s.setCanvasColor);

  return (
    <div className="bg-[#0e0f11] rounded-[22px] p-3 flex flex-col gap-4">
      <h2 className="font-cond-black font-black text-[24px] text-[#252931] uppercase leading-none">Холст</h2>

      <div className="flex flex-col gap-2">
        <span className="font-cond-regular text-[14px] text-[#454a55] uppercase">Цвет</span>
        <ColorSlot label="Холст" color={canvasColor} onChange={setCanvasColor} />
        <ColorSlot
          label="Частицы"
          color={config.color}
          onChange={(c) => updateConfig({ color: c })}
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className="font-cond-regular text-[14px] text-[#454a55] uppercase">Формат</span>
        <CanvasSizeSelector />
      </div>
    </div>
  );
}
