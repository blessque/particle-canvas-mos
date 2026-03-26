import { useToolStore } from '@/store/toolStore';
import { useUIStore } from '@/store/uiStore';
import { useSceneStore } from '@/store/sceneStore';
import { uid } from '@/utils/uid';
import type { ToolType } from '@/types/tools';
import type { RectangleObject, EllipseObject, StarObject } from '@/types/scene';
import type { SpeedPreset, AmpPreset } from '@/types/particles';

function PlayIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <polygon points="3,1 3,15 14,8" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <rect x="2" y="1" width="4" height="14" rx="1" />
      <rect x="10" y="1" width="4" height="14" rx="1" />
    </svg>
  );
}

const TOOLS: { type: ToolType; label: string; hotkey: string; icon: string }[] = [
  { type: 'select',    label: 'Выделение',     hotkey: 'V', icon: '↖' },
  { type: 'rectangle', label: 'Прямоугольник', hotkey: 'R', icon: '▭' },
  { type: 'ellipse',   label: 'Эллипс',        hotkey: 'O', icon: '◯' },
  { type: 'star',      label: 'Звезда',        hotkey: 'S', icon: '★' },
  { type: 'freehand',  label: 'Рисование',     hotkey: 'F', icon: '✏' },
];

const ARC_MODES = [
  { mode: 'full'    as const, icon: '◯', label: 'Полный эллипс' },
  { mode: 'half'    as const, icon: '⌓', label: 'Полудуга' },
  { mode: 'quarter' as const, icon: '◜', label: 'Четверть дуги' },
];

function ToolButton({
  tool,
  activeTool,
  onClick,
}: {
  tool: typeof TOOLS[number];
  activeTool: ToolType;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={tool.label}
      className={[
        'flex flex-col items-center px-2 py-1.5 rounded-xl w-11 transition-colors',
        activeTool === tool.type
          ? 'bg-white/15 text-white'
          : 'text-white/50 hover:bg-white/10 hover:text-white',
      ].join(' ')}
    >
      <span className="text-xl leading-none">{tool.icon}</span>
      <span className="text-[10px] font-mono text-white/30 mt-0.5">{tool.hotkey}</span>
    </button>
  );
}

const SPEED_PRESETS: { value: SpeedPreset; label: string }[] = [
  { value: 1, label: '1' },
  { value: 2, label: '2' },
  { value: 3, label: '3' },
  { value: 4, label: '4' },
];

const AMP_PRESETS: { value: AmpPreset; label: string }[] = [
  { value: 1, label: 'S' },
  { value: 2, label: 'M' },
  { value: 3, label: 'L' },
  { value: 4, label: 'XL' },
];

const PLACE_TOOLS = new Set<ToolType>(['rectangle', 'ellipse', 'star']);

export function BottomBar() {
  const activeTool = useToolStore((s) => s.activeTool);
  const setActiveTool = useToolStore((s) => s.setActiveTool);
  const ellipseMode = useUIStore((s) => s.ellipseMode);
  const setEllipseMode = useUIStore((s) => s.setEllipseMode);
  const animationPlaying = useUIStore((s) => s.animationPlaying);
  const setAnimationPlaying = useUIStore((s) => s.setAnimationPlaying);
  const animationConfig = useUIStore((s) => s.animationConfig);
  const setAnimationPresets = useUIStore((s) => s.setAnimationPresets);

  function placeShapeAtCenter(type: 'rectangle' | 'ellipse' | 'star') {
    const { documentWidth: dw, documentHeight: dh } = useUIStore.getState().viewport;
    const size = Math.min(dw, dh) * 0.35;
    const x = dw / 2 - size / 2;
    const y = dh / 2 - size / 2;
    const base = { id: uid(), position: { x, y }, width: size, height: size, rotation: 0, visible: true, locked: false };
    let obj: RectangleObject | EllipseObject | StarObject;
    if (type === 'rectangle') {
      obj = { ...base, type: 'rectangle' };
    } else if (type === 'ellipse') {
      obj = { ...base, type: 'ellipse', arcStartAngle: 0, arcEndAngle: Math.PI * 2 };
    } else {
      obj = { ...base, type: 'star', points: 5, innerRadiusRatio: 0.4 };
    }
    useSceneStore.getState().addObject(obj);
    useToolStore.getState().setActiveTool('select');
    useToolStore.getState().selectObjects([obj.id]);
  }

  function getToolClickHandler(type: ToolType): () => void {
    if (PLACE_TOOLS.has(type)) {
      return () => placeShapeAtCenter(type as 'rectangle' | 'ellipse' | 'star');
    }
    return () => setActiveTool(type);
  }

  return (
    <div className="relative shrink-0 flex items-center px-4 pb-3 pt-2 bg-[#111112]">
      {/* Left island — Playback */}
      <div className="flex items-center gap-3 bg-white/[0.06] rounded-2xl px-3 py-2 shrink-0">
        <button
          onClick={() => setAnimationPlaying(!animationPlaying)}
          title={animationPlaying ? 'Остановить (Space)' : 'Запустить (Space)'}
          className="w-8 h-8 flex items-center justify-center rounded-xl text-white/70 hover:bg-white/10 hover:text-white transition-colors"
        >
          {animationPlaying ? <PauseIcon /> : <PlayIcon />}
        </button>
        <span className="text-[10px] text-white/20">Space</span>

        {(animationConfig.mode === 'brownian' || animationConfig.mode === 'directional') && (
          <>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-white/30 w-8">Темп</span>
              <div className="flex gap-0.5">
                {SPEED_PRESETS.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setAnimationPresets(value, animationConfig.ampPreset)}
                    className={[
                      'w-7 h-6 rounded text-[11px] transition-colors',
                      animationConfig.speedPreset === value
                        ? 'bg-white/20 text-white'
                        : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/70',
                    ].join(' ')}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-white/30 w-12">Амплит.</span>
              <div className="flex gap-0.5">
                {AMP_PRESETS.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setAnimationPresets(animationConfig.speedPreset, value)}
                    className={[
                      'w-7 h-6 rounded text-[11px] transition-colors',
                      animationConfig.ampPreset === value
                        ? 'bg-white/20 text-white'
                        : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white/70',
                    ].join(' ')}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Center island — Tools (absolute, horizontally centered) */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-end gap-0.5 bg-white/[0.06] rounded-2xl px-2 py-1.5">
        {TOOLS.map((tool) =>
          tool.type === 'ellipse' ? (
            <div key="ellipse" className="relative">
              {activeTool === 'ellipse' && (
                <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 flex items-center gap-0.5 bg-white/[0.08] rounded-xl px-1.5 py-1">
                  {ARC_MODES.map(({ mode, icon, label }) => (
                    <button
                      key={mode}
                      onClick={() => setEllipseMode(mode)}
                      title={label}
                      className={[
                        'px-2 py-1 rounded-lg text-base transition-colors',
                        ellipseMode === mode
                          ? 'bg-white/15 text-white'
                          : 'text-white/40 hover:bg-white/10 hover:text-white',
                      ].join(' ')}
                    >
                      {icon}
                    </button>
                  ))}
                  <span className="text-[10px] text-white/25 ml-1 font-mono">⌥O</span>
                </div>
              )}
              <ToolButton tool={tool} activeTool={activeTool} onClick={getToolClickHandler(tool.type)} />
            </div>
          ) : (
            <ToolButton key={tool.type} tool={tool} activeTool={activeTool} onClick={getToolClickHandler(tool.type)} />
          )
        )}
      </div>
    </div>
  );
}
