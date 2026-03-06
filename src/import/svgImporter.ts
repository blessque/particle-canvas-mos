import type { Point, Path } from '@/types/geometry';
import type { SVGImportObject } from '@/types/scene';
import { uid } from '@/utils/uid';

// ── Affine 2D matrix ─────────────────────────────────────────────────────────
// [a, b, c, d, e, f]:  x' = a*x + c*y + e,  y' = b*x + d*y + f
type M2D = [number, number, number, number, number, number];

function identity(): M2D { return [1, 0, 0, 1, 0, 0]; }

function multiply(p: M2D, q: M2D): M2D {
  return [
    p[0]*q[0] + p[2]*q[1],
    p[1]*q[0] + p[3]*q[1],
    p[0]*q[2] + p[2]*q[3],
    p[1]*q[2] + p[3]*q[3],
    p[0]*q[4] + p[2]*q[5] + p[4],
    p[1]*q[4] + p[3]*q[5] + p[5],
  ];
}

function applyM(m: M2D, pt: Point): Point {
  return { x: m[0]*pt.x + m[2]*pt.y + m[4], y: m[1]*pt.x + m[3]*pt.y + m[5] };
}

function parseSingleTransform(fn: string, vals: number[]): M2D {
  const v = (n: number, d = 0): number => vals[n] ?? d;
  switch (fn) {
    case 'translate': return [1, 0, 0, 1, v(0), v(1)];
    case 'scale': { const sx = v(0, 1), sy = v(1, sx); return [sx, 0, 0, sy, 0, 0]; }
    case 'rotate': {
      const a = v(0) * Math.PI / 180;
      const cos = Math.cos(a), sin = Math.sin(a);
      if (vals.length >= 3) {
        const cx = v(1), cy = v(2);
        return [cos, sin, -sin, cos, cx - cos*cx + sin*cy, cy - sin*cx - cos*cy];
      }
      return [cos, sin, -sin, cos, 0, 0];
    }
    case 'matrix': return [v(0, 1), v(1), v(2), v(3, 1), v(4), v(5)];
    case 'skewX': { const t = Math.tan(v(0) * Math.PI / 180); return [1, 0, t, 1, 0, 0]; }
    case 'skewY': { const t = Math.tan(v(0) * Math.PI / 180); return [1, t, 0, 1, 0, 0]; }
    default: return identity();
  }
}

function parseTransform(attr: string | null): M2D {
  if (!attr) return identity();
  let m = identity();
  const re = /(\w+)\s*\(([^)]*)\)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(attr)) !== null) {
    const vals = match[2]!.trim().split(/[\s,]+/).map(Number);
    m = multiply(m, parseSingleTransform(match[1]!, vals));
  }
  return m;
}

// ── Path d tessellator ────────────────────────────────────────────────────────
interface SubPath { points: Point[]; closed: boolean; }

const SUBDIVS = 16;

function cubicBezier(t: number, p0: Point, p1: Point, p2: Point, p3: Point): Point {
  const u = 1 - t;
  return {
    x: u*u*u*p0.x + 3*u*u*t*p1.x + 3*u*t*t*p2.x + t*t*t*p3.x,
    y: u*u*u*p0.y + 3*u*u*t*p1.y + 3*u*t*t*p2.y + t*t*t*p3.y,
  };
}

function quadBezier(t: number, p0: Point, p1: Point, p2: Point): Point {
  const u = 1 - t;
  return {
    x: u*u*p0.x + 2*u*t*p1.x + t*t*p2.x,
    y: u*u*p0.y + 2*u*t*p1.y + t*t*p2.y,
  };
}

function svgArcPoints(
  x1: number, y1: number,
  rx0: number, ry0: number, xRot: number,
  largeArc: boolean, sweep: boolean,
  x2: number, y2: number,
): Point[] {
  if (x1 === x2 && y1 === y2) return [];
  if (rx0 === 0 || ry0 === 0) return [{ x: x2, y: y2 }];

  let rx = Math.abs(rx0), ry = Math.abs(ry0);
  const phi = xRot * Math.PI / 180;
  const cphi = Math.cos(phi), sphi = Math.sin(phi);

  const dx2 = (x1 - x2) / 2, dy2 = (y1 - y2) / 2;
  const x1p =  cphi*dx2 + sphi*dy2;
  const y1p = -sphi*dx2 + cphi*dy2;

  // Scale radii if too small
  const lambda = (x1p/rx)**2 + (y1p/ry)**2;
  if (lambda > 1) { const s = Math.sqrt(lambda); rx *= s; ry *= s; }

  const rxSq = rx*rx, rySq = ry*ry;
  const x1pSq = x1p*x1p, y1pSq = y1p*y1p;
  const num = Math.max(0, rxSq*rySq - rxSq*y1pSq - rySq*x1pSq);
  const den = rxSq*y1pSq + rySq*x1pSq;
  const coeff = (largeArc !== sweep ? 1 : -1) * Math.sqrt(den > 0 ? num / den : 0);
  const cxp =  coeff * rx * y1p / ry;
  const cyp = -coeff * ry * x1p / rx;
  const cx = cphi*cxp - sphi*cyp + (x1 + x2) / 2;
  const cy = sphi*cxp + cphi*cyp + (y1 + y2) / 2;

  function vAngle(ux: number, uy: number, vx: number, vy: number): number {
    const dot = ux*vx + uy*vy;
    const len = Math.sqrt((ux*ux + uy*uy) * (vx*vx + vy*vy));
    const ang = Math.acos(Math.max(-1, Math.min(1, len > 0 ? dot / len : 0)));
    return (ux*vy - uy*vx) < 0 ? -ang : ang;
  }

  const startAngle = vAngle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dAngle = vAngle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && dAngle > 0) dAngle -= 2 * Math.PI;
  if (sweep  && dAngle < 0) dAngle += 2 * Math.PI;

  const pts: Point[] = [];
  for (let j = 1; j <= SUBDIVS; j++) {
    const angle = startAngle + dAngle * j / SUBDIVS;
    pts.push({
      x: cx + cphi * rx * Math.cos(angle) - sphi * ry * Math.sin(angle),
      y: cy + sphi * rx * Math.cos(angle) + cphi * ry * Math.sin(angle),
    });
  }
  return pts;
}

function parsePathD(d: string): SubPath[] {
  const subPaths: SubPath[] = [];
  let pts: Point[] = [];
  let cx = 0, cy = 0, sx = 0, sy = 0;
  // previous control point for S/T commands
  let prevCpX = cx, prevCpY = cy;
  let prevIsC = false, prevIsQ = false;

  // Tokenize: command letters and numbers (including scientific notation)
  const raw = d.match(/[MmZzLlHhVvCcSsQqTtAa]|[+-]?(?:\d*\.\d+|\d+\.?)(?:[eE][+-]?\d+)?/g) ?? [];
  let i = 0;
  let cmd = '';

  function n(): number { return parseFloat(raw[i++] ?? '0'); }
  function isNum(): boolean { const t = raw[i]; return t !== undefined && !isNaN(+t); }

  function commit(closed: boolean) {
    if (pts.length > 1) subPaths.push({ points: pts, closed });
    pts = [];
  }

  while (i < raw.length) {
    const tok = raw[i]!;

    // Command letter
    if (isNaN(+tok)) {
      cmd = tok;
      i++;
      // Z/z: close path, no args
      if (cmd === 'Z' || cmd === 'z') {
        commit(true);
        cx = sx; cy = sy;
        cmd = '';
        continue;
      }
    }

    // Guard: need a number to proceed
    if (!isNum()) continue;

    const isAbs = cmd === cmd.toUpperCase();
    const x0 = cx, y0 = cy;

    switch (cmd) {
      case 'M': case 'm': {
        commit(false);
        if (isAbs) { cx = n(); cy = n(); }
        else       { cx += n(); cy += n(); }
        sx = cx; sy = cy;
        pts = [{ x: cx, y: cy }];
        cmd = isAbs ? 'L' : 'l';
        prevIsC = false; prevIsQ = false;
        break;
      }
      case 'L': case 'l': {
        if (isAbs) { cx = n(); cy = n(); }
        else       { cx += n(); cy += n(); }
        pts.push({ x: cx, y: cy });
        prevIsC = false; prevIsQ = false;
        break;
      }
      case 'H': case 'h': {
        if (isAbs) cx = n(); else cx += n();
        pts.push({ x: cx, y: cy });
        prevIsC = false; prevIsQ = false;
        break;
      }
      case 'V': case 'v': {
        if (isAbs) cy = n(); else cy += n();
        pts.push({ x: cx, y: cy });
        prevIsC = false; prevIsQ = false;
        break;
      }
      case 'C': case 'c': {
        const cp1x = isAbs ? n() : x0 + n(), cp1y = isAbs ? n() : y0 + n();
        const cp2x = isAbs ? n() : x0 + n(), cp2y = isAbs ? n() : y0 + n();
        const ex   = isAbs ? n() : x0 + n(), ey   = isAbs ? n() : y0 + n();
        const p0 = { x: x0, y: y0 };
        for (let j = 1; j <= SUBDIVS; j++) pts.push(cubicBezier(j / SUBDIVS, p0, { x: cp1x, y: cp1y }, { x: cp2x, y: cp2y }, { x: ex, y: ey }));
        prevCpX = cp2x; prevCpY = cp2y; cx = ex; cy = ey;
        prevIsC = true; prevIsQ = false;
        break;
      }
      case 'S': case 's': {
        // Reflect previous CP2 if prev was C/S, else use current point
        const rcp1x = prevIsC ? 2 * cx - prevCpX : cx;
        const rcp1y = prevIsC ? 2 * cy - prevCpY : cy;
        const cp2x = isAbs ? n() : x0 + n(), cp2y = isAbs ? n() : y0 + n();
        const ex   = isAbs ? n() : x0 + n(), ey   = isAbs ? n() : y0 + n();
        const p0 = { x: x0, y: y0 };
        for (let j = 1; j <= SUBDIVS; j++) pts.push(cubicBezier(j / SUBDIVS, p0, { x: rcp1x, y: rcp1y }, { x: cp2x, y: cp2y }, { x: ex, y: ey }));
        prevCpX = cp2x; prevCpY = cp2y; cx = ex; cy = ey;
        prevIsC = true; prevIsQ = false;
        break;
      }
      case 'Q': case 'q': {
        const cpx = isAbs ? n() : x0 + n(), cpy = isAbs ? n() : y0 + n();
        const ex  = isAbs ? n() : x0 + n(), ey  = isAbs ? n() : y0 + n();
        const p0 = { x: x0, y: y0 };
        for (let j = 1; j <= SUBDIVS; j++) pts.push(quadBezier(j / SUBDIVS, p0, { x: cpx, y: cpy }, { x: ex, y: ey }));
        prevCpX = cpx; prevCpY = cpy; cx = ex; cy = ey;
        prevIsC = false; prevIsQ = true;
        break;
      }
      case 'T': case 't': {
        const rcpx = prevIsQ ? 2 * cx - prevCpX : cx;
        const rcpy = prevIsQ ? 2 * cy - prevCpY : cy;
        const ex = isAbs ? n() : x0 + n(), ey = isAbs ? n() : y0 + n();
        const p0 = { x: x0, y: y0 };
        for (let j = 1; j <= SUBDIVS; j++) pts.push(quadBezier(j / SUBDIVS, p0, { x: rcpx, y: rcpy }, { x: ex, y: ey }));
        prevCpX = rcpx; prevCpY = rcpy; cx = ex; cy = ey;
        prevIsC = false; prevIsQ = true;
        break;
      }
      case 'A': case 'a': {
        const rx = n(), ry = n(), xRot = n();
        const laf = n() !== 0, sf = n() !== 0;
        const ex = isAbs ? n() : x0 + n(), ey = isAbs ? n() : y0 + n();
        const arcPts = svgArcPoints(cx, cy, rx, ry, xRot, laf, sf, ex, ey);
        pts.push(...arcPts);
        cx = ex; cy = ey;
        prevIsC = false; prevIsQ = false;
        break;
      }
      default:
        i++; // consume unknown token to prevent infinite loop
        break;
    }
  }

  commit(false);
  return subPaths;
}

// ── Primitive shapes → SubPaths ───────────────────────────────────────────────
function attrN(el: Element, name: string, def = 0): number {
  const v = el.getAttribute(name);
  return v !== null ? parseFloat(v) : def;
}

function rectSubPath(el: Element): SubPath {
  const x = attrN(el, 'x'), y = attrN(el, 'y');
  const w = attrN(el, 'width'), h = attrN(el, 'height');
  const rx = Math.min(attrN(el, 'rx', attrN(el, 'ry')), w / 2);
  const ry = Math.min(attrN(el, 'ry', attrN(el, 'rx')), h / 2);

  if (rx <= 0 || ry <= 0) {
    return {
      points: [
        { x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }, { x, y },
      ],
      closed: true,
    };
  }
  // Rounded rect — approximate with line segments
  const pts: Point[] = [];
  function arcCorner(cx: number, cy: number, startA: number, endA: number) {
    const steps = 8;
    for (let k = 0; k <= steps; k++) {
      const a = startA + (endA - startA) * k / steps;
      pts.push({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) });
    }
  }
  arcCorner(x + w - rx, y + ry,      -Math.PI / 2, 0);
  arcCorner(x + w - rx, y + h - ry,   0,             Math.PI / 2);
  arcCorner(x + rx,     y + h - ry,   Math.PI / 2,  Math.PI);
  arcCorner(x + rx,     y + ry,       Math.PI,      3 * Math.PI / 2);
  return { points: pts, closed: true };
}

function circleSubPath(el: Element): SubPath {
  const cx = attrN(el, 'cx'), cy = attrN(el, 'cy'), r = attrN(el, 'r');
  const pts: Point[] = [];
  for (let k = 0; k <= SUBDIVS; k++) {
    const a = (2 * Math.PI * k) / SUBDIVS;
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  return { points: pts, closed: true };
}

function ellipseSubPath(el: Element): SubPath {
  const cx = attrN(el, 'cx'), cy = attrN(el, 'cy');
  const rx = attrN(el, 'rx'), ry = attrN(el, 'ry');
  const pts: Point[] = [];
  for (let k = 0; k <= SUBDIVS; k++) {
    const a = (2 * Math.PI * k) / SUBDIVS;
    pts.push({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) });
  }
  return { points: pts, closed: true };
}

function polySubPath(el: Element, closed: boolean): SubPath {
  const raw = el.getAttribute('points') ?? '';
  const nums = raw.trim().split(/[\s,]+/).map(Number).filter((v) => !isNaN(v));
  const pts: Point[] = [];
  for (let k = 0; k + 1 < nums.length; k += 2) {
    pts.push({ x: nums[k]!, y: nums[k + 1]! });
  }
  if (closed && pts.length > 0) pts.push(pts[0]!);
  return { points: pts, closed };
}

// ── DOM traversal ─────────────────────────────────────────────────────────────
function collectSubPaths(el: Element, parentMatrix: M2D): SubPath[] {
  const result: SubPath[] = [];

  for (let ci = 0; ci < el.children.length; ci++) {
    const child = el.children[ci]!;
    const tag = child.tagName.toLowerCase().replace(/^svg:/, '');

    // Skip invisible elements
    const display = child.getAttribute('display');
    const visibility = child.getAttribute('visibility');
    if (display === 'none' || visibility === 'hidden') continue;

    const m = multiply(parentMatrix, parseTransform(child.getAttribute('transform')));

    switch (tag) {
      case 'g':
      case 'svg':
        result.push(...collectSubPaths(child, m));
        break;

      case 'path': {
        const d = child.getAttribute('d') ?? '';
        const subs = parsePathD(d);
        for (const sp of subs) {
          result.push({ points: sp.points.map((p) => applyM(m, p)), closed: sp.closed });
        }
        break;
      }

      case 'rect': {
        const sp = rectSubPath(child);
        result.push({ points: sp.points.map((p) => applyM(m, p)), closed: sp.closed });
        break;
      }

      case 'circle': {
        const sp = circleSubPath(child);
        result.push({ points: sp.points.map((p) => applyM(m, p)), closed: sp.closed });
        break;
      }

      case 'ellipse': {
        const sp = ellipseSubPath(child);
        result.push({ points: sp.points.map((p) => applyM(m, p)), closed: sp.closed });
        break;
      }

      case 'polyline': {
        const sp = polySubPath(child, false);
        result.push({ points: sp.points.map((p) => applyM(m, p)), closed: sp.closed });
        break;
      }

      case 'polygon': {
        const sp = polySubPath(child, true);
        result.push({ points: sp.points.map((p) => applyM(m, p)), closed: sp.closed });
        break;
      }

      default:
        // Ignore unsupported elements (text, use, symbol, defs, etc.)
        break;
    }
  }

  return result;
}

// ── SubPath → Path conversion ─────────────────────────────────────────────────
function subPathToPath(sp: SubPath): Path {
  const segs: Path['segments'] = [];
  const pts = sp.points;
  for (let k = 0; k + 1 < pts.length; k++) {
    segs.push({ type: 'line', from: pts[k]!, to: pts[k + 1]! });
  }
  if (sp.closed && pts.length > 1) {
    const last = pts[pts.length - 1]!;
    const first = pts[0]!;
    if (last.x !== first.x || last.y !== first.y) {
      segs.push({ type: 'line', from: last, to: first });
    }
  }
  return { segments: segs, closed: sp.closed };
}

// ── Public API ────────────────────────────────────────────────────────────────
export function importSVG(
  svgText: string,
  docWidth: number,
  docHeight: number,
): SVGImportObject | null {
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  } catch {
    return null;
  }

  const parseError = doc.querySelector('parsererror');
  if (parseError) return null;

  const svgEl = doc.querySelector('svg');
  if (!svgEl) return null;

  // Collect all sub-paths in SVG user-space coordinates
  const subPaths = collectSubPaths(svgEl, identity());
  if (subPaths.length === 0) return null;

  // Filter degenerate paths
  const valid = subPaths.filter((sp) => sp.points.length >= 2);
  if (valid.length === 0) return null;

  // Compute bounding box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const sp of valid) {
    for (const pt of sp.points) {
      if (pt.x < minX) minX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y > maxY) maxY = pt.y;
    }
  }

  const svgW = maxX - minX;
  const svgH = maxY - minY;
  if (svgW <= 0 || svgH <= 0) return null;

  // Scale to fit 80% of shorter document dimension
  const targetSize = Math.min(docWidth, docHeight) * 0.8;
  const scaleF = Math.min(targetSize / svgW, targetSize / svgH);

  const scaledW = svgW * scaleF;
  const scaledH = svgH * scaleF;

  // Center in document
  const offsetX = (docWidth - scaledW) / 2 - minX * scaleF;
  const offsetY = (docHeight - scaledH) / 2 - minY * scaleF;

  function transformPt(pt: Point): Point {
    return { x: pt.x * scaleF + offsetX, y: pt.y * scaleF + offsetY };
  }

  // Build final paths in document coordinates
  const paths: Path[] = valid.map((sp) => {
    const transformed: SubPath = {
      points: sp.points.map(transformPt),
      closed: sp.closed,
    };
    return subPathToPath(transformed);
  });

  const posX = (docWidth - scaledW) / 2;
  const posY = (docHeight - scaledH) / 2;

  return {
    id: uid(),
    type: 'svg-import',
    position: { x: posX, y: posY },
    width: scaledW,
    height: scaledH,
    rotation: 0,
    visible: true,
    locked: false,
    paths,
    originalSVG: svgText,
  };
}
