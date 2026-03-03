import { useParticleStore } from '@/store/particleStore';
import type { SpawnDirection, FalloffType } from '@/types/particles';

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex justify-between text-xs text-white/50">
        <span>{label}</span>
        <span className="font-mono text-white/70">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-blue-400 cursor-pointer"
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
      <span className="text-xs text-white/50">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="bg-white/10 text-white/80 text-xs rounded px-2 py-1 border border-white/10 cursor-pointer"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

const SPAWN_OPTIONS: { value: SpawnDirection; label: string }[] = [
  { value: 'outside', label: 'Outside' },
  { value: 'inside',  label: 'Inside' },
  { value: 'both',    label: 'Both' },
];

const FALLOFF_OPTIONS: { value: FalloffType; label: string }[] = [
  { value: 'gaussian',    label: 'Gaussian' },
  { value: 'linear',      label: 'Linear' },
  { value: 'exponential', label: 'Exponential' },
];

export function ParticlePanel() {
  const config = useParticleStore((s) => s.config);
  const updateConfig = useParticleStore((s) => s.updateConfig);
  const randomizeSeed = useParticleStore((s) => s.randomizeSeed);

  return (
    <div className="flex flex-col gap-3 p-3 overflow-y-auto flex-1">
      <p className="text-xs text-white/40 uppercase tracking-widest">Particles</p>

      <SliderRow
        label="Count"
        value={config.count}
        min={100}
        max={10000}
        step={100}
        onChange={(v) => updateConfig({ count: v })}
      />

      <SliderRow
        label="Size"
        value={config.minSize}
        min={0.5}
        max={8}
        step={0.5}
        onChange={(v) => updateConfig({ minSize: v, maxSize: v })}
      />

      <SliderRow
        label="Opacity"
        value={Math.round(config.baseOpacity * 100)}
        min={10}
        max={100}
        step={5}
        onChange={(v) => updateConfig({ baseOpacity: v / 100 })}
      />

      <SliderRow
        label="Falloff Distance"
        value={config.falloffDistance}
        min={5}
        max={200}
        step={5}
        onChange={(v) => updateConfig({ falloffDistance: v })}
      />

      <SelectRow
        label="Spawn Direction"
        value={config.spawnDirection}
        options={SPAWN_OPTIONS}
        onChange={(v) => updateConfig({ spawnDirection: v })}
      />

      <SelectRow
        label="Falloff Curve"
        value={config.falloffType}
        options={FALLOFF_OPTIONS}
        onChange={(v) => updateConfig({ falloffType: v })}
      />

      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-white/50">Color</span>
        <input
          type="color"
          value={config.color}
          onChange={(e) => updateConfig({ color: e.target.value })}
          className="w-full h-8 rounded cursor-pointer bg-transparent border border-white/10"
        />
      </div>

      <button
        onClick={randomizeSeed}
        className="text-xs text-white/50 hover:text-white/80 border border-white/10 hover:border-white/30 rounded px-2 py-1.5 transition-colors"
      >
        Randomize Seed
      </button>
    </div>
  );
}
