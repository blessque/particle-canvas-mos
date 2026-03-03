import type { Point } from './geometry';

/** Available tool types */
export type ToolType = 'select' | 'rectangle' | 'ellipse' | 'star' | 'freehand';

/** Transient state during a tool operation */
export interface ToolState {
  activeTool: ToolType;
  isDrawing: boolean;
  drawStart: Point | null;
  drawCurrent: Point | null;
  shiftHeld: boolean;
  selectedObjectIds: string[];
  pendingPath: Point[] | null;
}

/** Pointer event handlers that every tool must implement */
export interface Tool {
  name: ToolType;
  onPointerDown(e: PointerEvent, docPoint: Point, callbacks: ToolCallbacks): void;
  onPointerMove(e: PointerEvent, docPoint: Point, callbacks: ToolCallbacks): void;
  onPointerUp(e: PointerEvent, docPoint: Point, callbacks: ToolCallbacks): void;
  onKeyDown?(e: KeyboardEvent, callbacks: ToolCallbacks): void;
  onKeyUp?(e: KeyboardEvent, callbacks: ToolCallbacks): void;
  getCursor(): string;
}

/** Store actions available to tools */
export interface ToolCallbacks {
  addObject(obj: import('./scene').SceneObject): void;
  updateObject(id: string, partial: Partial<import('./scene').SceneObject>): void;
  deleteObject(id: string): void;
  setToolState(partial: Partial<ToolState>): void;
  getToolState(): ToolState;
  getObjects(): import('./scene').SceneObject[];
  getScale(): number;
}
