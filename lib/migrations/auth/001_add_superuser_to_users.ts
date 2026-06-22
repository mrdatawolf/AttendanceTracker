import { Migration, columnExists } from '../index';

/**
 * Migration: Add is_superuser column to users table
 *
 * Changes:
 * - Adds is_superuser column to users table
 * - Migrates existing Master group users to superuser status
 * - Preserves existing data and group_id for backward compatibility
 */
export const migration: Migration = {
  name: '001_add_superuser_to_users',
  description: 'Add is_superuser column to users table',

  async up(db) {
    // Check if column already exists
    const exists = await columnExists(db, 'users', 'is_superuser');
    if (exists) {
      console.log('     Column is_superuser already exists, skipping');
      return;
    }

    // Add is_superuser column
    await db.execute(`
      ALTER TABLE users ADD COLUMN is_superuser INTEGER DEFAULT 0
    `);

    // Migrate existing Master group users to superuser status
    await db.execute(`
      UPDATE users
      SET is_superuser = 1
      WHERE group_id IN (SELECT id FROM groups WHERE is_master = 1)
    `);

    console.log('     Added is_superuser column and migrated Master group users');
  },

  async down(db) {
    // SQLite doesn't support DROP COLUMN easily
    // We'll leave the column in place for safety
    console.log('     Rollback not supported for this migration (column preserved)');
  },
};
