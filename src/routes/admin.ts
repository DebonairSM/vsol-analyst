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
import { StoryGenerator } from "../analyst/StoryGenerator";
import { RequirementsRefinementPipeline } from "../analyst/RequirementsRefinementPipeline";
import { UserStoryRefinementPipeline } from "../analyst/UserStoryRefinementPipeline";
import { FlowchartGenerator } from "../analyst/FlowchartGenerator";
import { convertPriorityToDb, convertEffortToDb } from "../analyst/RequirementsTypes";

const router = Router();

// Initialize services for admin operations
const llmMini = new OpenAILLMProvider({ defaultModel: "gpt-4o-mini" });
const llmFull = new OpenAILLMProvider({ defaultModel: "gpt-4o" });
const llmFlowchart = new OpenAILLMProvider({ defaultModel: "gpt-4o-2024-11-20" });
const extractor = new RequirementsExtractor(llmMini);
const storyGen = new StoryGenerator(llmMini);
const flowchartGen = new FlowchartGenerator(llmFlowchart);
const docs = new DocumentGenerator();
const refinementPipeline = new RequirementsRefinementPipeline(
  llmMini,
  llmFull,
  extractor,
  docs
);

const storyRefinementPipeline = new UserStoryRefinementPipeline(
  llmMini,
  llmFull,
  storyGen,
  (stories) => docs.generateUserStoriesMarkdown(stories)
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

// Get saved requirements for any project (admin)
router.get("/projects/:id/requirements", requireAdmin, asyncHandler(async (req, res) => {
  const { id: projectId } = req.params;
  validateUUID(projectId);

  // Get project without ownership check (admin can view any project)
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      generatedRequirements: true,
      generatedUserStories: true,
      requirementsMarkdown: true,
      requirementsMermaid: true,
      detailedFlowchartMermaid: true,
      seedData: true,
      requirementsExtractedAt: true,
      sessions: {
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: {
          updatedAt: true,
        },
      },
      userStories: {
        select: {
          id: true,
        },
      },
    },
  });

  if (!project) {
    return res.status(404).json({ error: "Project not found" });
  }

  // If no requirements exist yet, return empty state instead of 404
  if (!project.generatedRequirements) {
    return res.json({
      requirements: null,
      markdown: "",
      mermaid: "",
      detailedFlowchart: "",
      seedData: null,
      hasUserStories: false,
      userStoriesMarkdown: "",
      extractedAt: null,
      isStale: false,
      isEmpty: true,
    });
  }

  // Check if requirements might be outdated
  const lastMessageTime = project.sessions[0]?.updatedAt;
  const isStale = lastMessageTime && project.requirementsExtractedAt 
    ? new Date(lastMessageTime) > new Date(project.requirementsExtractedAt)
    : false;

  // Generate user stories markdown if user stories exist
  let userStoriesMarkdown = "";
  if (project.generatedUserStories && project.userStories.length > 0) {
    try {
      userStoriesMarkdown = docs.generateUserStoriesMarkdown(project.generatedUserStories as any);
    } catch (error) {
      console.error("Error generating user stories markdown:", error);
    }
  }

  res.json({
    requirements: project.generatedRequirements,
    markdown: project.requirementsMarkdown || "",
    mermaid: project.requirementsMermaid || "",
    detailedFlowchart: project.detailedFlowchartMermaid || "",
    seedData: project.seedData,
    hasUserStories: project.userStories.length > 0,
    userStoriesMarkdown,
    extractedAt: project.requirementsExtractedAt,
    isStale,
    isEmpty: false,
  });
}));

// Generate user stories for any project (admin, streaming)
router.post("/projects/:id/generate-stories-stream", requireAdmin, async (req, res) => {
  try {
    const { id: projectId } = req.params;
    const { requirements } = req.body;

    validateUUID(projectId);

    if (!requirements) {
      return res.status(400).json({ error: "requirements object required" });
    }

    // Verify project exists (no ownership check for admin)
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // Set up SSE headers
    configureSSEHeaders(res);

    try {
      sendSSEProgress(res, 10, "Sunny is reviewing requirements...");
      await new Promise(resolve => setTimeout(resolve, 2500));
      
      sendSSEProgress(res, 20, "Sunny is preparing to generate stories...");
      await new Promise(resolve => setTimeout(resolve, 2500));
      
      const result = await storyRefinementPipeline.generateWithRefinement(
        requirements,
        (progress: number, stage: string) => {
          console.log(`📊 [Admin Stories - Progress] ${progress}% - ${stage}`);
          sendSSEProgress(res, progress, stage);
        }
      );
      
      sendSSEProgress(res, 95, "Completing...");
      
      // Save user stories to database
      await prisma.project.update({
        where: { id: projectId },
        data: {
          generatedUserStories: result.userStories as any,
        },
      });

      // Create Epic and UserStory records
      for (const epic of result.userStories.epics) {
        // Create or find epic
        let dbEpic = await prisma.epic.findFirst({
          where: {
            projectId: projectId,
            name: epic.name,
          },
        });

        if (!dbEpic) {
          dbEpic = await prisma.epic.create({
            data: {
              name: epic.name,
              description: epic.description,
              icon: epic.icon,
              projectId: projectId,
            },
          });
        }

        // Create user stories for this epic
        for (const story of epic.stories) {
          // Check if story already exists (by id or title)
          const existingStory = await prisma.userStory.findFirst({
            where: {
              projectId: projectId,
              epicId: dbEpic.id,
              title: story.title,
            },
          });

          if (!existingStory) {
            await prisma.userStory.create({
              data: {
                title: story.title,
                actor: story.actor,
                action: story.action,
                benefit: story.benefit,
                priority: convertPriorityToDb(story.priority),
                effort: convertEffortToDb(story.effort),
                team: "Team Sunny",
                acceptanceCriteria: (story.acceptanceCriteria || []) as any,
                epicId: dbEpic.id,
                projectId: projectId,
              },
            });
          }
        }
      }
      
      // Wait a moment before 100%
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Send 100% progress
      sendSSEProgress(res, 100, "");
      
      // Wait 2 seconds to let the user see 100%
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Send final result
      sendSSEData(res, { 
        complete: true,
        userStories: result.userStories, 
        markdown: result.markdown,
        wasRefined: result.wasRefined,
        metrics: result.metrics,
        saved: true,
      });
    } catch (error) {
      logError(error as Error, { projectId, context: "admin-generate-stories" });
      sendSSEError(res, "User story generation failed");
    }
  } catch (error) {
    console.error("Error in admin generate-stories-stream:", error);
    res.status(500).json({ error: "User story generation failed" });
  }
});

// Generate flowchart for any project (admin, streaming)
router.post("/projects/:id/generate-flowchart-stream", requireAdmin, async (req, res) => {
  try {
    const { id: projectId } = req.params;
    const { requirements } = req.body;

    validateUUID(projectId);

    if (!requirements) {
      return res.status(400).json({ error: "requirements object required" });
    }

    // Verify project exists (no ownership check for admin)
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // Set up SSE headers
    configureSSEHeaders(res);

    try {
      sendSSEProgress(res, 10, "Sunny is analyzing your system architecture...");
      await new Promise(resolve => setTimeout(resolve, 2500));
      
      sendSSEProgress(res, 20, "Sunny is preparing to map workflows...");
      await new Promise(resolve => setTimeout(resolve, 2500));
      
      sendSSEProgress(res, 30, "Sunny is mapping actor interactions...");
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      sendSSEProgress(res, 40, "Sunny is identifying workflow patterns...");
      
      // Generate the flowchart
      const mermaidDiagram = await flowchartGen.generateFlowchart(requirements);
      
      sendSSEProgress(res, 75, "Sunny is creating detailed workflow diagrams...");
      await new Promise(resolve => setTimeout(resolve, 500));
      
      sendSSEProgress(res, 90, "Sunny is finalizing your flowchart...");
      const markdown = flowchartGen.wrapInMarkdown(mermaidDiagram);
      
      sendSSEProgress(res, 95, "Completing...");
      
      // Save detailed flowchart to database
      await prisma.project.update({
        where: { id: projectId },
        data: {
          detailedFlowchartMermaid: mermaidDiagram,
        },
      });
      
      // Wait a moment before 100%
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Send 100% progress
      sendSSEProgress(res, 100, "");
      
      // Wait 2 seconds to let the user see 100%
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Send final result
      sendSSEData(res, { 
        complete: true,
        mermaidDiagram,
        markdown,
        saved: true,
      });
    } catch (error) {
      logError(error as Error, { projectId, context: "admin-generate-flowchart" });
      sendSSEError(res, "Flowchart generation failed");
    }
  } catch (error) {
    console.error("Error in admin generate-flowchart-stream:", error);
    res.status(500).json({ error: "Flowchart generation failed" });
  }
});

export default router;

