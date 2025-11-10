import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { requireAdmin } from "../auth/middleware";
import { ChatMessage } from "../llm/LLMProvider";

const router = Router();
const prisma = new PrismaClient();

// Get admin dashboard stats
router.get("/stats", requireAdmin, async (req, res) => {
  try {
    const [userCount, projectCount, sessionCount] = await Promise.all([
      prisma.user.count(),
      prisma.project.count(),
      prisma.chatSession.count(),
    ]);

    res.json({
      stats: {
        users: userCount,
        projects: projectCount,
        sessions: sessionCount,
      },
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// List all users
router.get("/users", requireAdmin, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      include: {
        companies: {
          include: {
            projects: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ users });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// List all projects (from all users)
router.get("/projects", requireAdmin, async (req, res) => {
  try {
    const projects = await prisma.project.findMany({
      include: {
        company: {
          include: {
            user: true,
          },
        },
        sessions: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    res.json({ projects });
  } catch (error) {
    console.error("Error fetching all projects:", error);
    res.status(500).json({ error: "Failed to fetch projects" });
  }
});

// View specific project's chat history
router.get("/projects/:id/chat", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        company: {
          include: {
            user: true,
          },
        },
        sessions: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // Parse chat history
    const sessions = project.sessions.map((session) => ({
      ...session,
      history: JSON.parse(session.history as string),
    }));

    res.json({
      project: {
        ...project,
        sessions,
      },
    });
  } catch (error) {
    console.error("Error fetching project chat:", error);
    res.status(500).json({ error: "Failed to fetch project chat" });
  }
});

export default router;

