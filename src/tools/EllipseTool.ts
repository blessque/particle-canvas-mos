import type { Tool, ToolCallbacks } from '@/types/tools';
import type { Point } from '@/types/geometry';
import type { EllipseObject } from '@/types/scene';
import { uid } from '@/utils/uid';
import { dragToBBox, MIN_DRAG_SIZE } from './pointerUtils';
import { useUIStore } from '@/store/uiStore';
import { computeEllipseArcAngles } from '@/engine/shapeGeometry';

export const EllipseTool: Tool = {
  name: 'ellipse',

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

    const ellipseMode = useUIStore.getState().ellipseMode;
    let arcStartAngle = 0;
    let arcEndAngle = Math.PI * 2;
    if (ellipseMode !== 'full') {
      const dx = docPoint.x - state.drawStart.x;
      const dy = docPoint.y - state.drawStart.y;
      const angles = computeEllipseArcAngles(dx, dy, ellipseMode);
      arcStartAngle = angles.start;
      arcEndAngle = angles.end;
    }

    const obj: EllipseObject = {
      id: uid(),
      type: 'ellipse',
      position: { x: bbox.x, y: bbox.y },
      width: bbox.width,
      height: bbox.height,
      rotation: 0,
      visible: true,
      locked: false,
      arcStartAngle,
      arcEndAngle,
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
