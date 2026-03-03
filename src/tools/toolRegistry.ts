import type { Tool, ToolType } from '@/types/tools';
import { RectangleTool } from './RectangleTool';
import { EllipseTool } from './EllipseTool';
import { StarTool } from './StarTool';
import { SelectTool } from './SelectTool';

const registry: Record<ToolType, Tool> = {
  select: SelectTool,
  rectangle: RectangleTool,
  ellipse: EllipseTool,
  star: StarTool,
  // freehand deferred to a later phase
  freehand: SelectTool,
};

export function getToolInstance(type: ToolType): Tool {
  return registry[type];
}
