import type { Point, Vector } from '@/types/geometry';

export function add(a: Point, b: Vector): Point {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function sub(a: Point, b: Point): Vector {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function scale(v: Vector, s: number): Vector {
  return { x: v.x * s, y: v.y * s };
}

export function length(v: Vector): number {
  return Math.sqrt(v.x * v.x + v.y * v.y);
}

export function normalize(v: Vector): Vector {
  const len = length(v);
  if (len === 0) return { x: 0, y: 1 };
  return { x: v.x / len, y: v.y / len };
}

export function dot(a: Vector, b: Vector): number {
  return a.x * b.x + a.y * b.y;
}

/** Returns the left-hand perpendicular (rotated 90° CCW) */
export function perp2D(v: Vector): Vector {
  return { x: -v.y, y: v.x };
}

export function lerpVec(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

export function dist(a: Point, b: Point): number {
  return length(sub(a, b));
}
