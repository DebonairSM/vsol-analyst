import * as fs from 'fs';
import * as path from 'path';
import { homedir } from 'os';

interface BackupConfig {
  sourcePath: string;
  targetDir: string;
  keepBackups: number;
}

function getBackupDirectory(): string {
  // Use environment variable if set, otherwise use default OneDrive Documents path
  const backupPath = process.env.BACKUP_PATH;
  
  if (backupPath) {
    return backupPath;
  }
  
  // Default to OneDrive Documents folder
  const home = homedir();
  return path.join(home, 'OneDrive', 'Documents', 'vsol-analyst-backups');
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
    console.log(`Created backup directory: ${dirPath}`);
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
    // Check if source database exists
    if (!fs.existsSync(finalConfig.sourcePath)) {
      throw new Error(`Database not found at: ${finalConfig.sourcePath}`);
    }

    // Ensure backup directory exists
    ensureDirectoryExists(finalConfig.targetDir);

    // Create backup filename with timestamp
    const timestamp = createTimestamp();
    const backupFilename = `dev-${timestamp}.db`;
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

