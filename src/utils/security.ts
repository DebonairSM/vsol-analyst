import crypto from "crypto";

/**
 * Constant-time comparison for API keys to prevent timing attacks.
 * @param a - First string to compare
 * @param b - Second string to compare
 * @returns true if strings are equal, false otherwise
 */
export function timingSafeEqual(a: string, b: string): boolean {
  // Convert strings to buffers
  const bufferA = Buffer.from(a, "utf8");
  const bufferB = Buffer.from(b, "utf8");
  
  // If lengths differ, they can't be equal
  if (bufferA.length !== bufferB.length) {
    return false;
  }
  
  // Use crypto.timingSafeEqual for constant-time comparison
  return crypto.timingSafeEqual(bufferA, bufferB);
}

