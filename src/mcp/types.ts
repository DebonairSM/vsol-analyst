import { StoryStatus, StoryPriority, StoryEffort } from "@prisma/client";

/**
 * MCP-specific type definitions for Sunny
 */

export interface MCPProject {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  hasRequirements: boolean;
  hasUserStories: boolean;
  hasDiagrams: boolean;
  hasSeedData: boolean;
}

export interface MCPUserStory {
  id: string;
  title: string;
  actor: string;
  action: string;
  benefit: string;
  status: StoryStatus;
  priority: StoryPriority;
  effort: StoryEffort;
  team: string;
  acceptanceCriteria: string[];
  epicId: string;
  epicName: string;
  epicIcon: string;
  createdAt: string;
  updatedAt: string;
}

export interface MCPEpic {
  id: string;
  name: string;
  description: string;
  icon: string;
  stories: MCPUserStory[];
}

export interface MCPRequirements {
  hasData: boolean;
  markdown: string;
  mermaidWorkflow: string;
  extractedAt: string | null;
}

export interface MCPDiagrams {
  hasWorkflow: boolean;
  hasFlowchart: boolean;
  workflowDiagram: string;
  detailedFlowchart: string;
}

export interface MCPSeedData {
  hasData: boolean;
  format: string;
  filename: string;
  data: any;
  generatedAt: string;
}

export interface UpdateUserStoryParams {
  projectId: string;
  storyId: string;
  status?: StoryStatus;
  priority?: StoryPriority;
  effort?: StoryEffort;
  title?: string;
  actor?: string;
  action?: string;
  benefit?: string;
  acceptanceCriteria?: string[];
}

export interface ToolResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

