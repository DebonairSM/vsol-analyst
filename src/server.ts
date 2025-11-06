import dotenv from "dotenv";
dotenv.config();

import express from "express";
import bodyParser from "body-parser";
import path from "path";
import { OpenAILLMProvider } from "./llm/OpenAILLMProvider";
import { RequirementsExtractor } from "./analyst/RequirementsExtractor";
import { DocumentGenerator } from "./analyst/DocumentGenerator";
import { SYSTEM_PROMPT_ANALYST } from "./analyst/prompts";
import { ChatMessage } from "./llm/LLMProvider";

const app = express();
app.use(bodyParser.json());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, "../public")));

const llm = new OpenAILLMProvider();
const extractor = new RequirementsExtractor(llm);
const docs = new DocumentGenerator();

// In-memory session storage
const sessions = new Map<string, ChatMessage[]>();

// Root route serves the chat UI
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

// Chat endpoint
app.post("/analyst/chat", async (req, res) => {
  const { sessionId, message } = req.body as {
    sessionId: string;
    message: string;
  };

  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, [
      { role: "system", content: SYSTEM_PROMPT_ANALYST },
    ]);
  }

  const history = sessions.get(sessionId)!;
  history.push({ role: "user", content: message });

  const reply = await llm.chat({
    messages: history,
    temperature: 0.4,
  });

  history.push({ role: "assistant", content: reply });
  res.json({ reply });
});

// Extract requirements endpoint
app.post("/analyst/extract", async (req, res) => {
  const { sessionId } = req.body as { sessionId: string };

  const history = sessions.get(sessionId);
  if (!history) return res.status(404).json({ error: "Unknown session" });

  const transcript = history
    .filter(m => m.role !== "system")
    .map(m => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n\n");

  const requirements = await extractor.extractFromTranscript(transcript);
  const md = docs.generateRequirementsMarkdown(requirements);
  const mermaid = docs.generateMermaidFlow(requirements);

  res.json({ requirements, markdown: md, mermaid });
});

const PORT = 5051;
app.listen(PORT, () => {
  console.log(`VSol Analyst Agent running on http://localhost:${PORT}`);
});

