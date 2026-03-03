import { useToolStore } from '@/store/toolStore';
import { useSceneStore } from '@/store/sceneStore';
import type { ToolType } from '@/types/tools';

interface ToolButton {
  type: ToolType;
  label: string;
  hotkey: string;
  icon: string;
}

const TOOLS: ToolButton[] = [
  { type: 'select',    label: 'Select',    hotkey: 'V', icon: '↖' },
  { type: 'rectangle', label: 'Rectangle', hotkey: 'R', icon: '▭' },
  { type: 'ellipse',   label: 'Ellipse',   hotkey: 'O', icon: '◯' },
  { type: 'star',      label: 'Star',      hotkey: 'S', icon: '★' },
  { type: 'freehand',  label: 'Freehand',  hotkey: 'F', icon: '✏' },
];

export function Toolbar() {
  const activeTool = useToolStore((s) => s.activeTool);
  const setActiveTool = useToolStore((s) => s.setActiveTool);

  function handleClear() {
    useSceneStore.getState().clearAll();
    useToolStore.getState().clearSelection();
  }

  return (
    <div className="flex flex-col gap-1 p-2 border-b border-white/10">
      <p className="text-xs text-white/40 uppercase tracking-widest px-1 pb-1">Tools</p>
      {TOOLS.map((tool) => (
        <button
          key={tool.type}
          onClick={() => setActiveTool(tool.type)}
          title={`${tool.label} (${tool.hotkey})`}
          className={[
            'flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left transition-colors',
            activeTool === tool.type
              ? 'bg-white/15 text-white'
              : 'text-white/60 hover:bg-white/10 hover:text-white',
          ].join(' ')}
        >
          <span className="text-base w-5 text-center">{tool.icon}</span>
          <span className="flex-1">{tool.label}</span>
          <kbd className="text-xs text-white/30 font-mono">{tool.hotkey}</kbd>
        </button>
      ))}

      <div className="mt-2 pt-2 border-t border-white/10">
        <button
          onClick={handleClear}
          title="Clear all shapes from canvas"
          className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left text-red-400/70 hover:bg-red-500/10 hover:text-red-400 transition-colors"
        >
          <span className="text-base w-5 text-center">⊘</span>
          <span className="flex-1">Clear canvas</span>
        </button>
      </div>
    </div>
  );
}
