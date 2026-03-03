import type { Point } from '@/types/geometry';

/**
 * Constrain a draw end-point to form a square relative to start.
 * The square extends in the direction the user is dragging.
 */
export function constrainToSquare(start: Point, current: Point): Point {
  const dx = current.x - start.x;
  const dy = current.y - start.y;
  const size = Math.min(Math.abs(dx), Math.abs(dy));
  return {
    x: start.x + Math.sign(dx) * size,
    y: start.y + Math.sign(dy) * size,
  };
}

/**
 * Compute the normalised bounding box from two drag points.
 * Always returns positive width/height with top-left origin.
 */
export function dragToBBox(
  start: Point,
  current: Point,
  shiftHeld: boolean,
): { x: number; y: number; width: number; height: number } {
  let end = current;
  if (shiftHeld) end = constrainToSquare(start, current);

  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

/** Minimum drag size in document units before a shape is committed */
export const MIN_DRAG_SIZE = 4;
