import * as fs from 'fs';
import * as path from 'path';
import { homedir } from 'os';

interface BackupConfig {
  sourcePath: string;
  targetDir: string;
  keepBackups: number;
}

export function getBackupDirectory(): string {
  // Use environment variable if set, otherwise use default OneDrive Documents path
  const backupPath = process.env.BACKUP_PATH;
  
  if (backupPath) {
    return backupPath;
  }
  
  // Default to OneDrive Documents folder with app-specific subfolder
  const home = homedir();
  const oneDrivePath = path.join(home, 'OneDrive', 'Documents');
  
  // Check if OneDrive Documents exists, fallback to regular Documents if not
  if (!fs.existsSync(oneDrivePath)) {
    const documentsPath = path.join(home, 'Documents');
    console.log(`OneDrive Documents not found, using: ${documentsPath}`);
    return path.join(documentsPath, 'backups', 'Sunny');
  }
  
  return path.join(oneDrivePath, 'backups', 'Sunny');
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
    try {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`Created backup directory: ${dirPath}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to create backup directory "${dirPath}": ${errorMessage}`);
    }
  }
  
  // Verify we can write to the directory
  try {
    const testFile = path.join(dirPath, '.write-test');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Backup directory "${dirPath}" is not writable: ${errorMessage}`);
  }
}

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

function cleanOldBackups(backupDir: string, keepCount: number): void {
  const files = fs.readdirSync(backupDir)
    .filter(f => (f.startsWith('sunny-dev-') || f.startsWith('dev-')) && f.endsWith('.db'))
    .map(f => {
      const filePath = path.join(backupDir, f);
      const stats = fs.statSync(filePath);
      // Try to parse timestamp from filename, fallback to file mtime
      const filenameTimestamp = parseTimestampFromFilename(f);
      return {
        name: f,
        path: filePath,
        time: filenameTimestamp ? filenameTimestamp.getTime() : stats.mtime.getTime()
      };
    })
    .sort((a, b) => b.time - a.time);

  if (files.length > keepCount) {
    const toDelete = files.slice(keepCount);
    toDelete.forEach(file => {
      fs.unlinkSync(file.path);
      console.log(`Deleted old backup: ${file.name}`);
    });
  }
}

function createRestoreInstructions(backupDir: string, sourcePath: string): void {
  // Escape backslashes for use in code blocks
  const backupDirEscaped = backupDir.replace(/\\/g, '\\\\');
  const sourcePathEscaped = sourcePath.replace(/\\/g, '\\\\');
  const backupDirForward = backupDir.replace(/\\/g, '/');
  const sourcePathForward = sourcePath.replace(/\\/g, '/');
  
  const restoreInstructions = `# Sunny Database Restore Instructions

## Quick Restore Guide

### Backup Location
This folder contains backups for the **Sunny** application. The parent \`backups\` directory is shared by multiple applications, each with their own subfolder.

\`\`\`
${backupDir}
\`\`\`

---

## Restore Steps

### 1. Stop the Server
Stop the Sunny application if it's running.

### 2. Locate Your Sunny Backup File
Navigate to this backup directory and find the backup file you want to restore:
- Format: \`sunny-dev-YYYY-MM-DD_HH-MM-SS-mmmZ.db\`
- Example: \`sunny-dev-2025-11-24_13-23-48-244Z.db\`

All files in this folder are Sunny backups.

### 3. Copy Backup to Database Location
Copy the backup file and overwrite the current database:

**Windows (PowerShell):**
\`\`\`powershell
# Replace <backup-filename> with your backup file name
Copy-Item "${backupDirForward}/<backup-filename>" "${sourcePathForward}" -Force
\`\`\`

**Windows (Command Prompt):**
\`\`\`cmd
copy "${backupDirEscaped}\\<backup-filename>" "${sourcePathEscaped}" /Y
\`\`\`

**Example:**
\`\`\`cmd
copy "${backupDirEscaped}\\sunny-dev-2025-11-24_13-23-48-244Z.db" "${sourcePathEscaped}" /Y
\`\`\`

### 4. Restart the Server
Start the Sunny application again:
\`\`\`bash
npm run dev
\`\`\`

---

## Verify Restore

After restoring, verify your data:
1. Open the application in your browser
2. Check that your projects, user stories, and data are present
3. Or use Prisma Studio to inspect the database:
   \`\`\`bash
   npx prisma studio
   \`\`\`

---

## Notes

- Always stop the server before restoring to prevent database corruption
- The backup file will overwrite the current database file at: \`${sourcePath}\`
- Keep multiple backups if you need to restore to different points in time
- Sunny backups are automatically created hourly while the server is running
- The system keeps the 10 most recent Sunny backups
- This folder is dedicated to Sunny backups only
`;

  const restorePath = path.join(backupDir, 'Sunny-RESTORE.md');
  try {
    fs.writeFileSync(restorePath, restoreInstructions, 'utf8');
  } catch (error) {
    // Don't fail backup if we can't write instructions file
    console.warn(`Warning: Could not write restore instructions: ${error instanceof Error ? error.message : error}`);
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
    // Check if source database exists
    if (!fs.existsSync(finalConfig.sourcePath)) {
      throw new Error(`Database not found at: ${finalConfig.sourcePath}`);
    }

    // Ensure backup directory exists
    ensureDirectoryExists(finalConfig.targetDir);

    // Create backup filename with timestamp
    const timestamp = createTimestamp();
    const backupFilename = `sunny-dev-${timestamp}.db`;
    const backupPath = path.join(finalConfig.targetDir, backupFilename);

    // Copy database file
    fs.copyFileSync(finalConfig.sourcePath, backupPath);

    const stats = fs.statSync(backupPath);
    const sizeKB = (stats.size / 1024).toFixed(2);

    console.log('\n✓ Database backup successful!');
    console.log(`  Source: ${finalConfig.sourcePath}`);
    console.log(`  Target: ${backupPath}`);
    console.log(`  Size: ${sizeKB} KB`);
    console.log(`  Time: ${new Date().toLocaleString()}`);

    // Clean up old backups
    cleanOldBackups(finalConfig.targetDir, finalConfig.keepBackups);

    // Create/update restore instructions in backup directory
    createRestoreInstructions(finalConfig.targetDir, finalConfig.sourcePath);

  } catch (error) {
    console.error('\n✗ Backup failed:', error instanceof Error ? error.message : error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  backupDatabase()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

