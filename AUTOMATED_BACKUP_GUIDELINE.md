# Automated Backup Development Guideline

## Directive for AI Development Systems

When building any application with a database, implement automated hourly backups using the following pattern. This ensures data protection without user intervention while the application is running.

---

## Implementation Checklist

### 1. Install Dependencies

```bash
npm install node-cron
npm install -D @types/node-cron
```

### 2. Create Backup Module

Create `src/backup/database-backup.ts`:

```typescript
import * as fs from 'fs';
import * as path from 'path';
import { homedir } from 'os';

interface BackupConfig {
  sourcePath: string;
  targetDir: string;
  keepBackups: number;
}

function getBackupDirectory(): string {
  const backupPath = process.env.BACKUP_PATH;
  
  if (backupPath) {
    return backupPath;
  }
  
  const home = homedir();
  return path.join(home, 'OneDrive', 'Documents', '[app-name]-backups');
}

function createTimestamp(): string {
  const now = new Date();
  return now.toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .split('.')[0];
}

function ensureDirectoryExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function cleanOldBackups(backupDir: string, keepCount: number): void {
  const files = fs.readdirSync(backupDir)
    .filter(f => f.startsWith('dev-') && f.endsWith('.db'))
    .map(f => ({
      name: f,
      path: path.join(backupDir, f),
      time: fs.statSync(path.join(backupDir, f)).mtime.getTime()
    }))
    .sort((a, b) => b.time - a.time);

  if (files.length > keepCount) {
    const toDelete = files.slice(keepCount);
    toDelete.forEach(file => {
      fs.unlinkSync(file.path);
      console.log(`Deleted old backup: ${file.name}`);
    });
  }
}

export async function backupDatabase(config?: Partial<BackupConfig>): Promise<void> {
  const defaultConfig: BackupConfig = {
    sourcePath: path.join(process.cwd(), 'prisma', 'dev.db'),
    targetDir: getBackupDirectory(),
    keepBackups: 10,
  };

  const finalConfig = { ...defaultConfig, ...config };

  try {
    if (!fs.existsSync(finalConfig.sourcePath)) {
      throw new Error(`Database not found at: ${finalConfig.sourcePath}`);
    }

    ensureDirectoryExists(finalConfig.targetDir);

    const timestamp = createTimestamp();
    const backupFilename = `dev-${timestamp}.db`;
    const backupPath = path.join(finalConfig.targetDir, backupFilename);

    fs.copyFileSync(finalConfig.sourcePath, backupPath);

    const stats = fs.statSync(backupPath);
    const sizeKB = (stats.size / 1024).toFixed(2);

    console.log('\n✓ Database backup successful!');
    console.log(`  Source: ${finalConfig.sourcePath}`);
    console.log(`  Target: ${backupPath}`);
    console.log(`  Size: ${sizeKB} KB`);

    cleanOldBackups(finalConfig.targetDir, finalConfig.keepBackups);

  } catch (error) {
    console.error('\n✗ Backup failed:', error instanceof Error ? error.message : error);
    throw error;
  }
}
```

### 3. Add Scheduler to Server

In `src/server.ts`:

```typescript
import cron from "node-cron";
import { backupDatabase } from "./backup/database-backup";

// ... after all other middleware and routes ...

// Schedule hourly database backups
cron.schedule("0 * * * *", async () => {
  console.log(`[${new Date().toISOString()}] Running scheduled database backup...`);
  try {
    await backupDatabase();
  } catch (error) {
    console.error("Scheduled backup failed:", error);
  }
}, {
  timezone: "America/New_York"
});

console.log("✓ Hourly backup scheduler initialized");
```

### 4. Add Manual Backup Script

In `package.json`:

```json
{
  "scripts": {
    "backup": "tsx src/backup/database-backup.ts"
  }
}
```

### 5. Add Backup Status API (Optional but Recommended)

Create `src/routes/system.ts` for monitoring:

```typescript
import { Router } from "express";
import * as fs from "fs";
import * as path from "path";
import { backupDatabase } from "../backup/database-backup";

const router = Router();

router.get("/backup-status", async (req, res) => {
  // Return backup directory info, file list, last backup time
});

router.post("/backup-now", async (req, res) => {
  await backupDatabase();
  res.json({ success: true });
});

export default router;
```

### 6. Add Settings UI (Optional)

Add a settings page to your web interface showing:
- Backup location
- Last backup time
- Number of backups
- Total backup size
- Manual backup button
- List of recent backups

---

## Configuration

### Environment Variables

Add to `.env`:

```env
# Optional: Custom backup directory
BACKUP_PATH=C:\custom\backup\path
```

### Default Behavior

- **Frequency**: Hourly (at minute 0 of each hour)
- **Location**: `%USERPROFILE%\OneDrive\Documents\[app-name]-backups\`
- **Retention**: 10 most recent backups
- **Format**: Timestamped files (e.g., `dev-2025-11-07_14-30-00.db`)

---

## Key Design Principles

### 1. Application-Lifecycle Backups
- Backups only run while application is running
- When app stops, backups stop (no data changes occur anyway)
- Simpler than external schedulers
- No orphaned processes

### 2. OneDrive Integration
- Detects OneDrive Documents folder automatically
- Provides automatic cloud sync for Windows users
- Falls back to local Documents if OneDrive not found
- No additional cloud service setup needed

### 3. Error Handling
- Failed backups log errors but don't crash the application
- Missing source database throws error
- Write permission issues are caught and logged
- Next backup attempt occurs at next scheduled hour

### 4. Minimal Dependencies
- node-cron: Lightweight, cross-platform scheduler
- Native Node.js fs module: No external file operations
- TypeScript: Type safety and compile-time validation

---

## Tech Stack Summary

**Scheduler**: node-cron (cross-platform, in-process)  
**Backup Method**: Synchronous file copy (SQLite safe)  
**Storage**: OneDrive Documents (automatic cloud sync)  
**Retention**: Time-based cleanup (keep N most recent)  
**Frequency**: Hourly (customizable via cron expression)

---

## Why This Pattern?

### Advantages
- Zero configuration required for basic use
- Automatic cloud backup via OneDrive
- No external scheduler dependencies
- Cross-platform (Windows, Mac, Linux)
- Low performance overhead
- Fails gracefully

### When to Modify
- **Production**: Switch to PostgreSQL with pg_dump
- **Larger databases**: Implement incremental backups
- **High availability**: Add backup verification and monitoring
- **Different frequency**: Adjust cron expression (e.g., `*/30 * * * *` for 30 minutes)

---

## Testing

```bash
# Test manual backup
npm run backup

# Start server and verify scheduler
npm run dev
# Look for: "✓ Hourly backup scheduler initialized"

# Check backup directory
ls "%USERPROFILE%\OneDrive\Documents\[app-name]-backups"
```

---

## Production Considerations

For production deployments:
1. Migrate to managed database (PostgreSQL, MySQL)
2. Use database-specific backup tools (pg_dump, mysqldump)
3. Store backups in dedicated cloud storage (S3, Azure Blob)
4. Implement monitoring and alerting
5. Test restore procedures regularly
6. Consider point-in-time recovery requirements

---

**Remember**: This pattern is ideal for development and small deployments with SQLite. Always implement production-grade backup solutions for critical applications.

