# Particle Engine — Module Guide

Owner files: `src/engine/particleDistributor.ts`, `src/engine/falloff.ts`, `src/engine/spatialHash.ts`

## Overview

The particle engine is the core of the application. It takes scene objects + particle config and returns an array of `Particle` positions. It is a **pure function pipeline** — no side effects, no DOM access, no store access.

## Pipeline

```
SceneObjects[] + ParticleConfig + BooleanMode
    ↓
1. Convert each SceneObject → Path[] (via shapeGeometry.ts)
    ↓
2. If union mode: merge overlapping paths via booleanOps.ts
    ↓
3. Discretize all paths into evenly-spaced sample points (pathUtils.ts)
    ↓
4. For raster objects: generate brightness grid (rasterSampler.ts)
    ↓
5. Distribute particles using Poisson disk sampling + falloff
    ↓
6. Apply opacity (random or fixed)
    ↓
Particle[]
```

## Particle Distribution Algorithm

**DO NOT use a simple random scatter or grid.** The result must look organic and natural.

### Step 1: Candidate Generation
For each path, generate candidate points:
- **Along the path:** Sample points at regular arc-length intervals along every curve segment. Use `pathUtils.samplePointsAlongPath(path, spacing)`. The spacing should produce roughly 3-5× more candidates than the target particle count.
- **Perpendicular spread:** For each candidate, offset it perpendicular to the curve by a random distance weighted by the falloff function. The `spawnDirection` config controls whether offset goes inward, outward, or both.

### Step 2: Poisson Disk Filtering
The raw candidates will be unevenly distributed. Apply Poisson disk sampling to enforce a minimum distance between particles. This creates the organic "not-too-regular, not-too-random" look.

Algorithm: Bridson's algorithm variant:
1. Set minimum distance based on: `minDist = sqrt(totalArea / targetCount) * 0.8`
2. Use a spatial hash grid with cell size = minDist / sqrt(2)
3. For each candidate, check if any existing particle is within minDist
4. Accept if no conflict, reject otherwise
5. Continue until target count is reached or candidates exhausted

### Step 3: Falloff Weighting
The `falloff.ts` module maps distance-from-curve to a density probability:
- `linear(d, maxDist)` → `1 - d/maxDist`
- `exponential(d, maxDist)` → `exp(-3 * d/maxDist)`
- `gaussian(d, maxDist)` → `exp(-4.5 * (d/maxDist)²)`

The `falloffBias` parameter (0–1) interpolates between uniform distribution and full falloff:
```
effectiveProbability = lerp(1.0, falloffValue, falloffBias)
```
At `falloffBias = 0`, particles spread uniformly within the falloff distance.
At `falloffBias = 1`, particles cluster tightly along the curve.

### Step 4: Inside/Outside Logic

`spawnDirection` affects how the perpendicular offset is applied:
- `'outside'`: offset always points away from shape interior
- `'inside'`: offset always points into the shape interior
- `'both'`: offset can go either direction

For closed shapes, "inside" is determined by the winding rule (use `pathUtils.isPointInside`). For open paths (freehand), there is no inside — both sides are "outside."

### Step 5: Raster Density Override

For `RasterImportObject`, the brightness grid overrides the distribution:
- Dark pixels (brightness near 0) → high particle density
- Light pixels (brightness near 1) → low particle density
- Sample the brightness grid at each candidate position using bilinear interpolation
- Multiply the candidate's acceptance probability by `(1 - brightness)`

## Sample Density Rules — CRITICAL

These rules exist because the particle engine picks candidates **uniformly at random** from `allSamples`. More samples in a region = more early placements there = the Poisson disk fills it before sparse regions are saturated. Density bugs are subtle and only visible with complex geometry.

### Rule 1: Arc-length sampling ≠ spatial uniformity
`sampleOnePath` samples every **2 arc-length units**. A straight 50-unit stroke → 25 samples. A micro zig-zag with 1-unit teeth covering the same 50-unit area has ~5× the arc length → ~125 samples packed into the same 2D footprint. Result: hot spots at complex regions.

**Fix already in place:** `thinSamples(samples, 2)` in `sampleSVGPaths` collapses to one sample per 2×2 grid cell before the samples reach the distributor. **Do not remove this call.**

### Rule 2: Always thin SVG samples before distribution
If you add a new importer or a new sampling path for SVG-like geometry, run `thinSamples(raw, 2)` after collecting all path samples. The grid step (2) matches the arc-length step in `sampleOnePath`.

### Rule 3: Do not thin freehand or primitive shapes
`sampleFreehandPath`, `sampleRectangle`, `sampleEllipse`, `sampleStar` are already geometrically uniform — their arc spacing ≈ spatial spacing. Thinning them would only drop legitimate samples at shared corners.

### Rule 4: `jitterScale` is not a fix for density — it controls lateral spread
`OutlineSample.jitterScale` multiplies tangential jitter (not radial distance). SVG paths use `0.5` to reduce lateral drift and preserve legibility; it does **not** affect sample density. The density fix is `thinSamples`.

### Rule 5: Loop bound in `sampleOnePath` is `j < steps`, not `j <= steps`
Using `j <= steps` emits both the start *and* end point of each segment. Adjacent segments share endpoints → duplicate samples at every segment junction → invisible double-weighting. Keep the loop as `j < steps`.

## Performance Targets

- 3,000 particles, 5 shapes: < 50ms
- 10,000 particles, 10 shapes: < 150ms
- 20,000 particles, 20 shapes: < 300ms (acceptable, debounce slider changes)

If recompute exceeds 100ms, the UI should debounce parameter changes — recompute on pointerUp instead of continuous slider drag.

## Seeded Randomness

All random number generation MUST use a seeded PRNG (pseudo-random number generator), not `Math.random()`. Use a simple implementation like a mulberry32 or xoshiro128 seeded with `ParticleConfig.seed`. This ensures the same inputs always produce the same particle layout, which is essential for reliable exports.

```typescript
// Example seeded PRNG (mulberry32)
function createRNG(seed: number) {
  return function(): number {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
```
