import { fileTypeFromBuffer } from "file-type";
import { Readable } from "stream";
import fs from "fs";
import { ValidationError } from "./errors";
import { ALLOWED_IMAGE_MIMES, ALLOWED_SPREADSHEET_MIMES } from "./constants";

/**
 * Validate file type by checking magic bytes (file signature).
 * This prevents MIME type spoofing attacks.
 * @param filePath - Path to the file to validate
 * @param expectedMimeTypes - Array of allowed MIME types
 * @returns The detected MIME type
 * @throws ValidationError if file type doesn't match expected types
 */
export async function validateFileTypeByMagicBytes(
  filePath: string,
  expectedMimeTypes: readonly string[]
): Promise<string> {
  // Read first 4100 bytes (file-type needs at least 4100 bytes for some formats)
  const buffer = Buffer.alloc(4100);
  const fd = fs.openSync(filePath, "r");
  try {
    const bytesRead = fs.readSync(fd, buffer, 0, 4100, 0);
    fs.closeSync(fd);
    
    // Slice to actual bytes read
    const fileBuffer = buffer.slice(0, bytesRead);
    
    // Detect file type from magic bytes
    const detectedType = await fileTypeFromBuffer(fileBuffer);
    
    if (!detectedType) {
      throw new ValidationError(
        `Unable to detect file type. Only ${expectedMimeTypes.join(", ")} are allowed.`
      );
    }
    
    // Check if detected MIME type matches expected types
    const mimeType = detectedType.mime;
    
    if (!expectedMimeTypes.includes(mimeType)) {
      throw new ValidationError(
        `File type mismatch. Detected: ${mimeType}, but only ${expectedMimeTypes.join(", ")} are allowed.`
      );
    }
    
    return mimeType;
  } catch (error) {
    fs.closeSync(fd);
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError(`Failed to validate file type: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Validate image file type by checking magic bytes.
 */
export async function validateImageFileType(filePath: string): Promise<string> {
  return validateFileTypeByMagicBytes(filePath, ALLOWED_IMAGE_MIMES);
}

/**
 * Validate spreadsheet file type by checking magic bytes.
 */
export async function validateSpreadsheetFileType(filePath: string): Promise<string> {
  return validateFileTypeByMagicBytes(filePath, ALLOWED_SPREADSHEET_MIMES);
}

