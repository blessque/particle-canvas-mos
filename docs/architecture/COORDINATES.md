# Coordinate Systems

There are THREE coordinate spaces in this application. Mixing them up is the #1 source of bugs. Every module must use the transform functions in `src/utils/coordinates.ts`.

## 1. Screen Space (pixels on the physical display)

- Origin: top-left of the browser viewport
- Units: CSS pixels × devicePixelRatio
- Used by: pointer events (event.clientX, event.clientY)
- You almost never work directly in this space

## 2. Canvas Space (pixels on the canvas element)

- Origin: top-left of the `<canvas>` element
- Units: logical pixels (CSS pixels of the canvas element)
- The canvas element may be smaller or larger than the document
- Used by: hit testing, tool handlers
- Convert from screen space: subtract canvas element's bounding rect offset

## 3. Document Space (the design's coordinate system)

- Origin: top-left of the design area
- Units: abstract units that map to the export resolution
- The document has a FIXED ASPECT RATIO (e.g., 1:1, 16:9, 4:3)
- The document fits inside the canvas with padding/letterboxing
- ALL scene objects, ALL particle positions are stored in document space
- This is the "true" coordinate system — what gets exported

## Transform Functions

All live in `src/utils/coordinates.ts`:

```typescript
// Convert pointer event to canvas-relative position
screenToCanvas(event: PointerEvent, canvasEl: HTMLCanvasElement): Point

// Convert canvas position to document position
// Accounts for: canvas padding, zoom, pan, document offset
canvasToDocument(canvasPoint: Point, viewport: ViewportState): Point

// Convert document position to canvas position (for rendering)
documentToCanvas(docPoint: Point, viewport: ViewportState): Point

// Scale a distance (not a position) between spaces
scaleToDocument(canvasDist: number, viewport: ViewportState): number
scaleToCanvas(docDist: number, viewport: ViewportState): number
```

## Device Pixel Ratio (DPR) Handling

The `<canvas>` element's internal resolution must be scaled by `window.devicePixelRatio` for crisp rendering on retina displays.

In `CanvasRoot.tsx`:
- Set `canvas.width = element.clientWidth * dpr`
- Set `canvas.height = element.clientHeight * dpr`
- Apply `ctx.scale(dpr, dpr)` at the start of every render
- All drawing code then works in CSS pixel units

The DPR scaling is handled ONLY in CanvasRoot. No other module should reference devicePixelRatio.

## Viewport State

Stored in `uiStore`:

```typescript
interface ViewportState {
  zoom: number;           // 1.0 = 100%
  panX: number;           // document-space offset
  panY: number;
  documentWidth: number;  // document dimensions in document units
  documentHeight: number;
  canvasWidth: number;    // canvas element size in CSS pixels
  canvasHeight: number;
}
```

## Common Mistakes to Avoid

1. **Storing positions in canvas space.** ALL positions on SceneObjects and Particles are in document space. Always.
2. **Forgetting to transform pointer events.** Raw event.clientX is screen space. You must go screen → canvas → document before creating/modifying scene objects.
3. **Drawing in document space without transforming.** The renderer must convert document → canvas positions before calling ctx.lineTo etc.
4. **Mixing DPR into document calculations.** DPR only matters at the canvas rendering level, never in the engine or tools.
