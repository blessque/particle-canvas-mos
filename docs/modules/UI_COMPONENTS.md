# UI Components — Module Guide

Owner files: `src/ui/*.tsx`, `src/ui/icons/*.tsx`

## Design Principles

1. **Dark theme.** The canvas background is dark (near-black). All UI is dark-themed with subtle borders. Particles are light-colored, so the UI must not compete visually.
2. **Minimal, tool-like.** Think Figma, not Photoshop. Clean, tight spacing, small text, iconographic.
3. **Figma-editable.** The owner uses Figma MCP to iterate on icons and layout. This means:
   - Icons are individual `.tsx` files returning inline SVG (easy to find, easy to replace)
   - Color values use Tailwind's `surface-*` scale (easy to swap)
   - No deeply nested or clever CSS — straightforward Tailwind utilities
4. **Mobile-friendly.** Panels collapse on small screens. Touch targets are at least 44×44px.

## Layout Structure

```
┌─────────────────────────────────────────┐
│  Toolbar (top bar, horizontal)          │
├────────┬────────────────────────────────┤
│        │                                │
│  Left  │       Canvas Area              │
│ Panel  │    (CanvasRoot.tsx)             │
│        │                                │
│        │                                │
├────────┴────────────────────────────────┤
│  (optional bottom bar for status)       │
└─────────────────────────────────────────┘
```

On mobile (< 768px):
- Toolbar stays on top but becomes more compact (icons only, no labels)
- Left panel becomes a bottom sheet that slides up on tap
- Canvas fills remaining space

## Component Inventory

### Toolbar.tsx
Horizontal bar at the top. Contains:
- Tool buttons: Select, Rectangle, Ellipse, Star, Freehand (with icons)
- Import button (opens file picker)
- Export button (opens export dialog or dropdown)
- Boolean mode toggle (union/independent)

Active tool is highlighted. Use `toolStore.activeTool` to determine which button is active.

### ParticlePanel.tsx
Left sidebar panel. Contains controls for particle configuration:
- **Count** — slider, range 100–20000, logarithmic scale
- **Size range** — dual-thumb slider for minSize/maxSize
- **Opacity randomize** — toggle switch (on/off)
- **Base opacity** — slider, 0–1 (only shown if randomize is off)
- **Falloff type** — segmented control: Linear / Exponential / Gaussian
- **Falloff distance** — slider
- **Falloff bias** — slider, 0–1
- **Spawn direction** — segmented control: Inside / Outside / Both
- **Seed** — number input + "randomize" button (generates new random seed)
- **Color** — color input or simple hex field

Each control updates `particleStore` on change. Particles recompute on each change.
For performance: debounce slider `onChange` — only trigger recompute after 100ms of no change, or on `onPointerUp`.

### ShapePanel.tsx
Appears when a shape is selected. Shows:
- Position (x, y) — number inputs
- Size (width, height) — number inputs
- For star: point count, inner radius ratio — sliders
- Visible toggle
- Lock toggle
- Delete button

### ExportButton.tsx
Dropdown or dialog with:
- Format selector: PNG / SVG
- Background: Transparent / Solid color (with color picker)
- Export button
- (Shows warning if SVG + particle count > 10000)

### BooleanToggle.tsx
Simple toggle or segmented control: Union / Independent
Updates `sceneStore.booleanMode`.

### CanvasSizeSelector.tsx
Dropdown or dialog to set document dimensions:
- Preset sizes: 1080×1080 (Instagram), 1920×1080 (HD), 1080×1920 (Story), 3840×2160 (4K), Custom
- Width/height number inputs for custom

## Icon System

Each icon is a separate `.tsx` file in `src/ui/icons/` returning an SVG element:

```typescript
// IconRectangle.tsx
interface IconProps {
  size?: number;
  className?: string;
}

export function IconRectangle({ size = 20, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none"
         stroke="currentColor" strokeWidth="1.5" className={className}>
      <rect x="3" y="3" width="14" height="14" rx="1" />
    </svg>
  );
}
```

**Why individual files:** Easy to find by name, easy to replace one icon without touching others, easy to generate from Figma SVG exports.

**Consistent props:** All icons accept `size` (number) and `className` (string). All use `currentColor` for stroke/fill so they inherit text color from parent.

## Tailwind Patterns

### Colors
- Background: `bg-surface-950` (deepest), `bg-surface-900` (panels), `bg-surface-800` (inputs/buttons)
- Text: `text-surface-100` (primary), `text-surface-400` (secondary), `text-surface-500` (disabled)
- Borders: `border-surface-700`
- Accent/active: `bg-blue-600`, `text-blue-400` (for active tool highlight)

### Spacing
- Panel padding: `p-3`
- Between controls: `space-y-3`
- Between label and input: `space-y-1`
- Button padding: `px-3 py-2`

### Typography
- Labels: `text-xs font-medium text-surface-400 uppercase tracking-wide`
- Values: `text-sm text-surface-100`

### Interactive States
- Hover: `hover:bg-surface-700`
- Active/pressed: `bg-surface-600`
- Focus: `focus:ring-1 focus:ring-blue-500 focus:outline-none`

## Slider Component Pattern

Since we use many sliders, create a reusable `Slider` component or use the native `<input type="range">` styled with Tailwind:

```tsx
interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  onChangeEnd?: (value: number) => void;  // fires on pointerUp — triggers recompute
  displayValue?: string;  // formatted display value
}
```

The `onChangeEnd` prop is critical for performance — it's where the expensive particle recompute should be triggered, not on every `onChange` during drag.
