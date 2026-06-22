# Phase 4: Automated Database Backup System

## Status: ✅ COMPLETE (January 2026)

### Implementation Summary
- **Core System:** `lib/backup/` - Types, utilities, metadata, and BackupManager
- **API Endpoints:** `/api/backup`, `/api/backup/[id]`, `/api/backup/[id]/download`
- **UI:** Settings page backup section (admin only)
- **Features:** Manual backup, restore, delete, verify, download

### What's Included
- ✅ Manual backup creation via Settings UI
- ✅ Backup both attendance.db and auth.db
- ✅ SHA-256 checksum verification
- ✅ Rotation logic (7 daily, 4 weekly, 12 monthly)
- ✅ Restore with pre-restore backup
- ✅ Download individual database files
- ✅ Storage usage tracking
- ✅ Audit logging for all operations

### Future Enhancement (Optional)
- ⏳ Automatic scheduled backups (requires node-cron integration)

---

## Overview

Phase 4 implements an automated, intelligent backup system with rotating retention periods to ensure data safety while managing storage efficiently. The system follows a proven backup rotation strategy:

- **Daily backups**: Last 7 days
- **Weekly backups**: Last 4 weeks
- **Monthly backups**: Last 12 months

## Backup Rotation Strategy

### How It Works

```
Day 1-7: Keep daily backups
├─ backup-daily-2026-01-08.db
├─ backup-daily-2026-01-07.db
├─ backup-daily-2026-01-06.db
├─ backup-daily-2026-01-05.db
├─ backup-daily-2026-01-04.db
├─ backup-daily-2026-01-03.db
└─ backup-daily-2026-01-02.db

After 7 days: Oldest daily becomes a weekly backup
├─ backup-weekly-2026-01-01.db  (promoted from daily)
├─ backup-weekly-2025-12-25.db
├─ backup-weekly-2025-12-18.db
└─ backup-weekly-2025-12-11.db

After 4 weeks: Oldest weekly becomes a monthly backup
├─ backup-monthly-2026-01.db (promoted from weekly)
├─ backup-monthly-2025-12.db
├─ backup-monthly-2025-11.db
...
└─ backup-monthly-2025-02.db
```

### Retention Logic

1. **Every day**: Create new daily backup
2. **On day 8**:
   - Promote oldest daily (day 7) to weekly
   - Delete day 8's daily backup
3. **After 4 weeks**:
   - Promote oldest weekly to monthly
   - Delete 5th weekly backup
4. **After 12 months**:
   - Delete 13th monthly backup

**Total storage**: ~23 backups maximum (7 daily + 4 weekly + 12 monthly)

## Goals

### 1. Automated Backup Creation
- ✅ Automatic daily backups at configurable time
- ✅ Backup both `attendance.db` and `auth.db`
- ✅ Include metadata (timestamp, size, checksum)
- ✅ Atomic operations (backup completes fully or not at all)
- ✅ No downtime during backup

### 2. Intelligent Rotation
- ✅ Automatic promotion of backups (daily → weekly → monthly)
- ✅ Automatic cleanup of old backups
- ✅ Storage-efficient
- ✅ Configurable retention periods

### 3. Manual Operations
- ✅ On-demand backup creation via UI
- ✅ Browse and download existing backups
- ✅ Restore from any backup point
- ✅ Delete specific backups
- ✅ Verify backup integrity

### 4. Monitoring & Alerts
- ✅ Backup success/failure notifications
- ✅ Storage usage monitoring
- ✅ Backup age warnings
- ✅ Last backup timestamp display

## Technical Architecture

### Folder Structure

```
databases/
├── attendance.db          # Active database
├── auth.db               # Active auth database
└── backups/
    ├── daily/
    │   ├── attendance-2026-01-08.db
    │   ├── auth-2026-01-08.db
    │   ├── attendance-2026-01-07.db
    │   ├── auth-2026-01-07.db
    │   └── ...
    ├── weekly/
    │   ├── attendance-2026-W02.db
    │   ├── auth-2026-W02.db
    │   └── ...
    ├── monthly/
    │   ├── attendance-2026-01.db
    │   ├── auth-2026-01.db
    │   └── ...
    └── metadata.json        # Backup metadata and checksums
```

### Core Components

#### 1. Backup Manager (`lib/backup/manager.ts`)

```typescript
interface BackupMetadata {
  id: string;
  type: 'daily' | 'weekly' | 'monthly';
  timestamp: string;
  databases: {
    attendance: { size: number; checksum: string };
    auth: { size: number; checksum: string };
  };
  promotedFrom?: string;  // If promoted from another backup
}

class BackupManager {
  async createBackup(type: 'daily' | 'manual'): Promise<BackupMetadata>;
  async rotateBackups(): Promise<void>;
  async listBackups(): Promise<BackupMetadata[]>;
  async restoreBackup(backupId: string): Promise<void>;
  async deleteBackup(backupId: string): Promise<void>;
  async verifyBackup(backupId: string): Promise<boolean>;
  async getStorageUsage(): Promise<{ total: number; byType: Record<string, number> }>;
}
```

#### 2. Backup Scheduler (`lib/backup/scheduler.ts`)

```typescript
class BackupScheduler {
  // Schedule daily backup at configured time
  scheduleDaily(hour: number, minute: number): void;

  // Trigger immediate backup
  triggerNow(): Promise<void>;

  // Stop scheduled backups
  stopScheduler(): void;
}
```

#### 3. Backup Utilities (`lib/backup/utils.ts`)

```typescript
// File operations
async function copyDatabase(source: string, dest: string): Promise<void>;
async function calculateChecksum(filePath: string): Promise<string>;
async function verifyIntegrity(filePath: string, expectedChecksum: string): Promise<boolean>;

// Date utilities
function getBackupFileName(type: 'daily' | 'weekly' | 'monthly', date: Date): string;
function parseBackupFileName(fileName: string): { type: string; date: Date };
```

### Backup Process

```typescript
async function createBackup() {
  const timestamp = new Date();
  const backupId = `daily-${formatDate(timestamp)}`;

  // 1. Create backup directory
  const backupDir = path.join(BACKUPS_DIR, 'daily');
  await fs.mkdir(backupDir, { recursive: true });

  // 2. Copy databases
  const files = ['attendance.db', 'auth.db'];
  const checksums = {};

  for (const file of files) {
    const source = path.join(DATABASES_DIR, file);
    const dest = path.join(backupDir, `${backupId}-${file}`);

    // Copy file
    await copyFile(source, dest);

    // Calculate checksum
    checksums[file] = await calculateChecksum(dest);
  }

  // 3. Save metadata
  const metadata = {
    id: backupId,
    type: 'daily',
    timestamp: timestamp.toISOString(),
    databases: checksums,
  };

  await saveMetadata(metadata);

  // 4. Trigger rotation
  await rotateBackups();

  return metadata;
}
```

### Rotation Process

```typescript
async function rotateBackups() {
  // 1. Get all backups sorted by date
  const dailyBackups = await listBackupsByType('daily');
  const weeklyBackups = await listBackupsByType('weekly');
  const monthlyBackups = await listBackupsByType('monthly');

  // 2. Promote oldest daily to weekly if we have > 7 daily backups
  if (dailyBackups.length > 7) {
    const oldestDaily = dailyBackups[dailyBackups.length - 1];
    await promoteBackup(oldestDaily, 'weekly');
    await deleteBackup(oldestDaily.id);
  }

  // 3. Promote oldest weekly to monthly if we have > 4 weekly backups
  if (weeklyBackups.length > 4) {
    const oldestWeekly = weeklyBackups[weeklyBackups.length - 1];
    await promoteBackup(oldestWeekly, 'monthly');
    await deleteBackup(oldestWeekly.id);
  }

  // 4. Delete oldest monthly if we have > 12
  if (monthlyBackups.length > 12) {
    const oldestMonthly = monthlyBackups[monthlyBackups.length - 1];
    await deleteBackup(oldestMonthly.id);
  }
}
```

## API Endpoints

### Backup Management
- `POST /api/backup/create` - Create immediate backup (superuser only)
- `GET /api/backup/list` - List all backups with metadata
- `POST /api/backup/restore` - Restore from backup (superuser only)
- `DELETE /api/backup/:id` - Delete specific backup (superuser only)
- `GET /api/backup/download/:id` - Download backup files
- `POST /api/backup/verify/:id` - Verify backup integrity
- `GET /api/backup/status` - Get backup system status

### Configuration
- `GET /api/backup/config` - Get backup configuration
- `PUT /api/backup/config` - Update backup schedule (superuser only)

## UI Components

### Settings Page Integration

Add new "Backups" section to Settings page for superusers:

```tsx
<Card>
  <CardHeader>
    <CardTitle>Database Backups</CardTitle>
    <CardDescription>
      Automatic backups run daily at 2:00 AM. Last backup: {lastBackupTime}
    </CardDescription>
  </CardHeader>
  <CardContent>
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <p className="font-medium">Backup Status</p>
          <p className="text-sm text-muted-foreground">
            {dailyCount} daily, {weeklyCount} weekly, {monthlyCount} monthly
          </p>
        </div>
        <Button onClick={createBackup}>Create Backup Now</Button>
      </div>

      <Separator />

      <BackupList backups={backups} onRestore={handleRestore} onDownload={handleDownload} />
    </div>
  </CardContent>
</Card>
```

## Configuration

### Environment Variables

```env
# Backup settings
BACKUP_ENABLED=true
BACKUP_SCHEDULE_HOUR=2
BACKUP_SCHEDULE_MINUTE=0
BACKUP_RETENTION_DAILY=7
BACKUP_RETENTION_WEEKLY=4
BACKUP_RETENTION_MONTHLY=12
BACKUP_DIRECTORY=./databases/backups
```

## Implementation Steps

### Phase 4.1: Core Backup System (Week 1)
1. Create backup directory structure
2. Implement BackupManager class
3. File copy and checksum utilities
4. Metadata storage system
5. Basic backup creation

### Phase 4.2: Rotation Logic (Week 1)
1. Implement rotation algorithm
2. Backup promotion logic
3. Cleanup old backups
4. Metadata updates

### Phase 4.3: Scheduling System (Week 2)
1. Node-cron or similar for scheduling
2. Scheduled backup execution
3. Error handling and retry logic
4. Startup initialization

### Phase 4.4: API Endpoints (Week 2)
1. Create backup endpoint
2. List backups endpoint
3. Restore backup endpoint
4. Download backup endpoint
5. Permission checks (superuser only)

### Phase 4.5: UI Integration (Week 3)
1. Settings page backup section
2. Backup list component
3. Create backup button
4. Restore confirmation dialog
5. Download functionality

### Phase 4.6: Testing & Documentation (Week 3)
1. Unit tests for rotation logic
2. Integration tests for backup/restore
3. Test different time scenarios
4. Document backup procedures
5. Create troubleshooting guide

## Security Considerations

- **Access Control**: Only superusers can create/restore/delete backups
- **File Permissions**: Backup files readable only by application
- **Restore Confirmation**: Require explicit confirmation with warning before restore
- **Audit Logging**: Log all backup operations
- **Download Limits**: Rate limit backup downloads
- **Path Traversal**: Validate all file paths to prevent directory traversal attacks

## Error Handling

```typescript
try {
  await createBackup();
} catch (error) {
  if (error.code === 'ENOSPC') {
    // Disk space full
    console.error('Backup failed: Disk space exhausted');
    await cleanupOldBackups();
  } else if (error.code === 'EACCES') {
    // Permission error
    console.error('Backup failed: Permission denied');
  } else {
    // Unknown error
    console.error('Backup failed:', error);
  }
}
```

## Success Criteria

- ✅ Backups created automatically every day at configured time
- ✅ Rotation works correctly (daily → weekly → monthly)
- ✅ No more than 23 backups stored at any time
- ✅ Restore functionality works without data loss
- ✅ Backup process completes in <10 seconds for typical database size
- ✅ Zero data loss during backup/restore operations
- ✅ UI clearly shows backup status and history

## Timeline Estimate

- **Week 1**: Core backup system and rotation logic
- **Week 2**: Scheduling and API endpoints
- **Week 3**: UI integration and testing

**Total**: 3 weeks

## Future Enhancements (Post-Phase 4)

- Cloud backup integration (S3, Google Drive, Dropbox)
- Differential/incremental backups
- Backup encryption
- Automatic backup before major updates
- Email notifications for backup failures
- Multi-region backup replication
- Point-in-time restore
- Backup compression
