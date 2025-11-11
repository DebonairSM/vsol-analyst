# Database Backup Setup

This document explains the backup strategy for the VSol Analyst database.

## Automated Backup

The application automatically backs up the database every hour while running. Backups are scheduled using node-cron and run at the top of each hour (e.g., 1:00, 2:00, 3:00).

- **Schedule**: Hourly (when application is running)
- **Location**: `%USERPROFILE%\OneDrive\Documents\vsol-analyst-backups\`
- **Format**: Timestamped files (e.g., `dev-2025-11-07_14-30-00.db`)
- **Retention**: 10 most recent backups (older ones are automatically deleted)

The backup scheduler is initialized when the server starts and runs in the background.

## Manual Backup

To create a backup manually at any time, run:

```bash
npm run backup
```

This will:
- Copy the database to your OneDrive Documents folder
- Create a timestamped backup file
- Keep the 10 most recent backups (older ones are automatically deleted)

Default backup location: `%USERPROFILE%\OneDrive\Documents\vsol-analyst-backups\`

## Custom Backup Location

To use a different backup location, set the `BACKUP_PATH` environment variable in your `.env` file:

```env
BACKUP_PATH=C:\custom\backup\path
```

## How It Works

The backup system is implemented in `src/server.ts` using node-cron:

```typescript
import cron from "node-cron";
import { backupDatabase } from "./backup/database-backup";

// Schedule hourly backups at the top of each hour
cron.schedule("0 * * * *", async () => {
  console.log(`[${new Date().toISOString()}] Running scheduled database backup...`);
  try {
    await backupDatabase();
  } catch (error) {
    console.error("Scheduled backup failed:", error);
  }
});
```

This approach ensures backups run automatically while the application is active. When the application is stopped, backups do not run.

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

