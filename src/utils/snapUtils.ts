import type { Point, SnapLine } from '@/types/geometry';

export interface SnapResult {
  /** Snapped top-left position for the shape */
  position: Point;
  /** Snap guide lines to display (empty when nothing snapped) */
  snapLines: SnapLine[];
}

/**
 * Snap a shape (defined by top-left pos + size) to canvas key points.
 * Canvas key points: center + 4 corners.
 * Shape key points tested: center + 4 corners.
 * X and Y axes are snapped independently — the closest match within threshold wins.
 *
 * @param pos - current shape top-left (already offset by drag delta)
 * @param w - shape width in doc units
 * @param h - shape height in doc units
 * @param docW - canvas document width
 * @param docH - canvas document height
 * @param threshold - maximum distance in doc units to activate snap
 */
export function computeSnap(
  pos: Point,
  w: number,
  h: number,
  docW: number,
  docH: number,
  threshold: number,
): SnapResult {
  const cx = pos.x + w / 2;
  const cy = pos.y + h / 2;

  // Shape key points (in doc space)
  const shapeX = [pos.x, cx, pos.x + w];         // left, center, right
  const shapeY = [pos.y, cy, pos.y + h];           // top, center, bottom

  // Canvas snap targets
  const canvasX = [0, docW / 2, docW];
  const canvasY = [0, docH / 2, docH];

  let bestDx = Infinity;
  let bestDy = Infinity;
  let snapX: number | null = null;
  let snapY: number | null = null;

  for (const sx of shapeX) {
    for (const tx of canvasX) {
      const d = tx - sx;
      if (Math.abs(d) < Math.abs(bestDx) && Math.abs(d) <= threshold) {
        bestDx = d;
        snapX = tx;
      }
    }
  }

  for (const sy of shapeY) {
    for (const ty of canvasY) {
      const d = ty - sy;
      if (Math.abs(d) < Math.abs(bestDy) && Math.abs(d) <= threshold) {
        bestDy = d;
        snapY = ty;
      }
    }
  }

  const dx = isFinite(bestDx) ? bestDx : 0;
  const dy = isFinite(bestDy) ? bestDy : 0;

  const snapLines: SnapLine[] = [];
  if (snapX !== null) snapLines.push({ orientation: 'vertical',   pos: snapX });
  if (snapY !== null) snapLines.push({ orientation: 'horizontal', pos: snapY });

  return {
    position: { x: pos.x + dx, y: pos.y + dy },
    snapLines,
  };
}
