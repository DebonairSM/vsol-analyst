import fs from "fs";
import { ValidationError } from "./errors";
import { ALLOWED_IMAGE_MIMES, ALLOWED_SPREADSHEET_MIMES } from "./constants";

/**
 * Magic bytes (file signatures) for common file types
 */
const MAGIC_BYTES: Record<string, { signatures: number[][], mimeType: string }> = {
  // Images
  'image/png': {
    signatures: [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
    mimeType: 'image/png'
  },
  'image/jpeg': {
    signatures: [[0xFF, 0xD8, 0xFF]],
    mimeType: 'image/jpeg'
  },
  'image/jpg': {
    signatures: [[0xFF, 0xD8, 0xFF]],
    mimeType: 'image/jpeg'
  },
  'image/gif': {
    signatures: [[0x47, 0x49, 0x46, 0x38, 0x37, 0x61], [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]],
    mimeType: 'image/gif'
  },
  'image/webp': {
    signatures: [[0x52, 0x49, 0x46, 0x46]], // RIFF header, need to check further for WEBP
    mimeType: 'image/webp'
  },
  // Spreadsheets
  'application/vnd.ms-excel': {
    signatures: [[0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]], // OLE2/CFB format (.xls)
    mimeType: 'application/vnd.ms-excel'
  },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
    signatures: [[0x50, 0x4B, 0x03, 0x04]], // ZIP signature (.xlsx is a ZIP file)
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  }
};

/**
 * Check if buffer starts with magic bytes signature
 */
function matchesSignature(buffer: Buffer, signature: number[]): boolean {
  if (buffer.length < signature.length) {
    return false;
  }
  for (let i = 0; i < signature.length; i++) {
    if (buffer[i] !== signature[i]) {
      return false;
    }
  }
  return true;
}

/**
 * Detect MIME type from magic bytes
 */
function detectMimeTypeFromBuffer(buffer: Buffer): string | null {
  // Check each known file type
  for (const [mimeType, { signatures }] of Object.entries(MAGIC_BYTES)) {
    for (const signature of signatures) {
      if (matchesSignature(buffer, signature)) {
        // Special handling for WebP (RIFF + WEBP)
        if (mimeType === 'image/webp') {
          if (buffer.length >= 12 && buffer.toString('ascii', 8, 12) === 'WEBP') {
            return mimeType;
          }
          continue;
        }
        // Special handling for .xlsx (ZIP + specific structure)
        if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
          // Check if it's a ZIP file and contains [Content_Types].xml or xl/ directory
          // This is a simplified check - full validation would require ZIP parsing
          if (buffer.length >= 30) {
            const zipContent = buffer.toString('binary', 0, Math.min(1000, buffer.length));
            if (zipContent.includes('[Content_Types].xml') || zipContent.includes('xl/')) {
              return mimeType;
            }
          }
          // If it's a ZIP but we can't confirm it's an Excel file, continue checking
          continue;
        }
        return mimeType;
      }
    }
  }
  return null;
}

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
  // Read first 1024 bytes (enough for most magic bytes)
  const buffer = Buffer.alloc(1024);
  const fd = fs.openSync(filePath, "r");
  try {
    const bytesRead = fs.readSync(fd, buffer, 0, 1024, 0);
    fs.closeSync(fd);
    
    // Slice to actual bytes read
    const fileBuffer = buffer.slice(0, bytesRead);
    
    if (fileBuffer.length === 0) {
      throw new ValidationError("File is empty");
    }
    
    // Detect file type from magic bytes
    const detectedMimeType = detectMimeTypeFromBuffer(fileBuffer);
    
    if (!detectedMimeType) {
      throw new ValidationError(
        `Unable to detect file type from file signature. Only ${expectedMimeTypes.join(", ")} are allowed.`
      );
    }
    
    // Normalize jpg to jpeg
    const normalizedDetected = detectedMimeType === 'image/jpg' ? 'image/jpeg' : detectedMimeType;
    const normalizedExpected = expectedMimeTypes.map(m => m === 'image/jpg' ? 'image/jpeg' : m);
    
    // Check if detected MIME type matches expected types
    if (!normalizedExpected.includes(normalizedDetected)) {
      throw new ValidationError(
        `File type mismatch. Detected: ${normalizedDetected}, but only ${expectedMimeTypes.join(", ")} are allowed.`
      );
    }
    
    return normalizedDetected;
  } catch (error) {
    if (fd !== undefined) {
      try {
        fs.closeSync(fd);
      } catch (closeError) {
        // Ignore close errors
      }
    }
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

