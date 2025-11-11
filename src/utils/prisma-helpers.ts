/**
 * Convert undefined values to null for Prisma JSON storage.
 * Prisma requires null instead of undefined for JSON fields.
 */
export function sanitizeForPrisma<T>(obj: T): T {
  if (obj === undefined) {
    return null as unknown as T;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sanitizeForPrisma) as unknown as T;
  }
  
  if (obj !== null && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = sanitizeForPrisma(value);
    }
    return result as T;
  }
  
  return obj;
}

/**
 * Type guard to check if user object is valid.
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
}

export function isAuthenticatedUser(user: unknown): user is AuthenticatedUser {
  return (
    typeof user === "object" &&
    user !== null &&
    "id" in user &&
    "email" in user &&
    "name" in user &&
    typeof (user as AuthenticatedUser).id === "string" &&
    typeof (user as AuthenticatedUser).email === "string" &&
    typeof (user as AuthenticatedUser).name === "string"
  );
}

/**
 * Get authenticated user from request or throw error.
 */
export function getAuthenticatedUser(reqUser: unknown): AuthenticatedUser {
  if (!isAuthenticatedUser(reqUser)) {
    throw new Error("Invalid user object");
  }
  return reqUser;
}

