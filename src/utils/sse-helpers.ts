import { Response } from "express";

/**
 * Configure response headers for Server-Sent Events (SSE).
 */
export function configureSSEHeaders(res: Response): void {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering
  res.flushHeaders();
}

/**
 * Send a progress update via SSE.
 */
export function sendSSEProgress(
  res: Response,
  progress: number,
  stage: string
): void {
  res.write(`data: ${JSON.stringify({ progress, stage })}\n\n`);
  
  // Flush if available
  const resAny = res as any;
  if (typeof resAny.flush === "function") {
    resAny.flush();
  }
}

/**
 * Send SSE data and end the stream.
 */
export function sendSSEData(res: Response, data: unknown): void {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
  res.end();
}

/**
 * Send SSE error and end the stream.
 */
export function sendSSEError(res: Response, error: string): void {
  res.write(`data: ${JSON.stringify({ error })}\n\n`);
  res.end();
}

/**
 * Delay execution for a specified number of milliseconds.
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

