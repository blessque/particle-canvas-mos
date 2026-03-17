import type { Tool, ToolCallbacks } from '@/types/tools';
import type { Point } from '@/types/geometry';
import type { FreehandObject } from '@/types/scene';
import { uid } from '@/utils/uid';

let rawPoints: Point[] = [];

function dist(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Chaikin corner-cutting — approximates a smooth B-spline from a polyline. */
function chaikin(pts: Point[], iterations = 4): Point[] {
  let result = pts;
  for (let i = 0; i < iterations; i++) {
    const next: Point[] = [result[0]!];
    for (let j = 0; j < result.length - 1; j++) {
      const a = result[j]!;
      const b = result[j + 1]!;
      next.push({ x: 0.75 * a.x + 0.25 * b.x, y: 0.75 * a.y + 0.25 * b.y });
      next.push({ x: 0.25 * a.x + 0.75 * b.x, y: 0.25 * a.y + 0.75 * b.y });
    }
    next.push(result[result.length - 1]!);
    result = next;
  }
  return result;
}

function buildFreehand(points: Point[]): FreehandObject {
  let minX = points[0]!.x, minY = points[0]!.y;
  let maxX = minX, maxY = minY;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }

  const segments = [];
  for (let i = 0; i < points.length - 1; i++) {
    segments.push({ type: 'line' as const, from: points[i]!, to: points[i + 1]! });
  }

  return {
    id: uid(),
    type: 'freehand',
    position: { x: minX, y: minY },
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
    rotation: 0,
    visible: true,
    locked: false,
    path: { segments, closed: false },
  };
}

export const FreehandTool: Tool = {
  name: 'freehand',

  getCursor(): string {
    return 'crosshair';
  },

  onPointerDown(_e: PointerEvent, docPoint: Point, cbs: ToolCallbacks): void {
    rawPoints = [docPoint];
    cbs.setToolState({ isDrawing: true, pendingPath: [docPoint] });
  },

  onPointerMove(_e: PointerEvent, docPoint: Point, cbs: ToolCallbacks): void {
    const state = cbs.getToolState();
    if (!state.isDrawing) return;

    // Threshold of 1 doc unit — capture dense points so Chaikin has enough to work with
    const last = rawPoints[rawPoints.length - 1];
    if (last && dist(last, docPoint) < 1) return;

    rawPoints.push(docPoint);
    cbs.setToolState({ pendingPath: [...rawPoints], drawCurrent: docPoint });
  },

  onPointerUp(_e: PointerEvent, docPoint: Point, cbs: ToolCallbacks): void {
    // Always include the exact release point
    const last = rawPoints[rawPoints.length - 1];
    if (!last || dist(last, docPoint) >= 1) {
      rawPoints.push(docPoint);
    }

    if (rawPoints.length < 2) {
      rawPoints = [];
      cbs.setToolState({ isDrawing: false, pendingPath: null });
      return;
    }

    const smoothed = chaikin(rawPoints, 4);
    const obj = buildFreehand(smoothed);
    cbs.addObject(obj);
    cbs.setToolState({ isDrawing: false, pendingPath: null });
    rawPoints = [];
  },

  onKeyDown(e: KeyboardEvent, cbs: ToolCallbacks): void {
    if (e.key === 'Escape') {
      rawPoints = [];
      cbs.setToolState({ isDrawing: false, pendingPath: null });
    }
  },
};
