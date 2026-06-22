/**
 * Backup Manager
 *
 * Core class for managing database backups with rotation.
 * Handles daily, weekly, and monthly backup retention.
 */

import path from 'path';
import {
  BackupType,
  BackupMetadata,
  BackupResult,
  RestoreResult,
  RotationResult,
  StorageUsage,
  BackupVerificationResult,
  BackupConfig,
  DEFAULT_BACKUP_CONFIG,
} from './types';
import {
  ensureBackupDirs,
  copyFile,
  deleteFile,
  getFileSize,
  calculateChecksum,
  verifyChecksum,
  generateBackupId,
  generateBackupFilename,
  getBackupFilePath,
  getSourceDatabasePaths,
  getBackupTypeDir,
  fileExists,
  formatDate,
  formatWeek,
  formatMonth,
} from './utils';
import {
  addBackupMetadata,
  removeBackupMetadata,
  getBackupMetadata,
  listAllBackups,
  listBackupsByType,
  getOldestBackup,
  getBackupCounts,
  cleanupOrphanedMetadata,
} from './metadata';

export class BackupManager {
  private config: BackupConfig;

  constructor(config: Partial<BackupConfig> = {}) {
    this.config = { ...DEFAULT_BACKUP_CONFIG, ...config };
  }

  /**
   * Create a new backup
   */
  async createBackup(
    type: BackupType = 'daily',
    createdBy: string = 'system'
  ): Promise<BackupResult> {
    try {
      // Ensure backup directories exist
      await ensureBackupDirs();

      const timestamp = new Date();
      const backupId = generateBackupId(type, timestamp);

      // Get source database paths
      const sourcePaths = getSourceDatabasePaths();

      // Check if source databases exist
      if (!(await fileExists(sourcePaths.attendance))) {
        return {
          success: false,
          error: 'Attendance database not found',
        };
      }

      if (!(await fileExists(sourcePaths.auth))) {
        return {
          success: false,
          error: 'Auth database not found',
        };
      }

      // Generate filenames for backup
      const attendanceFilename = generateBackupFilename(backupId, 'attendance');
      const authFilename = generateBackupFilename(backupId, 'auth');

      // Get destination paths
      const attendanceDest = getBackupFilePath(type, attendanceFilename);
      const authDest = getBackupFilePath(type, authFilename);

      // Copy databases
      await copyFile(sourcePaths.attendance, attendanceDest);
      await copyFile(sourcePaths.auth, authDest);

      // Calculate checksums and sizes
      const [attendanceChecksum, authChecksum, attendanceSize, authSize] = await Promise.all([
        calculateChecksum(attendanceDest),
        calculateChecksum(authDest),
        getFileSize(attendanceDest),
        getFileSize(authDest),
      ]);

      // Create metadata
      const metadata: BackupMetadata = {
        id: backupId,
        type,
        timestamp: timestamp.toISOString(),
        databases: {
          attendance: {
            filename: attendanceFilename,
            size: attendanceSize,
            checksum: attendanceChecksum,
          },
          auth: {
            filename: authFilename,
            size: authSize,
            checksum: authChecksum,
          },
        },
        createdBy,
      };

      // Save metadata
      await addBackupMetadata(metadata);

      // Run rotation if this was a daily backup
      if (type === 'daily') {
        await this.rotateBackups();
      }

      return {
        success: true,
        backup: metadata,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Unknown error during backup',
      };
    }
  }

  /**
   * Rotate backups according to retention policy
   * - Keep 7 daily backups
   * - Promote oldest daily to weekly when we have > 7
   * - Keep 4 weekly backups
   * - Promote oldest weekly to monthly when we have > 4
   * - Keep 12 monthly backups
   * - Delete oldest monthly when we have > 12
   */
  async rotateBackups(): Promise<RotationResult> {
    const result: RotationResult = {
      promoted: [],
      deleted: [],
      errors: [],
    };

    try {
      // Get current counts
      const dailyBackups = await listBackupsByType('daily');
      const weeklyBackups = await listBackupsByType('weekly');
      const monthlyBackups = await listBackupsByType('monthly');

      // Sort by timestamp (oldest first)
      dailyBackups.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      weeklyBackups.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      monthlyBackups.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      // Promote daily to weekly if we have more than retention limit
      while (dailyBackups.length > this.config.retentionDaily) {
        const oldest = dailyBackups.shift();
        if (!oldest) break;

        try {
          await this.promoteBackup(oldest.id, 'weekly');
          result.promoted.push(`${oldest.id} -> weekly`);
        } catch (error: any) {
          result.errors.push(`Failed to promote ${oldest.id}: ${error.message}`);
        }
      }

      // Re-fetch weekly backups after promotions
      const updatedWeeklyBackups = await listBackupsByType('weekly');
      updatedWeeklyBackups.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      // Promote weekly to monthly if we have more than retention limit
      while (updatedWeeklyBackups.length > this.config.retentionWeekly) {
        const oldest = updatedWeeklyBackups.shift();
        if (!oldest) break;

        try {
          await this.promoteBackup(oldest.id, 'monthly');
          result.promoted.push(`${oldest.id} -> monthly`);
        } catch (error: any) {
          result.errors.push(`Failed to promote ${oldest.id}: ${error.message}`);
        }
      }

      // Re-fetch monthly backups after promotions
      const updatedMonthlyBackups = await listBackupsByType('monthly');
      updatedMonthlyBackups.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      // Delete oldest monthly if we have more than retention limit
      while (updatedMonthlyBackups.length > this.config.retentionMonthly) {
        const oldest = updatedMonthlyBackups.shift();
        if (!oldest) break;

        try {
          await this.deleteBackup(oldest.id);
          result.deleted.push(oldest.id);
        } catch (error: any) {
          result.errors.push(`Failed to delete ${oldest.id}: ${error.message}`);
        }
      }
    } catch (error: any) {
      result.errors.push(`Rotation error: ${error.message}`);
    }

    return result;
  }

  /**
   * Promote a backup to a higher tier (daily -> weekly -> monthly)
   */
  private async promoteBackup(backupId: string, targetType: 'weekly' | 'monthly'): Promise<void> {
    const backup = await getBackupMetadata(backupId);
    if (!backup) {
      throw new Error(`Backup not found: ${backupId}`);
    }

    // Generate new ID based on target type
    const timestamp = new Date(backup.timestamp);
    const newId = generateBackupId(targetType, timestamp);

    // Generate new filenames
    const newAttendanceFilename = generateBackupFilename(newId, 'attendance');
    const newAuthFilename = generateBackupFilename(newId, 'auth');

    // Get paths
    const oldAttendancePath = getBackupFilePath(backup.type, backup.databases.attendance.filename);
    const oldAuthPath = getBackupFilePath(backup.type, backup.databases.auth.filename);
    const newAttendancePath = getBackupFilePath(targetType, newAttendanceFilename);
    const newAuthPath = getBackupFilePath(targetType, newAuthFilename);

    // Move files (copy then delete)
    await copyFile(oldAttendancePath, newAttendancePath);
    await copyFile(oldAuthPath, newAuthPath);
    await deleteFile(oldAttendancePath);
    await deleteFile(oldAuthPath);

    // Update metadata
    await removeBackupMetadata(backupId);

    const newMetadata: BackupMetadata = {
      id: newId,
      type: targetType,
      timestamp: backup.timestamp,
      databases: {
        attendance: {
          filename: newAttendanceFilename,
          size: backup.databases.attendance.size,
          checksum: backup.databases.attendance.checksum,
        },
        auth: {
          filename: newAuthFilename,
          size: backup.databases.auth.size,
          checksum: backup.databases.auth.checksum,
        },
      },
      promotedFrom: backupId,
      createdBy: backup.createdBy,
    };

    await addBackupMetadata(newMetadata);
  }

  /**
   * List all backups
   */
  async listBackups(): Promise<BackupMetadata[]> {
    return await listAllBackups();
  }

  /**
   * Get a specific backup's metadata
   */
  async getBackup(backupId: string): Promise<BackupMetadata | null> {
    return await getBackupMetadata(backupId);
  }

  /**
   * Delete a specific backup
   */
  async deleteBackup(backupId: string): Promise<void> {
    const backup = await getBackupMetadata(backupId);
    if (!backup) {
      throw new Error(`Backup not found: ${backupId}`);
    }

    // Delete files
    const attendancePath = getBackupFilePath(backup.type, backup.databases.attendance.filename);
    const authPath = getBackupFilePath(backup.type, backup.databases.auth.filename);

    await deleteFile(attendancePath);
    await deleteFile(authPath);

    // Remove metadata
    await removeBackupMetadata(backupId);
  }

  /**
   * Verify a backup's integrity by checking checksums
   */
  async verifyBackup(backupId: string): Promise<BackupVerificationResult> {
    const backup = await getBackupMetadata(backupId);
    if (!backup) {
      throw new Error(`Backup not found: ${backupId}`);
    }

    const attendancePath = getBackupFilePath(backup.type, backup.databases.attendance.filename);
    const authPath = getBackupFilePath(backup.type, backup.databases.auth.filename);

    const [attendanceChecksum, authChecksum] = await Promise.all([
      calculateChecksum(attendancePath).catch(() => 'FILE_NOT_FOUND'),
      calculateChecksum(authPath).catch(() => 'FILE_NOT_FOUND'),
    ]);

    const attendanceValid = attendanceChecksum === backup.databases.attendance.checksum;
    const authValid = authChecksum === backup.databases.auth.checksum;

    return {
      id: backupId,
      valid: attendanceValid && authValid,
      databases: {
        attendance: {
          valid: attendanceValid,
          expectedChecksum: backup.databases.attendance.checksum,
          actualChecksum: attendanceChecksum,
        },
        auth: {
          valid: authValid,
          expectedChecksum: backup.databases.auth.checksum,
          actualChecksum: authChecksum,
        },
      },
    };
  }

  /**
   * Restore from a backup
   */
  async restoreBackup(backupId: string): Promise<RestoreResult> {
    try {
      const backup = await getBackupMetadata(backupId);
      if (!backup) {
        return {
          success: false,
          error: `Backup not found: ${backupId}`,
        };
      }

      // Verify backup integrity first
      const verification = await this.verifyBackup(backupId);
      if (!verification.valid) {
        return {
          success: false,
          error: 'Backup integrity check failed. Checksums do not match.',
        };
      }

      // Get paths
      const backupAttendancePath = getBackupFilePath(backup.type, backup.databases.attendance.filename);
      const backupAuthPath = getBackupFilePath(backup.type, backup.databases.auth.filename);
      const sourcePaths = getSourceDatabasePaths();

      // Create a backup of current state before restoring
      const preRestoreResult = await this.createBackup('manual', 'pre-restore');
      if (!preRestoreResult.success) {
        console.warn('Could not create pre-restore backup:', preRestoreResult.error);
      }

      // Restore databases
      await copyFile(backupAttendancePath, sourcePaths.attendance);
      await copyFile(backupAuthPath, sourcePaths.auth);

      return {
        success: true,
        restoredFrom: backupId,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Unknown error during restore',
      };
    }
  }

  /**
   * Get storage usage information
   */
  async getStorageUsage(): Promise<StorageUsage> {
    const backups = await listAllBackups();

    const usage: StorageUsage = {
      total: 0,
      byType: {
        daily: 0,
        weekly: 0,
        monthly: 0,
        manual: 0,
      },
      backupCount: {
        daily: 0,
        weekly: 0,
        monthly: 0,
        manual: 0,
      },
    };

    for (const backup of backups) {
      const size = backup.databases.attendance.size + backup.databases.auth.size;
      usage.total += size;
      usage.byType[backup.type] += size;
      usage.backupCount[backup.type]++;
    }

    return usage;
  }

  /**
   * Get backup paths for download
   */
  async getBackupPaths(backupId: string): Promise<{ attendance: string; auth: string } | null> {
    const backup = await getBackupMetadata(backupId);
    if (!backup) {
      return null;
    }

    return {
      attendance: getBackupFilePath(backup.type, backup.databases.attendance.filename),
      auth: getBackupFilePath(backup.type, backup.databases.auth.filename),
    };
  }

  /**
   * Clean up orphaned metadata entries
   */
  async cleanup(): Promise<string[]> {
    return await cleanupOrphanedMetadata();
  }
}

// Export singleton instance
export const backupManager = new BackupManager();
