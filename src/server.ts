import dotenv from "dotenv";
dotenv.config();

import express from "express";
import session from "express-session";
import path from "path";
import multer from "multer";
import passport from "./auth/passport";

// Import route modules
import authRoutes from "./routes/auth";
import projectRoutes from "./routes/projects";
import attachmentRoutes from "./routes/attachments";
import adminRoutes from "./routes/admin";
import analystRoutes from "./routes/analyst";

const app = express();
const isProd = process.env.NODE_ENV === "production";

// Use express.json() instead of body-parser
app.use(express.json());

// Trust proxy if in production (for secure cookies behind reverse proxy)
if (isProd) {
  app.set("trust proxy", 1);
}

// Session middleware
app.use(
  session({
    secret: process.env.SESSION_SECRET || "vsol-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      httpOnly: true,
      secure: isProd,     // Only over HTTPS in production
      sameSite: "lax",    // Decent default
    },
    // store: new RedisStore(...), // TODO: configure for production
  })
);

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, "../public")));

// Bypass ngrok browser warning
app.use((req, res, next) => {
  res.setHeader('ngrok-skip-browser-warning', 'true');
  next();
});

// Root route serves the chat UI
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

// Mount route modules
app.use("/auth", authRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/attachments", attachmentRoutes);
app.use("/api/admin", adminRoutes);
app.use("/analyst", analystRoutes);

// Global error handler (must be last middleware)
app.use((
  err: unknown,
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  const error = err as any;
  
  console.error("=== UNHANDLED ERROR ===");
  console.error("Path:", req.method, req.path);
  console.error("Error:", error);
  console.error("Stack:", error.stack);
  
  // Handle multer errors specifically
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "File too large (max 10MB)" });
    }
    return res.status(400).json({ error: `Upload error: ${error.message}` });
  }
  
  // Handle custom file filter errors (more specific pattern matching)
  if (error.message && 
      error.message.startsWith("Only ") && 
      error.message.includes(" files ") && 
      error.message.includes(" are allowed")) {
    return res.status(400).json({ error: error.message });
  }
  
  // For production, avoid leaking internal error messages on 500s
  const status = error.status || 500;
  const message = isProd && status === 500
    ? "Internal server error"
    : (error.message || "Internal server error");
  
  res.status(status).json({ error: message });
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("=== UNHANDLED PROMISE REJECTION ===");
  console.error("Reason:", reason);
  console.error("Promise:", promise);
  // In production, consider:
  // - Closing the server gracefully
  // - Flushing logs
  // - process.exit(1) after a small delay
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("=== UNCAUGHT EXCEPTION ===");
  console.error("Error:", error);
  console.error("Stack:", error.stack);
  // In production, consider:
  // - Closing the server gracefully
  // - Flushing logs
  // - process.exit(1) after a small delay
});

// Make port configurable via environment variable
const PORT = Number(process.env.PORT) || 5051;
app.listen(PORT, () => {
  console.log(`VSol Analyst Agent running on http://localhost:${PORT}`);
});
