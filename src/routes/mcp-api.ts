import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../utils/prisma";
import { asyncHandler } from "../utils/async-handler";
import { NotFoundError, ValidationError, UnauthorizedError } from "../utils/errors";
import { StoryStatus, StoryPriority, StoryEffort } from "@prisma/client";
import { timingSafeEqual } from "../utils/security";
import { validateUUID } from "../utils/validation";

const router = Router();

/**
 * Secure API key middleware for MCP server access with timing-safe comparison
 */
function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers["x-api-key"];
  const expectedApiKey = process.env.MCP_API_KEY;

  if (!expectedApiKey) {
    return res.status(500).json({ error: "MCP_API_KEY not configured" });
  }

  if (!apiKey || typeof apiKey !== "string") {
    throw new UnauthorizedError("API key required");
  }

  // Use timing-safe comparison to prevent timing attacks
  if (!timingSafeEqual(apiKey, expectedApiKey)) {
    throw new UnauthorizedError("Invalid API key");
  }

  next();
}

// List all projects with metadata
router.get("/projects", requireApiKey, asyncHandler(async (req, res) => {
  const projects = await prisma.project.findMany({
    include: {
      company: true,
      _count: {
        select: {
          userStories: true,
          epics: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const projectsWithMetadata = projects.map((p) => ({
    id: p.id,
    name: p.name,
    companyId: p.companyId,
    companyName: p.company.name,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    hasRequirements: !!p.requirementsMarkdown,
    hasWorkflowDiagram: !!p.requirementsMermaid,
    hasFlowchart: !!p.detailedFlowchartMermaid,
    hasSeedData: !!p.seedData,
    userStoryCount: p._count.userStories,
    epicCount: p._count.epics,
  }));

  res.json({ projects: projectsWithMetadata });
}));

// Get user stories for a project (grouped by epic)
router.get("/projects/:projectId/stories", requireApiKey, asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  validateUUID(projectId); // Validate UUID format

  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    throw new NotFoundError("Project");
  }

  const epics = await prisma.epic.findMany({
    where: { projectId },
    include: {
      stories: {
        where: {
          status: { not: StoryStatus.REMOVED },
        },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  res.json({ projectId, projectName: project.name, epics });
}));

// Get requirements document
router.get("/projects/:projectId/requirements", requireApiKey, asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  validateUUID(projectId);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      requirementsMarkdown: true,
      requirementsExtractedAt: true,
    },
  });

  if (!project) {
    throw new NotFoundError("Project");
  }

  if (!project.requirementsMarkdown) {
    return res.status(404).json({ error: "Requirements not yet generated for this project" });
  }

  res.json({
    projectId: project.id,
    projectName: project.name,
    requirements: project.requirementsMarkdown,
    generatedAt: project.requirementsExtractedAt,
  });
}));

// Get workflow diagram (Mermaid)
router.get("/projects/:projectId/workflow-diagram", requireApiKey, asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  validateUUID(projectId);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      requirementsMermaid: true,
      requirementsExtractedAt: true,
    },
  });

  if (!project) {
    throw new NotFoundError("Project");
  }

  if (!project.requirementsMermaid) {
    return res.status(404).json({ error: "Workflow diagram not yet generated for this project" });
  }

  res.json({
    projectId: project.id,
    projectName: project.name,
    diagram: project.requirementsMermaid,
    generatedAt: project.requirementsExtractedAt,
  });
}));

// Get flowchart diagram (Mermaid)
router.get("/projects/:projectId/flowchart", requireApiKey, asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  validateUUID(projectId);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      detailedFlowchartMermaid: true,
    },
  });

  if (!project) {
    throw new NotFoundError("Project");
  }

  if (!project.detailedFlowchartMermaid) {
    return res.status(404).json({ error: "Flowchart not yet generated for this project" });
  }

  res.json({
    projectId: project.id,
    projectName: project.name,
    diagram: project.detailedFlowchartMermaid,
  });
}));

// Get seed data
router.get("/projects/:projectId/seed-data", requireApiKey, asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  validateUUID(projectId);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      seedData: true,
    },
  });

  if (!project) {
    throw new NotFoundError("Project");
  }

  if (!project.seedData) {
    return res.status(404).json({ error: "Seed data not yet generated for this project" });
  }

  res.json({
    projectId: project.id,
    projectName: project.name,
    seedData: project.seedData,
  });
}));

// Update a user story
router.patch("/projects/:projectId/stories/:storyId", requireApiKey, asyncHandler(async (req, res) => {
  const { projectId, storyId } = req.params;
  validateUUID(projectId);
  validateUUID(storyId);
  const updates = req.body;

  // Verify story belongs to project
  const existingStory = await prisma.userStory.findFirst({
    where: {
      id: storyId,
      projectId,
    },
  });

  if (!existingStory) {
    throw new NotFoundError("User story");
  }

  // Validate enum values if provided
  if (updates.status && !Object.values(StoryStatus).includes(updates.status)) {
    throw new ValidationError("Invalid status value");
  }
  if (updates.priority && !Object.values(StoryPriority).includes(updates.priority)) {
    throw new ValidationError("Invalid priority value");
  }
  if (updates.effort && !Object.values(StoryEffort).includes(updates.effort)) {
    throw new ValidationError("Invalid effort value");
  }

  // Build update data
  interface UpdateData {
    title?: string;
    actor?: string;
    action?: string;
    benefit?: string;
    status?: StoryStatus;
    priority?: StoryPriority;
    effort?: StoryEffort;
    acceptanceCriteria?: string[];
  }

  const updateData: Partial<UpdateData> = {};
  const allowedFields: Array<keyof UpdateData> = [
    "title", "actor", "action", "benefit", "status", "priority", 
    "effort", "acceptanceCriteria"
  ];

  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      (updateData as any)[field] = updates[field];
    }
  }

  // Track status transition if status is changing
  if (updateData.status && updateData.status !== existingStory.status) {
    await prisma.statusTransition.create({
      data: {
        userStoryId: storyId,
        fromStatus: existingStory.status,
        toStatus: updateData.status,
      },
    });
  }

  // Update the story
  const updatedStory = await prisma.userStory.update({
    where: { id: storyId },
    data: updateData,
    include: {
      epic: {
        select: {
          name: true,
          icon: true,
        },
      },
    },
  });

  res.json({ story: updatedStory });
}));

export default router;

