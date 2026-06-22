/**
 * Backup Utilities
 *
 * File operations, checksum calculation, and naming utilities for the backup system.
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { BackupType } from './types';
import { getDataDirectory, getBackupsDirectory } from '../data-paths';

/**
 * Get the project root directory
 */
export function getProjectRoot(): string {
  return process.cwd();
}

/**
 * Get the databases directory path (uses centralized data paths)
 */
export function getDatabasesDir(): string {
  return getDataDirectory();
}

/**
 * Get the backups directory path (uses centralized data paths)
 */
export function getBackupsDir(): string {
  return getBackupsDirectory();
}

/**
 * Get a specific backup type directory path
 */
export function getBackupTypeDir(type: BackupType): string {
  return path.join(getBackupsDir(), type);
}

/**
 * Ensure a directory exists, creating it if necessary
 */
export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

/**
 * Ensure all backup directories exist
 */
export async function ensureBackupDirs(): Promise<void> {
  await ensureDir(getBackupsDir());
  await ensureDir(getBackupTypeDir('daily'));
  await ensureDir(getBackupTypeDir('weekly'));
  await ensureDir(getBackupTypeDir('monthly'));
  await ensureDir(getBackupTypeDir('manual'));
}

/**
 * Copy a file from source to destination
 */
export async function copyFile(source: string, dest: string): Promise<void> {
  await fs.copyFile(source, dest);
}

/**
 * Delete a file if it exists
 */
export async function deleteFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch (error: any) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

/**
 * Get file size in bytes
 */
export async function getFileSize(filePath: string): Promise<number> {
  const stats = await fs.stat(filePath);
  return stats.size;
}

/**
 * Check if a file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Calculate SHA-256 checksum of a file
 */
export async function calculateChecksum(filePath: string): Promise<string> {
  const fileBuffer = await fs.readFile(filePath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
}

/**
 * Verify a file's checksum matches the expected value
 */
export async function verifyChecksum(filePath: string, expectedChecksum: string): Promise<boolean> {
  try {
    const actualChecksum = await calculateChecksum(filePath);
    return actualChecksum === expectedChecksum;
  } catch {
    return false;
  }
}

/**
 * Format a date as YYYY-MM-DD
 */
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Format a date as YYYY-Www (week number)
 */
export function formatWeek(date: Date): string {
  const year = date.getFullYear();
  const weekNum = getWeekNumber(date);
  return `${year}-W${weekNum.toString().padStart(2, '0')}`;
}

/**
 * Format a date as YYYY-MM (month)
 */
export function formatMonth(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Get ISO week number for a date
 */
export function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

/**
 * Generate a backup ID based on type and date
 */
export function generateBackupId(type: BackupType, date: Date): string {
  switch (type) {
    case 'daily':
      return `daily-${formatDate(date)}`;
    case 'weekly':
      return `weekly-${formatWeek(date)}`;
    case 'monthly':
      return `monthly-${formatMonth(date)}`;
    case 'manual':
      return `manual-${date.toISOString().replace(/[:.]/g, '-')}`;
    default:
      throw new Error(`Unknown backup type: ${type}`);
  }
}

/**
 * Generate backup filename for a database
 */
export function generateBackupFilename(backupId: string, database: 'attendance' | 'auth'): string {
  return `${backupId}-${database}.db`;
}

/**
 * Parse a backup ID to extract type and date info
 */
export function parseBackupId(backupId: string): { type: BackupType; dateStr: string } | null {
  const match = backupId.match(/^(daily|weekly|monthly|manual)-(.+)$/);
  if (!match) {
    return null;
  }
  return {
    type: match[1] as BackupType,
    dateStr: match[2],
  };
}

/**
 * Get the full path to a backup file
 */
export function getBackupFilePath(type: BackupType, filename: string): string {
  return path.join(getBackupTypeDir(type), filename);
}

/**
 * List all files in a directory
 */
export async function listFiles(dirPath: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries.filter(e => e.isFile()).map(e => e.name);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Get source database paths
 */
export function getSourceDatabasePaths(): { attendance: string; auth: string } {
  const dbDir = getDatabasesDir();
  return {
    attendance: path.join(dbDir, 'attendance.db'),
    auth: path.join(dbDir, 'auth.db'),
  };
}
