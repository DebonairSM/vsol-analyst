import { Request, Response, NextFunction } from "express";
import { timingSafeEqual } from "../utils/security";
import { UnauthorizedError } from "../utils/errors";

/**
 * Middleware that accepts either OAuth or API key authentication
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  // Check for API key (for MCP server and other local services)
  const apiKey = req.headers["x-api-key"];
  const expectedApiKey = process.env.API_KEY;
  
  if (expectedApiKey && apiKey && typeof apiKey === "string") {
    // Use timing-safe comparison to prevent timing attacks
    if (timingSafeEqual(apiKey, expectedApiKey)) {
      // Valid API key - create a synthetic user for authorization checks
      // Use the first admin user from the database
      return next();
    }
  }
  
  // Fall back to OAuth authentication
  if (!req.isAuthenticated()) {
    throw new UnauthorizedError("Authentication required");
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Authentication required" });
  }
  
  const user = req.user as any;
  if (!user.isAdmin) {
    return res.status(403).json({ error: "Admin access required" });
  }
  
  next();
}

