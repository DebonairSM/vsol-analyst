# Generic Backup System Implementation Template

Use this template to implement automated database backups in any project with the following features:
- Automated hourly backups while application is running
- Shared backups directory with app-specific subfolders
- App-specific restore instructions automatically generated in backup folder
- Timestamp-based file naming for accurate sorting
- Automatic retention of N most recent backups
- OneDrive integration with fallback to regular Documents folder
- Comprehensive error handling
- Easy restore process

---

## Implementation Requirements

### 1. Backup File Naming Convention
- Format: `{app-name}-{env}-{timestamp}.{extension}`
- Example: `myapp-dev-2025-11-24_13-23-48-244Z.db`
- Use app name prefix to identify backups in shared directory
- Include environment identifier (dev, prod, staging)
- Use ISO timestamp format: `YYYY-MM-DD_HH-MM-SS-mmmZ`

### 2. Backup Directory Structure
- Default location: `%USERPROFILE%\OneDrive\Documents\backups\{AppName}\` (shared parent, app-specific subfolder)
- Fallback: `%USERPROFILE%\Documents\backups\{AppName}\` if OneDrive not available
- Each app gets its own subfolder in the shared `backups` directory
- Allow override via `BACKUP_PATH` environment variable (should point to app-specific folder)
- Directory should be created automatically if it doesn't exist
- Example structure:
  ```
  backups/
    ├── AppName1/
    │   ├── appname1-dev-2025-11-24_13-23-48-244Z.db
    │   └── AppName1-RESTORE.md
    ├── AppName2/
    │   ├── appname2-dev-2025-11-24_14-00-00-123Z.db
    │   └── AppName2-RESTORE.md
    └── Sunny/
        ├── sunny-dev-2025-11-24_14-16-54-229Z.db
        └── Sunny-RESTORE.md
  ```

### 3. Backup Scheduling
- Run backups hourly (at minute 0 of each hour) while app is running
- Use application lifecycle - backups stop when app stops
- No external cron jobs or schedulers required
- Use node-cron or similar library for scheduling

### 4. Retention Policy
- Keep N most recent backups (default: 10)
- Delete older backups automatically after each successful backup
- Sort backups by timestamp from filename (not file system mtime) for accuracy
- Support both old and new naming formats during transition

### 5. Error Handling
- Verify source database exists before backup
- Verify backup directory is writable
- Log errors but don't crash application
- Provide clear error messages for troubleshooting
- Test directory write permissions before attempting backup

### 6. Code Structure

#### Backup Module (`src/backup/database-backup.ts`)
```typescript
// Key functions:
- getBackupDirectory(): string
  // Returns app-specific backup directory path: backups/{AppName}/
  // Includes OneDrive fallback
  // Respects BACKUP_PATH environment variable
  
- parseTimestampFromFilename(filename: string): Date | null
  // Parses timestamp from backup filename
  // Used for accurate sorting regardless of file system mtime
  
- ensureDirectoryExists(dirPath: string): void
  // Creates directory if needed
  // Verifies write permissions
  
- cleanOldBackups(backupDir: string, keepCount: number): void
  // Sorts backups by filename timestamp
  // Deletes backups beyond retention count
  
- createRestoreInstructions(backupDir: string, sourcePath: string): void
  // Creates app-specific restore instructions file: {AppName}-RESTORE.md
  // Includes actual paths (not placeholders)
  // Written to backup directory for easy access
  
- backupDatabase(config?: Partial<BackupConfig>): Promise<void>
  // Main backup function
  // Creates timestamped backup file
  // Cleans up old backups
  // Creates/updates restore instructions file
```

#### System Routes (`src/routes/system.ts`)
```typescript
// Endpoints:
- GET /api/system/backup-status
  // Returns backup location, count, last backup, list of recent backups
  
- POST /api/system/backup-now
  // Triggers manual backup
  // Returns success/error with detailed message
```

### 7. Frontend Integration
- Display backup location, last backup time, total backups
- Show list of recent backups (up to 10)
- Manual backup button
- Refresh button to update status
- Display actual error messages from server (not generic "failed")

### 8. Restore Documentation
Automatically create `{AppName}-RESTORE.md` in the backup directory with:
- Actual backup directory path (not placeholders)
- Actual database source path (not placeholders)
- Clear note that parent backups directory is shared by multiple apps
- Step-by-step restore commands for your OS with real paths
- Verification steps after restore
- Safety warnings (stop server before restore)
- Note that this folder is dedicated to this app's backups

The restore instructions file should be created/updated automatically during each backup.

---

## Implementation Checklist

- [ ] Create backup module with directory detection (OneDrive fallback)
- [ ] Set up app-specific subfolder in shared backups directory (e.g., `backups/{AppName}/`)
- [ ] Implement timestamp parsing from filename for accurate sorting
- [ ] Add automatic directory creation with permission checks
- [ ] Implement retention policy with filename-based sorting
- [ ] Add function to create/update app-specific restore instructions file (`{AppName}-RESTORE.md`)
- [ ] Ensure restore instructions include actual paths (not placeholders)
- [ ] Add hourly scheduled backups using node-cron
- [ ] Create backup status API endpoint
- [ ] Create manual backup trigger endpoint
- [ ] Add error handling with clear messages
- [ ] Update frontend to show backup status and allow manual backups
- [ ] Test backup creation, retention, and restore process
- [ ] Verify restore instructions file is created in backup folder
- [ ] Verify error handling for missing directories, permissions, etc.

---

## Key Design Principles

1. **Application-Lifecycle Backups**: Backups only run while app is running. When app stops, backups stop.

2. **Shared Directory with App-Specific Subfolders**: Each app gets its own subfolder in the shared `backups` directory. This keeps backups organized and prevents conflicts.

3. **Self-Documenting Backups**: Each app's backup folder contains its own restore instructions file (`{AppName}-RESTORE.md`) with actual paths, making restore easy.

4. **Filename-Based Sorting**: Parse timestamps from filenames for accurate sorting, don't rely solely on file system mtime.

5. **Graceful Degradation**: Fallback to regular Documents folder if OneDrive not available.

6. **Error Resilience**: Failed backups log errors but don't crash the application.

7. **User-Friendly**: Provide clear status information and easy restore process with instructions right in the backup folder.

---

## Environment Variables

```env
# Optional: Custom backup directory
BACKUP_PATH=C:\custom\backup\path
```

---

## Package.json Script

```json
{
  "scripts": {
    "backup": "tsx src/backup/database-backup.ts"
  }
}
```

---

## Example Usage

Replace placeholders:
- `{AppName}` - Your application name in PascalCase for folder/restore file (e.g., "Sunny", "MyApp")
- `{app-name}` - Your application name in lowercase for file prefix (e.g., "sunny", "myapp")
- `{env}` - Environment identifier (e.g., "dev", "prod")
- `{extension}` - Database file extension (e.g., "db", "sqlite")

### Example for "MyApp" in development:

**Directory Structure:**
```
C:\Users\<user>\OneDrive\Documents\backups\MyApp\
```

**Backup Files:**
- `myapp-dev-2025-11-24_13-23-48-244Z.db`
- `myapp-dev-2025-11-24_14-00-00-123Z.db`
- `MyApp-RESTORE.md` (auto-generated with restore instructions)

**Implementation:**
1. Set `getBackupDirectory()` to return: `backups/MyApp/`
2. Backup files use prefix: `myapp-dev-`
3. Restore instructions file: `MyApp-RESTORE.md`
4. All files go in the `MyApp` subfolder

**Code Example:**
```typescript
// In getBackupDirectory():
return path.join(oneDrivePath, 'backups', 'MyApp');

// In backupDatabase():
const backupFilename = `myapp-dev-${timestamp}.db`;

// In createRestoreInstructions():
const restorePath = path.join(backupDir, 'MyApp-RESTORE.md');
```

