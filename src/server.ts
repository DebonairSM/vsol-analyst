import dotenv from "dotenv";
dotenv.config();

import express, { Request, Response, NextFunction } from "express";
import session from "express-session";
import path from "path";
import multer from "multer";
import passport from "./auth/passport";
import { AppError, logError } from "./utils/errors";

// Import route modules
import authRoutes from "./routes/auth";
import projectRoutes from "./routes/projects";
import attachmentRoutes from "./routes/attachments";
import adminRoutes from "./routes/admin";
import analystRoutes from "./routes/analyst";

const app = express();
const isProd = process.env.NODE_ENV === "production";

// Validate required environment variables
const requiredEnvVars = ["SESSION_SECRET", "OPENAI_API_KEY"];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`FATAL: Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

// Use express.json() instead of body-parser
app.use(express.json());

// Trust proxy if in production (for secure cookies behind reverse proxy)
if (isProd) {
  app.set("trust proxy", 1);
}

// Session middleware
app.use(
  session({
    secret: process.env.SESSION_SECRET as string,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
    },
    // TODO: configure Redis session store for production
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
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Handle custom application errors
  if (err instanceof AppError) {
    logError(err, {
      path: req.path,
      method: req.method,
      userId: (req.user as any)?.id,
    });

    return res.status(err.statusCode).json({
      error: err.message,
      ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
    });
  }

  // Handle multer errors
  if (err instanceof multer.MulterError) {
    const message = err.code === "LIMIT_FILE_SIZE"
      ? "File too large (max 10MB)"
      : `Upload error: ${err.message}`;
    
    logError(err, { path: req.path, method: req.method });
    return res.status(400).json({ error: message });
  }

  // Handle custom file filter errors
  const error = err as Error;
  if (
    error.message &&
    error.message.startsWith("Only ") &&
    error.message.includes(" files ") &&
    error.message.includes(" are allowed")
  ) {
    logError(error, { path: req.path, method: req.method });
    return res.status(400).json({ error: error.message });
  }

  // Unknown error
  logError(error, {
    path: req.path,
    method: req.method,
    userId: (req.user as any)?.id,
  });

  const status = (error as any).status || 500;
  const message = isProd && status === 500
    ? "Internal server error"
    : error.message || "Internal server error";

  res.status(status).json({ error: message });
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason: unknown) => {
  console.error("=== UNHANDLED PROMISE REJECTION ===");
  console.error("Reason:", reason);
  
  if (isProd) {
    // In production, log and consider exiting gracefully
    console.error("Shutting down due to unhandled promise rejection");
    // Allow time for logs to flush
    setTimeout(() => process.exit(1), 1000);
  }
});

// Handle uncaught exceptions
process.on("uncaughtException", (error: Error) => {
  console.error("=== UNCAUGHT EXCEPTION ===");
  console.error("Error:", error.message);
  console.error("Stack:", error.stack);
  
  if (isProd) {
    // In production, exit immediately - the process is in an undefined state
    console.error("Shutting down due to uncaught exception");
    process.exit(1);
  }
});

// Make port configurable via environment variable
const PORT = Number(process.env.PORT) || 5051;
app.listen(PORT, () => {
  console.log(`VSol Analyst Agent running on http://localhost:${PORT}`);
});
