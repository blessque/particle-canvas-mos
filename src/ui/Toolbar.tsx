import { Fragment, useRef } from 'react';
import { useToolStore } from '@/store/toolStore';
import { useSceneStore } from '@/store/sceneStore';
import { useUIStore } from '@/store/uiStore';
import type { ToolType } from '@/types/tools';
import { importSVG } from '@/import/svgImporter';

interface ToolButton {
  type: ToolType;
  label: string;
  hotkey: string;
  icon: string;
}

const ARC_MODES = [
  { mode: 'full'    as const, icon: '◯', label: 'Полный эллипс' },
  { mode: 'half'    as const, icon: '⌓', label: 'Полудуга' },
  { mode: 'quarter' as const, icon: '◜', label: 'Четверть дуги' },
];

const TOOLS: ToolButton[] = [
  { type: 'select',    label: 'Выделение',     hotkey: 'V', icon: '↖' },
  { type: 'rectangle', label: 'Прямоугольник', hotkey: 'R', icon: '▭' },
  { type: 'ellipse',   label: 'Эллипс',        hotkey: 'O', icon: '◯' },
  { type: 'star',      label: 'Звезда',        hotkey: 'S', icon: '★' },
  { type: 'freehand',  label: 'Рисование',      hotkey: 'F', icon: '✏' },
];

export function Toolbar() {
  const activeTool = useToolStore((s) => s.activeTool);
  const setActiveTool = useToolStore((s) => s.setActiveTool);
  const ellipseMode = useUIStore((s) => s.ellipseMode);
  const setEllipseMode = useUIStore((s) => s.setEllipseMode);
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

  return (
    <div className="flex flex-col gap-1 p-2 border-b border-white/10">
      <p className="text-[13px] text-white/40 uppercase tracking-widest px-1 pb-1">Инструменты</p>
      {TOOLS.map((tool) => (
        <Fragment key={tool.type}>
          <button
            onClick={() => setActiveTool(tool.type)}
            title={`${tool.label} (${tool.hotkey})`}
            className={[
              'flex items-center gap-2 px-2 py-2 rounded text-base text-left transition-colors',
              activeTool === tool.type
                ? 'bg-white/15 text-white'
                : 'text-white/60 hover:bg-white/10 hover:text-white',
            ].join(' ')}
          >
            <span className="text-lg w-5 text-center">{tool.icon}</span>
            <span className="flex-1">{tool.label}</span>
            <kbd className="text-[13px] text-white/30 font-mono">{tool.hotkey}</kbd>
          </button>
          {tool.type === 'ellipse' && activeTool === 'ellipse' && (
            <div className="flex items-center gap-1 ml-5 pb-1">
              {ARC_MODES.map(({ mode, icon, label }) => (
                <button
                  key={mode}
                  onClick={() => setEllipseMode(mode)}
                  title={label}
                  className={[
                    'flex-1 py-1 rounded text-base transition-colors',
                    ellipseMode === mode
                      ? 'bg-white/15 text-white'
                      : 'text-white/40 hover:bg-white/10 hover:text-white',
                  ].join(' ')}
                >
                  {icon}
                </button>
              ))}
              <span className="text-[13px] text-white/25 ml-1">⌥O</span>
            </div>
          )}
        </Fragment>
      ))}

      <div className="mt-2 pt-2 border-t border-white/10 flex flex-col gap-1">
        <button
          onClick={() => fileInputRef.current?.click()}
          title="Импортировать SVG-файл"
          className="w-full flex items-center gap-2 px-2 py-2 rounded text-base text-left text-white/40 hover:bg-white/10 hover:text-white/70 transition-colors"
        >
          <span className="text-lg w-5 text-center">↑</span>
          <span className="flex-1">Импорт SVG</span>
        </button>
        <button
          onClick={handleClear}
          title="Очистить все фигуры"
          className="w-full flex items-center gap-2 px-2 py-2 rounded text-base text-left text-white/40 hover:bg-white/10 hover:text-white/70 transition-colors"
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
