import type { ToolState } from '@/types/tools';
import type { SceneObject } from '@/types/scene';
import type { ViewportState } from '@/store/uiStore';
import { documentToCanvas, scaleToCanvas } from '@/utils/coordinates';
import { computeStarVertices } from '@/engine/shapeGeometry';

/**
 * Render selection highlights and drawing ghost previews.
 * Drawn on top of the scene and particle layers.
 */
export function renderHandles(
  ctx: CanvasRenderingContext2D,
  toolState: ToolState,
  objects: SceneObject[],
  viewport: ViewportState,
): void {
  ctx.save();

  // Draw selection outlines for selected objects
  for (const id of toolState.selectedObjectIds) {
    const obj = objects.find((o) => o.id === id);
    if (obj) drawSelectionOutline(ctx, obj, viewport);
  }

  // Draw ghost preview while user is actively drawing
  if (toolState.isDrawing && toolState.drawStart && toolState.drawCurrent) {
    drawGhostPreview(ctx, toolState, viewport);
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
      const center = documentToCanvas(
        { x: obj.position.x + obj.width / 2, y: obj.position.y + obj.height / 2 },
        viewport,
      );
      const rx = scaleToCanvas(obj.width / 2 + 2, viewport);
      const ry = scaleToCanvas(obj.height / 2 + 2, viewport);
      ctx.beginPath();
      ctx.ellipse(center.x, center.y, rx, ry, 0, 0, Math.PI * 2);
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
  }

  ctx.setLineDash([]);
}

function drawGhostPreview(
  ctx: CanvasRenderingContext2D,
  toolState: ToolState,
  viewport: ViewportState,
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
    ctx.beginPath();
    ctx.ellipse(cx, cy, cw / 2, ch / 2, 0, 0, Math.PI * 2);
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
