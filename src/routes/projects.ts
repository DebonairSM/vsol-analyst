import { Router } from "express";
import { PrismaClient } from "@prisma/client";
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

export default router;

