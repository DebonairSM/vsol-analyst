import { ValidationError } from "./errors";

/**
 * Validate project name input.
 */
export function validateProjectName(name: unknown): string {
  if (typeof name !== "string") {
    throw new ValidationError("Project name must be a string");
  }

  const trimmed = name.trim();
  
  if (trimmed.length === 0) {
    throw new ValidationError("Project name cannot be empty");
  }

  if (trimmed.length > 100) {
    throw new ValidationError("Project name must be 100 characters or less");
  }

  return trimmed;
}

/**
 * Validate text input for polishing.
 */
export function validateTextInput(text: unknown): string {
  if (typeof text !== "string") {
    throw new ValidationError("Text must be a string");
  }

  const trimmed = text.trim();
  
  if (trimmed.length === 0) {
    throw new ValidationError("Text cannot be empty");
  }

  if (trimmed.length > 10000) {
    throw new ValidationError("Text must be 10000 characters or less");
  }

  return trimmed;
}

/**
 * Validate CUID format (Prisma uses CUIDs, not UUIDs).
 * CUIDs are 25 characters long, start with 'c', and contain alphanumeric characters.
 */
export function validateUUID(id: unknown): string {
  if (typeof id !== "string") {
    throw new ValidationError("ID must be a string");
  }

  const cuidRegex = /^c[0-9a-z]{24}$/;
  
  if (!cuidRegex.test(id)) {
    throw new ValidationError("Invalid ID format");
  }

  return id;
}

