import { useState } from 'react';
import { useParticleStore } from '@/store/particleStore';
import { useUIStore } from '@/store/uiStore';
import type { SpawnDirection, FalloffType } from '@/types/particles';

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  displayValue,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  displayValue?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex justify-between text-[15px] text-white/50">
        <span>{label}</span>
        <span className="font-mono text-white/70">{displayValue ?? value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-white cursor-pointer"
      />
    </div>
  );
}

function SelectRow<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[15px] text-white/50">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="bg-white/10 text-white/80 text-[15px] rounded px-2 py-1.5 border border-white/10 cursor-pointer"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

const SPAWN_OPTIONS: { value: SpawnDirection; label: string }[] = [
  { value: 'outside', label: 'Наружу' },
  { value: 'inside',  label: 'Внутрь' },
  { value: 'both',    label: 'Во все стороны' },
];

const FALLOFF_OPTIONS: { value: FalloffType; label: string }[] = [
  { value: 'gaussian',    label: 'Гаусс' },
  { value: 'linear',      label: 'Линейно' },
  { value: 'exponential', label: 'Экспоненциально' },
];

export function ParticlePanel() {
  const config = useParticleStore((s) => s.config);
  const updateConfig = useParticleStore((s) => s.updateConfig);
  const randomizeSeed = useParticleStore((s) => s.randomizeSeed);
  const showOutlines = useUIStore((s) => s.showOutlines);
  const setShowOutlines = useUIStore((s) => s.setShowOutlines);

  const [baseSize, setBaseSize] = useState(config.minSize);
  const [sizeVariance, setSizeVariance] = useState(0);

  function applySize(size: number, variance: number) {
    const f = variance / 100;
    updateConfig({
      minSize: size * Math.max(0.5, 1 - f),
      maxSize: size * (1 + f),
    });
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      <p className="text-[13px] text-white/40 uppercase tracking-widest">Частицы</p>

      <SliderRow
        label="Количество"
        value={config.count}
        min={100}
        max={20000}
        step={100}
        onChange={(v) => updateConfig({ count: v })}
      />

      <SliderRow
        label="Размер"
        value={baseSize}
        min={0.5}
        max={8}
        step={0.5}
        onChange={(v) => {
          setBaseSize(v);
          applySize(v, sizeVariance);
        }}
      />

      <SliderRow
        label="Разброс размера"
        value={sizeVariance}
        min={0}
        max={100}
        step={5}
        displayValue={`${sizeVariance}%`}
        onChange={(v) => {
          setSizeVariance(v);
          applySize(baseSize, v);
        }}
      />

      <SliderRow
        label="Разброс прозрачности"
        value={Math.round(config.falloffBias * 100)}
        min={0}
        max={100}
        step={5}
        displayValue={`${Math.round(config.falloffBias * 100)}%`}
        onChange={(v) => updateConfig({ falloffBias: v / 100, baseOpacity: 1.0, opacityRandomize: true })}
      />

      <SliderRow
        label="Рассеивание"
        value={config.falloffDistance}
        min={5}
        max={200}
        step={5}
        onChange={(v) => updateConfig({ falloffDistance: v })}
      />

      <SelectRow
        label="Направление"
        value={config.spawnDirection}
        options={SPAWN_OPTIONS}
        onChange={(v) => updateConfig({ spawnDirection: v })}
      />

      <SelectRow
        label="Кривая затухания"
        value={config.falloffType}
        options={FALLOFF_OPTIONS}
        onChange={(v) => updateConfig({ falloffType: v })}
      />

      <button
        onClick={randomizeSeed}
        className="text-[15px] text-white/50 hover:text-white/80 border border-white/10 hover:border-white/30 rounded px-2 py-2 transition-colors"
      >
        Перемешать
      </button>

      <div className="flex items-center justify-between">
        <span className="text-[15px] text-white/60">Показывать контуры</span>
        <button
          role="switch"
          aria-checked={showOutlines}
          onClick={() => setShowOutlines(!showOutlines)}
          className={[
            'relative w-9 h-5 rounded-full transition-colors shrink-0 overflow-hidden',
            showOutlines ? 'bg-white/70' : 'bg-white/20',
          ].join(' ')}
        >
          <span className={[
            'absolute top-[2px] left-0 w-4 h-4 rounded-full bg-white shadow transition-transform',
            showOutlines ? 'translate-x-[18px]' : 'translate-x-[2px]',
          ].join(' ')} />
        </button>
      </div>
    </div>
  );
}
