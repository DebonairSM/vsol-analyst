# Automated Hourly Backup Implementation Summary

## Overview

The VSol Analyst application now includes automated hourly database backups that run while the application is active. Backups are stored in the user's OneDrive Documents folder for automatic cloud synchronization.

## Technical Stack

### Core Dependencies

**node-cron** (v3.x)
- Lightweight task scheduler for Node.js
- Uses cron expression syntax for scheduling
- Runs in-process with the application
- Zero external dependencies

**TypeScript**
- Type-safe implementation
- Compile-time validation
- Integration with existing codebase

**File System (Node.js fs module)**
- Native file operations
- Cross-platform path handling
- Synchronous copy operations for reliability

## Implementation Details

### Scheduling Configuration

**Cron Expression**: `0 * * * *`
- Runs at minute 0 of every hour
- Examples: 1:00, 2:00, 3:00, etc.
- Only executes while application is running

**Timezone**: America/New_York
- Configurable in `src/server.ts`
- Adjust based on deployment location

### Backup Location Strategy

**Default Path**: `%USERPROFILE%\OneDrive\Documents\vsol-analyst-backups\`

**Path Resolution**:
```typescript
const home = homedir();
path.join(home, 'OneDrive', 'Documents', 'vsol-analyst-backups')
```

**Fallback**: If OneDrive is not detected, backups still go to the path (folder will be created)

**Custom Path**: Override via `BACKUP_PATH` environment variable in `.env`

### Backup Process

1. **Check Source**: Verify database file exists at `./prisma/dev.db`
2. **Create Directory**: Ensure backup directory exists (create if missing)
3. **Generate Timestamp**: ISO format converted to filesystem-safe string
4. **Copy File**: Synchronous copy for reliability (prevents partial backups)
5. **Log Results**: Console output with file size and timestamp
6. **Cleanup**: Delete backups older than the 10 most recent

### Retention Policy

**Keep**: 10 most recent backups
**Delete**: Older backups automatically removed after each successful backup
**Sorting**: By file modification time (newest first)

### Error Handling

**Failed Backups**:
- Logged to console with error details
- Do not crash the application
- Next backup attempt occurs at the next scheduled hour

**Missing Source**:
- Throws error if database file doesn't exist
- Error caught and logged by cron scheduler

**Write Permission Issues**:
- Error logged if backup directory cannot be created
- Error logged if file copy fails

## Design Decisions

### Why node-cron?

**Alternatives Considered**:
1. Windows Task Scheduler - External dependency, platform-specific
2. Systemd timers - Linux-only, not cross-platform
3. Cloud-based schedulers - Network dependency, complexity
4. Application startup backup - Only backs up once per launch

**node-cron Selected Because**:
- In-process (no external scheduler needed)
- Cross-platform (Windows, Mac, Linux)
- Simple cron expression syntax
- Lightweight (no heavy dependencies)
- Automatic with application lifecycle

### Why Hourly Backups?

**Balance Between**:
- Data protection (more frequent = less data loss)
- Disk space (more backups = more storage)
- Performance impact (minimal for SQLite copies)

**Hourly provides**:
- Maximum 1 hour of data loss in worst case
- 10 backups = 10 hours of recovery points
- Low performance overhead (backup takes milliseconds)

### Why OneDrive Integration?

**Automatic Cloud Backup**:
- Many Windows users have OneDrive enabled
- Backups automatically sync to cloud
- No additional cloud service configuration needed
- Works offline (files sync when connection restored)

**Fallback Strategy**:
- If OneDrive not detected, uses local Documents folder
- User can override with custom path
- Cross-platform path resolution

### Why Application-Lifecycle Backups?

**Run Only While App Running**:
- If app is stopped, no data changes occur
- No need to backup when idle
- Simpler than external scheduler
- No orphaned backup processes

**Trade-offs**:
- Requires application to be running
- Not suitable for apps that stop/start frequently
- Good fit for long-running development servers

## File Structure

```
src/
├── backup/
│   └── database-backup.ts    # Core backup logic
├── server.ts                 # Cron scheduler initialization
└── ...

docs/
└── backup-setup.md           # User documentation

backup.bat                    # Legacy manual backup script (still functional)
```

## Testing

**Manual Test**:
```bash
npm run backup
```

**Verify Scheduler**:
1. Start application: `npm run dev`
2. Check console output: "✓ Hourly backup scheduler initialized"
3. Wait for next hour boundary
4. Observe backup execution in logs
5. Check backup directory for new file

## Future Enhancements

**Potential Improvements**:
- Configurable backup frequency (env variable)
- Configurable retention count (env variable)
- Backup health checks (verify file integrity)
- Email notifications on backup failures
- Compression for older backups
- Incremental backups (SQLite journal mode)
- Cloud upload to S3/Azure Blob (in addition to OneDrive)

## Monitoring

**Success Indicators**:
- Console logs show successful backups hourly
- Backup directory contains timestamped files
- Files appear in OneDrive web interface (if sync enabled)

**Failure Indicators**:
- "Scheduled backup failed:" errors in console
- Missing hourly backup files
- Old backups not being cleaned up

## Production Considerations

**For Production Deployment**:
1. Consider migrating to PostgreSQL (better for production)
2. Implement PostgreSQL-specific backup strategy (pg_dump)
3. Add monitoring/alerting for backup failures
4. Store backups in dedicated cloud storage (S3, Azure Blob)
5. Implement point-in-time recovery
6. Test restore procedures regularly

**Current Implementation**:
- Suitable for development and small deployments
- SQLite backup via file copy is reliable
- OneDrive provides basic cloud protection
- Manual restore process is straightforward

## Dependencies Added

**Production**:
```json
"node-cron": "^3.0.3"
```

**Development**:
```json
"@types/node-cron": "^3.0.11"
```

## Configuration Summary

**Environment Variables**:
- `BACKUP_PATH` (optional) - Custom backup directory path

**Defaults**:
- Frequency: Hourly
- Retention: 10 backups
- Location: OneDrive Documents folder
- Timezone: America/New_York

**No additional setup required** - backups start automatically when application runs.

