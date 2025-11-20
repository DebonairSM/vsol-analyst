import path from "path";
import fs from "fs";
import { ForbiddenError } from "./errors";

/**
 * Validate that a file path is within a base directory and safe from path traversal.
 * @param userPath - The path to validate (can be relative or absolute)
 * @param baseDir - The base directory that the path must be within
 * @returns The resolved, normalized path if valid
 * @throws ForbiddenError if path traversal is detected
 */
export function validatePathWithinBase(userPath: string, baseDir: string): string {
  // Resolve both paths to absolute paths
  const baseAbsolute = path.resolve(baseDir);
  const resolvedPath = path.resolve(baseAbsolute, userPath);
  
  // Normalize paths to handle .. and . sequences
  const normalizedBase = path.normalize(baseAbsolute);
  const normalizedPath = path.normalize(resolvedPath);
  
  // Check that the resolved path starts with the base directory
  // Use path.relative to handle edge cases with different path separators
  const relativePath = path.relative(normalizedBase, normalizedPath);
  
  // If relative path contains .. or starts with .., it's a path traversal attempt
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new ForbiddenError("Path traversal detected: Invalid file path");
  }
  
  // Additional check: ensure the resolved path actually starts with the base
  if (!normalizedPath.startsWith(normalizedBase + path.sep) && normalizedPath !== normalizedBase) {
    throw new ForbiddenError("Path traversal detected: Invalid file path");
  }
  
  return normalizedPath;
}

/**
 * Validate file path and ensure the file exists.
 * @param userPath - The path to validate
 * @param baseDir - The base directory
 * @returns The validated absolute path
 * @throws ForbiddenError if path traversal is detected
 * @throws Error if file does not exist
 */
export function validateAndResolveFilePath(userPath: string, baseDir: string): string {
  const safePath = validatePathWithinBase(userPath, baseDir);
  
  if (!fs.existsSync(safePath)) {
    throw new Error("File does not exist");
  }
  
  return safePath;
}

