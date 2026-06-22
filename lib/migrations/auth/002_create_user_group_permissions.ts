import { Migration, tableExists } from '../index';

/**
 * Migration: Create user_group_permissions table
 *
 * Changes:
 * - Creates new user_group_permissions table for granular CRUD permissions
 * - Each user can have access to multiple groups with specific CRUD rights
 * - Replaces the old group-based permission model with user-specific permissions
 */
export const migration: Migration = {
  name: '002_create_user_group_permissions',
  description: 'Create user_group_permissions table for granular CRUD access control',

  async up(db) {
    // Check if table already exists
    const exists = await tableExists(db, 'user_group_permissions');
    if (exists) {
      console.log('     Table user_group_permissions already exists, skipping');
      return;
    }

    // Create user_group_permissions table
    await db.execute(`
      CREATE TABLE user_group_permissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        group_id INTEGER NOT NULL,
        can_create INTEGER DEFAULT 0,
        can_read INTEGER DEFAULT 1,
        can_update INTEGER DEFAULT 0,
        can_delete INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
        UNIQUE(user_id, group_id)
      )
    `);

    // Create index for faster lookups
    await db.execute(`
      CREATE INDEX idx_user_group_permissions_user
      ON user_group_permissions(user_id)
    `);

    await db.execute(`
      CREATE INDEX idx_user_group_permissions_group
      ON user_group_permissions(group_id)
    `);

    console.log('     Created user_group_permissions table with indexes');
  },

  async down(db) {
    await db.execute('DROP TABLE IF EXISTS user_group_permissions');
    console.log('     Dropped user_group_permissions table');
  },
};
