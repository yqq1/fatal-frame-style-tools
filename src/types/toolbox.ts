export type ToolCategory = 'audio' | 'image' | 'text';

export type ToolStatus = 'ready' | 'planned';

export type ToolDefinition = {
  id: string;
  name: string;
  category: ToolCategory;
  description: string;
  status: ToolStatus;
  icon: 'audio' | 'image' | 'text' | 'camera' | 'wand' | 'archive' | 'quiz';
};

export type NavKey = 'all' | ToolCategory | 'blog' | 'museum' | 'video' | 'music' | 'settings';

export type MobileToolCategory = 'all' | ToolCategory;

export type MobileToolMode = 'list' | 'detail';
