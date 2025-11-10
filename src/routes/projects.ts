import { Router } from "express";
import { PrismaClient, StoryStatus, StoryPriority, StoryEffort } from "@prisma/client";
import { requireAuth } from "../auth/middleware";

const router = Router();
const prisma = new PrismaClient();

// List user's projects
router.get("/", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
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
  } catch (error) {
    console.error("Error fetching projects:", error);
    res.status(500).json({ error: "Failed to fetch projects" });
  }
});

// Create new project
router.post("/", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const { name } = req.body;

    if (!name || typeof name !== "string") {
      return res.status(400).json({ error: "Project name is required" });
    }

    // Get user's first company (we auto-create one on signup)
    const company = await prisma.company.findFirst({
      where: { userId: user.id },
    });

    if (!company) {
      return res.status(400).json({ error: "No company found" });
    }

    const project = await prisma.project.create({
      data: {
        name,
        companyId: company.id,
      },
    });

    res.json({ project });
  } catch (error) {
    console.error("Error creating project:", error);
    res.status(500).json({ error: "Failed to create project" });
  }
});

// Get project details
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
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
      return res.status(404).json({ error: "Project not found" });
    }

    res.json({ project });
  } catch (error) {
    console.error("Error fetching project:", error);
    res.status(500).json({ error: "Failed to fetch project" });
  }
});

// Update project
router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const { id } = req.params;
    const { name } = req.body;

    if (!name || typeof name !== "string") {
      return res.status(400).json({ error: "Project name is required" });
    }

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
      return res.status(404).json({ error: "Project not found" });
    }

    const project = await prisma.project.update({
      where: { id },
      data: { name },
    });

    res.json({ project });
  } catch (error) {
    console.error("Error updating project:", error);
    res.status(500).json({ error: "Failed to update project" });
  }
});

// Get all user stories for a project
router.get("/:id/stories", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
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
      return res.status(404).json({ error: "Project not found" });
    }

    // Fetch epics with their stories
    const epics = await prisma.epic.findMany({
      where: { projectId: id },
      include: {
        stories: {
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // Calculate status counts
    const allStories = epics.flatMap(e => e.stories);
    const statusCounts = {
      open: allStories.filter(s => s.status === "OPEN").length,
      inProgress: allStories.filter(s => s.status === "IN_PROGRESS").length,
      done: allStories.filter(s => s.status === "DONE").length,
      total: allStories.length,
    };

    res.json({ epics, statusCounts });
  } catch (error) {
    console.error("Error fetching user stories:", error);
    res.status(500).json({ error: "Failed to fetch user stories" });
  }
});

// Create/save user stories (can be bulk)
router.post("/:id/stories", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const { id } = req.params;
    const { stories } = req.body; // Array of story objects with epicName

    if (!stories || !Array.isArray(stories)) {
      return res.status(400).json({ error: "stories array is required" });
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
      return res.status(404).json({ error: "Project not found" });
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
          storyPoints: story.storyPoints,
          sprint: story.sprint,
          acceptanceCriteria: story.acceptanceCriteria || [],
          epicId: epic.id,
          projectId: id,
        },
      });

      createdStories.push(createdStory);
    }

    res.json({ stories: createdStories, count: createdStories.length });
  } catch (error) {
    console.error("Error creating user stories:", error);
    res.status(500).json({ error: "Failed to create user stories" });
  }
});

// Update a user story
router.patch("/:id/stories/:storyId", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
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
      return res.status(404).json({ error: "Project not found" });
    }

    // Verify story belongs to project
    const existingStory = await prisma.userStory.findFirst({
      where: {
        id: storyId,
        projectId: id,
      },
    });

    if (!existingStory) {
      return res.status(404).json({ error: "User story not found" });
    }

    // Validate enum values if provided
    if (updates.status && !Object.values(StoryStatus).includes(updates.status)) {
      return res.status(400).json({ error: "Invalid status value" });
    }
    if (updates.priority && !Object.values(StoryPriority).includes(updates.priority)) {
      return res.status(400).json({ error: "Invalid priority value" });
    }
    if (updates.effort && !Object.values(StoryEffort).includes(updates.effort)) {
      return res.status(400).json({ error: "Invalid effort value" });
    }

    // Build update data
    const updateData: any = {};
    const allowedFields = [
      "title", "actor", "action", "benefit", "status", "priority", 
      "effort", "storyPoints", "sprint", "acceptanceCriteria"
    ];

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        updateData[field] = updates[field];
      }
    }

    // Update the story
    const updatedStory = await prisma.userStory.update({
      where: { id: storyId },
      data: updateData,
    });

    res.json({ story: updatedStory });
  } catch (error) {
    console.error("Error updating user story:", error);
    res.status(500).json({ error: "Failed to update user story" });
  }
});

// Delete a user story
router.delete("/:id/stories/:storyId", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
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
      return res.status(404).json({ error: "Project not found" });
    }

    // Verify story belongs to project
    const existingStory = await prisma.userStory.findFirst({
      where: {
        id: storyId,
        projectId: id,
      },
    });

    if (!existingStory) {
      return res.status(404).json({ error: "User story not found" });
    }

    // Delete the story
    await prisma.userStory.delete({
      where: { id: storyId },
    });

    res.json({ success: true, message: "User story deleted" });
  } catch (error) {
    console.error("Error deleting user story:", error);
    res.status(500).json({ error: "Failed to delete user story" });
  }
});

// Branch a project (copy all user stories for tracking)
router.post("/:id/branch", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const { id } = req.params;
    const { name } = req.body;

    if (!name || typeof name !== "string") {
      return res.status(400).json({ error: "New project name is required" });
    }

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
      return res.status(404).json({ error: "Source project not found" });
    }

    // Create new project with reference to source
    const newProject = await prisma.project.create({
      data: {
        name,
        companyId: sourceProject.companyId,
        sourceProjectId: sourceProject.id,
      },
    });

    // Copy epics and stories
    const epicMap = new Map<string, string>(); // old epic id -> new epic id

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

      epicMap.set(sourceEpic.id, newEpic.id);

      // Copy all stories from this epic
      for (const sourceStory of sourceEpic.stories) {
        await prisma.userStory.create({
          data: {
            title: sourceStory.title,
            actor: sourceStory.actor,
            action: sourceStory.action,
            benefit: sourceStory.benefit,
            // Reset incomplete stories to OPEN, keep DONE as DONE
            status: sourceStory.status === "DONE" ? StoryStatus.DONE : StoryStatus.OPEN,
            priority: sourceStory.priority,
            effort: sourceStory.effort,
            storyPoints: sourceStory.storyPoints,
            sprint: sourceStory.sprint,
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
  } catch (error) {
    console.error("Error branching project:", error);
    res.status(500).json({ error: "Failed to branch project" });
  }
});

export default router;

