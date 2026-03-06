import type { SceneObject, EllipseObject, FreehandObject, SVGImportObject } from '@/types/scene';
import type { ViewportState } from '@/store/uiStore';
import { documentToCanvas, scaleToCanvas } from '@/utils/coordinates';
import { computeStarVertices } from '@/engine/shapeGeometry';

/**
 * Draw shape outlines for all visible scene objects.
 * Uses a faint white stroke — purely for editing reference, never exported.
 */
export function renderScene(
  ctx: CanvasRenderingContext2D,
  objects: SceneObject[],
  viewport: ViewportState,
): void {
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 1;

  for (const obj of objects) {
    if (!obj.visible) continue;
    drawObjectOutline(ctx, obj, viewport);
  }

  ctx.restore();
}

function drawObjectOutline(
  ctx: CanvasRenderingContext2D,
  obj: SceneObject,
  viewport: ViewportState,
): void {
  switch (obj.type) {
    case 'rectangle':
      drawRectangleOutline(ctx, obj, viewport);
      break;
    case 'ellipse':
      drawEllipseOutline(ctx, obj, viewport);
      break;
    case 'star':
      drawStarOutline(ctx, obj, viewport);
      break;
    case 'freehand':
      drawFreehandOutline(ctx, obj, viewport);
      break;
    case 'svg-import':
      drawSVGImportOutline(ctx, obj as SVGImportObject, viewport);
      break;
    default:
      break;
  }
}

function drawRectangleOutline(
  ctx: CanvasRenderingContext2D,
  obj: SceneObject,
  viewport: ViewportState,
): void {
  const tl = documentToCanvas(obj.position, viewport);
  const w = scaleToCanvas(obj.width, viewport);
  const h = scaleToCanvas(obj.height, viewport);
  ctx.beginPath();
  ctx.rect(tl.x, tl.y, w, h);
  ctx.stroke();
}

function drawEllipseOutline(
  ctx: CanvasRenderingContext2D,
  obj: EllipseObject,
  viewport: ViewportState,
): void {
  const center = documentToCanvas(
    { x: obj.position.x + obj.width / 2, y: obj.position.y + obj.height / 2 },
    viewport,
  );
  const rx = scaleToCanvas(obj.width / 2, viewport);
  const ry = scaleToCanvas(obj.height / 2, viewport);
  ctx.beginPath();
  ctx.ellipse(center.x, center.y, rx, ry, 0, obj.arcStartAngle, obj.arcEndAngle);
  ctx.stroke();
}

function drawStarOutline(
  ctx: CanvasRenderingContext2D,
  obj: SceneObject & { type: 'star' },
  viewport: ViewportState,
): void {
  const cx = obj.position.x + obj.width / 2;
  const cy = obj.position.y + obj.height / 2;
  const outerR = Math.min(obj.width, obj.height) / 2;
  const innerR = outerR * obj.innerRadiusRatio;
  const verts = computeStarVertices(cx, cy, outerR, innerR, obj.points);

  ctx.beginPath();
  for (let i = 0; i < verts.length; i++) {
    const cv = documentToCanvas(verts[i]!, viewport);
    if (i === 0) ctx.moveTo(cv.x, cv.y);
    else ctx.lineTo(cv.x, cv.y);
  }
  ctx.closePath();
  ctx.stroke();
}

function drawFreehandOutline(
  ctx: CanvasRenderingContext2D,
  obj: FreehandObject,
  viewport: ViewportState,
): void {
  if (obj.path.segments.length === 0) return;
  ctx.beginPath();
  let started = false;
  for (const seg of obj.path.segments) {
    if (seg.type !== 'line') continue;
    if (!started) {
      const from = documentToCanvas(seg.from, viewport);
      ctx.moveTo(from.x, from.y);
      started = true;
    }
    const to = documentToCanvas(seg.to, viewport);
    ctx.lineTo(to.x, to.y);
  }
  if (started) ctx.stroke();
}

function drawSVGImportOutline(
  ctx: CanvasRenderingContext2D,
  obj: SVGImportObject,
  viewport: ViewportState,
): void {
  for (const path of obj.paths) {
    if (path.segments.length === 0) continue;
    ctx.beginPath();
    let started = false;
    for (const seg of path.segments) {
      if (seg.type !== 'line') continue;
      if (!started) {
        const from = documentToCanvas(seg.from, viewport);
        ctx.moveTo(from.x, from.y);
        started = true;
      }
      const to = documentToCanvas(seg.to, viewport);
      ctx.lineTo(to.x, to.y);
    }
    if (started) {
      if (path.closed) ctx.closePath();
      ctx.stroke();
    }
  }
}
