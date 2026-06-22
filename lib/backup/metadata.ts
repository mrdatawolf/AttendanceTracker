/**
 * Backup Metadata Storage
 *
 * Handles storing and retrieving backup metadata in a JSON file.
 */

import fs from 'fs/promises';
import path from 'path';
import { BackupMetadata, BackupListItem, BackupType } from './types';
import { getBackupsDir, ensureDir, fileExists, getBackupTypeDir, getFileSize } from './utils';

const METADATA_FILENAME = 'metadata.json';

interface MetadataStore {
  version: number;
  lastUpdated: string;
  backups: BackupMetadata[];
}

/**
 * Get the path to the metadata file
 */
function getMetadataPath(): string {
  return path.join(getBackupsDir(), METADATA_FILENAME);
}

/**
 * Load metadata from disk
 */
export async function loadMetadata(): Promise<MetadataStore> {
  const metadataPath = getMetadataPath();

  if (!(await fileExists(metadataPath))) {
    return {
      version: 1,
      lastUpdated: new Date().toISOString(),
      backups: [],
    };
  }

  try {
    const content = await fs.readFile(metadataPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Failed to parse metadata file, returning empty store:', error);
    return {
      version: 1,
      lastUpdated: new Date().toISOString(),
      backups: [],
    };
  }
}

/**
 * Save metadata to disk
 */
export async function saveMetadata(store: MetadataStore): Promise<void> {
  await ensureDir(getBackupsDir());
  const metadataPath = getMetadataPath();

  store.lastUpdated = new Date().toISOString();

  await fs.writeFile(metadataPath, JSON.stringify(store, null, 2), 'utf-8');
}

/**
 * Add a backup to the metadata store
 */
export async function addBackupMetadata(backup: BackupMetadata): Promise<void> {
  const store = await loadMetadata();

  // Check if backup already exists
  const existingIndex = store.backups.findIndex(b => b.id === backup.id);
  if (existingIndex >= 0) {
    // Update existing
    store.backups[existingIndex] = backup;
  } else {
    // Add new
    store.backups.push(backup);
  }

  await saveMetadata(store);
}

/**
 * Remove a backup from the metadata store
 */
export async function removeBackupMetadata(backupId: string): Promise<void> {
  const store = await loadMetadata();
  store.backups = store.backups.filter(b => b.id !== backupId);
  await saveMetadata(store);
}

/**
 * Get metadata for a specific backup
 */
export async function getBackupMetadata(backupId: string): Promise<BackupMetadata | null> {
  const store = await loadMetadata();
  return store.backups.find(b => b.id === backupId) || null;
}

/**
 * List all backups with total size calculation
 */
export async function listAllBackups(): Promise<BackupListItem[]> {
  const store = await loadMetadata();

  const items: BackupListItem[] = [];

  for (const backup of store.backups) {
    // Calculate total size by checking if files exist
    let totalSize = 0;
    const typeDir = getBackupTypeDir(backup.type);

    try {
      const attendancePath = path.join(typeDir, backup.databases.attendance.filename);
      const authPath = path.join(typeDir, backup.databases.auth.filename);

      if (await fileExists(attendancePath)) {
        totalSize += await getFileSize(attendancePath);
      }
      if (await fileExists(authPath)) {
        totalSize += await getFileSize(authPath);
      }
    } catch {
      // If files don't exist, use stored sizes
      totalSize = backup.databases.attendance.size + backup.databases.auth.size;
    }

    items.push({
      ...backup,
      totalSize,
    });
  }

  // Sort by timestamp descending (newest first)
  items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return items;
}

/**
 * List backups by type
 */
export async function listBackupsByType(type: BackupType): Promise<BackupListItem[]> {
  const allBackups = await listAllBackups();
  return allBackups.filter(b => b.type === type);
}

/**
 * Get the count of backups by type
 */
export async function getBackupCounts(): Promise<Record<BackupType, number>> {
  const store = await loadMetadata();

  const counts: Record<BackupType, number> = {
    daily: 0,
    weekly: 0,
    monthly: 0,
    manual: 0,
  };

  for (const backup of store.backups) {
    counts[backup.type]++;
  }

  return counts;
}

/**
 * Update backup type (for promotion)
 */
export async function updateBackupType(
  backupId: string,
  newType: BackupType,
  newId: string
): Promise<BackupMetadata | null> {
  const store = await loadMetadata();
  const backup = store.backups.find(b => b.id === backupId);

  if (!backup) {
    return null;
  }

  // Update the backup
  backup.promotedFrom = backup.id;
  backup.id = newId;
  backup.type = newType;

  await saveMetadata(store);
  return backup;
}

/**
 * Get the oldest backup of a specific type
 */
export async function getOldestBackup(type: BackupType): Promise<BackupMetadata | null> {
  const backups = await listBackupsByType(type);
  if (backups.length === 0) {
    return null;
  }

  // Sort by timestamp ascending to get oldest
  backups.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  return backups[0];
}

/**
 * Get the newest backup of any type
 */
export async function getNewestBackup(): Promise<BackupMetadata | null> {
  const store = await loadMetadata();
  if (store.backups.length === 0) {
    return null;
  }

  // Sort by timestamp descending to get newest
  const sorted = [...store.backups].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  return sorted[0];
}

/**
 * Clean up orphaned metadata (backups where files no longer exist)
 */
export async function cleanupOrphanedMetadata(): Promise<string[]> {
  const store = await loadMetadata();
  const orphaned: string[] = [];

  const validBackups: BackupMetadata[] = [];

  for (const backup of store.backups) {
    const typeDir = getBackupTypeDir(backup.type);
    const attendancePath = path.join(typeDir, backup.databases.attendance.filename);
    const authPath = path.join(typeDir, backup.databases.auth.filename);

    const attendanceExists = await fileExists(attendancePath);
    const authExists = await fileExists(authPath);

    if (attendanceExists && authExists) {
      validBackups.push(backup);
    } else {
      orphaned.push(backup.id);
    }
  }

  if (orphaned.length > 0) {
    store.backups = validBackups;
    await saveMetadata(store);
  }

  return orphaned;
}
