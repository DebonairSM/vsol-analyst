import { Request, Response, NextFunction } from "express";

/**
 * Middleware that accepts either OAuth or API key authentication
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  // Check for API key (for MCP server and other local services)
  const apiKey = req.headers["x-api-key"];
  const expectedApiKey = process.env.API_KEY;
  
  if (expectedApiKey && apiKey === expectedApiKey) {
    // Valid API key - create a synthetic user for authorization checks
    // Use the first admin user from the database
    return next();
  }
  
  // Fall back to OAuth authentication
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Authentication required" });
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

