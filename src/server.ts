import dotenv from "dotenv";
dotenv.config();

import express from "express";
import bodyParser from "body-parser";
import session from "express-session";
import path from "path";
import { PrismaClient } from "@prisma/client";
import passport from "./auth/passport";
import { requireAuth, requireAdmin } from "./auth/middleware";
import { OpenAILLMProvider } from "./llm/OpenAILLMProvider";
import { RequirementsExtractor } from "./analyst/RequirementsExtractor";
import { DocumentGenerator } from "./analyst/DocumentGenerator";
import { SYSTEM_PROMPT_ANALYST } from "./analyst/prompts";
import { ChatMessage } from "./llm/LLMProvider";

const app = express();
const prisma = new PrismaClient();

app.use(bodyParser.json());

// Session middleware
app.use(
  session({
    secret: process.env.SESSION_SECRET || "vsol-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, "../public")));

const llm = new OpenAILLMProvider();
const extractor = new RequirementsExtractor(llm);
const docs = new DocumentGenerator();

// Root route serves the chat UI
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

// ========== Auth Routes ==========

// Initiate Google OAuth
app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

// Google OAuth callback
app.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/" }),
  (req, res) => {
    res.redirect("/");
  }
);

// Logout
app.get("/auth/logout", (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: "Logout failed" });
    }
    res.json({ success: true });
  });
});

// Get current user
app.get("/auth/me", (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  res.json({ user: req.user });
});

// ========== Project Routes ==========

// List user's projects
app.get("/api/projects", requireAuth, async (req, res) => {
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
app.post("/api/projects", requireAuth, async (req, res) => {
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
app.get("/api/projects/:id", requireAuth, async (req, res) => {
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
app.patch("/api/projects/:id", requireAuth, async (req, res) => {
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

// ========== Admin Routes ==========

// Get admin dashboard stats
app.get("/api/admin/stats", requireAdmin, async (req, res) => {
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
app.get("/api/admin/users", requireAdmin, async (req, res) => {
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
app.get("/api/admin/projects", requireAdmin, async (req, res) => {
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
app.get("/api/admin/projects/:id/chat", requireAdmin, async (req, res) => {
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

// ========== Chat & Analysis Routes ==========

// Chat endpoint
app.post("/analyst/chat", requireAuth, async (req, res) => {
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

    // Get AI reply
    const reply = await llm.chat({
      messages: history,
      temperature: 0.4,
    });

    // Add assistant reply
    history.push({ role: "assistant", content: reply });

    // Update session in database
    await prisma.chatSession.update({
      where: { id: chatSession.id },
      data: { history: JSON.stringify(history) },
    });

    res.json({ reply });
  } catch (error) {
    console.error("Error in chat:", error);
    res.status(500).json({ error: "Chat failed" });
  }
});

// Extract requirements endpoint
app.post("/analyst/extract", requireAuth, async (req, res) => {
  try {
    const { projectId } = req.body as { projectId: string };

    if (!projectId) {
      return res.status(400).json({ error: "projectId required" });
    }

    const user = req.user as any;

    // Verify project ownership and get latest session
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
        },
      },
    });

    if (!project || !project.sessions.length) {
      return res.status(404).json({ error: "No chat history found" });
    }

    const history = JSON.parse(
      project.sessions[0].history as string
    ) as ChatMessage[];

    const transcript = history
      .filter((m) => m.role !== "system")
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n\n");

    const requirements = await extractor.extractFromTranscript(transcript);
    const md = docs.generateRequirementsMarkdown(requirements);
    const mermaid = docs.generateMermaidFlow(requirements);

    res.json({ requirements, markdown: md, mermaid });
  } catch (error) {
    console.error("Error extracting requirements:", error);
    res.status(500).json({ error: "Extraction failed" });
  }
});

const PORT = 5051;
app.listen(PORT, () => {
  console.log(`VSol Analyst Agent running on http://localhost:${PORT}`);
});
