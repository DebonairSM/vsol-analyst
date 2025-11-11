import { Router } from "express";
import path from "path";
import fs from "fs";
import { requireAuth } from "../auth/middleware";
import { prisma } from "../utils/prisma";
import { getAuthenticatedUser } from "../utils/prisma-helpers";
import { NotFoundError, ForbiddenError, logError } from "../utils/errors";
import { asyncHandler } from "../utils/async-handler";

const router = Router();

// Serve attachment files
router.get("/:id", requireAuth, asyncHandler(async (req, res) => {
  const user = getAuthenticatedUser(req.user);
  const { id } = req.params;

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

  // Serve the file
  const filePath = path.resolve(attachment.storedPath);
  
  if (!fs.existsSync(filePath)) {
    throw new NotFoundError("File on disk");
  }

  res.setHeader("Content-Type", attachment.mimeType);
  res.setHeader("Content-Disposition", `inline; filename="${attachment.filename}"`);
  res.sendFile(filePath);
}));

export default router;

