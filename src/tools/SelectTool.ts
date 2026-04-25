import type { Tool, ToolCallbacks } from '@/types/tools';
import type { Point, Path, SnapLine } from '@/types/geometry';
import type { SceneObject } from '@/types/scene';
import { getHandles, getGroupHandles, applyResize } from '@/utils/handleUtils';
import type { HandleId } from '@/utils/handleUtils';
import { computeSnap } from '@/utils/snapUtils';
import { useUIStore } from '@/store/uiStore';
import { uid } from '@/utils/uid';

function boxesOverlap(obj: SceneObject, r: { x: number; y: number; w: number; h: number }): boolean {
  return (
    obj.position.x < r.x + r.w &&
    obj.position.x + obj.width  > r.x &&
    obj.position.y < r.y + r.h &&
    obj.position.y + obj.height > r.y
  );
}

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

interface MultiResizeEntry {
  id: string;
  ox: number; oy: number;
  ow: number; oh: number;
  origPath?: Path;
  origPaths?: Path[];
}

let dragBase: Point | null = null;
let dragObjPositions: DragEntry[] = [];

let marqueeStart: Point | null = null;
let marqueeActive = false;

let resizeHandle: HandleId | null = null;
let resizeObjId: string | null = null;
let resizeOrig: { x: number; y: number; w: number; h: number } | null = null;
let resizeOrigPath: Path | null = null;
let resizeOrigPaths: Path[] | null = null;
let resizeGroupBBox: { x: number; y: number; w: number; h: number } | null = null;
let resizeMultiEntries: MultiResizeEntry[] = [];
let hoverCursor = 'default';
let activeSnapLines: SnapLine[] = [];

function groupBBox(objs: SceneObject[]): { x: number; y: number; w: number; h: number } {
  const x1 = Math.min(...objs.map((o) => o.position.x));
  const y1 = Math.min(...objs.map((o) => o.position.y));
  const x2 = Math.max(...objs.map((o) => o.position.x + o.width));
  const y2 = Math.max(...objs.map((o) => o.position.y + o.height));
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

function rescaleInGroup(
  entry: { ox: number; oy: number; ow: number; oh: number },
  orig: { x: number; y: number; w: number; h: number },
  next: { x: number; y: number; w: number; h: number },
): { x: number; y: number; w: number; h: number } {
  const rx = orig.w > 0 ? (entry.ox - orig.x) / orig.w : 0;
  const ry = orig.h > 0 ? (entry.oy - orig.y) / orig.h : 0;
  const rw = orig.w > 0 ? entry.ow / orig.w : 1;
  const rh = orig.h > 0 ? entry.oh / orig.h : 1;
  return {
    x: next.x + rx * next.w, y: next.y + ry * next.h,
    w: rw * next.w,          h: rh * next.h,
  };
}

export const SelectTool: Tool = {
  name: 'select',

  getCursor(): string {
    return hoverCursor;
  },

  onPointerDown(e: PointerEvent, docPoint: Point, cbs: ToolCallbacks): void {
    const state = cbs.getToolState();
    const objects = cbs.getObjects();
    const hitRadius = 8 / cbs.getScale();

    // Multi-object resize handle hit
    if (state.selectedObjectIds.length > 1) {
      const selObjs = objects.filter((o) => state.selectedObjectIds.includes(o.id));
      const gbbox = groupBBox(selObjs);
      for (const h of getGroupHandles(gbbox)) {
        if (dist(docPoint, h.pos) < hitRadius) {
          resizeHandle = h.id;
          resizeGroupBBox = gbbox;
          resizeMultiEntries = selObjs.map((o) => ({
            id: o.id,
            ox: o.position.x, oy: o.position.y,
            ow: o.width,      oh: o.height,
            origPath:  o.type === 'freehand'   ? o.path  : undefined,
            origPaths: o.type === 'svg-import' ? o.paths : undefined,
          }));
          hoverCursor = h.cursor;
          cbs.pushHistory();
          cbs.setToolState({ isDrawing: true });
          return;
        }
      }
    }

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
            cbs.pushHistory();
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
      if (e.shiftKey) {
        const current = state.selectedObjectIds;
        const newIds = current.includes(hit.id)
          ? current.filter((id) => id !== hit.id)
          : [...current, hit.id];
        cbs.setToolState({ selectedObjectIds: newIds });
      } else {
        if (!state.selectedObjectIds.includes(hit.id)) {
          cbs.setToolState({ selectedObjectIds: [hit.id] });
        }
      }
      const selected = cbs.getToolState().selectedObjectIds;
      dragBase = docPoint;
      cbs.pushHistory();

      if (state.altHeld) {
        // Alt+drag: clone each selected object, drag the clones
        const cloneIds: string[] = [];
        dragObjPositions = [];
        for (const o of objects.filter((o) => selected.includes(o.id))) {
          const cloneId = uid();
          let clone: SceneObject;
          let cloneOrigPath: Path | undefined;
          let cloneOrigPaths: Path[] | undefined;
          if (o.type === 'freehand') {
            const clonedPath: Path = { ...o.path, segments: [...o.path.segments] };
            clone = { ...o, id: cloneId, position: { ...o.position }, path: clonedPath };
            cloneOrigPath = clonedPath;
          } else if (o.type === 'svg-import') {
            const clonedPaths: Path[] = o.paths.map((p) => ({ ...p, segments: [...p.segments] }));
            clone = { ...o, id: cloneId, position: { ...o.position }, paths: clonedPaths };
            cloneOrigPaths = clonedPaths;
          } else {
            clone = { ...o, id: cloneId, position: { ...o.position } };
          }
          cbs.addObject(clone);
          cloneIds.push(cloneId);
          dragObjPositions.push({
            id: cloneId,
            ox: o.position.x,
            oy: o.position.y,
            origPath:  cloneOrigPath,
            origPaths: cloneOrigPaths,
          });
        }
        cbs.setToolState({ selectedObjectIds: cloneIds });
      } else {
        dragObjPositions = objects
          .filter((o) => selected.includes(o.id))
          .map((o) => ({
            id: o.id,
            ox: o.position.x,
            oy: o.position.y,
            origPath:  o.type === 'freehand'   ? o.path  : undefined,
            origPaths: o.type === 'svg-import' ? o.paths : undefined,
          }));
      }

      hoverCursor = 'move';
      cbs.setToolState({ isDrawing: true });
    } else {
      marqueeStart = docPoint;
      marqueeActive = true;
      cbs.setToolState({
        selectedObjectIds: [],
        isDrawing: true,
        drawStart: docPoint,
        drawCurrent: docPoint,
      });
      dragBase = null;
      dragObjPositions = [];
      hoverCursor = 'default';
    }
  },

  onPointerMove(e: PointerEvent, docPoint: Point, cbs: ToolCallbacks): void {
    void e;
    const state = cbs.getToolState();

    // Marquee drag in progress
    if (marqueeActive) {
      cbs.setToolState({ drawCurrent: docPoint });
      return;
    }

    // Multi-object resize in progress
    if (resizeHandle && resizeGroupBBox && resizeMultiEntries.length > 0) {
      const result = applyResize(resizeHandle, docPoint, resizeGroupBBox, state.shiftHeld, state.altHeld);
      const ng = { x: result.position.x, y: result.position.y, w: result.width, h: result.height };
      for (const entry of resizeMultiEntries) {
        const scaled = rescaleInGroup(entry, resizeGroupBBox, ng);
        const ob = { x: entry.ox, y: entry.oy, w: entry.ow, h: entry.oh };
        const nb = { x: scaled.x, y: scaled.y, w: scaled.w, h: scaled.h };
        if (entry.origPath) {
          cbs.updateObject(entry.id, {
            position: { x: scaled.x, y: scaled.y },
            width: scaled.w, height: scaled.h,
            path: scalePath(entry.origPath, ob, nb),
          } as unknown as Partial<SceneObject>);
        } else if (entry.origPaths) {
          cbs.updateObject(entry.id, {
            position: { x: scaled.x, y: scaled.y },
            width: scaled.w, height: scaled.h,
            paths: scalePaths(entry.origPaths, ob, nb),
          } as unknown as Partial<SceneObject>);
        } else {
          cbs.updateObject(entry.id, {
            position: { x: scaled.x, y: scaled.y },
            width: scaled.w, height: scaled.h,
          });
        }
      }
      return;
    }

    // Resize in progress
    if (resizeHandle && resizeOrig && resizeObjId) {
      const result = applyResize(resizeHandle, docPoint, resizeOrig, state.shiftHeld, state.altHeld);
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

      // Snap single-object drag to canvas key points
      let snapDx = 0;
      let snapDy = 0;
      if (dragObjPositions.length === 1) {
        const entry = dragObjPositions[0]!;
        const obj = cbs.getObjects().find((o) => o.id === entry.id);
        if (obj) {
          const vp = useUIStore.getState().viewport;
          const threshold = 14 / cbs.getScale();
          const snap = computeSnap(
            { x: entry.ox + dx, y: entry.oy + dy },
            obj.width, obj.height,
            vp.documentWidth, vp.documentHeight,
            threshold,
          );
          snapDx = snap.position.x - (entry.ox + dx);
          snapDy = snap.position.y - (entry.oy + dy);
          activeSnapLines = snap.snapLines;
        }
      } else {
        activeSnapLines = [];
      }

      for (const entry of dragObjPositions) {
        const newX = entry.ox + dx + snapDx;
        const newY = entry.oy + dy + snapDy;
        if (entry.origPath) {
          const pdx = newX - entry.ox;
          const pdy = newY - entry.oy;
          cbs.updateObject(entry.id, {
            position: { x: newX, y: newY },
            path: translatePath(entry.origPath, pdx, pdy),
          } as unknown as Partial<SceneObject>);
        } else if (entry.origPaths) {
          const pdx = newX - entry.ox;
          const pdy = newY - entry.oy;
          cbs.updateObject(entry.id, {
            position: { x: newX, y: newY },
            paths: translatePaths(entry.origPaths, pdx, pdy),
          } as unknown as Partial<SceneObject>);
        } else {
          cbs.updateObject(entry.id, { position: { x: newX, y: newY } });
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
      const selObjs = objects.filter((o) => state.selectedObjectIds.includes(o.id));
      const gbbox = groupBBox(selObjs);
      for (const h of getGroupHandles(gbbox)) {
        if (dist(docPoint, h.pos) < hitRadius) {
          hoverCursor = h.cursor;
          return;
        }
      }
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

  onPointerUp(_e: PointerEvent, docPoint: Point, cbs: ToolCallbacks): void {
    if (marqueeActive && marqueeStart) {
      const ex = docPoint.x, ey = docPoint.y;
      const rect = {
        x: Math.min(marqueeStart.x, ex),
        y: Math.min(marqueeStart.y, ey),
        w: Math.abs(ex - marqueeStart.x),
        h: Math.abs(ey - marqueeStart.y),
      };
      const hits = cbs.getObjects().filter(
        (o) => !o.locked && o.visible && boxesOverlap(o, rect),
      );
      cbs.setToolState({
        selectedObjectIds: hits.map((o) => o.id),
        isDrawing: false,
        drawStart: null,
        drawCurrent: null,
      });
      marqueeStart = null;
      marqueeActive = false;
    } else {
      cbs.setToolState({ isDrawing: false });
    }
    resizeHandle = null;
    resizeObjId = null;
    resizeOrig = null;
    resizeOrigPath = null;
    resizeOrigPaths = null;
    resizeGroupBBox = null;
    resizeMultiEntries = [];
    dragBase = null;
    dragObjPositions = [];
    activeSnapLines = [];
  },

  getSnapLines(): SnapLine[] {
    return activeSnapLines;
  },

  onKeyDown(e: KeyboardEvent, cbs: ToolCallbacks): void {
    const state = cbs.getToolState();
    if (e.key === 'Delete' || e.key === 'Backspace') {
      cbs.pushHistory();
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
