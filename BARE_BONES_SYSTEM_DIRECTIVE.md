# Bare Bones System Directive: Automated Backups

## Add This to Your AI Development System

When building any application with a database, always implement automated hourly backups with the following requirements:

---

## Mandatory Implementation

### 1. Dependencies
```bash
npm install node-cron
npm install -D @types/node-cron
```

### 2. Backup Module Structure

Create `src/backup/database-backup.ts` with:
- Backup function that copies database to timestamped files
- Automatic directory creation
- Cleanup of old backups (keep 10 most recent)
- OneDrive Documents folder integration: `%USERPROFILE%\OneDrive\Documents\[app-name]-backups\`
- Custom path support via `BACKUP_PATH` environment variable

### 3. Scheduler Integration

Add to main server file:
```typescript
import cron from "node-cron";
import { backupDatabase } from "./backup/database-backup";

cron.schedule("0 * * * *", async () => {
  console.log(`[${new Date().toISOString()}] Running scheduled backup...`);
  try {
    await backupDatabase();
  } catch (error) {
    console.error("Scheduled backup failed:", error);
  }
});

console.log("✓ Hourly backup scheduler initialized");
```

### 4. NPM Script
```json
{
  "scripts": {
    "backup": "tsx src/backup/database-backup.ts"
  }
}
```

### 5. Settings Page (Optional but Recommended)

Add system settings page with:
- Backup status API endpoints (`/api/system/backup-status`, `/api/system/backup-now`)
- UI showing: backup location, count, size, last backup time
- Manual backup trigger button
- List of recent backups

---

## Configuration Defaults

- **Frequency**: Hourly (runs at minute 0)
- **Location**: OneDrive Documents folder
- **Retention**: 10 most recent backups
- **Method**: File copy (safe for SQLite)
- **Runs**: Only while application is running

---

## Key Principle

**Application-lifecycle backups**: When the app runs, backups run. When the app stops, backups stop. Simple, reliable, no external dependencies.

---

## Tech Stack

- **Scheduler**: node-cron
- **Storage**: OneDrive Documents (automatic cloud sync)
- **Retention**: Time-based (10 most recent)
- **Error handling**: Logs errors, doesn't crash app

---

## End Result

Users get automatic hourly backups synced to their OneDrive with zero configuration, plus a settings page to monitor and trigger manual backups.

