/** 2D point in document space */
export interface Point {
  x: number;
  y: number;
}

/** 2D vector (same shape as Point, semantically different) */
export type Vector = Point;

/** Axis-aligned bounding box */
export interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A single segment of a path */
export type CurveSegment =
  | { type: 'line'; from: Point; to: Point }
  | { type: 'cubic'; from: Point; cp1: Point; cp2: Point; to: Point }
  | { type: 'quadratic'; from: Point; cp: Point; to: Point }
  | {
      type: 'arc';
      center: Point;
      rx: number;
      ry: number;
      startAngle: number;
      endAngle: number;
      rotation: number;
    };

/** A closed or open path made of segments */
export interface Path {
  segments: CurveSegment[];
  closed: boolean;
}

/** A snap guide line shown when a shape aligns to a canvas key point */
export interface SnapLine {
  orientation: 'horizontal' | 'vertical';
  /** Position in document units: x for vertical lines, y for horizontal lines */
  pos: number;
}

/** A point on a shape outline with its outward unit normal */
export interface OutlineSample {
  point: Point;
  normal: Point;
  /** 0 = at an open-path endpoint (no particles), 1 = full density. Undefined = closed shape (always 1). */
  taper?: number;
  /**
   * Tangential jitter multiplier. 1 = full organic spread (freehand, shapes).
   * 0 = no lateral drift — use for SVG imports where path legibility must be preserved.
   * Defaults to 1 when absent.
   */
  jitterScale?: number;
  /** Bounding-box minor dimension of the source shape (min of width, height). Used for proportional falloff. */
  shapeSize?: number;
}
