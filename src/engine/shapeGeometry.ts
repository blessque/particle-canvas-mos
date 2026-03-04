import type { Point } from '@/types/geometry';
import type { SceneObject, EllipseObject, FreehandObject } from '@/types/scene';
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

/**
 * Fan-fill samples at a corner vertex between two edges.
 * Sweeps the shorter arc from nA to nB, filling the convex exterior gap.
 * Returns empty for concave corners (arc >= 180°) or near-straight edges.
 */
function sampleCorner(vertex: Point, nA: Point, nB: Point): OutlineSample[] {
  const angleA = Math.atan2(nA.y, nA.x);
  const angleB = Math.atan2(nB.y, nB.x);
  let delta = angleB - angleA;
  // Normalize to (-π, π] — always the shorter arc
  while (delta > Math.PI) delta -= 2 * Math.PI;
  while (delta < -Math.PI) delta += 2 * Math.PI;
  // Skip near-straight edges and concave (reflex) corners
  if (Math.abs(delta) < 0.01 || Math.abs(delta) >= Math.PI) return [];

  const ANGLE_STEP = Math.PI / 16; // ~11.25° per sample
  const n = Math.max(1, Math.round(Math.abs(delta) / ANGLE_STEP));
  const samples: OutlineSample[] = [];
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const angle = angleA + delta * t;
    samples.push({ point: vertex, normal: { x: Math.cos(angle), y: Math.sin(angle) } });
  }
  return samples;
}

/**
 * Sample a closed polygon outline with per-edge normals and corner fan-fill.
 * Eliminates the empty-wedge artefact at sharp corners.
 */
function samplePolygon(vertices: Point[], center: Point, step: number): OutlineSample[] {
  const n = vertices.length;
  const samples: OutlineSample[] = [];

  // Pre-compute outward normals for every edge
  const edgeNormals: Point[] = vertices.map((v, i) => {
    const next = vertices[(i + 1) % n]!;
    const dir = sub(next, v);
    let normal = normalize(perp2D(normalize(dir)));
    const mid: Point = { x: (v.x + next.x) / 2, y: (v.y + next.y) / 2 };
    if (dot(normal, sub(mid, center)) < 0) normal = scale(normal, -1);
    return normal;
  });

  for (let i = 0; i < n; i++) {
    const p0 = vertices[i]!;
    const p1 = vertices[(i + 1) % n]!;
    const nCurr = edgeNormals[i]!;
    const nNext = edgeNormals[(i + 1) % n]!;
    samples.push(...sampleEdge(p0, p1, center, step));
    // Fan-fill the corner at p1 (junction between edge i and edge i+1)
    samples.push(...sampleCorner(p1, nCurr, nNext));
  }
  return samples;
}

function sampleRectangle(obj: SceneObject & { type: 'rectangle' }): OutlineSample[] {
  const { position: { x, y }, width, height } = obj;
  const cx = x + width / 2;
  const cy = y + height / 2;
  const tl: Point = { x, y };
  const tr: Point = { x: x + width, y };
  const br: Point = { x: x + width, y: y + height };
  const bl: Point = { x, y: y + height };
  return samplePolygon([tl, tr, br, bl], { x: cx, y: cy }, 2);
}

/**
 * Compute arc start/end angles from a drag delta vector and ellipse mode.
 * Uses canvas coordinate convention (Y-down, clockwise angles).
 */
export function computeEllipseArcAngles(
  dx: number,
  dy: number,
  mode: 'half' | 'quarter',
): { start: number; end: number } {
  if (mode === 'quarter') {
    // dy < 0 = dragging up on screen (doc Y increases downward)
    if (dx >= 0 && dy <= 0) return { start: 0, end: Math.PI / 2 };
    if (dx >= 0 && dy > 0)  return { start: (3 * Math.PI) / 2, end: 2 * Math.PI };
    if (dx < 0 && dy <= 0)  return { start: Math.PI / 2, end: Math.PI };
    return { start: Math.PI, end: (3 * Math.PI) / 2 };
  }
  // half
  if (Math.abs(dx) >= Math.abs(dy)) {
    if (dy <= 0) return { start: Math.PI, end: 2 * Math.PI }; // top half (rainbow arch)
    return { start: 0, end: Math.PI };                         // bottom half
  }
  if (dx > 0) return { start: -(Math.PI / 2), end: Math.PI / 2 }; // right half
  return { start: Math.PI / 2, end: (3 * Math.PI) / 2 };          // left half
}

function sampleEllipse(obj: EllipseObject): OutlineSample[] {
  const { position: { x, y }, width, height, arcStartAngle, arcEndAngle } = obj;
  const cx = x + width / 2;
  const cy = y + height / 2;
  const rx = width / 2;
  const ry = height / 2;
  if (rx <= 0 || ry <= 0) return [];

  const arcRange = arcEndAngle - arcStartAngle;
  const arcFraction = arcRange / (2 * Math.PI);
  const circumference = Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry)));
  const n = Math.max(8, Math.floor(circumference * arcFraction / 2));
  const samples: OutlineSample[] = [];

  for (let i = 0; i < n; i++) {
    const t = arcStartAngle + (arcRange * i) / n;
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
  const center: Point = { x: cx, y: cy };
  const verts = computeStarVertices(cx, cy, outerR, innerR, points);
  return samplePolygon(verts, center, 2);
}

function sampleFreehandPath(obj: FreehandObject): OutlineSample[] {
  const samples: OutlineSample[] = [];
  const segs = obj.path.segments.filter((s) => s.type === 'line');

  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i]!;
    if (seg.type !== 'line') continue;
    const dx = seg.to.x - seg.from.x;
    const dy = seg.to.y - seg.from.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 1) continue;
    // Left-perpendicular normal (both sides handled by spawnDirection in distributor)
    const nx = -dy / len;
    const ny = dx / len;
    const normal: Point = { x: nx, y: ny };
    const steps = Math.max(1, Math.floor(len / 2));
    for (let j = 0; j <= steps; j++) {
      const t = j / steps;
      samples.push({
        point: { x: seg.from.x + dx * t, y: seg.from.y + dy * t },
        normal,
      });
    }

    // Fan-fill the corner at the junction to the next segment
    const nextSeg = segs[i + 1];
    if (nextSeg && nextSeg.type === 'line') {
      const ndx = nextSeg.to.x - nextSeg.from.x;
      const ndy = nextSeg.to.y - nextSeg.from.y;
      const nlen = Math.sqrt(ndx * ndx + ndy * ndy);
      if (nlen >= 1) {
        const nextNormal: Point = { x: -ndy / nlen, y: ndx / nlen };
        // Fan for the left side (positive normals)
        samples.push(...sampleCorner(seg.to, normal, nextNormal));
        // Fan for the right side (negative normals — for 'both' and 'inside' spawn directions)
        samples.push(...sampleCorner(seg.to, { x: -nx, y: -ny }, { x: ndy / nlen, y: -ndx / nlen }));
      }
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
