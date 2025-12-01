/**
 * Migration script to move an image file to user-specific directory structure
 * 
 * Usage: npx ts-node migrate-image.ts
 */

import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";
import { sanitizeUserNameForPath } from "./src/utils/constants";
import { UPLOAD_DIR_IMAGES } from "./src/utils/constants";

const prisma = new PrismaClient();

async function migrateImage() {
  // Try both .jpg and .jpeg extensions
  const fileBaseName = "1764595631425-976735242-89dd9a94-484e-404a-a737-933808a959f5";
  const userName = "Abaya & fragrances (Elisha Esahak)";
  
  try {
    console.log(`Starting migration for file: ${fileBaseName}`);
    console.log(`User: ${userName}`);
    
    // Find the attachment in the database by partial match (works with .jpg or .jpeg)
    const attachment = await prisma.attachment.findFirst({
      where: {
        OR: [
          { filename: { contains: fileBaseName } },
          { storedPath: { contains: fileBaseName } }
        ]
      },
      include: {
        session: {
          include: {
            project: {
              include: {
                company: {
                  include: {
                    user: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!attachment) {
      throw new Error(`No attachment found in database matching: ${fileBaseName}`);
    }

    console.log(`Found attachment: ${attachment.id}`);
    console.log(`Current storedPath: ${attachment.storedPath}`);
    console.log(`Current filename: ${attachment.filename}`);
    
    await migrateAttachment(attachment, userName);
    
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

async function migrateAttachment(attachment: any, providedUserName: string) {
  // Get user name from database or use provided one
  const dbUserName = attachment.session?.project?.company?.user?.name;
  const userName = dbUserName || providedUserName;
  
  console.log(`Using user name: ${userName}`);
  
  // Sanitize user name for folder path
  const userFolder = sanitizeUserNameForPath(userName);
  console.log(`Sanitized folder name: ${userFolder}`);
  
  // Determine old and new paths
  const oldPath = attachment.storedPath;
  const oldAbsolutePath = path.isAbsolute(oldPath)
    ? oldPath
    : path.resolve(process.cwd(), oldPath);
  
  // Get the actual filename from the stored path or attachment
  const fileName = path.basename(oldPath) || attachment.filename;
  console.log(`File name: ${fileName}`);
  
  // Check if old file exists
  if (!fs.existsSync(oldAbsolutePath)) {
    // Try alternative locations
    const fileBaseName = "1764595631425-976735242-89dd9a94-484e-404a-a737-933808a959f5";
    const altPaths = [
      path.resolve(process.cwd(), "uploads/images", `${fileBaseName}.jpg`),
      path.resolve(process.cwd(), "uploads/images", `${fileBaseName}.jpeg`),
      path.resolve(process.cwd(), "uploads/images", fileName),
      path.resolve(process.cwd(), "uploads/images", oldPath),
      path.resolve(process.cwd(), oldPath),
    ];
    
    let found = false;
    for (const altPath of altPaths) {
      if (fs.existsSync(altPath)) {
        console.log(`Found file at alternative location: ${altPath}`);
        await moveFile(altPath, userFolder, path.basename(altPath), attachment);
        found = true;
        break;
      }
    }
    
    if (!found) {
      throw new Error(`File not found. Tried:\n  - ${oldAbsolutePath}\n  - ${altPaths.join("\n  - ")}`);
    }
  } else {
    await moveFile(oldAbsolutePath, userFolder, fileName, attachment);
  }
}

async function moveFile(oldAbsolutePath: string, userFolder: string, fileName: string, attachment: any) {
  // Create new directory structure
  const newDir = path.resolve(process.cwd(), UPLOAD_DIR_IMAGES, userFolder);
  if (!fs.existsSync(newDir)) {
    fs.mkdirSync(newDir, { recursive: true });
    console.log(`Created directory: ${newDir}`);
  }
  
  // New file path
  const newAbsolutePath = path.join(newDir, fileName);
  const newRelativePath = path.relative(process.cwd(), newAbsolutePath);
  
  // Move the file
  if (fs.existsSync(newAbsolutePath)) {
    console.log(`Warning: Target file already exists: ${newAbsolutePath}`);
    console.log("Skipping file move, but updating database...");
  } else {
    fs.renameSync(oldAbsolutePath, newAbsolutePath);
    console.log(`Moved file from ${oldAbsolutePath} to ${newAbsolutePath}`);
  }
  
  // Update database
  await prisma.attachment.update({
    where: { id: attachment.id },
    data: {
      storedPath: newRelativePath.replace(/\\/g, "/") // Normalize path separators
    }
  });
  
  console.log(`Updated database record for attachment ${attachment.id}`);
  console.log(`New storedPath: ${newRelativePath.replace(/\\/g, "/")}`);
  console.log("Migration completed successfully!");
}

// Run the migration
migrateImage()
  .then(() => {
    console.log("Migration script completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Migration script failed:", error);
    process.exit(1);
  });
