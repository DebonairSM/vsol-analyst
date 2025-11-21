import { Request, Response, NextFunction } from "express";
import csrf from "csrf";
import { UnauthorizedError } from "../utils/errors";

const csrfProtection = csrf();

/**
 * Middleware to generate CSRF token for GET requests
 */
export function generateCSRFToken(req: Request, res: Response, next: NextFunction): void {
  if (req.method === "GET" && req.session) {
    const secret = req.session.csrfSecret || csrfProtection.secretSync();
    
    if (!req.session.csrfSecret) {
      req.session.csrfSecret = secret;
    }
    
    const token = csrfProtection.create(secret);
    res.locals.csrfToken = token;
  }
  next();
}

/**
 * Middleware to validate CSRF token for state-changing requests
 */
export function validateCSRFToken(req: Request, res: Response, next: NextFunction): void {
  // Skip CSRF validation for GET, HEAD, OPTIONS requests
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }
  
  // Skip CSRF validation for API key authenticated requests (MCP endpoints)
  if (req.headers["x-api-key"]) {
    return next();
  }
  
  // Require session for CSRF protection
  if (!req.session || !req.session.csrfSecret) {
    throw new UnauthorizedError("CSRF token missing. Please refresh the page.");
  }
  
  // Get token from header or body
  const token = req.headers["x-csrf-token"] || req.body?._csrf;
  
  if (!token || typeof token !== "string") {
    throw new UnauthorizedError("CSRF token missing");
  }
  
  // Validate token
  const secret = req.session.csrfSecret;
  if (!csrfProtection.verify(secret, token)) {
    throw new UnauthorizedError("Invalid CSRF token");
  }
  
  next();
}

