import type { Point, Path } from './geometry';

/** All possible scene object types */
export type SceneObjectType =
  | 'rectangle'
  | 'ellipse'
  | 'star'
  | 'freehand'
  | 'svg-import'
  | 'raster-import';

/** Base fields shared by all scene objects */
export interface SceneObjectBase {
  id: string;
  type: SceneObjectType;
  position: Point;
  width: number;
  height: number;
  rotation: number;
  visible: boolean;
  locked: boolean;
}

/** Rectangle shape */
export interface RectangleObject extends SceneObjectBase {
  type: 'rectangle';
}

/** Ellipse shape */
export interface EllipseObject extends SceneObjectBase {
  type: 'ellipse';
}

/** Star shape */
export interface StarObject extends SceneObjectBase {
  type: 'star';
  points: number;
  innerRadiusRatio: number;
}

/** Freehand drawn curve */
export interface FreehandObject extends SceneObjectBase {
  type: 'freehand';
  path: Path;
}

/** Imported SVG (flattened to paths) */
export interface SVGImportObject extends SceneObjectBase {
  type: 'svg-import';
  paths: Path[];
  originalSVG?: string;
}

/** Imported raster image */
export interface RasterImportObject extends SceneObjectBase {
  type: 'raster-import';
  imageDataURL: string;
  brightnessGrid?: number[][];
}

/** Union type of all scene objects */
export type SceneObject =
  | RectangleObject
  | EllipseObject
  | StarObject
  | FreehandObject
  | SVGImportObject
  | RasterImportObject;
