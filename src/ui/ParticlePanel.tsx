import { useEffect, useRef, useState } from 'react';
import { useParticleStore } from '@/store/particleStore';
import { useUIStore } from '@/store/uiStore';
import { useSceneStore } from '@/store/sceneStore';
import { useToolStore } from '@/store/toolStore';
import { importSVG } from '@/import/svgImporter';
import type { SpawnDirection } from '@/types/particles';
import type { SpeedPreset, AmpPreset } from '@/types/particles';

/* ─── Shared primitive components ─── */

const THUMB_SIZE = 10;
const THUMB_OVERHANG = 0;
const TRACK_PAD = 3; // matches padding: 0 3px on .custom-slider

function stepPct(v: number, min: number, max: number, trackWidth: number): number {
  const fraction = (v - min) / (max - min);
  return ((TRACK_PAD + THUMB_SIZE / 2 + fraction * (trackWidth - 2 * TRACK_PAD - THUMB_SIZE)) / trackWidth) * 100;
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  displayValue,
  showDots,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  displayValue?: string;
  showDots?: boolean;
  onChange: (v: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [trackWidth, setTrackWidth] = useState(0);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setTrackWidth(el.offsetWidth));
    ro.observe(el);
    setTrackWidth(el.offsetWidth);
    return () => ro.disconnect();
  }, []);

  const rawFraction = (value - min) / (max - min);
  const fillEndPct = trackWidth > 0
    ? ((TRACK_PAD + THUMB_SIZE / 2 + rawFraction * (trackWidth - 2 * TRACK_PAD - THUMB_SIZE) + THUMB_OVERHANG) / trackWidth) * 100
    : rawFraction * 100;

  const dotValues = showDots && trackWidth > 0
    ? Array.from(
        { length: Math.round((max - min) / step) + 1 },
        (_, i) => min + i * step,
      ).filter((v) => v > value)
    : [];

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between items-baseline px-0.5">
        <span className="font-cond-regular text-[14px] text-[#454a55] uppercase leading-none">
          {label}
        </span>
        <span className="font-mono text-[14px] text-white leading-none">
          {displayValue ?? value}
        </span>
      </div>
      <div className="relative">
        <input
          ref={inputRef}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="custom-slider block"
          style={{ '--fill': `${fillEndPct}%` } as React.CSSProperties}
        />
        {dotValues.length > 0 && (
          <div className="absolute inset-0 pointer-events-none">
            {dotValues.map((v) => (
              <div
                key={v}
                className="absolute rounded-full bg-[#454a55]"
                style={{ left: `${stepPct(v, min, max, trackWidth)}%`, top: '50%', width: 3, height: 3, transform: 'translate(-50%, -50%)' }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Switcher<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const n = options.length;
  function radius(i: number) {
    if (i === 0 && n === 1) return 'rounded-[8px]';
    if (i === 0) return 'rounded-tl-[8px] rounded-bl-[8px] rounded-tr-[2px] rounded-br-[2px]';
    if (i === n - 1) return 'rounded-tr-[8px] rounded-br-[8px] rounded-tl-[2px] rounded-bl-[2px]';
    return 'rounded-[2px]';
  }
  return (
    <div className="flex gap-[2px]">
      {options.map((opt, i) => (
        <button
          key={String(opt.value)}
          onClick={() => onChange(opt.value)}
          className={[
            'flex-1 p-[6px] font-cond-regular text-[14px] leading-none text-center transition-colors',
            radius(i),
            value === opt.value
              ? 'bg-[#33373f] text-white'
              : 'bg-[#202226] text-[#777e8c] hover:bg-[#2a2e35] hover:text-[#9ca3b1]',
          ].join(' ')}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-cond-regular text-[14px] text-[#454a55] uppercase leading-none px-0.5">
        {label}
      </span>
      {children}
    </div>
  );
}

function CustomDropdown<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} className="relative w-full">
      <button
        onClick={() => setOpen(!open)}
        className="w-full bg-[#33373f] rounded-[8px] px-[10px] py-[10px] flex items-center hover:bg-[#3d4149] transition-colors"
      >
        <span className="font-cond-regular text-[14px] text-white flex-1 text-left leading-none">
          {selected?.label}
        </span>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-[#777e8c] shrink-0">
          <path d={open ? 'M2 9L7 4L12 9' : 'M2 5L7 10L12 5'} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-[2px] bg-[#33373f] rounded-[8px] z-50 overflow-hidden">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={[
                'w-full px-[10px] py-[10px] text-left font-cond-regular text-[14px] leading-none transition-colors',
                value === opt.value
                  ? 'text-white bg-[#3d4149]'
                  : 'text-[#777e8c] hover:bg-[#3d4149] hover:text-white',
              ].join(' ')}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── SVG icons ─── */

function IconRefresh() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M12.0789 3.75001C13.3892 3.74748 14.6791 4.08107 15.8236 4.71888C15.8951 4.75874 15.966 4.79971 16.036 4.84176C17.0869 5.47231 17.9719 6.34665 18.6159 7.39201L19.8921 6.60656C19.071 5.27344 17.922 4.173 16.5547 3.41031C15.1868 2.64735 13.6452 2.24786 12.0789 2.25001C7.07696 2.25001 3.00221 6.2389 2.92992 11.1989L1.52795 9.80001L0.471947 10.865L3.15195 13.532C3.29241 13.6712 3.48217 13.7494 3.67995 13.7494C3.87772 13.7494 4.06749 13.6712 4.20795 13.532L6.88795 10.866L5.82995 9.80001L4.43016 11.1967C4.50351 7.07736 7.895 3.75001 12.0789 3.75001Z" fill="currentColor"/>
      <path opacity="0.5" d="M11.892 20.1993C10.5818 20.2018 9.29183 19.8682 8.14734 19.2304C8.07581 19.1905 8.00499 19.1496 7.93491 19.1075C6.88409 18.477 5.99909 17.6026 5.355 16.5573L4.07889 17.3427C4.89991 18.6758 6.04893 19.7763 7.41628 20.539C8.78413 21.3019 10.3258 21.7014 11.892 21.6993C16.894 21.6993 20.9687 17.7104 21.041 12.7504L22.443 14.1493L23.499 13.0843L20.819 10.4173C20.6785 10.278 20.4888 10.1999 20.291 10.1999C20.0932 10.1999 19.9035 10.278 19.763 10.4173L17.083 13.0833L18.141 14.1493L19.5408 12.7526C19.4674 16.8719 16.0759 20.1993 11.892 20.1993Z" fill="currentColor"/>
    </svg>
  );
}

function IconUpload() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path opacity="0.5" d="M3.75 14C3.75 15.435 3.75197 16.4361 3.85352 17.1914C3.95221 17.9253 4.13254 18.3145 4.40918 18.5908L4.51856 18.6904C4.78805 18.9117 5.16633 19.0601 5.8086 19.1465C6.56395 19.248 7.565 19.25 9 19.25H15C16.435 19.25 17.4361 19.248 18.1914 19.1465C18.9253 19.0478 19.3145 18.8675 19.5908 18.5908L19.6904 18.4814C19.9117 18.2119 20.0601 17.8337 20.1465 17.1914C20.248 16.4361 20.25 15.435 20.25 14H21.75C21.75 15.3927 21.7519 16.513 21.6338 17.3916C21.5203 18.2356 21.2851 18.9547 20.7598 19.5371L20.6514 19.6514C20.0497 20.2535 19.2916 20.5128 18.3916 20.6338C17.513 20.7519 16.3927 20.75 15 20.75H9C7.60729 20.75 6.48698 20.7519 5.6084 20.6338C4.76445 20.5203 4.04527 20.2851 3.46289 19.7598L3.34863 19.6514C2.74649 19.0497 2.48725 18.2916 2.36621 17.3916C2.24807 16.513 2.25 15.3927 2.25 14H3.75Z" fill="currentColor"/>
      <path d="M12 2.25C12.2106 2.25 12.4116 2.33874 12.5537 2.49414L16.5537 6.86914L15.4463 7.88086L12.75 4.93164V16H11.25V4.93164L8.55371 7.88086L7.44629 6.86914L11.4463 2.49414C11.5884 2.33874 11.7894 2.25 12 2.25Z" fill="currentColor"/>
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M19.5811 8.5498L19.1211 15.4502C19.034 16.7566 18.9658 17.81 18.8018 18.6338C18.6335 19.4787 18.3465 20.184 17.7549 20.7373C17.1634 21.2904 16.4406 21.5296 15.5859 21.6416C14.7527 21.7508 13.6969 21.75 12.3867 21.75H11.6133C10.3038 21.75 9.24824 21.7517 8.41504 21.6426C7.56029 21.5307 6.83705 21.291 6.24512 20.7373C5.65352 20.184 5.36652 19.4787 5.19824 18.6338C5.03421 17.81 4.96603 16.7566 4.87891 15.4502L4.41895 8.5498L5.91504 8.4502L6.375 15.3496C6.46487 16.6971 6.52947 17.6354 6.66992 18.3408C6.80615 19.0247 6.99628 19.387 7.26953 19.6426C7.54354 19.8987 7.918 20.0647 8.60938 20.1553C9.32264 20.2487 10.2628 20.25 11.6133 20.25H12.3867C13.7373 20.25 14.6774 20.2478 15.3906 20.1543C16.0822 20.0636 16.4569 19.8983 16.7305 19.6426C17.0037 19.387 17.1939 19.0247 17.3301 18.3408C17.4705 17.6354 17.5351 16.6971 17.625 15.3496L18.085 8.4502L19.5811 8.5498ZM20.5 5.25V6.75H3.5V5.25H20.5Z" fill="currentColor"/>
      <path opacity="0.5" d="M13.6445 2.24994C13.8797 2.24994 14.0842 2.24721 14.2754 2.27826L14.2744 2.27924C14.6206 2.33466 14.9489 2.46986 15.2334 2.67474C15.5183 2.87992 15.7518 3.14862 15.9141 3.4599L15.915 3.46185C16.0033 3.63206 16.0649 3.82145 16.1406 4.04877L16.2373 4.33978L16.2412 4.35053L16.2441 4.36127C16.3233 4.62431 16.4872 4.85388 16.71 5.01459C16.9329 5.17529 17.2028 5.25793 17.4775 5.24994L17.5225 6.74994C16.9178 6.76772 16.3237 6.58511 15.833 6.23138C15.3482 5.88186 14.991 5.38401 14.8145 4.81342L14.7178 4.52338C14.6276 4.25287 14.6046 4.19398 14.583 4.15228V4.15131C14.529 4.04845 14.4517 3.95947 14.3574 3.89154C14.2625 3.82317 14.1526 3.77816 14.0371 3.7597H14.0352C13.9924 3.75276 13.9333 3.74994 13.6445 3.74994H10.3555C10.0667 3.74994 10.0076 3.75276 9.96484 3.7597H9.96289C9.84737 3.77816 9.7375 3.82317 9.64258 3.89154C9.54818 3.95956 9.47006 4.04828 9.41602 4.15131L9.41699 4.15228C9.39536 4.19398 9.37239 4.25287 9.28223 4.52338L9.18555 4.81146L9.15234 4.91498L9.14941 4.92474L9.14551 4.93451C8.95748 5.45514 8.61691 5.90756 8.16797 6.23138C7.71903 6.5552 7.18226 6.7358 6.62891 6.74994H6.5V5.24994H6.59082C6.84227 5.24351 7.08601 5.1617 7.29004 5.01459C7.4941 4.86739 7.64891 4.6614 7.73438 4.42474L7.76172 4.34174L7.7627 4.33978L7.85938 4.04877C7.93515 3.82145 7.9967 3.63206 8.08496 3.46185L8.08594 3.4599C8.24824 3.14862 8.48175 2.87992 8.7666 2.67474C9.05085 2.47005 9.37878 2.33476 9.72461 2.27924C9.91583 2.24818 10.1203 2.24994 10.3555 2.24994H13.6445Z" fill="currentColor"/>
    </svg>
  );
}

/* ─── Spawn direction options ─── */

const SPAWN_OPTIONS: { value: SpawnDirection; label: string }[] = [
  { value: 'outside', label: 'Наружу' },
  { value: 'inside',  label: 'Внутрь' },
  { value: 'both',    label: 'Во все стороны' },
];

/* ─── Speed / Amplitude preset options ─── */

const SPEED_OPTIONS: { value: SpeedPreset; label: string }[] = [
  { value: 1, label: '1' },
  { value: 2, label: '2' },
  { value: 3, label: '3' },
  { value: 4, label: '4' },
];

const AMP_OPTIONS: { value: AmpPreset; label: string }[] = [
  { value: 1, label: 'S' },
  { value: 2, label: 'M' },
  { value: 3, label: 'L' },
  { value: 4, label: 'XL' },
];

/* ─── Main component ─── */

export function ParticlePanel() {
  const config = useParticleStore((s) => s.config);
  const updateConfig = useParticleStore((s) => s.updateConfig);
  const randomizeSeed = useParticleStore((s) => s.randomizeSeed);
  const animationConfig = useUIStore((s) => s.animationConfig);
  const setAnimationConfig = useUIStore((s) => s.setAnimationConfig);
  const setAnimationPresets = useUIStore((s) => s.setAnimationPresets);

  const [baseSize, setBaseSize] = useState(1);
  const [volumetric, setVolumetric] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleClear() {
    useSceneStore.getState().pushHistory();
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
      useSceneStore.getState().pushHistory();
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
    <>
      {/* Logo block */}
      <div className="px-3 py-1">
        <img
          src="/icons/BM%E2%80%94logo_main.svg"
          alt="Particle Canvas"
          className="h-7 w-auto shrink-0"
        />
      </div>

      {/* Card: Частицы */}
      <div className="bg-[#0e0f11] rounded-[22px] p-3 flex flex-col gap-4">
        <h2 className="font-cond-black font-black text-[24px] text-[#252931] uppercase leading-none">
          Частицы
        </h2>

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
          max={2.5}
          step={0.25}
          showDots
          onChange={(v) => {
            setBaseSize(v);
            applySize(v, volumetric ? 80 : 0);
          }}
        />

        <SliderRow
          label="Рассеивание"
          value={config.falloffDistance}
          min={5}
          max={500}
          step={5}
          onChange={(v) => updateConfig({ falloffDistance: v })}
        />

        <Row label="Глубина">
          <Switcher
            value={volumetric ? 'volumetric' : 'flat'}
            options={[
              { value: 'flat', label: 'Плоские' },
              { value: 'volumetric', label: 'Объем' },
            ]}
            onChange={(v) => {
              const vol = v === 'volumetric';
              setVolumetric(vol);
              applySize(baseSize, vol ? 80 : 0);
              updateConfig({ falloffBias: vol ? 0.8 : 0 });
            }}
          />
        </Row>

        <Row label="Направление">
          <CustomDropdown
            value={config.spawnDirection}
            options={SPAWN_OPTIONS}
            onChange={(v) => updateConfig({ spawnDirection: v })}
          />
        </Row>

        {/* Action buttons */}
        <div className="flex flex-col gap-0.5 border-t border-[#1a1d21] pt-2">
          <button
            onClick={randomizeSeed}
            className="flex items-center gap-2 px-1 py-2 rounded-[4px] font-cond-regular text-[18px] text-[#777e8c] hover:text-white transition-colors"
          >
            <span className="w-6 h-6 flex items-center justify-center shrink-0"><IconRefresh /></span>
            Перемешать
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-1 py-2 rounded-[4px] font-cond-regular text-[18px] text-[#777e8c] hover:text-white transition-colors"
          >
            <span className="w-6 h-6 flex items-center justify-center shrink-0"><IconUpload /></span>
            Импорт SVG
          </button>
          <button
            onClick={handleClear}
            className="flex items-center gap-2 px-1 py-2 rounded-[4px] font-cond-regular text-[18px] text-[#777e8c] hover:text-white transition-colors"
          >
            <span className="w-6 h-6 flex items-center justify-center shrink-0"><IconTrash /></span>
            Очистить
          </button>
        </div>
      </div>

      {/* Card: Анимация */}
      <div className="bg-[#0e0f11] rounded-[22px] p-3 flex flex-col gap-4">
        <h2 className="font-cond-black font-black text-[24px] text-[#252931] uppercase leading-none">
          Анимация
        </h2>

        <Row label="Движение">
          <Switcher
            value={animationConfig.mode}
            options={[
              { value: 'brownian' as const,    label: 'Пульс' },
              { value: 'directional' as const, label: 'Полёт' },
            ]}
            onChange={(v) => setAnimationConfig({ mode: v })}
          />
        </Row>

        <Row label="Темп">
          <Switcher
            value={animationConfig.speedPreset}
            options={SPEED_OPTIONS}
            onChange={(v) => setAnimationPresets(v, animationConfig.ampPreset)}
          />
        </Row>

        <Row label="Амплитуда">
          <Switcher
            value={animationConfig.ampPreset}
            options={AMP_OPTIONS}
            onChange={(v) => setAnimationPresets(animationConfig.speedPreset, v)}
          />
        </Row>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".svg,image/svg+xml"
        className="hidden"
        onChange={handleSVGImport}
      />
    </>
  );
}
