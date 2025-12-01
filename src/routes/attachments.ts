import { Router } from "express";
import { requireAuth } from "../auth/middleware";
import { prisma } from "../utils/prisma";
import { getAuthenticatedUser } from "../utils/prisma-helpers";
import { NotFoundError, ForbiddenError, logError } from "../utils/errors";
import { asyncHandler } from "../utils/async-handler";
import { UPLOAD_DIR_IMAGES, UPLOAD_DIR_SPREADSHEETS } from "../utils/constants";
import { validateUUID } from "../utils/validation";
import path from "path";
import fs from "fs";

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

  // Verify user owns the project, or is an admin
  const isOwner = attachment.session.project.company.userId === user.id;
  const isAdmin = user.isAdmin === true;
  
  if (!isOwner && !isAdmin) {
    throw new ForbiddenError("Access denied to this attachment");
  }

  // Validate file path and prevent path traversal
  // Determine base directory based on file type (images vs spreadsheets)
  const baseDir = attachment.mimeType.startsWith("image/")
    ? path.resolve(process.cwd(), UPLOAD_DIR_IMAGES)
    : path.resolve(process.cwd(), UPLOAD_DIR_SPREADSHEETS);
  
  // Resolve storedPath from process.cwd() since it's stored relative to cwd
  // storedPath format: "uploads/images/{userFolder}/filename" or "uploads/spreadsheets/{userFolder}/filename"
  const resolvedPath = path.resolve(process.cwd(), attachment.storedPath);
  
  // Validate the resolved path is within the correct base directory
  const normalizedBase = path.normalize(baseDir);
  const normalizedPath = path.normalize(resolvedPath);
  
  // Check that the path is within the base directory
  if (!normalizedPath.startsWith(normalizedBase + path.sep) && normalizedPath !== normalizedBase) {
    throw new ForbiddenError("Path traversal detected: Invalid file path");
  }
  
  // Check if file exists
  if (!fs.existsSync(normalizedPath)) {
    throw new Error("File does not exist");
  }
  
  const filePath = normalizedPath;

  res.setHeader("Content-Type", attachment.mimeType);
  res.setHeader("Content-Disposition", `inline; filename="${attachment.filename}"`);
  res.sendFile(filePath);
}));

export default router;

