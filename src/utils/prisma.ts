import { PrismaClient } from "@prisma/client";

/**
 * Singleton PrismaClient instance to avoid connection pool exhaustion.
 * See: https://www.prisma.io/docs/guides/performance-and-optimization/connection-management
 */
class PrismaService {
  private static instance: PrismaClient | null = null;

  private constructor() {}

  public static getInstance(): PrismaClient {
    if (!PrismaService.instance) {
      PrismaService.instance = new PrismaClient({
        log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
      });
    }
    return PrismaService.instance;
  }

  public static async disconnect(): Promise<void> {
    if (PrismaService.instance) {
      await PrismaService.instance.$disconnect();
      PrismaService.instance = null;
    }
  }
}

export const prisma = PrismaService.getInstance();
export default prisma;

