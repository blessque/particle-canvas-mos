import type { Tool, ToolCallbacks } from '@/types/tools';
import type { Point } from '@/types/geometry';
import type { RectangleObject } from '@/types/scene';
import { uid } from '@/utils/uid';
import { dragToBBox, MIN_DRAG_SIZE } from './pointerUtils';

export const RectangleTool: Tool = {
  name: 'rectangle',

  getCursor(): string {
    return 'crosshair';
  },

  onPointerDown(_e: PointerEvent, docPoint: Point, cbs: ToolCallbacks): void {
    cbs.setToolState({ isDrawing: true, drawStart: docPoint, drawCurrent: docPoint });
  },

  onPointerMove(_e: PointerEvent, docPoint: Point, cbs: ToolCallbacks): void {
    const state = cbs.getToolState();
    if (!state.isDrawing) return;
    cbs.setToolState({ drawCurrent: docPoint });
  },

  onPointerUp(_e: PointerEvent, docPoint: Point, cbs: ToolCallbacks): void {
    const state = cbs.getToolState();
    if (!state.isDrawing || !state.drawStart) return;

    cbs.setToolState({ isDrawing: false, drawStart: null, drawCurrent: null });

    const bbox = dragToBBox(state.drawStart, docPoint, state.shiftHeld);
    if (bbox.width < MIN_DRAG_SIZE || bbox.height < MIN_DRAG_SIZE) return;

    const obj: RectangleObject = {
      id: uid(),
      type: 'rectangle',
      position: { x: bbox.x, y: bbox.y },
      width: bbox.width,
      height: bbox.height,
      rotation: 0,
      visible: true,
      locked: false,
    };
    cbs.addObject(obj);
    cbs.setToolState({ activeTool: 'select' });
  },

  onKeyDown(e: KeyboardEvent, cbs: ToolCallbacks): void {
    if (e.key === 'Escape') {
      cbs.setToolState({ isDrawing: false, drawStart: null, drawCurrent: null });
    }
  },
};
