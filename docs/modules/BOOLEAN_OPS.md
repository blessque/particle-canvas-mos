# Boolean Operations — Module Guide

Owner file: `src/engine/booleanOps.ts`

## What This Module Does

Controls how overlapping shapes combine for particle distribution. There is a single global toggle with two modes:

- **Union mode:** Overlapping shapes are merged into a single combined outline. Particles treat the merged shape as one object. There are no particles in the overlap zone's "interior boundaries."
- **Independent mode:** Each shape is treated separately. Overlapping shapes produce overlapping particle fields, which may result in denser particles in overlap zones.

## Why Paper.js

Computing the boolean union of arbitrary 2D paths (rectangles, ellipses, stars, freehand curves) is a hard computational geometry problem. Paper.js has battle-tested implementations of `path.unite()`, `path.intersect()`, `path.subtract()`, and `path.exclude()`.

**We use Paper.js ONLY as a geometry computation library.** We do NOT use its canvas rendering, its mouse handling, or its scene graph. We never call `paper.setup()` with a canvas element.

## Integration Pattern

```typescript
import paper from 'paper';

// Initialize Paper.js WITHOUT a canvas (headless mode)
// Do this once at module load time
paper.setup(new paper.Size(1, 1));

export function computeUnion(paths: Path[]): Path[] {
  // 1. Convert our Path type → paper.Path objects
  // 2. Sequentially unite them: result = path1.unite(path2).unite(path3)...
  // 3. Convert the resulting paper.Path back to our Path type
  // 4. Return the merged paths
}

export function getPathsForDistribution(
  objects: SceneObject[],
  booleanMode: 'union' | 'independent'
): Path[] {
  // 1. Convert all SceneObjects → Path[] via shapeGeometry.ts
  // 2. If 'independent': return all paths as-is
  // 3. If 'union': pass closed paths through computeUnion(), return result
  //    (Open paths like freehand are not unioned — they stay independent)
}
```

## Converting Between Our Types and Paper.js Types

### Our Path → paper.Path

```typescript
function toPaperPath(path: Path): paper.Path {
  const pp = new paper.Path();
  for (const seg of path.segments) {
    switch (seg.type) {
      case 'line':
        pp.add(new paper.Point(seg.to.x, seg.to.y));
        break;
      case 'cubic':
        // Use paper.Segment with handleIn/handleOut for bezier control points
        break;
      // ... handle other segment types
    }
  }
  if (path.closed) pp.closePath();
  return pp;
}
```

### paper.Path → Our Path

After a boolean operation, extract the result:
```typescript
function fromPaperPath(pp: paper.Path): Path {
  const segments: CurveSegment[] = [];
  for (const curve of pp.curves) {
    // Each paper.Curve is a cubic bezier
    segments.push({
      type: 'cubic',
      from: { x: curve.point1.x, y: curve.point1.y },
      cp1: { x: curve.handle1.x + curve.point1.x, y: curve.handle1.y + curve.point1.y },
      cp2: { x: curve.handle2.x + curve.point2.x, y: curve.handle2.y + curve.point2.y },
      to: { x: curve.point2.x, y: curve.point2.y },
    });
  }
  return { segments, closed: pp.closed };
}
```

## Handling Compound Paths

`path.unite()` can return a `paper.CompoundPath` (a path with holes). Handle this:

```typescript
const result = path1.unite(path2);
if (result instanceof paper.CompoundPath) {
  // result.children is an array of paper.Path objects
  return result.children.map(child => fromPaperPath(child as paper.Path));
} else {
  return [fromPaperPath(result as paper.Path)];
}
```

## State Location

The boolean mode toggle is stored in `sceneStore`:

```typescript
booleanMode: 'union' | 'independent'
```

When the user toggles it, particles are recomputed.

## Edge Cases

1. **No overlapping shapes:** Union mode produces the same result as independent mode.
2. **Single shape:** No union needed, pass through.
3. **Open paths (freehand):** Cannot be meaningfully unioned. Always treated as independent.
4. **Raster imports:** Not affected by boolean ops. Their brightness map is independent.
5. **SVG imports with multiple paths:** Each SVG path is treated as a separate path for union purposes.
