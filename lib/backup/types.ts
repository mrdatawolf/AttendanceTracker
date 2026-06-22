/**
 * Backup System Types
 *
 * Type definitions for the automated backup system.
 * See info/PHASE-4-PLAN.md for full specification.
 */

export type BackupType = 'daily' | 'weekly' | 'monthly' | 'manual';

export interface DatabaseBackupInfo {
  filename: string;
  size: number;
  checksum: string;
}

export interface BackupMetadata {
  id: string;
  type: BackupType;
  timestamp: string;
  databases: {
    attendance: DatabaseBackupInfo;
    auth: DatabaseBackupInfo;
  };
  promotedFrom?: string;  // ID of backup this was promoted from
  createdBy?: string;     // 'system' or user ID for manual backups
}

export interface BackupListItem extends BackupMetadata {
  totalSize: number;
}

export interface BackupConfig {
  enabled: boolean;
  scheduleHour: number;
  scheduleMinute: number;
  retentionDaily: number;
  retentionWeekly: number;
  retentionMonthly: number;
  backupDirectory: string;
}

export interface BackupResult {
  success: boolean;
  backup?: BackupMetadata;
  error?: string;
}

export interface RestoreResult {
  success: boolean;
  restoredFrom?: string;
  error?: string;
}

export interface RotationResult {
  promoted: string[];
  deleted: string[];
  errors: string[];
}

export interface StorageUsage {
  total: number;
  byType: {
    daily: number;
    weekly: number;
    monthly: number;
    manual: number;
  };
  backupCount: {
    daily: number;
    weekly: number;
    monthly: number;
    manual: number;
  };
}

export interface BackupVerificationResult {
  id: string;
  valid: boolean;
  databases: {
    attendance: { valid: boolean; expectedChecksum: string; actualChecksum: string };
    auth: { valid: boolean; expectedChecksum: string; actualChecksum: string };
  };
}

// Default configuration
export const DEFAULT_BACKUP_CONFIG: BackupConfig = {
  enabled: true,
  scheduleHour: 2,
  scheduleMinute: 0,
  retentionDaily: 7,
  retentionWeekly: 4,
  retentionMonthly: 12,
  backupDirectory: './databases/backups',
};
