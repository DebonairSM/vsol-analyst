# Sunny Database Restore Instructions

## Quick Restore Guide

### Backup Location
This folder contains backups for the **Sunny** application. The parent `backups` directory is shared by multiple applications, each with their own subfolder.

```
C:\Users\romme\OneDrive\Documents\backups\Sunny
```

---

## Restore Steps

### 1. Stop the Server
Stop the Sunny application if it's running.

### 2. Locate Your Sunny Backup File
Navigate to this backup directory and find the backup file you want to restore:
- Format: `sunny-dev-YYYY-MM-DD_HH-MM-SS-mmmZ.db`
- Example: `sunny-dev-2025-11-24_13-23-48-244Z.db`

All files in this folder are Sunny backups.

### 3. Copy Backup to Database Location
Copy the backup file and overwrite the current database:

**Windows (PowerShell):**
```powershell
# Replace <backup-filename> with your backup file name
Copy-Item "C:/Users/romme/OneDrive/Documents/backups/Sunny/<backup-filename>" "C:/git/vsol-analyst/prisma/dev.db" -Force
```

**Windows (Command Prompt):**
```cmd
copy "C:\\Users\\romme\\OneDrive\\Documents\\backups\\Sunny\<backup-filename>" "C:\\git\\vsol-analyst\\prisma\\dev.db" /Y
```

**Example:**
```cmd
copy "C:\\Users\\romme\\OneDrive\\Documents\\backups\\Sunny\sunny-dev-2025-11-24_13-23-48-244Z.db" "C:\\git\\vsol-analyst\\prisma\\dev.db" /Y
```

### 4. Restart the Server
Start the Sunny application again:
```bash
npm run dev
```

---

## Verify Restore

After restoring, verify your data:
1. Open the application in your browser
2. Check that your projects, user stories, and data are present
3. Or use Prisma Studio to inspect the database:
   ```bash
   npx prisma studio
   ```

---

## Notes

- Always stop the server before restoring to prevent database corruption
- The backup file will overwrite the current database file at: `C:\git\vsol-analyst\prisma\dev.db`
- Keep multiple backups if you need to restore to different points in time
- Sunny backups are automatically created hourly while the server is running
- The system keeps the 10 most recent Sunny backups
- This folder is dedicated to Sunny backups only
