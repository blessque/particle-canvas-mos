import type { Tool, ToolCallbacks } from '@/types/tools';
import type { Point, Path } from '@/types/geometry';
import type { SceneObject } from '@/types/scene';
import { getHandles, applyResize } from '@/utils/handleUtils';
import type { HandleId } from '@/utils/handleUtils';

/** Simple point-in-bounding-box hit test */
function hitTest(obj: SceneObject, pt: Point): boolean {
  const { x, y } = obj.position;
  return (
    pt.x >= x && pt.x <= x + obj.width &&
    pt.y >= y && pt.y <= y + obj.height
  );
}

function dist(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Translate all line-segment points by (dx, dy). */
function translatePath(path: Path, dx: number, dy: number): Path {
  return {
    segments: path.segments.map((seg) => {
      if (seg.type !== 'line') return seg;
      return {
        type: 'line' as const,
        from: { x: seg.from.x + dx, y: seg.from.y + dy },
        to:   { x: seg.to.x   + dx, y: seg.to.y   + dy },
      };
    }),
    closed: path.closed,
  };
}

/** Scale all line-segment points from origBox into newBox proportionally. */
function scalePath(
  path: Path,
  orig: { x: number; y: number; w: number; h: number },
  newBox: { x: number; y: number; w: number; h: number },
): Path {
  return {
    segments: path.segments.map((seg) => {
      if (seg.type !== 'line') return seg;
      return {
        type: 'line' as const,
        from: scalePoint(seg.from, orig, newBox),
        to:   scalePoint(seg.to,   orig, newBox),
      };
    }),
    closed: path.closed,
  };
}

function translatePaths(paths: Path[], dx: number, dy: number): Path[] {
  return paths.map((p) => translatePath(p, dx, dy));
}

function scalePaths(
  paths: Path[],
  orig: { x: number; y: number; w: number; h: number },
  newBox: { x: number; y: number; w: number; h: number },
): Path[] {
  return paths.map((p) => scalePath(p, orig, newBox));
}

function scalePoint(
  pt: Point,
  orig: { x: number; y: number; w: number; h: number },
  newBox: { x: number; y: number; w: number; h: number },
): Point {
  const rx = orig.w > 0 ? (pt.x - orig.x) / orig.w : 0;
  const ry = orig.h > 0 ? (pt.y - orig.y) / orig.h : 0;
  return { x: newBox.x + rx * newBox.w, y: newBox.y + ry * newBox.h };
}

interface DragEntry {
  id: string;
  ox: number;
  oy: number;
  origPath?: Path;   // FreehandObject
  origPaths?: Path[]; // SVGImportObject
}

let dragBase: Point | null = null;
let dragObjPositions: DragEntry[] = [];

let resizeHandle: HandleId | null = null;
let resizeObjId: string | null = null;
let resizeOrig: { x: number; y: number; w: number; h: number } | null = null;
let resizeOrigPath: Path | null = null;
let resizeOrigPaths: Path[] | null = null;
let hoverCursor = 'default';

export const SelectTool: Tool = {
  name: 'select',

  getCursor(): string {
    return hoverCursor;
  },

  onPointerDown(_e: PointerEvent, docPoint: Point, cbs: ToolCallbacks): void {
    const state = cbs.getToolState();
    const objects = cbs.getObjects();
    const hitRadius = 8 / cbs.getScale();

    // Check if clicking a resize handle on the selected object
    if (state.selectedObjectIds.length === 1) {
      const selObj = objects.find((o) => o.id === state.selectedObjectIds[0]);
      if (selObj) {
        const handles = getHandles(selObj);
        for (const h of handles) {
          if (dist(docPoint, h.pos) < hitRadius) {
            resizeHandle = h.id;
            resizeObjId = selObj.id;
            resizeOrig = { x: selObj.position.x, y: selObj.position.y, w: selObj.width, h: selObj.height };
            resizeOrigPath  = selObj.type === 'freehand'    ? selObj.path  : null;
            resizeOrigPaths = selObj.type === 'svg-import'  ? selObj.paths : null;
            hoverCursor = h.cursor;
            cbs.setToolState({ isDrawing: true });
            return;
          }
        }
      }
    }

    // Normal hit-test (move / select)
    let hit: SceneObject | null = null;
    for (let i = objects.length - 1; i >= 0; i--) {
      const obj = objects[i];
      if (obj && !obj.locked && obj.visible && hitTest(obj, docPoint)) {
        hit = obj;
        break;
      }
    }

    if (hit) {
      if (!state.selectedObjectIds.includes(hit.id)) {
        cbs.setToolState({ selectedObjectIds: [hit.id] });
      }
      const selected = cbs.getToolState().selectedObjectIds;
      dragBase = docPoint;
      dragObjPositions = objects
        .filter((o) => selected.includes(o.id))
        .map((o) => ({
          id: o.id,
          ox: o.position.x,
          oy: o.position.y,
          origPath:  o.type === 'freehand'   ? o.path  : undefined,
          origPaths: o.type === 'svg-import' ? o.paths : undefined,
        }));
      hoverCursor = 'move';
      cbs.setToolState({ isDrawing: true });
    } else {
      cbs.setToolState({ selectedObjectIds: [], isDrawing: false });
      dragBase = null;
      dragObjPositions = [];
      hoverCursor = 'default';
    }
  },

  onPointerMove(_e: PointerEvent, docPoint: Point, cbs: ToolCallbacks): void {
    const state = cbs.getToolState();

    // Resize in progress
    if (resizeHandle && resizeOrig && resizeObjId) {
      const result = applyResize(resizeHandle, docPoint, resizeOrig, state.shiftHeld);
      const newBox = { x: result.position.x, y: result.position.y, w: result.width, h: result.height };
      if (resizeOrigPath) {
        cbs.updateObject(resizeObjId, {
          ...result,
          path: scalePath(resizeOrigPath, resizeOrig, newBox),
        } as unknown as Partial<SceneObject>);
      } else if (resizeOrigPaths) {
        cbs.updateObject(resizeObjId, {
          ...result,
          paths: scalePaths(resizeOrigPaths, resizeOrig, newBox),
        } as unknown as Partial<SceneObject>);
      } else {
        cbs.updateObject(resizeObjId, result);
      }
      return;
    }

    // Move drag in progress
    if (state.isDrawing && dragBase) {
      const dx = docPoint.x - dragBase.x;
      const dy = docPoint.y - dragBase.y;
      for (const entry of dragObjPositions) {
        if (entry.origPath) {
          cbs.updateObject(entry.id, {
            position: { x: entry.ox + dx, y: entry.oy + dy },
            path: translatePath(entry.origPath, dx, dy),
          } as unknown as Partial<SceneObject>);
        } else if (entry.origPaths) {
          cbs.updateObject(entry.id, {
            position: { x: entry.ox + dx, y: entry.oy + dy },
            paths: translatePaths(entry.origPaths, dx, dy),
          } as unknown as Partial<SceneObject>);
        } else {
          cbs.updateObject(entry.id, {
            position: { x: entry.ox + dx, y: entry.oy + dy },
          });
        }
      }
      return;
    }

    // Not dragging: update hover cursor
    const objects = cbs.getObjects();
    const hitRadius = 8 / cbs.getScale();

    if (state.selectedObjectIds.length === 1) {
      const selObj = objects.find((o) => o.id === state.selectedObjectIds[0]);
      if (selObj) {
        for (const h of getHandles(selObj)) {
          if (dist(docPoint, h.pos) < hitRadius) {
            hoverCursor = h.cursor;
            return;
          }
        }
        if (hitTest(selObj, docPoint)) {
          hoverCursor = 'move';
          return;
        }
      }
    } else if (state.selectedObjectIds.length > 1) {
      for (const id of state.selectedObjectIds) {
        const obj = objects.find((o) => o.id === id);
        if (obj && hitTest(obj, docPoint)) {
          hoverCursor = 'move';
          return;
        }
      }
    }

    hoverCursor = 'default';
  },

  onPointerUp(_e: PointerEvent, _docPoint: Point, cbs: ToolCallbacks): void {
    cbs.setToolState({ isDrawing: false });
    resizeHandle = null;
    resizeObjId = null;
    resizeOrig = null;
    resizeOrigPath = null;
    resizeOrigPaths = null;
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
