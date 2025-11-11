import { Router } from "express";
import { StoryStatus, StoryPriority, StoryEffort } from "@prisma/client";
import { requireAuth } from "../auth/middleware";
import { prisma } from "../utils/prisma";
import { getAuthenticatedUser } from "../utils/prisma-helpers";
import { validateProjectName } from "../utils/validation";
import { NotFoundError, ForbiddenError, ValidationError, logError } from "../utils/errors";
import { asyncHandler } from "../utils/async-handler";

const router = Router();

// List user's projects
router.get("/", requireAuth, asyncHandler(async (req, res) => {
  const user = getAuthenticatedUser(req.user);
  
  const companies = await prisma.company.findMany({
    where: { userId: user.id },
    include: {
      projects: {
        orderBy: { updatedAt: "desc" },
      },
    },
  });

  // Flatten projects from all companies
  const projects = companies.flatMap((c) => c.projects);
  res.json({ projects });
}));

// Create new project
router.post("/", requireAuth, asyncHandler(async (req, res) => {
  const user = getAuthenticatedUser(req.user);
  const projectName = validateProjectName(req.body.name);

  // Get user's first company (we auto-create one on signup)
  const company = await prisma.company.findFirst({
    where: { userId: user.id },
  });

  if (!company) {
    throw new NotFoundError("Company");
  }

  const project = await prisma.project.create({
    data: {
      name: projectName,
      companyId: company.id,
    },
  });

  res.json({ project });
}));

// Get project details
router.get("/:id", requireAuth, asyncHandler(async (req, res) => {
  const user = getAuthenticatedUser(req.user);
  const { id } = req.params;

  const project = await prisma.project.findFirst({
    where: {
      id,
      company: {
        userId: user.id,
      },
    },
    include: {
      company: true,
      sessions: {
        orderBy: { createdAt: "desc" },
        include: {
          attachments: true,
        },
      },
    },
  });

  if (!project) {
    throw new NotFoundError("Project");
  }

  res.json({ project });
}));

// Update project
router.patch("/:id", requireAuth, asyncHandler(async (req, res) => {
  const user = getAuthenticatedUser(req.user);
  const { id } = req.params;
  const projectName = validateProjectName(req.body.name);

  // Verify ownership
  const existing = await prisma.project.findFirst({
    where: {
      id,
      company: {
        userId: user.id,
      },
    },
  });

  if (!existing) {
    throw new NotFoundError("Project");
  }

  const project = await prisma.project.update({
    where: { id },
    data: { name: projectName },
  });

  res.json({ project });
}));

// Get all user stories for a project
router.get("/:id/stories", requireAuth, asyncHandler(async (req, res) => {
  const user = getAuthenticatedUser(req.user);
  const { id } = req.params;

  // Verify project ownership
  const project = await prisma.project.findFirst({
    where: {
      id,
      company: {
        userId: user.id,
      },
    },
  });

  if (!project) {
    throw new NotFoundError("Project");
  }

  // Fetch epics with their stories (exclude REMOVED stories by default)
  const epics = await prisma.epic.findMany({
    where: { projectId: id },
    include: {
      stories: {
        where: {
          status: {
            not: StoryStatus.REMOVED,
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // Calculate status counts (excluding REMOVED stories)
  const allStories = epics.flatMap(e => e.stories);
  const statusCounts = {
    open: allStories.filter(s => s.status === StoryStatus.OPEN).length,
    inProgress: allStories.filter(s => s.status === StoryStatus.IN_PROGRESS).length,
    readyForReview: allStories.filter(s => s.status === StoryStatus.READY_FOR_REVIEW).length,
    inReview: allStories.filter(s => s.status === StoryStatus.IN_REVIEW).length,
    done: allStories.filter(s => s.status === StoryStatus.DONE).length,
    total: allStories.length,
  };

  // Count removed stories separately
  const removedCount = await prisma.userStory.count({
    where: {
      projectId: id,
      status: StoryStatus.REMOVED,
    },
  });

  res.json({ epics, statusCounts, removedCount });
}));

// Create/save user stories (can be bulk)
router.post("/:id/stories", requireAuth, asyncHandler(async (req, res) => {
  const user = getAuthenticatedUser(req.user);
  const { id } = req.params;
  const { stories } = req.body;

  if (!stories || !Array.isArray(stories)) {
    throw new ValidationError("stories array is required");
  }

  // Verify project ownership
  const project = await prisma.project.findFirst({
    where: {
      id,
      company: {
        userId: user.id,
      },
    },
  });

  if (!project) {
    throw new NotFoundError("Project");
  }

  const createdStories = [];

  // Process each story
  for (const story of stories) {
    // Find or create epic
    let epic = await prisma.epic.findFirst({
      where: {
        projectId: id,
        name: story.epicName,
      },
    });

    if (!epic) {
      epic = await prisma.epic.create({
        data: {
          name: story.epicName,
          description: story.epicDescription || "",
          icon: story.epicIcon || "📦",
          projectId: id,
        },
      });
    }

    // Create the story
    const createdStory = await prisma.userStory.create({
      data: {
        title: story.title,
        actor: story.actor,
        action: story.action,
        benefit: story.benefit,
        status: story.status || StoryStatus.OPEN,
        priority: story.priority,
        effort: story.effort,
        team: "Team Sunny",
        acceptanceCriteria: story.acceptanceCriteria || [],
        epicId: epic.id,
        projectId: id,
      },
    });

    createdStories.push(createdStory);
  }

  res.json({ stories: createdStories, count: createdStories.length });
}));

// Update a user story
router.patch("/:id/stories/:storyId", requireAuth, asyncHandler(async (req, res) => {
  const user = getAuthenticatedUser(req.user);
  const { id, storyId } = req.params;
  const updates = req.body;

  // Verify project ownership
  const project = await prisma.project.findFirst({
    where: {
      id,
      company: {
        userId: user.id,
      },
    },
  });

  if (!project) {
    throw new NotFoundError("Project");
  }

  // Verify story belongs to project
  const existingStory = await prisma.userStory.findFirst({
    where: {
      id: storyId,
      projectId: id,
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

  // Build update data - use a proper type
  interface UpdateData {
    title?: string;
    actor?: string;
    action?: string;
    benefit?: string;
    status?: StoryStatus;
    priority?: StoryPriority;
    effort?: StoryEffort;
    team?: string;
    acceptanceCriteria?: string[];
  }

  const updateData: Partial<UpdateData> = {};
  const allowedFields: Array<keyof UpdateData> = [
    "title", "actor", "action", "benefit", "status", "priority", 
    "effort", "team", "acceptanceCriteria"
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
  });

  res.json({ story: updatedStory });
}));

// Get status transitions for a user story (for time tracking)
router.get("/:id/stories/:storyId/transitions", requireAuth, asyncHandler(async (req, res) => {
  const user = getAuthenticatedUser(req.user);
  const { id, storyId } = req.params;

  // Verify project ownership
  const project = await prisma.project.findFirst({
    where: {
      id,
      company: {
        userId: user.id,
      },
    },
  });

  if (!project) {
    throw new NotFoundError("Project");
  }

  // Verify story belongs to project
  const story = await prisma.userStory.findFirst({
    where: {
      id: storyId,
      projectId: id,
    },
  });

  if (!story) {
    throw new NotFoundError("User story");
  }

  // Get all transitions for this story
  const transitions = await prisma.statusTransition.findMany({
    where: {
      userStoryId: storyId,
    },
    orderBy: {
      transitionedAt: 'asc',
    },
  });

  // Calculate time metrics
  const metrics = {
    currentStatus: story.status,
    createdAt: story.createdAt,
    updatedAt: story.updatedAt,
    transitions,
    timeInStatus: {} as Record<string, number>,
    cycleTime: null as number | null, // Time from first IN_PROGRESS to DONE
    leadTime: null as number | null, // Time from creation to DONE
  };

  // Calculate time spent in each status
  const allStatusChanges = [
    { status: 'OPEN', timestamp: story.createdAt },
    ...transitions.map(t => ({ status: t.toStatus, timestamp: t.transitionedAt })),
  ];

  for (let i = 0; i < allStatusChanges.length; i++) {
    const current = allStatusChanges[i];
    const next = allStatusChanges[i + 1] || { timestamp: new Date() };
    const duration = next.timestamp.getTime() - current.timestamp.getTime();
    
    if (!metrics.timeInStatus[current.status]) {
      metrics.timeInStatus[current.status] = 0;
    }
    metrics.timeInStatus[current.status] += duration;
  }

  // Calculate cycle time (first IN_PROGRESS to DONE)
  const firstInProgress = transitions.find(t => t.toStatus === 'IN_PROGRESS');
  const doneTransition = transitions.find(t => t.toStatus === 'DONE');
  
  if (firstInProgress && doneTransition) {
    metrics.cycleTime = doneTransition.transitionedAt.getTime() - firstInProgress.transitionedAt.getTime();
  }

  // Calculate lead time (creation to DONE)
  if (doneTransition) {
    metrics.leadTime = doneTransition.transitionedAt.getTime() - story.createdAt.getTime();
  }

  res.json(metrics);
}));

// Delete a user story
router.delete("/:id/stories/:storyId", requireAuth, asyncHandler(async (req, res) => {
  const user = getAuthenticatedUser(req.user);
  const { id, storyId } = req.params;

  // Verify project ownership
  const project = await prisma.project.findFirst({
    where: {
      id,
      company: {
        userId: user.id,
      },
    },
  });

  if (!project) {
    throw new NotFoundError("Project");
  }

  // Verify story belongs to project
  const existingStory = await prisma.userStory.findFirst({
    where: {
      id: storyId,
      projectId: id,
    },
  });

  if (!existingStory) {
    throw new NotFoundError("User story");
  }

  // Delete the story
  await prisma.userStory.delete({
    where: { id: storyId },
  });

  res.json({ success: true, message: "User story deleted" });
}));

// Branch a project (copy all user stories for tracking)
router.post("/:id/branch", requireAuth, asyncHandler(async (req, res) => {
  const user = getAuthenticatedUser(req.user);
  const { id } = req.params;
  const projectName = validateProjectName(req.body.name);

  // Verify source project ownership
  const sourceProject = await prisma.project.findFirst({
    where: {
      id,
      company: {
        userId: user.id,
      },
    },
    include: {
      company: true,
      epics: {
        include: {
          stories: true,
        },
      },
    },
  });

  if (!sourceProject) {
    throw new NotFoundError("Source project");
  }

  // Create new project with reference to source
  const newProject = await prisma.project.create({
    data: {
      name: projectName,
      companyId: sourceProject.companyId,
      sourceProjectId: sourceProject.id,
    },
  });

  // Copy epics and stories
  for (const sourceEpic of sourceProject.epics) {
    // Create epic in new project
    const newEpic = await prisma.epic.create({
      data: {
        name: sourceEpic.name,
        description: sourceEpic.description,
        icon: sourceEpic.icon,
        projectId: newProject.id,
      },
    });

    // Copy all stories from this epic
    for (const sourceStory of sourceEpic.stories) {
      await prisma.userStory.create({
        data: {
          title: sourceStory.title,
          actor: sourceStory.actor,
          action: sourceStory.action,
          benefit: sourceStory.benefit,
          // Reset incomplete stories to OPEN, keep DONE as DONE
          status: sourceStory.status === StoryStatus.DONE ? StoryStatus.DONE : StoryStatus.OPEN,
          priority: sourceStory.priority,
          effort: sourceStory.effort,
          team: sourceStory.team || "Team Sunny",
          acceptanceCriteria: sourceStory.acceptanceCriteria,
          epicId: newEpic.id,
          projectId: newProject.id,
          originalStoryId: sourceStory.id, // Track lineage
        },
      });
    }
  }

  // Fetch the new project with all its data
  const newProjectWithStories = await prisma.project.findUnique({
    where: { id: newProject.id },
    include: {
      company: true,
      epics: {
        include: {
          stories: true,
        },
      },
      sourceProject: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  res.json({ project: newProjectWithStories });
}));

export default router;

