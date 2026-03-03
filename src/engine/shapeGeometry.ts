import type { Point } from '@/types/geometry';
import type { SceneObject, FreehandObject } from '@/types/scene';
import { sub, normalize, perp2D, dot, scale } from './vectorMath';

export interface OutlineSample {
  point: Point;
  normal: Point; // outward unit normal in document space
}

/**
 * Compute evenly spaced star vertices (outer and inner alternating).
 * Returns 2*points vertices starting from the top (angle = -π/2).
 */
export function computeStarVertices(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  numPoints: number,
): Point[] {
  const vertices: Point[] = [];
  const total = numPoints * 2;
  for (let i = 0; i < total; i++) {
    const angle = (Math.PI * i) / numPoints - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    vertices.push({ x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r });
  }
  return vertices;
}

/** Sample a straight edge from p0 to p1 at `step` doc-unit intervals */
function sampleEdge(p0: Point, p1: Point, center: Point, step: number): OutlineSample[] {
  const samples: OutlineSample[] = [];
  const dir = sub(p1, p0);
  const edgeLen = Math.sqrt(dir.x * dir.x + dir.y * dir.y);
  if (edgeLen === 0) return samples;

  const n = Math.max(1, Math.floor(edgeLen / step));
  // Compute outward-facing normal from edge direction
  let normal = normalize(perp2D(normalize(dir)));
  // Ensure normal points away from center
  const mid: Point = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
  const outward = sub(mid, center);
  if (dot(normal, outward) < 0) {
    normal = scale(normal, -1);
  }

  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const point: Point = { x: p0.x + dir.x * t, y: p0.y + dir.y * t };
    samples.push({ point, normal });
  }
  return samples;
}

function sampleRectangle(obj: SceneObject & { type: 'rectangle' }): OutlineSample[] {
  const { position: { x, y }, width, height } = obj;
  const step = 2;
  const cx = x + width / 2;
  const cy = y + height / 2;
  const tl: Point = { x, y };
  const tr: Point = { x: x + width, y };
  const br: Point = { x: x + width, y: y + height };
  const bl: Point = { x, y: y + height };
  const center: Point = { x: cx, y: cy };

  return [
    ...sampleEdge(tl, tr, center, step),
    ...sampleEdge(tr, br, center, step),
    ...sampleEdge(br, bl, center, step),
    ...sampleEdge(bl, tl, center, step),
  ];
}

function sampleEllipse(obj: SceneObject & { type: 'ellipse' }): OutlineSample[] {
  const { position: { x, y }, width, height } = obj;
  const cx = x + width / 2;
  const cy = y + height / 2;
  const rx = width / 2;
  const ry = height / 2;
  if (rx <= 0 || ry <= 0) return [];

  const circumference = Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry)));
  const n = Math.max(8, Math.floor(circumference / 2));
  const samples: OutlineSample[] = [];

  for (let i = 0; i < n; i++) {
    const t = (2 * Math.PI * i) / n;
    const px = cx + Math.cos(t) * rx;
    const py = cy + Math.sin(t) * ry;
    // Ellipse outward normal is the gradient of (x/rx)^2 + (y/ry)^2 = 1
    const nx = Math.cos(t) / rx;
    const ny = Math.sin(t) / ry;
    const len = Math.sqrt(nx * nx + ny * ny);
    const normal: Point = len > 0 ? { x: nx / len, y: ny / len } : { x: Math.cos(t), y: Math.sin(t) };
    samples.push({ point: { x: px, y: py }, normal });
  }
  return samples;
}

function sampleStar(obj: SceneObject & { type: 'star' }): OutlineSample[] {
  const { position: { x, y }, width, height, points, innerRadiusRatio } = obj;
  const cx = x + width / 2;
  const cy = y + height / 2;
  const outerR = Math.min(width, height) / 2;
  const innerR = outerR * innerRadiusRatio;
  const step = 2;
  const center: Point = { x: cx, y: cy };

  const verts = computeStarVertices(cx, cy, outerR, innerR, points);
  const samples: OutlineSample[] = [];

  for (let i = 0; i < verts.length; i++) {
    const p0 = verts[i]!;
    const p1 = verts[(i + 1) % verts.length]!;
    samples.push(...sampleEdge(p0, p1, center, step));
  }
  return samples;
}

function sampleFreehandPath(obj: FreehandObject): OutlineSample[] {
  const samples: OutlineSample[] = [];
  for (const seg of obj.path.segments) {
    if (seg.type !== 'line') continue;
    const dx = seg.to.x - seg.from.x;
    const dy = seg.to.y - seg.from.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) continue;
    // Perpendicular normal (both sides handled by spawnDirection in distributor)
    const nx = -dy / len;
    const ny = dx / len;
    const steps = Math.max(1, Math.floor(len / 2));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      samples.push({
        point: { x: seg.from.x + dx * t, y: seg.from.y + dy * t },
        normal: { x: nx, y: ny },
      });
    }
  }
  return samples;
}

/**
 * Returns outline sample points (with outward normals) for a given scene object.
 * Returns empty array for unsupported types.
 */
export function sampleShapeOutline(obj: SceneObject): OutlineSample[] {
  switch (obj.type) {
    case 'rectangle': return sampleRectangle(obj);
    case 'ellipse':   return sampleEllipse(obj);
    case 'star':      return sampleStar(obj);
    case 'freehand':  return sampleFreehandPath(obj);
    default:          return [];
  }
}

/** Compute the axis-aligned bounding box for a scene object */
export function getObjectBBox(obj: SceneObject): { x: number; y: number; w: number; h: number } {
  return { x: obj.position.x, y: obj.position.y, w: obj.width, h: obj.height };
}
