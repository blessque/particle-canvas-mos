# Shape Tools — Module Guide

Owner files: `src/tools/RectangleTool.ts`, `src/tools/EllipseTool.ts`, `src/tools/StarTool.ts`, `src/tools/FreehandTool.ts`, `src/tools/SelectTool.ts`, `src/tools/pointerUtils.ts`, `src/tools/toolRegistry.ts`

## Tool Interface Contract

Every tool exports an object matching this interface:

```typescript
export interface Tool {
  name: ToolType;
  onPointerDown(e: PointerEvent, docPoint: Point, store: ToolCallbacks): void;
  onPointerMove(e: PointerEvent, docPoint: Point, store: ToolCallbacks): void;
  onPointerUp(e: PointerEvent, docPoint: Point, store: ToolCallbacks): void;
  onKeyDown?(e: KeyboardEvent, store: ToolCallbacks): void;
  onKeyUp?(e: KeyboardEvent, store: ToolCallbacks): void;
  getCursor(): string;  // CSS cursor value
}
```

**IMPORTANT:** The `docPoint` parameter is already transformed from screen space to document space by `CanvasRoot.tsx`. Tools NEVER do coordinate transforms themselves. They receive document-space points and work entirely in document space.

`ToolCallbacks` is a set of store actions the tool can call:

```typescript
export interface ToolCallbacks {
  addObject(obj: SceneObject): void;
  updateObject(id: string, partial: Partial<SceneObject>): void;
  deleteObject(id: string): void;
  setToolState(partial: Partial<ToolState>): void;
  getToolState(): ToolState;
  getSelectedObjects(): SceneObject[];
}
```

## Tool Registry

`toolRegistry.ts` maps `ToolType` → `Tool` object:

```typescript
const registry: Record<ToolType, Tool> = {
  select: SelectTool,
  rectangle: RectangleTool,
  ellipse: EllipseTool,
  star: StarTool,
  freehand: FreehandTool,
};
```

`CanvasRoot.tsx` imports only the registry, not individual tools. This keeps the canvas module decoupled from specific tool implementations.

## Shape Drawing Flow (Rectangle, Ellipse, Star)

All three follow the same pattern:

### onPointerDown
1. Record `drawStart = docPoint`
2. Set `isDrawing = true`

### onPointerMove
1. If not `isDrawing`, return
2. Compute bounding box from `drawStart` to `docPoint`
3. If `shiftHeld`, constrain to square/circle (equal width and height)
4. Update `drawCurrent = docPoint` (for preview rendering)

### onPointerUp
1. Compute final bounding box
2. If the shape is too small (width or height < 5 document units), discard it
3. Create a `SceneObject` with the final dimensions and add it via `addObject()`
4. Reset: `isDrawing = false`, `drawStart = null`, `drawCurrent = null`

## Shift-Constrain Logic (in pointerUtils.ts)

When shift is held:
- Shape drawing: force width === height (square rectangle, circle, regular star bounding box)
- Shape resizing: maintain original aspect ratio
- The constrain is applied to the bounding box BEFORE creating/updating the scene object

```typescript
export function constrainToSquare(start: Point, current: Point): BBox {
  const dx = current.x - start.x;
  const dy = current.y - start.y;
  const size = Math.max(Math.abs(dx), Math.abs(dy));
  return {
    x: dx >= 0 ? start.x : start.x - size,
    y: dy >= 0 ? start.y : start.y - size,
    width: size,
    height: size,
  };
}
```

## Freehand Tool

Different from shape tools — captures a continuous stream of points.

### onPointerDown
1. Start collecting raw points: `rawPoints = [docPoint]`
2. Set `isDrawing = true`

### onPointerMove
1. Push `docPoint` to `rawPoints`
2. Update `drawCurrent` for real-time preview

### onPointerUp
1. Pass `rawPoints` through the `perfect-freehand` library to get smoothed outline points
2. Convert the smoothed points into cubic bezier `CurveSegment[]` (fit curves to the point cloud)
3. Create a `FreehandObject` with the resulting `Path`
4. Reset

### Curve Fitting
Use the `perfect-freehand` library's `getStroke()` function which returns an array of points forming a smooth outline. Then convert those points to bezier curves using a simple catmull-rom → bezier conversion or by fitting cubics to groups of 4 points.

The `perfect-freehand` options to use:
```typescript
{
  size: 3,           // base stroke width (will affect path width)
  thinning: 0.5,
  smoothing: 0.5,
  streamline: 0.5,
  simulatePressure: true,
}
```

## Select Tool

### Hit Testing
On click/pointerDown without drag:
1. Iterate scene objects in reverse z-order (top object first)
2. For each object, check if `docPoint` is inside the object's bounding box
3. If hit: select it (set `selectedObjectIds = [obj.id]`)
4. If no hit: deselect all

### Moving
When dragging a selected object:
1. Compute delta: `currentDocPoint - previousDocPoint`
2. Update object's position by delta
3. On pointerUp: finalize position

### Resize Handles
When an object is selected, `HandleRenderer` draws 8 handles (4 corners + 4 midpoints) around the bounding box.

Hit test handles BEFORE objects. If a handle is hit:
1. Track which handle (e.g., 'bottom-right')
2. On drag: resize the bounding box from the opposite corner as anchor
3. If shift held: constrain aspect ratio
4. On pointerUp: finalize new dimensions

### Delete
On `Delete` or `Backspace` key: delete all selected objects.

## Hotkeys

Handled in `CanvasRoot.tsx`'s key event listeners, delegated to the active tool:

- `Shift` (hold): constrain proportions during draw/resize
- `Delete` / `Backspace`: delete selected objects
- `Escape`: deselect all, cancel current draw
- `V`: switch to select tool
- `R`: switch to rectangle tool
- `E`: switch to ellipse tool
- `S`: switch to star tool
- `F`: switch to freehand tool
