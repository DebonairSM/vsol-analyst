import { prisma } from "./prisma";

/**
 * Type for attachment resolver function.
 */
export type AttachmentResolver = (attachmentId: string) => Promise<string | null>;

/**
 * Create an attachment resolver that fetches file paths from database.
 */
export function createAttachmentResolver(): AttachmentResolver {
  return async (attachmentId: string): Promise<string | null> => {
    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
    });
    return attachment ? attachment.storedPath : null;
  };
}

