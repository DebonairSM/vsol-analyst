import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { requireAdmin } from "../auth/middleware";
import { ChatMessage } from "../llm/LLMProvider";
import { OpenAILLMProvider } from "../llm/OpenAILLMProvider";
import { RequirementsExtractor } from "../analyst/RequirementsExtractor";
import { DocumentGenerator } from "../analyst/DocumentGenerator";
import { RequirementsRefinementPipeline } from "../analyst/RequirementsRefinementPipeline";

const router = Router();
const prisma = new PrismaClient();

// Initialize services for admin operations
const llmMini = new OpenAILLMProvider({ defaultModel: "gpt-4o-mini" });
const llmFull = new OpenAILLMProvider({ defaultModel: "gpt-4o" });
const extractor = new RequirementsExtractor(llmMini);
const docs = new DocumentGenerator();
const refinementPipeline = new RequirementsRefinementPipeline(
  llmMini,
  llmFull,
  extractor,
  docs
);

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

// Admin endpoint to extract requirements from any project (with streaming)
router.post("/projects/:id/extract", requireAdmin, async (req, res) => {
  try {
    const { id: projectId } = req.params;

    // Get project with sessions (no ownership check for admin)
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        sessions: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            attachments: true,
          },
        },
      },
    });

    if (!project || !project.sessions.length) {
      return res.status(404).json({ error: "No chat history found" });
    }

    const session = project.sessions[0];
    const history = JSON.parse(session.history as string) as ChatMessage[];

    // Create attachment resolver function
    const resolveAttachment = async (attachmentId: string): Promise<string | null> => {
      const attachment = await prisma.attachment.findUnique({
        where: { id: attachmentId },
      });
      return attachment ? attachment.storedPath : null;
    };

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // Helper function to send progress updates
    const sendProgress = (progress: number, stage: string) => {
      res.write(`data: ${JSON.stringify({ progress, stage })}\n\n`);
      if (typeof (res as any).flush === 'function') {
        (res as any).flush();
      }
    };

    try {
      sendProgress(10, "Sunny is reviewing the conversation...");
      
      sendProgress(20, "Sunny is analyzing conversation context...");
      
      const result = await refinementPipeline.extractWithRefinement(
        history,
        resolveAttachment,
        (progress: number, stage: string) => {
          console.log(`📊 [Admin Extract - Progress] ${progress}% - ${stage}`);
          sendProgress(progress, stage);
        }
      );
      
      sendProgress(95, "Completing...");
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      sendProgress(100, "");
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Send final result
      res.write(`data: ${JSON.stringify({ 
        complete: true,
        requirements: result.requirements, 
        markdown: result.markdown, 
        mermaid: result.mermaid,
        wasRefined: result.wasRefined,
        metrics: result.metrics,
      })}\n\n`);
      res.end();
    } catch (error) {
      res.write(`data: ${JSON.stringify({ error: "Extraction failed" })}\n\n`);
      res.end();
    }
  } catch (error) {
    console.error("Error in admin extract-stream:", error);
    res.status(500).json({ error: "Extraction failed" });
  }
});

export default router;

