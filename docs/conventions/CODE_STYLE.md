# Code Style Conventions

Read this before writing ANY code in this project.

## File Rules

- **Max file length: 300 lines.** If a file exceeds 300 lines, it needs to be split. This is not a suggestion.
- **One export per file** for components and tools. Utility files may have multiple named exports.
- **No default exports** except for React components that need them (e.g., lazy loading). Use named exports everywhere else.

## Naming

### Files
- React components: `PascalCase.tsx` (e.g., `Toolbar.tsx`, `CanvasRoot.tsx`)
- Non-React TypeScript: `camelCase.ts` (e.g., `vectorMath.ts`, `particleDistributor.ts`)
- Type files: `camelCase.ts` in the `types/` directory
- Icon components: `IconPascalCase.tsx` (e.g., `IconRectangle.tsx`)

### Code
- Interfaces/types: `PascalCase` (e.g., `SceneObject`, `ParticleConfig`)
- Functions: `camelCase` (e.g., `distributeParticles`, `screenToCanvas`)
- Constants: `UPPER_SNAKE_CASE` (e.g., `DEFAULT_PARTICLE_CONFIG`, `MAX_PARTICLES`)
- Store hooks: `use[Domain]Store` (e.g., `useSceneStore`, `useParticleStore`)
- Boolean variables/props: prefix with `is`, `has`, `should`, `can` (e.g., `isDrawing`, `hasOverlap`)

## Imports

### Order (enforce this consistently)
```typescript
// 1. React
import { useState, useCallback } from 'react';

// 2. External libraries
import { create } from 'zustand';

// 3. Internal types
import type { Point, BBox } from '@/types/geometry';
import type { SceneObject } from '@/types/scene';

// 4. Internal modules (from closest to furthest)
import { addVec, subVec } from '@/engine/vectorMath';
import { useSceneStore } from '@/store/sceneStore';
```

### Rules
- Always use the `@/` path alias (maps to `src/`). Never use relative paths like `../../`.
- Always use `import type` for type-only imports. This is enforced by TypeScript strict mode.
- Never import from `engine/` in `store/` files.
- Never import from `canvas/` or `ui/` in `engine/` files.
- Check the dependency rules in `claude.md` before adding any import.

## Functions

- Prefer pure functions. A pure function takes inputs and returns outputs with no side effects.
- Engine functions must be pure. No DOM access, no store access, no `console.log`.
- Keep function signatures explicit. Always type parameters and return values.
- Use `readonly` arrays in function parameters when the function should not mutate the input.

```typescript
// GOOD
function distributeParticles(
  paths: readonly Path[],
  config: ParticleConfig,
): Particle[] {
  // ...
}

// BAD — no return type, mutable parameter
function distributeParticles(paths: Path[], config: ParticleConfig) {
  // ...
}
```

## React Components

- Use function components with hooks. No class components.
- Extract complex logic into custom hooks or utility functions.
- Keep components under 150 lines. If a component is getting long, extract sub-components.
- Use Tailwind classes directly. No separate CSS files. No CSS-in-JS.
- No inline styles except for truly dynamic values (e.g., computed positions for handles).

## Comments

- Don't comment obvious code.
- DO comment non-obvious algorithms, especially in `engine/`.
- Use `// TODO:` for known incomplete areas. Include a brief description.
- Use `// PERF:` to mark performance-sensitive code that should not be naively refactored.

## Error Handling

- Engine functions should not throw. Return empty arrays or default values for invalid input.
- File import functions should catch and surface errors to the user via a toast/notification.
- Use TypeScript's type system to prevent errors at compile time rather than catching at runtime.

## No Dead Code

- Do not leave commented-out code blocks.
- Do not create files "for later." Only create files that are immediately needed.
- Do not add parameters "for future use." Add them when the feature is built.
