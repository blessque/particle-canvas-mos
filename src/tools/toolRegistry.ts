import type { Tool, ToolType } from '@/types/tools';
import { RectangleTool } from './RectangleTool';
import { EllipseTool } from './EllipseTool';
import { StarTool } from './StarTool';
import { SelectTool } from './SelectTool';
import { FreehandTool } from './FreehandTool';

const registry: Record<ToolType, Tool> = {
  select: SelectTool,
  rectangle: RectangleTool,
  ellipse: EllipseTool,
  star: StarTool,
  freehand: FreehandTool,
};

export function getToolInstance(type: ToolType): Tool {
  return registry[type];
}
