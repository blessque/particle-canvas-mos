import { useRef, useState } from 'react';
import { useParticleStore } from '@/store/particleStore';
import { useUIStore } from '@/store/uiStore';
import { useSceneStore } from '@/store/sceneStore';
import { useToolStore } from '@/store/toolStore';
import { importSVG } from '@/import/svgImporter';
import type { SpawnDirection, FalloffType, AnimationMode } from '@/types/particles';

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
        className="bg-white/10 text-white/80 text-[15px] rounded px-2 py-1.5 border border-white/10 cursor-pointer focus:outline-none"
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

const ANIMATION_OPTIONS: { value: AnimationMode; label: string }[] = [
  { value: 'none',        label: 'Нет' },
  { value: 'brownian',    label: 'Броуновское' },
  { value: 'directional', label: 'Направленное' },
  { value: 'spread',      label: 'Разлёт' },
];

export function ParticlePanel() {
  const config = useParticleStore((s) => s.config);
  const updateConfig = useParticleStore((s) => s.updateConfig);
  const randomizeSeed = useParticleStore((s) => s.randomizeSeed);
  const animationConfig = useUIStore((s) => s.animationConfig);
  const setAnimationConfig = useUIStore((s) => s.setAnimationConfig);

  const [baseSize, setBaseSize] = useState(config.minSize);
  const [sizeVariance, setSizeVariance] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleClear() {
    useSceneStore.getState().clearAll();
    useToolStore.getState().clearSelection();
  }

  async function handleSVGImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const vp = useUIStore.getState().viewport;
    const obj = importSVG(text, vp.documentWidth, vp.documentHeight);
    if (obj) {
      useSceneStore.getState().addObject(obj);
      useToolStore.getState().setActiveTool('select');
      useToolStore.getState().selectObjects([obj.id]);
    }
    e.target.value = '';
  }

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

      <div className="flex flex-col gap-0.5">
        <div className="flex justify-between items-center text-[15px] text-white/50">
          <span>Рассеивание</span>
          <div className="flex items-center gap-0.5">
            {(['absolute', 'proportional'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => updateConfig({ falloffMode: mode })}
                className={[
                  'px-1.5 py-0.5 rounded text-[11px] transition-colors',
                  config.falloffMode === mode
                    ? 'bg-white/15 text-white'
                    : 'text-white/30 hover:bg-white/10 hover:text-white/60',
                ].join(' ')}
              >
                {mode === 'absolute' ? 'АБС' : '%'}
              </button>
            ))}
          </div>
        </div>
        <input
          type="range"
          min={5}
          max={200}
          step={5}
          value={config.falloffDistance}
          onChange={(e) => updateConfig({ falloffDistance: Number(e.target.value) })}
          className="w-full accent-white cursor-pointer"
        />
      </div>

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

      <SelectRow
        label="Анимация"
        value={animationConfig.mode}
        options={ANIMATION_OPTIONS}
        onChange={(v) => setAnimationConfig({ mode: v })}
      />

      <div className="border-t border-white/10 pt-3 flex flex-col gap-2">
        <button
          onClick={randomizeSeed}
          className="w-full flex items-center gap-2 px-2 py-2 rounded text-base text-left text-white/50 hover:bg-white/10 hover:text-white/80 transition-colors"
        >
          <span className="text-lg w-5 text-center">⟳</span>
          <span className="flex-1">Перемешать</span>
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full flex items-center gap-2 px-2 py-2 rounded text-base text-left text-white/50 hover:bg-white/10 hover:text-white/80 transition-colors"
        >
          <span className="text-lg w-5 text-center">↑</span>
          <span className="flex-1">Импорт SVG</span>
        </button>
        <button
          onClick={handleClear}
          className="w-full flex items-center gap-2 px-2 py-2 rounded text-base text-left text-white/50 hover:bg-white/10 hover:text-white/80 transition-colors"
        >
          <span className="text-lg w-5 text-center">⊘</span>
          <span className="flex-1">Очистить</span>
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".svg,image/svg+xml"
        className="hidden"
        onChange={handleSVGImport}
      />
    </div>
  );
}
