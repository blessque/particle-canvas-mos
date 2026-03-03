# State Management Conventions

## Library: Zustand

We use Zustand for all application state. It's lightweight, TypeScript-native, and works well with React without boilerplate.

## Store Architecture

There are exactly FOUR stores. Do not create additional stores without explicit approval.

### 1. sceneStore — Scene Objects

**Owns:** The array of `SceneObject` instances + the boolean mode toggle.

```typescript
interface SceneStoreState {
  objects: SceneObject[];
  booleanMode: 'union' | 'independent';

  // Actions
  addObject: (obj: SceneObject) => void;
  updateObject: (id: string, partial: Partial<SceneObject>) => void;
  removeObject: (id: string) => void;
  reorderObject: (id: string, direction: 'up' | 'down') => void;
  setBooleanMode: (mode: 'union' | 'independent') => void;
  clearAll: () => void;
}
```

### 2. particleStore — Particle Configuration

**Owns:** The global `ParticleConfig`. Does NOT store computed particles (those are ephemeral).

```typescript
interface ParticleStoreState {
  config: ParticleConfig;

  // Actions
  updateConfig: (partial: Partial<ParticleConfig>) => void;
  resetConfig: () => void;
  randomizeSeed: () => void;
}
```

### 3. toolStore — Tool State

**Owns:** Active tool selection and transient drawing state.

```typescript
interface ToolStoreState {
  activeTool: ToolType;
  isDrawing: boolean;
  drawStart: Point | null;
  drawCurrent: Point | null;
  shiftHeld: boolean;
  selectedObjectIds: string[];

  // Actions
  setActiveTool: (tool: ToolType) => void;
  setDrawing: (isDrawing: boolean) => void;
  setDrawStart: (point: Point | null) => void;
  setDrawCurrent: (point: Point | null) => void;
  setShiftHeld: (held: boolean) => void;
  selectObjects: (ids: string[]) => void;
  clearSelection: () => void;
}
```

### 4. uiStore — UI State

**Owns:** Panel visibility, viewport zoom/pan, canvas dimensions.

```typescript
interface UIStoreState {
  viewport: ViewportState;
  leftPanelOpen: boolean;
  exportDialogOpen: boolean;

  // Actions
  setViewport: (partial: Partial<ViewportState>) => void;
  toggleLeftPanel: () => void;
  setExportDialogOpen: (open: boolean) => void;
}
```

## Rules

### What Goes in a Store vs. What Doesn't

**IN a store:**
- Data that multiple components need to read
- Data that persists across user interactions
- Configuration that affects the particle computation

**NOT in a store:**
- Computed particles (`Particle[]` array) — derived, recomputed on demand, held in a `useRef` or local state in `CanvasRoot`
- Transient hover states — local component state
- Animation frame IDs — refs
- Canvas context — ref

### Mutation Patterns

- All mutations go through store actions. NEVER mutate store state directly.
- Actions are synchronous. No async operations in store actions.
- Actions produce new object references (immutability). Use spread:

```typescript
// GOOD
updateObject: (id, partial) => set(state => ({
  objects: state.objects.map(obj =>
    obj.id === id ? { ...obj, ...partial } : obj
  ),
})),

// BAD — mutating in place
updateObject: (id, partial) => set(state => {
  const obj = state.objects.find(o => o.id === id);
  Object.assign(obj, partial); // NEVER do this
}),
```

### Subscriptions and Selectors

- Use selectors to avoid unnecessary re-renders:

```typescript
// GOOD — component only re-renders when activeTool changes
const activeTool = useToolStore(state => state.activeTool);

// BAD — component re-renders on ANY toolStore change
const toolStore = useToolStore();
```

- For derived data (e.g., "selected objects"), compute in the component or a custom hook using selectors from multiple stores:

```typescript
function useSelectedObjects(): SceneObject[] {
  const ids = useToolStore(state => state.selectedObjectIds);
  const objects = useSceneStore(state => state.objects);
  return objects.filter(obj => ids.includes(obj.id));
}
```

### Cross-Store Communication

Stores do NOT import or call each other. If an action in one store needs to affect another, the orchestration happens in the React component (typically `App.tsx` or `CanvasRoot.tsx`).

Example: when a shape is deleted from sceneStore, the selectedObjectIds in toolStore should be updated. This is done in the component that handles delete, NOT by having sceneStore call toolStore.

## Particle Recomputation Trigger

Particles must recompute when:
- `sceneStore.objects` changes (shape added/moved/resized/deleted)
- `sceneStore.booleanMode` changes
- `particleStore.config` changes

The recomputation is triggered in `CanvasRoot.tsx` or `App.tsx` using a `useEffect` that watches these values. The result (`Particle[]`) is stored in a `useRef` (not in a store) and passed to the renderer.

```typescript
// In CanvasRoot.tsx
const objects = useSceneStore(state => state.objects);
const booleanMode = useSceneStore(state => state.booleanMode);
const config = useParticleStore(state => state.config);
const particlesRef = useRef<Particle[]>([]);

useEffect(() => {
  particlesRef.current = distributeParticles(objects, config, booleanMode);
  renderCanvas(); // trigger redraw
}, [objects, booleanMode, config]);
```
