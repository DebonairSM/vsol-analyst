import { prisma } from "../utils/prisma";
import { DocumentGenerator } from "../analyst/DocumentGenerator";
import {
  MCPProject,
  MCPUserStory,
  MCPEpic,
  MCPRequirements,
  MCPDiagrams,
  MCPSeedData,
} from "./types";

const docs = new DocumentGenerator();

/**
 * Fetch all projects with metadata about available data
 */
export async function fetchAllProjects(): Promise<MCPProject[]> {
  const projects = await prisma.project.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      createdAt: true,
      updatedAt: true,
      generatedRequirements: true,
      requirementsMarkdown: true,
      requirementsMermaid: true,
      detailedFlowchartMermaid: true,
      seedData: true,
      userStories: {
        select: { id: true },
      },
    },
  });

  return projects.map((project) => ({
    id: project.id,
    name: project.name,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    hasRequirements: !!project.generatedRequirements,
    hasUserStories: project.userStories.length > 0,
    hasDiagrams:
      !!project.requirementsMermaid || !!project.detailedFlowchartMermaid,
    hasSeedData: !!project.seedData,
  }));
}

/**
 * Fetch a single project by ID
 */
export async function fetchProject(projectId: string): Promise<MCPProject | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      createdAt: true,
      updatedAt: true,
      generatedRequirements: true,
      requirementsMarkdown: true,
      requirementsMermaid: true,
      detailedFlowchartMermaid: true,
      seedData: true,
      userStories: {
        select: { id: true },
      },
    },
  });

  if (!project) return null;

  return {
    id: project.id,
    name: project.name,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    hasRequirements: !!project.generatedRequirements,
    hasUserStories: project.userStories.length > 0,
    hasDiagrams:
      !!project.requirementsMermaid || !!project.detailedFlowchartMermaid,
    hasSeedData: !!project.seedData,
  };
}

/**
 * Fetch user stories grouped by epic for a project
 */
export async function fetchUserStoriesByProject(
  projectId: string
): Promise<MCPEpic[]> {
  const epics = await prisma.epic.findMany({
    where: { projectId },
    include: {
      stories: {
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return epics.map((epic) => ({
    id: epic.id,
    name: epic.name,
    description: epic.description,
    icon: epic.icon,
    stories: epic.stories.map((story) => ({
      id: story.id,
      title: story.title,
      actor: story.actor,
      action: story.action,
      benefit: story.benefit,
      status: story.status,
      priority: story.priority,
      effort: story.effort,
      team: story.team,
      acceptanceCriteria: story.acceptanceCriteria as any as string[],
      epicId: epic.id,
      epicName: epic.name,
      epicIcon: epic.icon,
      createdAt: story.createdAt.toISOString(),
      updatedAt: story.updatedAt.toISOString(),
    })),
  }));
}

/**
 * Fetch requirements for a project
 */
export async function fetchRequirements(
  projectId: string
): Promise<MCPRequirements | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      generatedRequirements: true,
      requirementsMarkdown: true,
      requirementsMermaid: true,
      requirementsExtractedAt: true,
    },
  });

  if (!project || !project.generatedRequirements) {
    return null;
  }

  return {
    hasData: true,
    markdown: project.requirementsMarkdown || "",
    mermaidWorkflow: project.requirementsMermaid || "",
    extractedAt: project.requirementsExtractedAt
      ? project.requirementsExtractedAt.toISOString()
      : null,
  };
}

/**
 * Fetch diagrams for a project
 */
export async function fetchDiagrams(
  projectId: string
): Promise<MCPDiagrams | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      requirementsMermaid: true,
      detailedFlowchartMermaid: true,
    },
  });

  if (!project) {
    return null;
  }

  return {
    hasWorkflow: !!project.requirementsMermaid,
    hasFlowchart: !!project.detailedFlowchartMermaid,
    workflowDiagram: project.requirementsMermaid || "",
    detailedFlowchart: project.detailedFlowchartMermaid || "",
  };
}

/**
 * Fetch seed data for a project
 */
export async function fetchSeedData(
  projectId: string
): Promise<MCPSeedData | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      seedData: true,
    },
  });

  if (!project || !project.seedData) {
    return null;
  }

  const seedDataObj = project.seedData as any;

  return {
    hasData: true,
    format: seedDataObj.format || "unknown",
    filename: seedDataObj.filename || "",
    data: seedDataObj.data || seedDataObj,
    generatedAt: seedDataObj.generatedAt || new Date().toISOString(),
  };
}

/**
 * Format user stories as markdown
 */
export async function formatUserStoriesAsMarkdown(
  projectId: string
): Promise<string> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      name: true,
      generatedUserStories: true,
    },
  });

  if (!project) {
    throw new Error("Project not found");
  }

  if (!project.generatedUserStories) {
    return `# User Stories for ${project.name}\n\nNo user stories have been generated yet.`;
  }

  try {
    return docs.generateUserStoriesMarkdown(project.generatedUserStories as any);
  } catch (error) {
    console.error("Error formatting user stories:", error);
    return `# User Stories for ${project.name}\n\nError formatting user stories.`;
  }
}

/**
 * Update a user story
 */
export async function updateUserStory(
  projectId: string,
  storyId: string,
  updates: {
    status?: any;
    priority?: any;
    effort?: any;
    title?: string;
    actor?: string;
    action?: string;
    benefit?: string;
    acceptanceCriteria?: string[];
  }
) {
  // Verify story belongs to project
  const story = await prisma.userStory.findFirst({
    where: {
      id: storyId,
      projectId: projectId,
    },
  });

  if (!story) {
    throw new Error("User story not found in this project");
  }

  // Track status transition if status is changing
  if (updates.status && updates.status !== story.status) {
    await prisma.statusTransition.create({
      data: {
        userStoryId: storyId,
        fromStatus: story.status,
        toStatus: updates.status,
      },
    });
  }

  // Update the story
  const updatedStory = await prisma.userStory.update({
    where: { id: storyId },
    data: updates,
    include: {
      epic: true,
    },
  });

  return {
    id: updatedStory.id,
    title: updatedStory.title,
    actor: updatedStory.actor,
    action: updatedStory.action,
    benefit: updatedStory.benefit,
    status: updatedStory.status,
    priority: updatedStory.priority,
    effort: updatedStory.effort,
    team: updatedStory.team,
    acceptanceCriteria: updatedStory.acceptanceCriteria as any as string[],
    epicId: updatedStory.epic.id,
    epicName: updatedStory.epic.name,
    epicIcon: updatedStory.epic.icon,
    createdAt: updatedStory.createdAt.toISOString(),
    updatedAt: updatedStory.updatedAt.toISOString(),
  } as MCPUserStory;
}

