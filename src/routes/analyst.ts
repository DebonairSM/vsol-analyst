import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import multer from "multer";
import * as XLSX from "xlsx";
import fs from "fs";
import { requireAuth } from "../auth/middleware";
import { OpenAILLMProvider } from "../llm/OpenAILLMProvider";
import { RequirementsExtractor } from "../analyst/RequirementsExtractor";
import { DocumentGenerator } from "../analyst/DocumentGenerator";
import { StoryGenerator } from "../analyst/StoryGenerator";
import { RequirementsRefinementPipeline } from "../analyst/RequirementsRefinementPipeline";
import { UserStoryRefinementPipeline } from "../analyst/UserStoryRefinementPipeline";
import { SYSTEM_PROMPT_ANALYST, SYSTEM_PROMPT_POLISHER } from "../analyst/prompts";
import { ChatMessage } from "../llm/LLMProvider";

const router = Router();
const prisma = new PrismaClient();

// Initialize services
const llmMini = new OpenAILLMProvider({ defaultModel: "gpt-4o-mini" });
const llmFull = new OpenAILLMProvider({ defaultModel: "gpt-4o" });
const extractor = new RequirementsExtractor(llmMini);
const storyGen = new StoryGenerator(llmMini);
const docs = new DocumentGenerator();
const refinementPipeline = new RequirementsRefinementPipeline(
  llmMini,
  llmFull,
  extractor,
  docs
);

// Helper function to convert undefined values to null for JSON storage (Prisma requirement)
const convertUndefinedToNull = (obj: any): any => {
  if (obj === undefined) {
    return null;
  }
  if (Array.isArray(obj)) {
    return obj.map(convertUndefinedToNull);
  }
  if (obj !== null && typeof obj === 'object') {
    const converted: any = {};
    for (const key in obj) {
      converted[key] = convertUndefinedToNull(obj[key]);
    }
    return converted;
  }
  return obj;
};
const storyRefinementPipeline = new UserStoryRefinementPipeline(
  llmMini,
  llmFull,
  storyGen,
  (stories) => docs.generateUserStoriesMarkdown(stories)
);

// Configure multer for file uploads
const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/images/");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

const spreadsheetStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/spreadsheets/");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

const uploadImage = multer({
  storage: imageStorage,
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/gif",
      "image/webp",
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image files (PNG, JPG, GIF, WebP) are allowed"));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

const uploadSpreadsheet = multer({
  storage: spreadsheetStorage,
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only Excel files (.xls, .xlsx) are allowed"));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// Chat endpoint
router.post("/chat", requireAuth, async (req, res) => {
  try {
    const { projectId, message } = req.body as {
      projectId: string;
      message: string;
    };

    if (!projectId || !message) {
      return res.status(400).json({ error: "projectId and message required" });
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

    // Get or create chat session for this project
    let chatSession = await prisma.chatSession.findFirst({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });

    let history: ChatMessage[];

    if (!chatSession) {
      // Create new session with user's first name
      const firstName = user.name.split(" ")[0];
      history = [{ role: "system", content: SYSTEM_PROMPT_ANALYST(firstName) }];
      chatSession = await prisma.chatSession.create({
        data: {
          projectId,
          history: JSON.stringify(history),
        },
      });
    } else {
      history = JSON.parse(chatSession.history as string) as ChatMessage[];
    }

    // Add user message
    history.push({ role: "user", content: message });

    // Create attachment resolver function
    const resolveAttachment = async (attachmentId: string): Promise<string | null> => {
      const attachment = await prisma.attachment.findUnique({
        where: { id: attachmentId },
      });
      return attachment ? attachment.storedPath : null;
    };

    // Get AI reply with attachment resolution
    const reply = await llmMini.chat({
      messages: history,
      temperature: 0.4,
      resolveAttachment,
    });

    // Add assistant reply
    history.push({ role: "assistant", content: reply });

    // Update session in database (convert undefined to null for Prisma)
    await prisma.chatSession.update({
      where: { id: chatSession.id },
      data: { history: JSON.stringify(convertUndefinedToNull(history)) },
    });

    res.json({ reply });
  } catch (error) {
    console.error("Error in chat:", error);
    res.status(500).json({ error: "Chat failed" });
  }
});

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

// Polish text endpoint
router.post("/polish", requireAuth, async (req, res) => {
  try {
    const { text } = req.body as { text: string };

    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "text is required" });
    }

    if (text.trim().length === 0) {
      return res.status(400).json({ error: "text cannot be empty" });
    }

    // Use the LLM to polish the text
    const polished = await llmMini.chat({
      messages: [
        { role: "system", content: SYSTEM_PROMPT_POLISHER },
        { role: "user", content: text },
      ],
      temperature: 0.3,
    });

    res.json({ original: text, polished: polished.trim() });
  } catch (error) {
    console.error("Error polishing text:", error);
    res.status(500).json({ error: "Polishing failed" });
  }
});

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
      data: { history: JSON.stringify(convertUndefinedToNull(history)) },
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
      data: convertUndefinedToNull({
        filename: req.file.originalname,
        storedPath: req.file.path,
        fileType: "image",
        mimeType: req.file.mimetype,
        sessionId: chatSession.id,
      }) as any,
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
      data: { history: JSON.stringify(convertUndefinedToNull(history)) },
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

