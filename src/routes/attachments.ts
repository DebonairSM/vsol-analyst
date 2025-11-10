import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import path from "path";
import fs from "fs";
import { requireAuth } from "../auth/middleware";

const router = Router();
const prisma = new PrismaClient();

// Serve attachment files
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const user = req.user as any;
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
      return res.status(404).json({ error: "Attachment not found" });
    }

    // Verify user owns the project
    if (attachment.session.project.company.userId !== user.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Serve the file
    const filePath = path.resolve(attachment.storedPath);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found on disk" });
    }

    res.setHeader("Content-Type", attachment.mimeType);
    res.setHeader("Content-Disposition", `inline; filename="${attachment.filename}"`);
    res.sendFile(filePath);
  } catch (error) {
    console.error("Error serving attachment:", error);
    res.status(500).json({ error: "Failed to serve attachment" });
  }
});

export default router;

