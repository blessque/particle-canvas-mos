# Performance Conventions

## The Performance Contract

The application must feel instant on any device. "Instant" means:
- Shape drawing: zero perceptible lag (tool response < 16ms)
- Particle recompute after parameter change: < 200ms on mid-range laptop, < 500ms on phone
- Canvas redraw: < 16ms (one frame at 60fps)
- Export: < 3 seconds for PNG, < 5 seconds for SVG

## Particle Budget

| Device tier | Max particle count | Target recompute time |
|------------|-------------------|----------------------|
| Desktop (modern) | 20,000 | < 200ms |
| Desktop (older) | 10,000 | < 200ms |
| Tablet | 8,000 | < 300ms |
| Phone | 5,000 | < 500ms |

The UI should NOT automatically limit particle count. The user can set whatever count they want. But if recompute exceeds 200ms, apply debouncing (see below).

## Debouncing Strategy

### Slider Changes
When the user drags a slider (particle count, falloff, etc.):
1. During drag: do NOT recompute particles. Optionally show a preview with 10% of particles.
2. On pointerUp (slider release): recompute with full particle count.
3. Alternatively: debounce with 150ms delay. If a new change comes within 150ms, cancel the previous recompute.

Implementation:
```typescript
const recomputeDebounced = useMemo(
  () => debounce(() => {
    particlesRef.current = distributeParticles(objects, config, booleanMode);
    renderCanvas();
  }, 150),
  [objects, config, booleanMode]
);
```

### Shape Manipulation
When moving or resizing a shape:
1. During drag: recompute particles (they should follow the shape in real-time)
2. BUT: if recompute takes > 50ms, switch to preview mode (lower particle count during drag, full count on drop)

Measure recompute time:
```typescript
const start = performance.now();
const particles = distributeParticles(objects, config, booleanMode);
const elapsed = performance.now() - start;
if (elapsed > 50) {
  enablePreviewMode(); // reduce particle count during next drag
}
```

## Spatial Hash

`src/engine/spatialHash.ts`

Use a grid-based spatial hash when:
- Total curve sample points × particle count > 1,000,000

The spatial hash divides the document space into a grid of cells. Each cell stores the curve sample points within it. When computing the nearest curve for a particle, only check the particle's cell and its 8 neighbors.

Cell size: `falloffDistance * 2` (so we never miss a nearby curve point)

```typescript
interface SpatialHash {
  cellSize: number;
  cells: Map<string, Point[]>;

  insert(point: Point): void;
  query(point: Point, radius: number): Point[];
  clear(): void;
}

function cellKey(x: number, y: number, cellSize: number): string {
  return `${Math.floor(x / cellSize)},${Math.floor(y / cellSize)}`;
}
```

## Canvas Rendering Performance

### Drawing 10,000+ circles
`ctx.arc()` + `ctx.fill()` for each particle is fine up to ~5000 particles. Above that:

1. **Batch by opacity:** Group particles by rounded opacity (e.g., 0.2, 0.4, 0.6, 0.8, 1.0). Set `globalAlpha` once per group, draw all particles in that group in a single path.

```typescript
// Group particles by rounded opacity
const groups = new Map<number, Particle[]>();
for (const p of particles) {
  const key = Math.round(p.opacity * 5) / 5; // round to nearest 0.2
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key)!.push(p);
}

// Draw each group as a single path
for (const [opacity, group] of groups) {
  ctx.globalAlpha = opacity;
  ctx.beginPath();
  for (const p of group) {
    ctx.moveTo(p.x + p.radius, p.y);
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
  }
  ctx.fill();
}
```

2. **Single fill color:** Since all particles share the same color, set `fillStyle` once.

3. **Avoid `save()`/`restore()`:** These are expensive in tight loops. Set state directly.

## Memory

- Brightness grids: max 512×512 = 262,144 floats ≈ 1MB. Fine.
- 20,000 particles × ~40 bytes each ≈ 800KB. Fine.
- OffscreenCanvas for export: allocate, use, discard. Don't keep references.
- Image data URLs (raster imports): these can be large (5–10MB for high-res photos). Store only one reference. When possible, store a thumbnail data URL for the display preview and the brightness grid for computation.

## Profiling

When performance is a concern, use:
```typescript
console.time('particleDistribution');
const particles = distributeParticles(objects, config, booleanMode);
console.timeEnd('particleDistribution');
```

Remove profiling logs before committing to final code. Use `// PERF:` comments to mark sections that have been optimized and should not be naively refactored.
