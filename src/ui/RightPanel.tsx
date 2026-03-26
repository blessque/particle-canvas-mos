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

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] text-white/40">{label}</span>
      <button
        onClick={handleOpen}
        className="w-20 h-20 rounded-full border-2 border-white/20 cursor-pointer shrink-0"
        style={{ backgroundColor: color }}
      />
      <input
        ref={inputRef}
        type="color"
        value={color}
        onChange={(e) => onChange(e.target.value)}
        className="sr-only"
      />
      {history.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {history.map((c) => (
            <button
              key={c}
              onClick={() => {
                setHistory((h) => h.map((x) => x === c ? color : x));
                onChange(c);
              }}
              className="w-3.5 h-3.5 rounded-full border border-white/20 cursor-pointer shrink-0"
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
    <div className="flex flex-col gap-3 p-3">
      <div className="flex gap-6 pb-3 border-b border-white/10">
        <ColorSlot label="Цвет холста" color={canvasColor} onChange={setCanvasColor} />
        <ColorSlot
          label="Цвет частиц"
          color={config.color}
          onChange={(c) => updateConfig({ color: c })}
        />
      </div>

      <CanvasSizeSelector />
    </div>
  );
}
