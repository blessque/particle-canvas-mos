import type { Tool, ToolCallbacks } from '@/types/tools';
import type { Point } from '@/types/geometry';
import type { SceneObject } from '@/types/scene';

/** Simple point-in-bounding-box hit test */
function hitTest(obj: SceneObject, pt: Point): boolean {
  const { x, y } = obj.position;
  return (
    pt.x >= x && pt.x <= x + obj.width &&
    pt.y >= y && pt.y <= y + obj.height
  );
}

let dragBase: Point | null = null;
let dragObjPositions: Array<{ id: string; ox: number; oy: number }> = [];

export const SelectTool: Tool = {
  name: 'select',

  getCursor(): string {
    return 'default';
  },

  onPointerDown(_e: PointerEvent, docPoint: Point, cbs: ToolCallbacks): void {
    const objects = cbs.getObjects();
    // Hit-test in reverse z-order (topmost first)
    let hit: SceneObject | null = null;
    for (let i = objects.length - 1; i >= 0; i--) {
      const obj = objects[i];
      if (obj && !obj.locked && obj.visible && hitTest(obj, docPoint)) {
        hit = obj;
        break;
      }
    }

    if (hit) {
      const state = cbs.getToolState();
      // If not already selected, replace selection
      if (!state.selectedObjectIds.includes(hit.id)) {
        cbs.setToolState({ selectedObjectIds: [hit.id] });
      }
      // Set up drag
      const selected = cbs.getToolState().selectedObjectIds;
      dragBase = docPoint;
      dragObjPositions = objects
        .filter((o) => selected.includes(o.id))
        .map((o) => ({ id: o.id, ox: o.position.x, oy: o.position.y }));
      cbs.setToolState({ isDrawing: true });
    } else {
      cbs.setToolState({ selectedObjectIds: [], isDrawing: false });
      dragBase = null;
      dragObjPositions = [];
    }
  },

  onPointerMove(_e: PointerEvent, docPoint: Point, cbs: ToolCallbacks): void {
    const state = cbs.getToolState();
    if (!state.isDrawing || !dragBase) return;

    const dx = docPoint.x - dragBase.x;
    const dy = docPoint.y - dragBase.y;

    for (const entry of dragObjPositions) {
      cbs.updateObject(entry.id, {
        position: { x: entry.ox + dx, y: entry.oy + dy },
      });
    }
  },

  onPointerUp(_e: PointerEvent, _docPoint: Point, cbs: ToolCallbacks): void {
    cbs.setToolState({ isDrawing: false });
    dragBase = null;
    dragObjPositions = [];
  },

  onKeyDown(e: KeyboardEvent, cbs: ToolCallbacks): void {
    const state = cbs.getToolState();
    if (e.key === 'Delete' || e.key === 'Backspace') {
      for (const id of state.selectedObjectIds) {
        cbs.deleteObject(id);
      }
      cbs.setToolState({ selectedObjectIds: [] });
    }
    if (e.key === 'Escape') {
      cbs.setToolState({ selectedObjectIds: [] });
    }
  },
};
