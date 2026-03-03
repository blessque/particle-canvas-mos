# Architecture Overview

## Core Principle: Static Rendering, Not Animation

This application does NOT run a continuous animation loop. There is no `requestAnimationFrame`. The pipeline is:

1. User performs an action (draws a shape, changes a parameter, imports a file)
2. The relevant Zustand store updates
3. React re-renders the UI panels
4. A recompute is triggered: the particle engine recalculates all particle positions
5. The canvas redraws once: scene objects + particles

This means every render is a "snapshot." The particle engine is a pure function:
`(sceneObjects, particleConfig, booleanMode) → Particle[]`

## Data Flow

```
User Input (pointer/keyboard)
    ↓
Tool Handler (tools/)
    ↓ calls store actions
Zustand Stores (store/)
    ↓ React subscriptions trigger
App.tsx orchestrates recompute
    ↓ passes store state to engine
Particle Engine (engine/) — pure functions, no side effects
    ↓ returns Particle[]
Canvas Renderers (canvas/) — draws to <canvas> element
    ↓
User sees the result
```

## Module Boundaries

### `types/` — Shared Contracts
Pure TypeScript type/interface definitions. No runtime code. No functions. Every other module imports from here. This is the single source of truth for data shapes.

### `engine/` — Pure Computation
**CRITICAL: This module has NO dependencies on React, DOM, Canvas API, or Zustand.**
Every function in engine/ is a pure function: given inputs, returns outputs, no side effects.
This makes the engine testable, predictable, and decoupled from rendering.

Files:
- `vectorMath.ts` — Vec2 add, sub, normalize, lerp, dist, rotate, dot, cross
- `shapeGeometry.ts` — converts ShapeObject → Path (array of CurveSegments). Rectangle → 4 line segments. Ellipse → 4 cubic bezier arcs. Star → line segments.
- `pathUtils.ts` — discretize CurveSegments into evenly-spaced sample points along the path (arc-length parameterization). Also: point-in-path testing.
- `spatialHash.ts` — grid-based spatial index. Insert points, query by cell. Used to accelerate nearest-curve lookups when particle count is high.
- `falloff.ts` — maps distance from curve → density multiplier. Supports linear, exponential, gaussian falloff curves. Configurable edge bias.
- `booleanOps.ts` — wraps Paper.js boolean operations. Takes ShapeObjects → produces combined paths (union or raw). Returns CurveSegment arrays.
- `particleDistributor.ts` — THE CORE. Takes combined paths + config → returns Particle positions. Uses Poisson disk sampling + falloff + inside/outside logic.
- `rasterSampler.ts` — takes an image → returns a brightness grid (downsampled to max 512×512). Used by particleDistributor for density-based placement.

### `store/` — Zustand State
Four small stores. Each owns a specific domain. Stores contain state + actions (mutators). Stores NEVER contain rendering logic or computation.

### `canvas/` — Rendering
Receives data, draws to Canvas 2D context. No computation here — just draw calls.

### `tools/` — Input Handling
Each tool is an object with pointer event handlers: `onPointerDown`, `onPointerMove`, `onPointerUp`, `onKeyDown`, `onKeyUp`. Tools read from toolStore (for transient state like current drag) and write to sceneStore (to create/modify objects).

### `ui/` — React Components
Panels, buttons, sliders. Read from stores via Zustand hooks. Dispatch store actions on user input. No canvas drawing here.

### `import/` — File Ingestion
SVG and raster file parsing. Converts external files into internal types (SceneObject variants).

### `export/` — File Output
Reads the current canvas state and produces downloadable PNG or SVG files.

### `utils/` — Shared Utilities
Small pure functions used across modules: coordinate transforms, ID generation, math helpers.

## Rendering Pipeline Detail

The canvas has three layers drawn in order on a SINGLE canvas element (not multiple overlapping canvases):

1. **Scene layer** (SceneRenderer) — shape outlines, imported SVG paths, raster image previews. Drawn with low opacity or as guides so the user can see what they've placed.
2. **Particle layer** (ParticleRenderer) — the computed particles. This is the visual output.
3. **Handle layer** (HandleRenderer) — selection outlines, resize handles, tool previews (like a rectangle being dragged). Drawn on top of everything.

All three are functions that take a `CanvasRenderingContext2D` and the relevant data, and draw. They are called sequentially in a single `renderAll()` function.

## Performance Model

Target: <100ms recompute for 10,000 particles on a mid-range laptop.

The critical path is `particleDistributor`. If particle count × curve complexity causes recompute to exceed 100ms:
1. Use spatialHash for nearest-curve lookups instead of brute force
2. Downsample curves (fewer sample points per curve)
3. Debounce slider changes (recompute only on pointerUp, show preview at lower particle count during drag)

See `docs/conventions/PERFORMANCE.md` for specific budgets.
