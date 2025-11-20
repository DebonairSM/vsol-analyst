import dotenv from "dotenv";
dotenv.config();

import express, { Request, Response, NextFunction } from "express";
import session from "express-session";
import path from "path";
import multer from "multer";
import cron from "node-cron";
import helmet from "helmet";
import cors from "cors";
import passport from "./auth/passport";
import { AppError, logError } from "./utils/errors";
import { backupDatabase } from "./backup/database-backup";

// Import security middleware
import { apiLimiter, authLimiter, analystLimiter, mcpApiLimiter } from "./middleware/rate-limit";
import { generateCSRFToken, validateCSRFToken } from "./middleware/csrf";

// Import route modules
import authRoutes from "./routes/auth";
import projectRoutes from "./routes/projects";
import attachmentRoutes from "./routes/attachments";
import adminRoutes from "./routes/admin";
import analystRoutes from "./routes/analyst";
import mcpApiRoutes from "./routes/mcp-api";
import systemRoutes from "./routes/system";

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

// Trust proxy if in production (for secure cookies behind reverse proxy)
if (isProd) {
  app.set("trust proxy", 1);
}

// Security headers via helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Note: Consider removing unsafe-inline in future
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "data:"],
    },
  },
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
}));

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",").map(o => o.trim()) || [
  isProd ? undefined : "http://localhost:5051",
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      return callback(null, true);
    }
    
    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-api-key", "x-csrf-token"],
}));

// Use express.json() - must be before CSRF validation
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session store configuration (Redis if available, otherwise memory)
let sessionStore: session.Store | undefined;

if (process.env.REDIS_URL && process.env.USE_REDIS_SESSIONS !== "false") {
  try {
    // Dynamic import to avoid requiring redis in development if not used
    const RedisStore = require("connect-redis").default;
    const { createClient } = require("redis");
    
    const redisClient = createClient({ url: process.env.REDIS_URL });
    redisClient.connect().catch((err: Error) => {
      console.error("Failed to connect to Redis, falling back to memory sessions:", err.message);
    });
    
    sessionStore = new RedisStore({ client: redisClient });
    console.log("✓ Redis session store initialized");
  } catch (error) {
    console.warn("Redis not available, using in-memory sessions:", error);
  }
}

// Session middleware
app.use(
  session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET as string,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "strict" : "lax", // Strict in production for better CSRF protection
    },
    name: "vsol.sid", // Custom session name (not default connect.sid)
  })
);

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// CSRF protection - generate tokens for GET requests
app.use(generateCSRFToken);

// Rate limiting - apply before routes
app.use("/auth", authLimiter);
app.use("/analyst", analystLimiter);
app.use("/api/mcp", mcpApiLimiter);
app.use("/api", apiLimiter); // General API rate limiting

// Serve static files from public directory
app.use(express.static(path.join(__dirname, "../public")));

// Bypass ngrok browser warning
app.use((req, res, next) => {
  res.setHeader('ngrok-skip-browser-warning', 'true');
  next();
});

// Root route serves the chat UI
app.get("/", generateCSRFToken, (req, res) => {
  // CSRF token is already set in res.locals.csrfToken by middleware
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

// API endpoint to get CSRF token (for frontend to fetch on load)
app.get("/api/csrf-token", generateCSRFToken, (req, res) => {
  res.json({ csrfToken: res.locals.csrfToken || null });
});

// Mount route modules with CSRF protection (except for MCP API which uses API keys)
app.use("/auth", validateCSRFToken, authRoutes);
app.use("/api/projects", validateCSRFToken, projectRoutes);
app.use("/api/attachments", validateCSRFToken, attachmentRoutes);
app.use("/api/admin", validateCSRFToken, adminRoutes);
app.use("/analyst", validateCSRFToken, analystRoutes);
app.use("/api/mcp", mcpApiRoutes); // MCP server API endpoints (no CSRF, uses API keys)
app.use("/api/system", validateCSRFToken, systemRoutes); // System status and management

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

    // Never expose stack traces to clients, even in development
    // Stack traces are logged server-side via logError
    return res.status(err.statusCode).json({
      error: err.message,
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

// Schedule hourly database backups while app is running
// Runs at the top of every hour (e.g., 1:00, 2:00, 3:00)
cron.schedule("0 * * * *", async () => {
  console.log(`[${new Date().toISOString()}] Running scheduled database backup...`);
  try {
    await backupDatabase();
  } catch (error) {
    console.error("Scheduled backup failed:", error);
  }
}, {
  timezone: "America/New_York" // Adjust to your timezone if needed
});

console.log("✓ Hourly backup scheduler initialized");

// Make port configurable via environment variable
const PORT = Number(process.env.PORT) || 5051;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`VSol Analyst Agent running on:`);
  console.log(`  - http://localhost:${PORT}`);
  console.log(`  - http://127.0.0.1:${PORT}`);
  if (HOST === '0.0.0.0') {
    console.log(`  - http://vsol-aurora:${PORT} (if DNS configured)`);
  }
});
