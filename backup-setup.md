# Database Backup Setup

This document explains how to backup the VSol Analyst database to OneDrive.

## Manual Backup

To create a backup manually, run:

```bash
npm run backup
```

This will:
- Copy the database to your OneDrive Documents folder
- Create a timestamped backup file (e.g., `dev-2025-11-07_14-30-00.db`)
- Keep the 10 most recent backups (older ones are automatically deleted)

Default backup location: `%USERPROFILE%\OneDrive\Documents\vsol-analyst-backups\`

## Custom Backup Location

To use a different backup location, set the `BACKUP_PATH` environment variable in your `.env` file:

```env
BACKUP_PATH=C:\custom\backup\path
```

## Scheduled Automatic Backups

### Option 1: Windows Task Scheduler (Recommended)

1. Open Task Scheduler (search for "Task Scheduler" in Windows)

2. Click "Create Basic Task" in the right panel

3. Configure the task:
   - **Name**: VSol Database Backup
   - **Description**: Backup VSol Analyst database to OneDrive
   - **Trigger**: Daily (or your preferred schedule)
   - **Time**: Choose a time when the application is not heavily used
   - **Action**: Start a program
   - **Program/script**: Browse to `C:\git\vsol-analyst\backup.bat` (adjust path to match your installation)
   - **Start in**: Leave empty (the batch file handles this)

4. Click Finish

Alternatively, you can configure it manually:
   - **Program/script**: `C:\Program Files\nodejs\node.exe`
   - **Add arguments**: `node_modules\.bin\tsx src\backup\database-backup.ts`
   - **Start in**: Your project directory (e.g., `C:\git\vsol-analyst`)

### Option 2: Run at Application Startup

To backup when starting the server, modify `src/server.ts`:

```typescript
import { backupDatabase } from './backup/database-backup';

// Add after imports
backupDatabase().catch(err => console.error('Startup backup failed:', err));
```

### Option 3: Scheduled NPM Package

Install a task scheduler for Node.js:

```bash
npm install node-cron
```

Then create a scheduled task in your application code.

## Backup Configuration

The backup script accepts these configuration options:

- **keepBackups**: Number of backups to retain (default: 10)
- **sourcePath**: Path to database file (default: `./prisma/dev.db`)
- **targetDir**: Backup destination directory

## Restoring from Backup

To restore the database from a backup:

1. Stop the application
2. Navigate to the backup directory
3. Copy the desired backup file to `C:\git\vsol-analyst\prisma\dev.db`
4. Restart the application

Example:

```bash
copy "%USERPROFILE%\OneDrive\Documents\vsol-analyst-backups\dev-2025-11-07_14-30-00.db" "C:\git\vsol-analyst\prisma\dev.db"
```

## Testing the Backup

Test the backup script:

```bash
npm run backup
```

Check the OneDrive folder to verify the backup was created successfully.

