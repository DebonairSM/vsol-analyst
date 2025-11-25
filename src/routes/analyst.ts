import { Router } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import fs from "fs";
import { requireAuth } from "../auth/middleware";
import { prisma } from "../utils/prisma";
import { getAuthenticatedUser, sanitizeForPrisma } from "../utils/prisma-helpers";
import { NotFoundError, ValidationError, logError } from "../utils/errors";
import { asyncHandler } from "../utils/async-handler";
import { createAttachmentResolver } from "../utils/attachment-helpers";
import { configureSSEHeaders, sendSSEProgress, sendSSEData, sendSSEError, delay } from "../utils/sse-helpers";
import { validateTextInput, validateUUID } from "../utils/validation";
import * as constants from "../utils/constants";
import { verifyProjectOwnership, getOrCreateChatSession, updateChatSessionHistory } from "../utils/project-helpers";
import { escapeSQLIdentifier, generateSafeSQLInsert } from "../utils/sql-escape";
import { validateSpreadsheetFileType, validateImageFileType } from "../utils/file-type-validation";

import { OpenAILLMProvider } from "../llm/OpenAILLMProvider";
import { RequirementsExtractor } from "../analyst/RequirementsExtractor";
import { DocumentGenerator } from "../analyst/DocumentGenerator";
import { StoryGenerator } from "../analyst/StoryGenerator";
import { RequirementsRefinementPipeline } from "../analyst/RequirementsRefinementPipeline";
import { UserStoryRefinementPipeline } from "../analyst/UserStoryRefinementPipeline";
import { FlowchartGenerator } from "../analyst/FlowchartGenerator";
import { SYSTEM_PROMPT_ANALYST, SYSTEM_PROMPT_POLISHER } from "../analyst/prompts";
import { ChatMessage } from "../llm/LLMProvider";
import { convertPriorityToDb, convertEffortToDb } from "../analyst/RequirementsTypes";

const router = Router();

// Initialize services
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

// Configure multer for file uploads
function createFileNameGenerator() {
  return (req: Express.Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  };
}

const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, constants.UPLOAD_DIR_IMAGES),
  filename: createFileNameGenerator(),
});

const spreadsheetStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, constants.UPLOAD_DIR_SPREADSHEETS),
  filename: createFileNameGenerator(),
});

const uploadImage = multer({
  storage: imageStorage,
  fileFilter: (req, file, cb) => {
    if (constants.ALLOWED_IMAGE_MIMES.includes(file.mimetype as any)) {
      cb(null, true);
    } else {
      cb(new Error("Only image files (PNG, JPG, GIF, WebP) are allowed"));
    }
  },
  limits: { fileSize: constants.MAX_FILE_SIZE },
});

const uploadSpreadsheet = multer({
  storage: spreadsheetStorage,
  fileFilter: (req, file, cb) => {
    if (constants.ALLOWED_SPREADSHEET_MIMES.includes(file.mimetype as any)) {
      cb(null, true);
    } else {
      cb(new Error("Only Excel files (.xls, .xlsx) are allowed"));
    }
  },
  limits: { fileSize: constants.MAX_FILE_SIZE },
});

// Chat endpoint
router.post("/chat", requireAuth, asyncHandler(async (req, res) => {
  const user = getAuthenticatedUser(req.user);
  const { projectId, message } = req.body;

  if (!projectId || typeof projectId !== "string") {
    throw new ValidationError("projectId is required");
  }
  if (!message || typeof message !== "string") {
    throw new ValidationError("message is required");
  }

  // Verify project ownership
  await verifyProjectOwnership(projectId, user.id);

  // Get or create chat session
  const firstName = user.name.split(" ")[0];
  const session = await getOrCreateChatSession(projectId, firstName);

  // Add user message
  session.history.push({ role: "user", content: message });

  // Get AI reply
  const reply = await llmMini.chat({
    messages: session.history,
    temperature: constants.DEFAULT_TEMPERATURE_CHAT,
    resolveAttachment: createAttachmentResolver(),
  });

  // Add assistant reply
  session.history.push({ role: "assistant", content: reply });

  // Update session
  await updateChatSessionHistory(session.id, session.history);

  res.json({ reply });
}));

// Extract requirements endpoint
router.post("/extract", requireAuth, async (req, res) => {
  try {
    const { projectId } = req.body as { projectId: string };

    if (!projectId) {
      return res.status(400).json({ error: "projectId required" });
    }

    const user = req.user as any;

    // Verify project ownership and get latest session with attachments
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        company: {
          userId: user.id,
        },
      },
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

    // Use the refinement pipeline instead of direct extraction
    const result = await refinementPipeline.extractWithRefinement(
      history,
      resolveAttachment
    );

    res.json({ 
      requirements: result.requirements, 
      markdown: result.markdown, 
      mermaid: result.mermaid,
      wasRefined: result.wasRefined,
      metrics: result.metrics,
    });
  } catch (error) {
    console.error("Error extracting requirements:", error);
    res.status(500).json({ error: "Extraction failed" });
  }
});

// Extract requirements with progress streaming
router.post("/extract-stream", requireAuth, async (req, res) => {
  try {
    const { projectId } = req.body as { projectId: string };

    if (!projectId) {
      return res.status(400).json({ error: "projectId required" });
    }

    const user = req.user as any;

    // Verify project ownership and get latest session with attachments
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        company: {
          userId: user.id,
        },
      },
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
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    res.flushHeaders(); // Flush headers immediately

    // Helper function to send progress updates
    const sendProgress = (progress: number, stage: string) => {
      res.write(`data: ${JSON.stringify({ progress, stage })}\n\n`);
      // Flush after each write to ensure immediate delivery
      if (typeof (res as any).flush === 'function') {
        (res as any).flush();
      }
    };

    try {
      sendProgress(10, "Sunny is reviewing your conversation...");
      await new Promise(resolve => setTimeout(resolve, 2500));
      
      sendProgress(20, "Sunny is preparing to extract requirements...");
      await new Promise(resolve => setTimeout(resolve, 2500));
      
      const result = await refinementPipeline.extractWithRefinement(
        history,
        resolveAttachment,
        (progress: number, stage: string) => {
          // Progress callback from pipeline
          console.log(`📊 [Progress Update] ${progress}% - ${stage}`);
          sendProgress(progress, stage);
        }
      );
      
      sendProgress(95, "Completing...");
      
      // Save requirements to database
      await prisma.project.update({
        where: { id: projectId },
        data: {
          generatedRequirements: result.requirements as any,
          requirementsMarkdown: result.markdown,
          requirementsMermaid: result.mermaid,
          requirementsExtractedAt: new Date(),
        },
      });
      
      // Wait a moment before 100%
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Send 100% progress
      sendProgress(100, "");
      
      // Wait 2 seconds to let the user see 100%
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
    console.error("Error in extract-stream:", error);
    res.status(500).json({ error: "Extraction failed" });
  }
});

// Get saved requirements for a project
router.get("/requirements/:projectId", requireAuth, asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    validateUUID(projectId);
    const user = getAuthenticatedUser(req.user);

    // Verify project ownership
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        company: {
          userId: user.id,
        },
      },
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

// Generate user stories endpoint (legacy - re-extracts requirements)
router.post("/generate-stories", requireAuth, async (req, res) => {
  try {
    const { projectId } = req.body as { projectId: string };

    if (!projectId) {
      return res.status(400).json({ error: "projectId required" });
    }

    const user = req.user as any;

    // Verify project ownership and get latest session with attachments
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        company: {
          userId: user.id,
        },
      },
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

    // First extract requirements from the transcript
    const requirements = await extractor.extractFromTranscript(
      history,
      resolveAttachment
    );

    // Then generate user stories with refinement pipeline
    const result = await storyRefinementPipeline.generateWithRefinement(requirements);

    res.json({ 
      userStories: result.userStories, 
      markdown: result.markdown,
      wasRefined: result.wasRefined,
      metrics: result.metrics,
    });
  } catch (error) {
    console.error("Error generating user stories:", error);
    res.status(500).json({ error: "User story generation failed" });
  }
});

// Generate user stories from cached requirements (optimized) with refinement
router.post("/generate-stories-from-requirements", requireAuth, async (req, res) => {
  try {
    const { requirements } = req.body;

    if (!requirements) {
      return res.status(400).json({ error: "requirements object required" });
    }

    // Use the refinement pipeline
    const result = await storyRefinementPipeline.generateWithRefinement(requirements);

    res.json({ 
      userStories: result.userStories, 
      markdown: result.markdown,
      wasRefined: result.wasRefined,
      metrics: result.metrics,
    });
  } catch (error) {
    console.error("Error generating user stories:", error);
    res.status(500).json({ error: "User story generation failed" });
  }
});

// Generate user stories with progress streaming
router.post("/generate-stories-stream", requireAuth, async (req, res) => {
  try {
    const { requirements, projectId } = req.body;

    if (!requirements) {
      return res.status(400).json({ error: "requirements object required" });
    }

    if (!projectId) {
      return res.status(400).json({ error: "projectId required" });
    }

    const user = req.user as any;

    // Verify project ownership
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        company: {
          userId: user.id,
        },
      },
    });

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    res.flushHeaders(); // Flush headers immediately

    // Helper function to send progress updates
    const sendProgress = (progress: number, stage: string) => {
      res.write(`data: ${JSON.stringify({ progress, stage })}\n\n`);
      // Flush after each write to ensure immediate delivery
      if (typeof (res as any).flush === 'function') {
        (res as any).flush();
      }
    };

    try {
      sendProgress(10, "Sunny is reviewing requirements...");
      await new Promise(resolve => setTimeout(resolve, 2500));
      
      sendProgress(20, "Sunny is preparing to generate stories...");
      await new Promise(resolve => setTimeout(resolve, 2500));
      
      const result = await storyRefinementPipeline.generateWithRefinement(
        requirements,
        (progress: number, stage: string) => {
          // Progress callback from pipeline
          console.log(`📊 [Progress Update] ${progress}% - ${stage}`);
          sendProgress(progress, stage);
        }
      );
      
      sendProgress(95, "Completing...");
      
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
      sendProgress(100, "");
      
      // Wait 2 seconds to let the user see 100%
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Send final result
      res.write(`data: ${JSON.stringify({ 
        complete: true,
        userStories: result.userStories, 
        markdown: result.markdown,
        wasRefined: result.wasRefined,
        metrics: result.metrics,
        saved: true,
      })}\n\n`);
      res.end();
    } catch (error) {
      res.write(`data: ${JSON.stringify({ error: "User story generation failed" })}\n\n`);
      res.end();
    }
  } catch (error) {
    console.error("Error in generate-stories-stream:", error);
    res.status(500).json({ error: "User story generation failed" });
  }
});

// Generate flowchart from cached requirements (optimized)
router.post("/generate-flowchart-from-requirements", requireAuth, async (req, res) => {
  try {
    const { requirements } = req.body;

    if (!requirements) {
      return res.status(400).json({ error: "requirements object required" });
    }

    // Generate complex flowchart using dedicated model
    const mermaidDiagram = await flowchartGen.generateFlowchart(requirements);
    const markdown = flowchartGen.wrapInMarkdown(mermaidDiagram);

    res.json({ 
      mermaidDiagram,
      markdown,
    });
  } catch (error) {
    console.error("Error generating flowchart:", error);
    res.status(500).json({ error: "Flowchart generation failed" });
  }
});

// Generate flowchart with progress streaming
router.post("/generate-flowchart-stream", requireAuth, async (req, res) => {
  try {
    const { requirements, projectId } = req.body;

    if (!requirements) {
      return res.status(400).json({ error: "requirements object required" });
    }

    if (!projectId) {
      return res.status(400).json({ error: "projectId required" });
    }

    const user = req.user as any;

    // Verify project ownership
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        company: {
          userId: user.id,
        },
      },
    });

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    res.flushHeaders(); // Flush headers immediately

    // Helper function to send progress updates
    const sendProgress = (progress: number, stage: string) => {
      res.write(`data: ${JSON.stringify({ progress, stage })}\n\n`);
      // Flush after each write to ensure immediate delivery
      if (typeof (res as any).flush === 'function') {
        (res as any).flush();
      }
    };

     try {
       sendProgress(10, "Sunny is analyzing your system architecture...");
       await new Promise(resolve => setTimeout(resolve, 2500));
       
       sendProgress(20, "Sunny is preparing to map workflows...");
       await new Promise(resolve => setTimeout(resolve, 2500));
       
       sendProgress(30, "Sunny is mapping actor interactions...");
       await new Promise(resolve => setTimeout(resolve, 1500));
       
       sendProgress(40, "Sunny is identifying workflow patterns...");
      
      // Generate the flowchart
      const mermaidDiagram = await flowchartGen.generateFlowchart(requirements);
      
      sendProgress(75, "Sunny is creating detailed workflow diagrams...");
      await new Promise(resolve => setTimeout(resolve, 500));
      
       sendProgress(90, "Sunny is finalizing your flowchart...");
       const markdown = flowchartGen.wrapInMarkdown(mermaidDiagram);
       
       sendProgress(95, "Completing...");
       
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
       sendProgress(100, "");
       
       // Wait 2 seconds to let the user see 100%
       await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Send final result
      res.write(`data: ${JSON.stringify({ 
        complete: true,
        mermaidDiagram,
        markdown,
        saved: true,
      })}\n\n`);
      res.end();
    } catch (error) {
      console.error("Error in flowchart generation:", error);
      res.write(`data: ${JSON.stringify({ error: "Flowchart generation failed" })}\n\n`);
      res.end();
    }
  } catch (error) {
    console.error("Error in generate-flowchart-stream:", error);
    res.status(500).json({ error: "Flowchart generation failed" });
  }
});

// Polish text endpoint
router.post("/polish", requireAuth, asyncHandler(async (req, res) => {
  const text = validateTextInput(req.body.text);

  // Use the LLM to polish the text
  const polished = await llmMini.chat({
    messages: [
      { role: "system", content: SYSTEM_PROMPT_POLISHER },
      { role: "user", content: text },
    ],
    temperature: constants.DEFAULT_TEMPERATURE_POLISH,
  });

  res.json({ original: text, polished: polished.trim() });
}));

// Upload Excel file endpoint
router.post("/upload-excel", requireAuth, uploadSpreadsheet.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const { projectId } = req.body;

    if (!projectId) {
      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: "projectId is required" });
    }

    const user = req.user as any;

    // Verify project ownership
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        company: {
          userId: user.id,
        },
      },
    });

    if (!project) {
      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: "Project not found" });
    }

    // Validate file type by checking magic bytes (prevents MIME type spoofing)
    try {
      await validateSpreadsheetFileType(req.file.path);
    } catch (validationError) {
      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ 
        error: validationError instanceof Error ? validationError.message : "Invalid file type" 
      });
    }

    // Read and parse the Excel file
    const workbook = XLSX.readFile(req.file.path);
    const result: any = {
      filename: req.file.originalname,
      sheets: {},
      summary: "",
    };

    // Process each sheet
    workbook.SheetNames.forEach((sheetName) => {
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      result.sheets[sheetName] = jsonData;
    });

    // Generate a summary of the Excel content
    let summaryParts: string[] = [];
    summaryParts.push(`📊 Excel File: ${req.file.originalname}`);
    summaryParts.push(`\nNumber of sheets: ${workbook.SheetNames.length}`);
    
    workbook.SheetNames.forEach((sheetName) => {
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
      
      summaryParts.push(`\n\n📄 Sheet: "${sheetName}"`);
      summaryParts.push(`Rows: ${jsonData.length}`);
      
      if (jsonData.length > 0) {
        const firstRow = jsonData[0] as any[];
        summaryParts.push(`Columns: ${firstRow.length}`);
        
        // Show column headers if available
        if (firstRow.length > 0) {
          summaryParts.push(`\nColumn Headers:`);
          firstRow.forEach((header, idx) => {
            if (header) {
              summaryParts.push(`  ${idx + 1}. ${header}`);
            }
          });
        }
        
        // Show first few rows as sample data
        if (jsonData.length > 1) {
          summaryParts.push(`\nSample Data (first ${Math.min(3, jsonData.length - 1)} rows):`);
          const sampleRows = jsonData.slice(1, Math.min(4, jsonData.length));
          sampleRows.forEach((row: any[], rowIdx) => {
            summaryParts.push(`  Row ${rowIdx + 2}: ${JSON.stringify(row)}`);
          });
        }
      }
    });

    result.summary = summaryParts.join("\n");

    // Get or create chat session for this project
    let chatSession = await prisma.chatSession.findFirst({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });

    if (!chatSession) {
      // Create new session with user's first name
      const firstName = user.name.split(" ")[0];
      const history = [{ role: "system", content: SYSTEM_PROMPT_ANALYST(firstName) }];
      chatSession = await prisma.chatSession.create({
        data: {
          projectId,
          history: JSON.stringify(history),
        },
      });
    }

    // Create Attachment record - convert undefined to null for Prisma JSON validation
    // JSON.stringify/parse removes undefined values, but we need null instead for Prisma
    const cleanedParsedData = JSON.parse(
      JSON.stringify(result.sheets, (key, value) => value === undefined ? null : value)
    );
    
    const attachment = await prisma.attachment.create({
      data: {
        filename: req.file.originalname,
        storedPath: req.file.path,
        fileType: "spreadsheet",
        mimeType: req.file.mimetype,
        parsedData: cleanedParsedData,
        sessionId: chatSession.id,
      },
    });

    // Add the spreadsheet information to the chat history
    const history = JSON.parse(chatSession.history as string) as ChatMessage[];
    
    // Create a detailed message about the spreadsheet upload
    const spreadsheetMessage = `[SYSTEM: User uploaded a spreadsheet file]\n\n${result.summary}`;
    
    // Add the spreadsheet info as a user message
    history.push({
      role: "user",
      content: spreadsheetMessage,
    });

    // Create attachment resolver function
    const resolveAttachment = async (attachmentId: string): Promise<string | null> => {
      const attachment = await prisma.attachment.findUnique({
        where: { id: attachmentId },
      });
      return attachment ? attachment.storedPath : null;
    };

    // Add an acknowledgment from the assistant
    const acknowledgment = await llmMini.chat({
      messages: history,
      temperature: 0.4,
      resolveAttachment,
    });

    history.push({
      role: "assistant",
      content: acknowledgment,
    });

    // Save the updated history (convert undefined to null for Prisma)
    await prisma.chatSession.update({
      where: { id: chatSession.id },
      data: { history: JSON.stringify(sanitizeForPrisma(history)) },
    });

    res.json({
      ...result,
      attachmentId: attachment.id,
      storedPath: attachment.storedPath,
    });
  } catch (error) {
    console.error("Error processing Excel file:", error);
    
    // Clean up file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({ error: "Failed to process Excel file" });
  }
});

// Get spreadsheet data endpoint
router.get("/get-spreadsheet-data/:attachmentId", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
    const { attachmentId } = req.params;
    validateUUID(attachmentId);

    // Get attachment with session info to verify ownership
    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
      include: {
        session: {
          include: {
            project: {
              include: {
                company: true,
              },
            },
          },
        },
      },
    });

    if (!attachment) {
      return res.status(404).json({ error: "Attachment not found" });
    }

    // Verify user owns the project
    if (attachment.session.project.company.userId !== user.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Verify this is a spreadsheet
    if (attachment.fileType !== "spreadsheet") {
      return res.status(400).json({ error: "This attachment is not a spreadsheet" });
    }

    // Return the parsed data
    res.json({
      id: attachment.id,
      filename: attachment.filename,
      parsedData: attachment.parsedData,
      createdAt: attachment.createdAt,
    });
  } catch (error) {
    console.error("Error retrieving spreadsheet data:", error);
    res.status(500).json({ error: "Failed to retrieve spreadsheet data" });
  }
});

// Generate and save seed data endpoint
router.post("/generate-seed-data", requireAuth, async (req, res) => {
  try {
    const { projectId, attachmentId, format } = req.body;

    if (!projectId || !attachmentId || !format) {
      return res.status(400).json({ error: "projectId, attachmentId, and format are required" });
    }

    if (!['json', 'sql', 'csv'].includes(format)) {
      return res.status(400).json({ error: "format must be json, sql, or csv" });
    }

    const user = req.user as any;

    // Verify project ownership and get attachment
    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
      include: {
        session: {
          include: {
            project: {
              include: {
                company: true,
              },
            },
          },
        },
      },
    });

    if (!attachment) {
      return res.status(404).json({ error: "Attachment not found" });
    }

    if (attachment.session.project.company.userId !== user.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    if (attachment.fileType !== "spreadsheet") {
      return res.status(400).json({ error: "Attachment must be a spreadsheet" });
    }

    // Generate seed data in requested format
    let seedData: any;
    let contentType: string;
    let fileExtension: string;

    const parsedData = attachment.parsedData as any;

    switch (format) {
      case 'json':
        seedData = JSON.stringify(parsedData, null, 2);
        contentType = 'application/json';
        fileExtension = 'json';
        break;

      case 'sql':
        let sql = '-- Seed Data SQL\n';
        sql += `-- Generated from: ${attachment.filename}\n`;
        sql += `-- Date: ${new Date().toISOString()}\n\n`;
        
        Object.keys(parsedData).forEach(sheetName => {
          const sheetData = parsedData[sheetName];
          
          if (sheetData.length === 0) return;
          
          // Use safe SQL escaping for table name
          const tableName = escapeSQLIdentifier(sheetName.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase());
          sql += `-- Table: ${tableName}\n`;
          
          const headers = sheetData[0];
          const dataRows = sheetData.slice(1);
          
          if (headers && headers.length > 0 && dataRows.length > 0) {
            // Use safe SQL escaping for column names
            const columns = headers.map((h: any, idx: number) => 
              h ? escapeSQLIdentifier(String(h).replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase()) : escapeSQLIdentifier(`column_${idx + 1}`)
            );
            
            // Generate safe SQL INSERT statements
            const safeInsert = generateSafeSQLInsert(tableName, columns, dataRows);
            sql += safeInsert + '\n';
          }
        });
        
        seedData = sql;
        contentType = 'text/plain';
        fileExtension = 'sql';
        break;

      case 'csv':
        // For CSV, we'll store all sheets in a JSON structure
        const csvData: any = {};
        Object.keys(parsedData).forEach(sheetName => {
          const sheetData = parsedData[sheetName];
          
          if (sheetData.length === 0) return;
          
          let csv = '';
          sheetData.forEach((row: any[]) => {
            const csvRow = row.map(cell => {
              if (cell === null || cell === undefined) return '';
              const cellStr = String(cell);
              if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
                return `"${cellStr.replace(/"/g, '""')}"`;
              }
              return cellStr;
            });
            csv += csvRow.join(',') + '\n';
          });
          
          csvData[sheetName] = csv;
        });
        
        seedData = JSON.stringify(csvData);
        contentType = 'application/json';
        fileExtension = 'csv';
        break;
    }

    // Save seed data to project
    await prisma.project.update({
      where: { id: projectId },
      data: {
        seedData: {
          format,
          attachmentId,
          filename: attachment.filename,
          data: seedData,
          generatedAt: new Date().toISOString(),
        } as any,
      },
    });

    res.json({
      success: true,
      format,
      data: seedData,
      filename: `${attachment.filename.replace(/\.[^/.]+$/, '')}-seed-data.${fileExtension}`,
    });
  } catch (error) {
    console.error("Error generating seed data:", error);
    res.status(500).json({ error: "Failed to generate seed data" });
  }
});

// Get saved seed data for a project
router.get("/seed-data/:projectId", requireAuth, async (req, res) => {
  try {
    const { projectId } = req.params;
    validateUUID(projectId);
    const user = req.user as any;

    // Verify project ownership
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        company: {
          userId: user.id,
        },
      },
      select: {
        seedData: true,
      },
    });

    if (!project) {
      return res.status(404).json({ error: "Project not found" });
    }

    if (!project.seedData) {
      return res.status(404).json({ error: "No seed data found" });
    }

    res.json(project.seedData);
  } catch (error) {
    console.error("Error fetching seed data:", error);
    res.status(500).json({ error: "Failed to fetch seed data" });
  }
});

// Upload image file endpoint
router.post("/upload-image", requireAuth, uploadImage.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const { projectId } = req.body;

    if (!projectId) {
      // Clean up uploaded file on error
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: "projectId is required" });
    }

    const user = req.user as any;

    // Verify project ownership
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        company: {
          userId: user.id,
        },
      },
    });

    if (!project) {
      // Clean up uploaded file on error
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: "Project not found" });
    }

    // Validate file type by checking magic bytes (prevents MIME type spoofing)
    try {
      await validateImageFileType(req.file.path);
    } catch (validationError) {
      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ 
        error: validationError instanceof Error ? validationError.message : "Invalid file type" 
      });
    }

    // Get or create chat session for this project
    let chatSession = await prisma.chatSession.findFirst({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });

    if (!chatSession) {
      // Create new session with user's first name
      const firstName = user.name.split(" ")[0];
      const history = [{ role: "system", content: SYSTEM_PROMPT_ANALYST(firstName) }];
      chatSession = await prisma.chatSession.create({
        data: {
          projectId,
          history: JSON.stringify(history),
        },
      });
    }

    // Create Attachment record
    const attachment = await prisma.attachment.create({
      data: sanitizeForPrisma({
        filename: req.file.originalname,
        storedPath: req.file.path,
        fileType: "image",
        mimeType: req.file.mimetype,
        sessionId: chatSession.id,
      }),
    });

    // Convert image to base64 data URL for vision analysis
    const fileBuffer = fs.readFileSync(req.file.path);
    const base64 = fileBuffer.toString("base64");
    const dataUrl = `data:${req.file.mimetype};base64,${base64}`;

    // Add the image to chat history with vision analysis
    const history = JSON.parse(chatSession.history as string) as ChatMessage[];
    
    // Add the image as a multimodal user message
    history.push({
      role: "user",
      content: [
        { type: "text", text: "[User uploaded an image/screenshot]" },
        { type: "image_url", image_url: { url: `attachment://${attachment.id}` } }
      ],
    });

    // Get AI analysis using vision (pass dataUrl for immediate analysis)
    const tempHistory = [
      ...history.slice(0, -1), // all history except the last message
      {
        role: "user",
        content: [
          { type: "text", text: "The user has uploaded an image. Please analyze it and describe what you see, then ask relevant questions about how this relates to their software requirements." },
          { type: "image_url", image_url: { url: dataUrl } }
        ],
      }
    ];

    // Create attachment resolver function
    const resolveAttachment = async (attachmentId: string): Promise<string | null> => {
      const attachment = await prisma.attachment.findUnique({
        where: { id: attachmentId },
      });
      return attachment ? attachment.storedPath : null;
    };

    const analysis = await llmMini.chat({
      messages: tempHistory as ChatMessage[],
      temperature: 0.4,
      resolveAttachment,
    });

    history.push({
      role: "assistant",
      content: analysis,
    });

    // Save the updated history (convert undefined to null for Prisma)
    await prisma.chatSession.update({
      where: { id: chatSession.id },
      data: { history: JSON.stringify(sanitizeForPrisma(history)) },
    });

    res.json({
      filename: req.file.originalname,
      attachmentId: attachment.id,
      storedPath: attachment.storedPath,
      analysis,
    });
  } catch (error) {
    console.error("Error processing image file:", error);
    
    // Clean up file if it exists and no attachment was created
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({ error: "Failed to process image file" });
  }
});

export default router;

