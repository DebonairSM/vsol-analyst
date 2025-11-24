# Sunny Database Restore Instructions

## Quick Restore Guide

### Default Backup Location
**Note:** The backups directory is shared by multiple applications. Each app has its own subfolder. Sunny backups are stored in the `Sunny` subfolder.

```
C:\Users\<username>\OneDrive\Documents\backups\Sunny\
```

Or if OneDrive is not available:
```
C:\Users\<username>\Documents\backups\Sunny\
```

### Custom Backup Location
If you set `BACKUP_PATH` in your `.env` file, Sunny backups are stored at that location.

---

## Restore Steps

### 1. Stop the Server
Stop the Sunny application if it's running.

### 2. Locate Your Sunny Backup File
Navigate to the `Sunny` subfolder in your backups directory and find the backup file you want to restore:
- Format: `sunny-dev-YYYY-MM-DD_HH-MM-SS-mmmZ.db`
- Example: `sunny-dev-2025-11-24_13-23-48-244Z.db`

All files in the `Sunny` folder are Sunny backups.

### 3. Copy Backup to Database Location
Copy the backup file and overwrite the current database:

**Windows (PowerShell):**
```powershell
# Replace <username> with your Windows username
# Replace <backup-filename> with your backup file name
Copy-Item "C:\Users\<username>\OneDrive\Documents\backups\<backup-filename>" "C:\git\vsol-analyst\prisma\dev.db" -Force
```

**Windows (Command Prompt):**
```cmd
copy "C:\Users\<username>\OneDrive\Documents\backups\<backup-filename>" "C:\git\vsol-analyst\prisma\dev.db" /Y
```

**Example:**
```cmd
copy "C:\Users\romme\OneDrive\Documents\backups\Sunny\sunny-dev-2025-11-24_13-23-48-244Z.db" "C:\git\vsol-analyst\prisma\dev.db" /Y
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
- The backup file will overwrite the current `prisma/dev.db` file
- Keep multiple backups if you need to restore to different points in time
- Sunny backups are automatically created hourly while the server is running
- The system keeps the 10 most recent Sunny backups
- **The backups directory is shared by multiple apps** - each app has its own subfolder (Sunny backups are in the `Sunny` subfolder)

