import { useToolStore } from '@/store/toolStore';
import { useUIStore } from '@/store/uiStore';
import { useSceneStore } from '@/store/sceneStore';
import { uid } from '@/utils/uid';
import type { ToolType } from '@/types/tools';
import type { RectangleObject, EllipseObject, StarObject } from '@/types/scene';

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

const PLACE_TOOLS = new Set<ToolType>(['rectangle', 'ellipse', 'star']);

export function BottomBar() {
  const activeTool = useToolStore((s) => s.activeTool);
  const setActiveTool = useToolStore((s) => s.setActiveTool);
  const ellipseMode = useUIStore((s) => s.ellipseMode);
  const setEllipseMode = useUIStore((s) => s.setEllipseMode);
  const animationPlaying = useUIStore((s) => s.animationPlaying);
  const setAnimationPlaying = useUIStore((s) => s.setAnimationPlaying);
  const animationConfig = useUIStore((s) => s.animationConfig);
  const setAnimationConfig = useUIStore((s) => s.setAnimationConfig);

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
      <div className="flex items-center gap-2 bg-white/[0.06] rounded-2xl px-3 py-2 shrink-0">
        <button
          onClick={() => setAnimationPlaying(!animationPlaying)}
          title={animationPlaying ? 'Остановить (Space)' : 'Запустить (Space)'}
          className="w-8 h-8 flex items-center justify-center rounded-xl text-white/70 hover:bg-white/10 hover:text-white transition-colors"
        >
          {animationPlaying ? <PauseIcon /> : <PlayIcon />}
        </button>
        <span className="text-[10px] text-white/20">Space</span>
        <input
          type="range"
          min={0.1}
          max={3.0}
          step={0.1}
          value={animationConfig.speed}
          onChange={(e) => setAnimationConfig({ speed: Number(e.target.value) })}
          className="w-20 accent-white cursor-pointer"
          title={`Скорость: ${animationConfig.speed.toFixed(1)}`}
        />
        <input
          type="range"
          min={1}
          max={100}
          step={1}
          value={animationConfig.amplitude}
          onChange={(e) => setAnimationConfig({ amplitude: Number(e.target.value) })}
          className="w-20 accent-white cursor-pointer"
          title={`Амплитуда: ${animationConfig.amplitude}`}
        />
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
