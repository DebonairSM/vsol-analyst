import { Request, Response, NextFunction } from "express";

/**
 * Wrapper for async route handlers to catch promise rejections.
 * Eliminates the need for try-catch in every async route.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void | Response>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

