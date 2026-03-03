import type { Point } from '@/types/geometry';
import type { SceneObject } from '@/types/scene';

export type HandleId = 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w';

export interface HandleInfo {
  id: HandleId;
  pos: Point;      // document space
  cursor: string;  // CSS cursor string
}

/** Returns resize handle positions for a selected object (doc space). */
export function getHandles(obj: SceneObject): HandleInfo[] {
  const { x, y } = obj.position;
  const { width: w, height: h } = obj;

  const handles: HandleInfo[] = [
    { id: 'nw', pos: { x, y },                  cursor: 'nwse-resize' },
    { id: 'ne', pos: { x: x + w, y },            cursor: 'nesw-resize' },
    { id: 'sw', pos: { x, y: y + h },            cursor: 'nesw-resize' },
    { id: 'se', pos: { x: x + w, y: y + h },     cursor: 'nwse-resize' },
  ];

  // Midpoint edge handles only for rectangle (ellipse + star resize from bbox corners)
  if (obj.type === 'rectangle') {
    handles.push(
      { id: 'n', pos: { x: x + w / 2, y },          cursor: 'ns-resize' },
      { id: 's', pos: { x: x + w / 2, y: y + h },   cursor: 'ns-resize' },
      { id: 'e', pos: { x: x + w, y: y + h / 2 },   cursor: 'ew-resize' },
      { id: 'w', pos: { x, y: y + h / 2 },          cursor: 'ew-resize' },
    );
  }

  return handles;
}

/**
 * Compute new { position, width, height } after dragging handleId to docPt.
 * orig is the shape bbox before the resize started.
 * shiftHeld enforces proportional resize (corners only).
 */
export function applyResize(
  handleId: HandleId,
  docPt: Point,
  orig: { x: number; y: number; w: number; h: number },
  shiftHeld: boolean,
): { position: Point; width: number; height: number } {
  const MIN = 4;

  switch (handleId) {
    case 'nw':
      return computeCorner({ x: orig.x + orig.w, y: orig.y + orig.h }, docPt, orig, shiftHeld, MIN);
    case 'ne':
      return computeCorner({ x: orig.x, y: orig.y + orig.h }, docPt, orig, shiftHeld, MIN);
    case 'sw':
      return computeCorner({ x: orig.x + orig.w, y: orig.y }, docPt, orig, shiftHeld, MIN);
    case 'se':
      return computeCorner({ x: orig.x, y: orig.y }, docPt, orig, shiftHeld, MIN);
    case 'n': {
      const anchorY = orig.y + orig.h;
      return {
        position: { x: orig.x, y: Math.min(anchorY, docPt.y) },
        width: orig.w,
        height: Math.max(MIN, Math.abs(anchorY - docPt.y)),
      };
    }
    case 's': {
      const anchorY = orig.y;
      return {
        position: { x: orig.x, y: Math.min(anchorY, docPt.y) },
        width: orig.w,
        height: Math.max(MIN, Math.abs(anchorY - docPt.y)),
      };
    }
    case 'e': {
      const anchorX = orig.x;
      return {
        position: { x: Math.min(anchorX, docPt.x), y: orig.y },
        width: Math.max(MIN, Math.abs(anchorX - docPt.x)),
        height: orig.h,
      };
    }
    case 'w': {
      const anchorX = orig.x + orig.w;
      return {
        position: { x: Math.min(anchorX, docPt.x), y: orig.y },
        width: Math.max(MIN, Math.abs(anchorX - docPt.x)),
        height: orig.h,
      };
    }
    default:
      return { position: { x: orig.x, y: orig.y }, width: orig.w, height: orig.h };
  }
}

function computeCorner(
  anchor: Point,
  docPt: Point,
  orig: { x: number; y: number; w: number; h: number },
  shiftHeld: boolean,
  min: number,
): { position: Point; width: number; height: number } {
  let newW = Math.abs(anchor.x - docPt.x);
  let newH = Math.abs(anchor.y - docPt.y);

  if (shiftHeld && orig.h > 0) {
    const ratio = orig.w / orig.h;
    if (newH === 0 || newW / newH >= ratio) {
      newH = newW / ratio;
    } else {
      newW = newH * ratio;
    }
  }

  newW = Math.max(min, newW);
  newH = Math.max(min, newH);

  // Position: anchor is the fixed corner; expand toward docPt
  const newX = docPt.x >= anchor.x ? anchor.x : anchor.x - newW;
  const newY = docPt.y >= anchor.y ? anchor.y : anchor.y - newH;

  return { position: { x: newX, y: newY }, width: newW, height: newH };
}
