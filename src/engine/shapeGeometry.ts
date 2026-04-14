import type { Point, Path, OutlineSample } from '@/types/geometry';
import type { SceneObject, EllipseObject, FreehandObject, SVGImportObject } from '@/types/scene';
import { sub, normalize, perp2D, scale } from './vectorMath';

export type { OutlineSample };

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


/**
 * Fan-fill samples at a corner vertex between two edges.
 * Sweeps the shorter arc from nA to nB, filling the convex exterior gap.
 * Returns empty for concave corners (arc >= 180°) or near-straight edges.
 * radius: distance from vertex where each fan sample is placed (= edge step).
 */
function sampleCorner(vertex: Point, nA: Point, nB: Point, radius = 4): OutlineSample[] {
  const angleA = Math.atan2(nA.y, nA.x);
  const angleB = Math.atan2(nB.y, nB.x);
  let delta = angleB - angleA;
  // Normalize to (-π, π] — always the shorter arc
  while (delta > Math.PI) delta -= 2 * Math.PI;
  while (delta < -Math.PI) delta += 2 * Math.PI;
  // Skip near-straight edges and concave (reflex) corners
  if (Math.abs(delta) < 0.01 || Math.abs(delta) >= Math.PI * 0.99) return [];

  const ANGLE_STEP = Math.PI / 24; // ~7.5° per sample
  const n = Math.max(1, Math.round(Math.abs(delta) / ANGLE_STEP));
  const samples: OutlineSample[] = [];
  for (let i = 0; i <= n; i++) {  // include arc endpoints to close edge-corner gaps
    const t = i / n;
    const angle = angleA + delta * t;
    const normal: Point = { x: Math.cos(angle), y: Math.sin(angle) };
    samples.push({
      point: { x: vertex.x + radius * normal.x, y: vertex.y + radius * normal.y },
      normal,
    });
  }
  return samples;
}

/**
 * Sample a closed polygon outline with smoothly interpolated normals.
 * At each vertex we compute a bisector normal (average of adjacent edge normals
 * for convex corners). Each edge sample lerps between its two endpoint vertex normals,
 * so samples near corners already point into the wedge — no separate corner mechanism needed.
 */
function samplePolygon(vertices: Point[], _center: Point, step: number): OutlineSample[] {
  const n = vertices.length;
  const samples: OutlineSample[] = [];

  // Determine winding via signed area (shoelace). In screen Y-down coords:
  //   positive → CW in screen → perp2D (left-perp) gives inward normal → flip
  //   negative → CCW in screen → perp2D gives outward normal → keep
  let signedArea2 = 0;
  for (let i = 0; i < n; i++) {
    const v = vertices[i]!;
    const nxt = vertices[(i + 1) % n]!;
    signedArea2 += v.x * nxt.y - nxt.x * v.y;
  }
  const windingFlip = signedArea2 >= 0 ? -1 : 1;

  // Pre-compute outward normals for every edge (winding-consistent, no centroid test)
  const edgeNormals: Point[] = vertices.map((v, i) => {
    const next = vertices[(i + 1) % n]!;
    const dir = sub(next, v);
    return scale(normalize(perp2D(normalize(dir))), windingFlip);
  });

  // Per-vertex bisector normals: average of incoming + outgoing edge normals at convex corners
  const vertexNormals: Point[] = vertices.map((v, i) => {
    const prevEdge = (i - 1 + n) % n;
    const nPrev = edgeNormals[prevEdge]!;
    const nCurr = edgeNormals[i]!;
    const vPrev = vertices[prevEdge]!;
    const vNext = vertices[(i + 1) % n]!;
    // Cross product of incoming and outgoing edge directions
    const e1x = v.x - vPrev.x, e1y = v.y - vPrev.y;
    const e2x = vNext.x - v.x, e2y = vNext.y - v.y;
    const cross = e1x * e2y - e1y * e2x;
    // Convex corner: cross > 0 for CW polygon, cross < 0 for CCW polygon
    const isConvex = windingFlip < 0 ? cross > 0 : cross < 0;
    if (!isConvex) return nCurr; // concave or straight — use outgoing edge normal
    const bx = nPrev.x + nCurr.x;
    const by = nPrev.y + nCurr.y;
    const blen = Math.sqrt(bx * bx + by * by);
    return blen > 0.01 ? { x: bx / blen, y: by / blen } : nCurr;
  });

  // Place edge samples with normals interpolated between vertex bisector normals
  for (let i = 0; i < n; i++) {
    const p0 = vertices[i]!;
    const p1 = vertices[(i + 1) % n]!;
    const startNormal = vertexNormals[i]!;
    const endNormal   = vertexNormals[(i + 1) % n]!;
    const dir = sub(p1, p0);
    const edgeLen = Math.sqrt(dir.x * dir.x + dir.y * dir.y);
    if (edgeLen === 0) continue;
    const steps = Math.max(1, Math.floor(edgeLen / step));
    for (let j = 0; j <= steps; j++) {
      const t = j / steps;
      const point: Point = { x: p0.x + dir.x * t, y: p0.y + dir.y * t };
      const nx = startNormal.x + (endNormal.x - startNormal.x) * t;
      const ny = startNormal.y + (endNormal.y - startNormal.y) * t;
      const nlen = Math.sqrt(nx * nx + ny * ny);
      const normal: Point = nlen > 0.001 ? { x: nx / nlen, y: ny / nlen } : startNormal;
      samples.push({ point, normal });
    }
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

/** Cubic smoothstep: 0 at edge0, 1 at edge1, smooth in between */
function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Shoelace signed area over line segments. Positive = CW in Y-down canvas. */
function computeSignedArea(segs: { type: string; from: Point; to: Point }[]): number {
  let area = 0;
  for (const seg of segs) {
    if (seg.type !== 'line') continue;
    area += seg.from.x * seg.to.y - seg.to.x * seg.from.y;
  }
  return area / 2;
}

function sampleOnePath(path: Path): OutlineSample[] {
  const samples: OutlineSample[] = [];
  const segs = path.segments.filter((s) => s.type === 'line');

  // Pre-compute per-segment lengths and total length for endpoint taper
  const segLengths = segs.map((seg) => {
    if (seg.type !== 'line') return 0;
    const dx = seg.to.x - seg.from.x;
    const dy = seg.to.y - seg.from.y;
    return Math.sqrt(dx * dx + dy * dy);
  });
  const totalLength = segLengths.reduce((a, b) => a + b, 0);
  // Taper zone: up to 20% of path length from each end, capped at 60 doc units
  const taperLength = !path.closed && totalLength > 0
    ? Math.min(totalLength * 0.2, 60)
    : 0;

  const getTaper = (arcPos: number): number =>
    taperLength > 0
      ? smoothstep(0, taperLength, Math.min(arcPos, totalLength - arcPos))
      : 1;

  // Flip normals for closed CW paths so inside/outside match basic shapes
  const normalSign =
    path.closed && computeSignedArea(segs as { type: string; from: Point; to: Point }[]) > 0
      ? -1
      : 1;

  // Compute path centroid to validate normal directions (guards against wrong winding in SVG)
  let pathCx = 0, pathCy = 0;
  if (segs.length > 0) {
    for (const seg of segs) { pathCx += seg.from.x; pathCy += seg.from.y; }
    pathCx /= segs.length;
    pathCy /= segs.length;
  }
  const hasCentroid = segs.length >= 3;

  // Flip normal if it points toward the path centroid instead of away from it
  function centroidCheck(nx: number, ny: number, midX: number, midY: number): [number, number] {
    if (!hasCentroid) return [nx, ny];
    const outX = midX - pathCx;
    const outY = midY - pathCy;
    if (outX * outX + outY * outY < 1) return [nx, ny]; // segment too close to centroid
    if (nx * outX + ny * outY < 0) return [-nx, -ny];   // normal points inward — flip
    return [nx, ny];
  }

  let arcDist = 0;
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i]!;
    if (seg.type !== 'line') continue;
    const dx = seg.to.x - seg.from.x;
    const dy = seg.to.y - seg.from.y;
    const len = segLengths[i] ?? 0;
    if (len < 0.01) continue;
    const [nx, ny] = centroidCheck(
      normalSign * (-dy / len),
      normalSign * ( dx / len),
      (seg.from.x + seg.to.x) * 0.5,
      (seg.from.y + seg.to.y) * 0.5,
    );
    const normal: Point = { x: nx, y: ny };
    const steps = Math.max(1, Math.floor(len / 2));
    for (let j = 0; j < steps; j++) {
      const t = j / steps;
      samples.push({
        point: { x: seg.from.x + dx * t, y: seg.from.y + dy * t },
        normal,
        taper: getTaper(arcDist + len * t),
      });
    }

    const nextSeg = segs[i + 1];
    if (nextSeg && nextSeg.type === 'line') {
      const ndx = nextSeg.to.x - nextSeg.from.x;
      const ndy = nextSeg.to.y - nextSeg.from.y;
      const nlen = Math.sqrt(ndx * ndx + ndy * ndy);
      if (nlen >= 0.01) {
        const [nnx, nny] = centroidCheck(
          normalSign * (-ndy / nlen),
          normalSign * ( ndx / nlen),
          (nextSeg.from.x + nextSeg.to.x) * 0.5,
          (nextSeg.from.y + nextSeg.to.y) * 0.5,
        );
        const nextNormal: Point = { x: nnx, y: nny };
        const cornerTaper = getTaper(arcDist + len);
        sampleCorner(seg.to, normal, nextNormal, 2).forEach((s) =>
          samples.push({ ...s, taper: cornerTaper }),
        );
      }
    }
    arcDist += len;
  }
  return samples;
}

function sampleFreehandPath(obj: FreehandObject): OutlineSample[] {
  return sampleOnePath(obj.path);
}

/**
 * Reduces OutlineSample density to at most one sample per grid cell.
 * Eliminates over-sampling in complex SVG regions (zig-zag, tight detail)
 * so particle density stays uniform regardless of local path complexity.
 * gridStep matches the arc-length sampling step (2 doc units) — any denser
 * sampling is wasted since the Poisson disk uses the same minDist.
 */
function thinSamples(samples: OutlineSample[], gridStep: number): OutlineSample[] {
  const grid = new Map<string, OutlineSample>();
  for (const s of samples) {
    const key = `${Math.floor(s.point.x / gridStep)},${Math.floor(s.point.y / gridStep)}`;
    if (!grid.has(key)) grid.set(key, s);
  }
  return [...grid.values()];
}

function sampleSVGPaths(obj: SVGImportObject): OutlineSample[] {
  const raw = obj.paths.flatMap((path) => {
    const segs = path.segments.filter((s) => s.type === 'line');
    if (path.closed && segs.length === path.segments.length && segs.length >= 3) {
      // Closed polygon — route through interpolated-normal sampler for clean corners
      const vertices: Point[] = segs.map((s) => s.from);
      const cx = vertices.reduce((sum, v) => sum + v.x, 0) / vertices.length;
      const cy = vertices.reduce((sum, v) => sum + v.y, 0) / vertices.length;
      return samplePolygon(vertices, { x: cx, y: cy }, 2);
    }
    return sampleOnePath(path);
  });
  return thinSamples(raw, 2).map((s) => ({ ...s, jitterScale: 0.5 }));
}

/**
 * Returns outline sample points (with outward normals) for a given scene object.
 * Returns empty array for unsupported types.
 */
export function sampleShapeOutline(obj: SceneObject): OutlineSample[] {
  let samples: OutlineSample[];
  switch (obj.type) {
    case 'rectangle': samples = sampleRectangle(obj); break;
    case 'ellipse':   samples = sampleEllipse(obj); break;
    case 'star':      samples = sampleStar(obj); break;
    case 'freehand':    samples = sampleFreehandPath(obj); break;
    case 'svg-import':  samples = sampleSVGPaths(obj as SVGImportObject); break;
    default:            return [];
  }
  const shapeSize = Math.min(obj.width, obj.height);
  return samples.map((s) => ({ ...s, shapeSize }));
}

/** Compute the axis-aligned bounding box for a scene object */
export function getObjectBBox(obj: SceneObject): { x: number; y: number; w: number; h: number } {
  return { x: obj.position.x, y: obj.position.y, w: obj.width, h: obj.height };
}
