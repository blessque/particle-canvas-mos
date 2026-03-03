# Import & Export — Module Guide

Owner files: `src/import/svgImporter.ts`, `src/import/rasterImporter.ts`, `src/import/fileHandler.ts`, `src/export/exportPNG.ts`, `src/export/exportSVG.ts`

---

## File Import: Drop Zone & Picker

`fileHandler.ts` provides:
1. A drop zone handler (attach to the canvas area)
2. A file picker trigger (for the import button in the UI)

Both accept files and route them:
- `.svg` files → `svgImporter.ts`
- `.png`, `.jpg`, `.jpeg`, `.webp`, `.heic` → `rasterImporter.ts`
- Other file types → show an error toast / ignore

```typescript
export function handleFiles(files: FileList): void {
  for (const file of Array.from(files)) {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'svg') {
      importSVG(file);
    } else if (['png', 'jpg', 'jpeg', 'webp', 'heic'].includes(ext ?? '')) {
      importRaster(file);
    }
  }
}
```

---

## SVG Import

### Scope — What We Support

**Supported elements (V1):**
- `<path>` — parse `d` attribute
- `<rect>` — convert to path
- `<circle>` — convert to path
- `<ellipse>` — convert to path
- `<line>` — convert to path
- `<polyline>` — convert to path
- `<polygon>` — convert to path
- `<g>` — recurse into children, accumulate transforms

**NOT supported (explicitly skip):**
- `<text>` and `<tspan>`
- `<image>` embedded in SVG
- CSS styling (`<style>` blocks, class attributes)
- `<use>` and `<defs>` references
- Filters, masks, clip-paths
- Gradients (fill/stroke gradients are ignored; paths still extracted)
- `<symbol>` elements

### Transform Flattening

SVG elements can have nested `transform` attributes. The importer MUST flatten all transforms into absolute coordinates. Walk the DOM tree, accumulate a transformation matrix at each level, and apply it to every point.

Supported transform types:
- `translate(tx, ty)`
- `scale(sx, sy)`
- `rotate(angle, cx, cy)`
- `matrix(a, b, c, d, e, f)`

Use a 3×3 affine matrix. Multiply parent × child at each level. Apply to all coordinates before creating CurveSegments.

### Parse Pipeline

```
SVG file (string)
  ↓ DOMParser.parseFromString(svg, 'image/svg+xml')
SVGDocument
  ↓ recursive walk, accumulate transforms
  ↓ for each shape element: convert to path data string
  ↓ parse path data string into CurveSegment[]
Path[]
  ↓ compute bounding box, normalize to document space
SVGImportObject (added to scene store)
```

### Path Data Parsing

SVG `<path>` `d` attributes use a compact notation: `M 10 20 L 30 40 C 50 60 70 80 90 100 Z`

Parse these commands into CurveSegments:
- `M/m` → moveTo (start new subpath)
- `L/l` → line segment
- `H/h` → horizontal line
- `V/v` → vertical line
- `C/c` → cubic bezier
- `S/s` → smooth cubic
- `Q/q` → quadratic bezier
- `T/t` → smooth quadratic
- `A/a` → arc (convert to cubic bezier approximation)
- `Z/z` → close path

Lowercase commands are relative. Convert all to absolute.

**Consider using a small library for this** (like `svg-path-parser` or `svgpath`) rather than writing a parser from scratch. It's a well-known parsing problem with many edge cases.

---

## Raster Import

### Pipeline

```
Image file (File object)
  ↓ FileReader.readAsDataURL()
Data URL string
  ↓ Create Image element, wait for load
HTMLImageElement
  ↓ Draw to OffscreenCanvas at reduced resolution (max 512×512)
OffscreenCanvas
  ↓ getImageData() → pixel array
  ↓ For each pixel: brightness = 0.299*R + 0.587*G + 0.114*B (luminance formula)
  ↓ Normalize to 0-1 range
number[][] (brightness grid)
  ↓
RasterImportObject { imageDataURL, brightnessGrid }
```

### Brightness Grid Details

- Downsample to max 512×512 regardless of source image size
- Maintain aspect ratio (e.g., a 1000×500 image → 512×256 grid)
- Brightness values: 0 = black (dense particles), 1 = white (no particles)
- Store as a flat 2D array: `grid[y][x]`

### HEIC Support

HEIC files may not be natively decodable in all browsers. If `new Image()` fails to load a HEIC file, show an error message suggesting the user convert to PNG/JPEG first. Do NOT add a HEIC decoder library — it's too large for the MVP.

---

## PNG Export

`exportPNG.ts`

### Pipeline

```
1. Create an OffscreenCanvas at export resolution (document dimensions × scale factor)
2. Fill with transparent background (or solid color if user chose one)
3. Draw particles only (NOT shape outlines, NOT handles)
4. canvas.toBlob('image/png')
5. Create download link, trigger click
```

### Key Details

- Export resolution is independent of the display canvas. If the document is 1920×1080, export at that exact resolution.
- Do NOT draw shape outlines or UI elements in the export. Only particles.
- Transparent background: do not call `fillRect` before drawing particles.
- Solid background: fill entire canvas with user-selected color first.

```typescript
export function exportPNG(
  particles: Particle[],
  docWidth: number,
  docHeight: number,
  config: ParticleConfig,
  backgroundColor: string | null  // null = transparent
): void {
  const canvas = new OffscreenCanvas(docWidth, docHeight);
  const ctx = canvas.getContext('2d')!;

  if (backgroundColor) {
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, docWidth, docHeight);
  }

  for (const p of particles) {
    ctx.globalAlpha = p.opacity;
    ctx.fillStyle = config.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  canvas.convertToBlob({ type: 'image/png' }).then(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'particle-canvas.png';
    a.click();
    URL.revokeObjectURL(url);
  });
}
```

---

## SVG Export

`exportSVG.ts`

### Pipeline

```
1. Create SVG root element string with viewBox matching document dimensions
2. For each particle: create a <circle> element
3. Assemble into a valid SVG string
4. Create blob and trigger download
```

### Output Format

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {docWidth} {docHeight}">
  <circle cx="{p.x}" cy="{p.y}" r="{p.radius}" fill="{color}" opacity="{p.opacity}" />
  <!-- ... repeat for all particles -->
</svg>
```

### Performance Note

At 10,000+ particles, the SVG file will be large (several MB) and may be slow to open in design tools. Warn the user if particle count exceeds 10,000 when exporting as SVG.
