import { Request, Response, NextFunction } from "express";
import { validateUUID } from "../utils/validation";

/**
 * Middleware to validate UUID parameters in route.
 * Validates all common ID parameter names.
 */
export function validateIdParams(req: Request, res: Response, next: NextFunction): void {
  const idParams = ["id", "projectId", "storyId", "attachmentId"];
  
  for (const paramName of idParams) {
    const paramValue = req.params[paramName];
    if (paramValue) {
      try {
        validateUUID(paramValue);
      } catch (error) {
        // ValidationError will be handled by error handler
        return next(error);
      }
    }
  }
  
  next();
}

