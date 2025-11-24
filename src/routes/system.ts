import { Router } from "express";
import * as fs from "fs";
import * as path from "path";
import { asyncHandler } from "../utils/async-handler";
import { backupDatabase, getBackupDirectory } from "../backup/database-backup";

const router = Router();

function parseTimestampFromFilename(filename: string): Date | null {
  // Extract timestamp from filename: sunny-dev-2025-11-24_13-23-48-244Z.db or dev-2025-11-24_13-00-00-037Z.db
  // Format: {prefix}-{year}-{month}-{day}_{hour}-{minute}-{second}-{milliseconds}Z.db
  const match = filename.match(/(?:sunny-)?dev-(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})-(\d+)Z\.db$/);
  if (match) {
    const [, year, month, day, hour, minute, second, milliseconds] = match;
    try {
      return new Date(
        parseInt(year),
        parseInt(month) - 1, // Month is 0-indexed
        parseInt(day),
        parseInt(hour),
        parseInt(minute),
        parseInt(second),
        parseInt(milliseconds)
      );
    } catch (e) {
      return null;
    }
  }
  return null;
}

function getBackupFiles(): Array<{ name: string; size: number; timestamp: Date }> {
  const backupDir = getBackupDirectory();
  
  if (!fs.existsSync(backupDir)) {
    return [];
  }

  return fs
    .readdirSync(backupDir)
    .filter((f) => (f.startsWith("sunny-dev-") || f.startsWith("dev-")) && f.endsWith(".db"))
    .map((f) => {
      const filePath = path.join(backupDir, f);
      const stats = fs.statSync(filePath);
      // Try to parse timestamp from filename, fallback to file mtime
      const filenameTimestamp = parseTimestampFromFilename(f);
      return {
        name: f,
        size: stats.size,
        timestamp: filenameTimestamp || stats.mtime,
      };
    })
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

// GET /api/system/backup-status
router.get(
  "/backup-status",
  asyncHandler(async (req, res) => {
    const backupDir = getBackupDirectory();
    const backups = getBackupFiles();

    const response = {
      backupEnabled: true,
      backupFrequency: "hourly",
      backupLocation: backupDir,
      backupLocationExists: fs.existsSync(backupDir),
      backupCount: backups.length,
      lastBackup: backups.length > 0 ? backups[0] : null,
      oldestBackup: backups.length > 0 ? backups[backups.length - 1] : null,
      totalBackupSize: backups.reduce((sum, b) => sum + b.size, 0),
      retentionPolicy: "10 most recent backups",
      backups: backups.slice(0, 10), // Return up to 10 most recent
      serverUptime: process.uptime(), // seconds
    };

    res.json(response);
  })
);

// POST /api/system/backup-now
router.post(
  "/backup-now",
  asyncHandler(async (req, res) => {
    try {
      await backupDatabase();
      
      // Get updated backup status
      const backups = getBackupFiles();
      const latest = backups.length > 0 ? backups[0] : null;

      res.json({
        success: true,
        message: "Backup created successfully",
        backup: latest,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Backup failed",
      });
    }
  })
);

export default router;

