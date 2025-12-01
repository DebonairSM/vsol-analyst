/**
 * Application constants.
 */

// File upload limits
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_TEXT_LENGTH = 10000;
export const MAX_PROJECT_NAME_LENGTH = 100;

// Allowed MIME types
export const ALLOWED_IMAGE_MIMES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
] as const;

export const ALLOWED_SPREADSHEET_MIMES = [
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

// Upload directories
export const UPLOAD_DIR_IMAGES = "uploads/images/";
export const UPLOAD_DIR_SPREADSHEETS = "uploads/spreadsheets/";

/**
 * Sanitize a user name for use in folder paths.
 * Removes special characters, replaces spaces with underscores, and limits length.
 */
export function sanitizeUserNameForPath(userName: string): string {
  return userName
    .trim()
    .replace(/[^a-zA-Z0-9\s_-]/g, "") // Remove special characters except spaces, dashes, underscores
    .replace(/\s+/g, "_") // Replace spaces with underscores
    .replace(/_{2,}/g, "_") // Replace multiple underscores with single
    .replace(/^_+|_+$/g, "") // Remove leading/trailing underscores
    .substring(0, 50) // Limit length
    || "user"; // Fallback if empty
}

// Default values
export const DEFAULT_EPIC_ICON = "📦";
export const DEFAULT_TEMPERATURE_CHAT = 0.4;
export const DEFAULT_TEMPERATURE_EXTRACTION = 0.2;
export const DEFAULT_TEMPERATURE_POLISH = 0.3;

// Progress delays (milliseconds)
export const PROGRESS_DELAY_SHORT = 500;
export const PROGRESS_DELAY_MEDIUM = 1000;
export const PROGRESS_DELAY_LONG = 2000;
export const PROGRESS_DELAY_EXTRA_LONG = 2500;

