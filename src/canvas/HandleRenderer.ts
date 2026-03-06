import type { ToolState } from '@/types/tools';
import type { SceneObject, EllipseObject } from '@/types/scene';
import type { ViewportState } from '@/store/uiStore';
import { documentToCanvas, scaleToCanvas } from '@/utils/coordinates';
import { computeStarVertices, computeEllipseArcAngles } from '@/engine/shapeGeometry';
import { getHandles } from '@/utils/handleUtils';

/**
 * Render selection highlights and drawing ghost previews.
 * Drawn on top of the scene and particle layers.
 */
export function renderHandles(
  ctx: CanvasRenderingContext2D,
  toolState: ToolState,
  objects: SceneObject[],
  viewport: ViewportState,
  ellipseMode: 'full' | 'half' | 'quarter',
): void {
  ctx.save();

  // Draw selection outlines for selected objects
  for (const id of toolState.selectedObjectIds) {
    const obj = objects.find((o) => o.id === id);
    if (obj) {
      drawSelectionOutline(ctx, obj, viewport);
      drawResizeHandles(ctx, obj, viewport);
    }
  }

  // Draw ghost preview while user is actively drawing a shape
  if (toolState.isDrawing && toolState.drawStart && toolState.drawCurrent &&
      toolState.activeTool !== 'freehand' && toolState.activeTool !== 'select') {
    drawGhostPreview(ctx, toolState, viewport, ellipseMode);
  }

  // Freehand live preview
  if (toolState.activeTool === 'freehand' && toolState.pendingPath && toolState.pendingPath.length > 1) {
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);
    ctx.beginPath();
    const first = documentToCanvas(toolState.pendingPath[0]!, viewport);
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < toolState.pendingPath.length; i++) {
      const pt = documentToCanvas(toolState.pendingPath[i]!, viewport);
      ctx.lineTo(pt.x, pt.y);
    }
    ctx.stroke();
  }

  ctx.restore();
}

function drawSelectionOutline(
  ctx: CanvasRenderingContext2D,
  obj: SceneObject,
  viewport: ViewportState,
): void {
  ctx.strokeStyle = '#4af';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 3]);

  switch (obj.type) {
    case 'rectangle': {
      const tl = documentToCanvas(obj.position, viewport);
      const w = scaleToCanvas(obj.width, viewport);
      const h = scaleToCanvas(obj.height, viewport);
      ctx.beginPath();
      ctx.rect(tl.x - 2, tl.y - 2, w + 4, h + 4);
      ctx.stroke();
      break;
    }
    case 'ellipse': {
      const ellipseObj = obj as EllipseObject;
      const center = documentToCanvas(
        { x: obj.position.x + obj.width / 2, y: obj.position.y + obj.height / 2 },
        viewport,
      );
      const rx = scaleToCanvas(obj.width / 2 + 2, viewport);
      const ry = scaleToCanvas(obj.height / 2 + 2, viewport);
      ctx.beginPath();
      ctx.ellipse(center.x, center.y, rx, ry, 0, ellipseObj.arcStartAngle, ellipseObj.arcEndAngle);
      ctx.stroke();
      break;
    }
    case 'star': {
      const cx = obj.position.x + obj.width / 2;
      const cy = obj.position.y + obj.height / 2;
      const outerR = Math.min(obj.width, obj.height) / 2 + 4;
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
      break;
    }
    case 'freehand': {
      if (obj.path.segments.length === 0) break;
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
      break;
    }
    case 'svg-import': {
      const tl = documentToCanvas(obj.position, viewport);
      const w = scaleToCanvas(obj.width, viewport);
      const h = scaleToCanvas(obj.height, viewport);
      ctx.beginPath();
      ctx.rect(tl.x - 2, tl.y - 2, w + 4, h + 4);
      ctx.stroke();
      break;
    }
  }

  ctx.setLineDash([]);
}

function drawResizeHandles(
  ctx: CanvasRenderingContext2D,
  obj: SceneObject,
  viewport: ViewportState,
): void {
  const handles = getHandles(obj);
  const SIZE = 7; // screen pixels

  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#4af';
  ctx.lineWidth = 1;
  ctx.setLineDash([]);

  for (const h of handles) {
    const cv = documentToCanvas(h.pos, viewport);
    ctx.fillRect(cv.x - SIZE / 2, cv.y - SIZE / 2, SIZE, SIZE);
    ctx.strokeRect(cv.x - SIZE / 2, cv.y - SIZE / 2, SIZE, SIZE);
  }
}

function drawGhostPreview(
  ctx: CanvasRenderingContext2D,
  toolState: ToolState,
  viewport: ViewportState,
  ellipseMode: 'full' | 'half' | 'quarter',
): void {
  const { activeTool, drawStart, drawCurrent, shiftHeld } = toolState;
  if (!drawStart || !drawCurrent) return;

  let x = Math.min(drawStart.x, drawCurrent.x);
  let y = Math.min(drawStart.y, drawCurrent.y);
  let w = Math.abs(drawCurrent.x - drawStart.x);
  let h = Math.abs(drawCurrent.y - drawStart.y);

  if (shiftHeld) {
    const size = Math.min(w, h);
    w = size;
    h = size;
    x = drawStart.x < drawCurrent.x ? drawStart.x : drawStart.x - size;
    y = drawStart.y < drawCurrent.y ? drawStart.y : drawStart.y - size;
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);

  const tl = documentToCanvas({ x, y }, viewport);
  const cw = scaleToCanvas(w, viewport);
  const ch = scaleToCanvas(h, viewport);

  if (activeTool === 'rectangle') {
    ctx.beginPath();
    ctx.rect(tl.x, tl.y, cw, ch);
    ctx.stroke();
  } else if (activeTool === 'ellipse') {
    const cx = tl.x + cw / 2;
    const cy = tl.y + ch / 2;
    let arcStart = 0;
    let arcEnd = Math.PI * 2;
    if (ellipseMode !== 'full') {
      const dx = drawCurrent.x - drawStart.x;
      const dy = drawCurrent.y - drawStart.y;
      const angles = computeEllipseArcAngles(dx, dy, ellipseMode);
      arcStart = angles.start;
      arcEnd = angles.end;
    }
    ctx.beginPath();
    ctx.ellipse(cx, cy, cw / 2, ch / 2, 0, arcStart, arcEnd);
    ctx.stroke();
  } else if (activeTool === 'star') {
    const docCx = x + w / 2;
    const docCy = y + h / 2;
    const outerR = Math.min(w, h) / 2;
    const innerR = outerR * 0.4;
    const verts = computeStarVertices(docCx, docCy, outerR, innerR, 5);
    ctx.beginPath();
    for (let i = 0; i < verts.length; i++) {
      const cv = documentToCanvas(verts[i]!, viewport);
      if (i === 0) ctx.moveTo(cv.x, cv.y);
      else ctx.lineTo(cv.x, cv.y);
    }
    ctx.closePath();
    ctx.stroke();
  }

  ctx.setLineDash([]);
}
