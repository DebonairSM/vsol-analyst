import { Router } from "express";
import { requireAdmin } from "../auth/middleware";
import { prisma } from "../utils/prisma";
import { NotFoundError, logError } from "../utils/errors";
import { asyncHandler } from "../utils/async-handler";
import { validateUUID } from "../utils/validation";
import { createAttachmentResolver } from "../utils/attachment-helpers";
import { configureSSEHeaders, sendSSEProgress, sendSSEData, sendSSEError } from "../utils/sse-helpers";

import { ChatMessage } from "../llm/LLMProvider";
import { OpenAILLMProvider } from "../llm/OpenAILLMProvider";
import { RequirementsExtractor } from "../analyst/RequirementsExtractor";
import { DocumentGenerator } from "../analyst/DocumentGenerator";
import { RequirementsRefinementPipeline } from "../analyst/RequirementsRefinementPipeline";

const router = Router();

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
router.get("/stats", requireAdmin, asyncHandler(async (req, res) => {
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
}));

// List all users
router.get("/users", requireAdmin, asyncHandler(async (req, res) => {
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
}));

// List all projects (from all users)
router.get("/projects", requireAdmin, asyncHandler(async (req, res) => {
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
}));

// View specific project's chat history
router.get("/projects/:id/chat", requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  validateUUID(id);

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
    throw new NotFoundError("Project");
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
}));

// Admin endpoint to extract requirements from any project (with streaming)
router.post("/projects/:id/extract", requireAdmin, async (req, res) => {
  try {
    const { id: projectId } = req.params;
    validateUUID(projectId);

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

    const resolveAttachment = createAttachmentResolver();

    // Set up SSE headers
    configureSSEHeaders(res);

    try {
      sendSSEProgress(res, 10, "Sunny is reviewing the conversation...");
      sendSSEProgress(res, 20, "Sunny is analyzing conversation context...");
      
      const result = await refinementPipeline.extractWithRefinement(
        history,
        resolveAttachment,
        (progress: number, stage: string) => {
          console.log(`📊 [Admin Extract - Progress] ${progress}% - ${stage}`);
          sendSSEProgress(res, progress, stage);
        }
      );
      
      sendSSEProgress(res, 95, "Completing...");
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      sendSSEProgress(res, 100, "");
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Send final result
      sendSSEData(res, {
        complete: true,
        requirements: result.requirements,
        markdown: result.markdown,
        mermaid: result.mermaid,
        wasRefined: result.wasRefined,
        metrics: result.metrics,
      });
    } catch (error) {
      logError(error as Error, { projectId, context: "admin-extract" });
      sendSSEError(res, "Extraction failed");
    }
  } catch (error) {
    console.error("Error in admin extract-stream:", error);
    res.status(500).json({ error: "Extraction failed" });
  }
});

export default router;

