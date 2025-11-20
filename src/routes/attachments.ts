import { Router } from "express";
import { requireAuth } from "../auth/middleware";
import { prisma } from "../utils/prisma";
import { getAuthenticatedUser } from "../utils/prisma-helpers";
import { NotFoundError, ForbiddenError, logError } from "../utils/errors";
import { asyncHandler } from "../utils/async-handler";
import { validateAndResolveFilePath } from "../utils/path-validation";
import { UPLOAD_DIR_IMAGES, UPLOAD_DIR_SPREADSHEETS } from "../utils/constants";
import { validateUUID } from "../utils/validation";
import path from "path";

const router = Router();

// Serve attachment files
router.get("/:id", requireAuth, asyncHandler(async (req, res) => {
  const user = getAuthenticatedUser(req.user);
  const { id } = req.params;
  validateUUID(id); // Validate UUID format

  // Get attachment with session info to verify ownership
  const attachment = await prisma.attachment.findUnique({
    where: { id },
    include: {
      session: {
        include: {
          project: {
            include: {
              company: true,
            },
          },
        },
      },
    },
  });

  if (!attachment) {
    throw new NotFoundError("Attachment");
  }

  // Verify user owns the project
  if (attachment.session.project.company.userId !== user.id) {
    throw new ForbiddenError("Access denied to this attachment");
  }

  // Validate file path and prevent path traversal
  // Determine base directory based on file type (images vs spreadsheets)
  const baseDir = attachment.mimeType.startsWith("image/")
    ? path.resolve(process.cwd(), UPLOAD_DIR_IMAGES)
    : path.resolve(process.cwd(), UPLOAD_DIR_SPREADSHEETS);
  
  // Validate and resolve the file path safely
  const filePath = validateAndResolveFilePath(attachment.storedPath, baseDir);

  res.setHeader("Content-Type", attachment.mimeType);
  res.setHeader("Content-Disposition", `inline; filename="${attachment.filename}"`);
  res.sendFile(filePath);
}));

export default router;

