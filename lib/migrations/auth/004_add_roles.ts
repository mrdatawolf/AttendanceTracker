import { Client } from '@libsql/client';
import { columnExists } from '../index';

export const migration = {
  name: 'add_roles',
  description: 'Add roles table and role-based permissions system',
  up: async (db: Client) => {
    console.log('Running migration: add_roles');

    // Create roles table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS roles (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        can_create INTEGER DEFAULT 0,
        can_read INTEGER DEFAULT 0,
        can_update INTEGER DEFAULT 0,
        can_delete INTEGER DEFAULT 0,
        can_manage_users INTEGER DEFAULT 0,
        can_access_all_groups INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insert default roles
    const roles = [
      {
        id: 1,
        name: 'Administrator',
        description: 'Full system access with all permissions',
        can_create: 1,
        can_read: 1,
        can_update: 1,
        can_delete: 1,
        can_manage_users: 1,
        can_access_all_groups: 1,
      },
      {
        id: 2,
        name: 'Manager',
        description: 'Full CRUD access to assigned groups and employees',
        can_create: 1,
        can_read: 1,
        can_update: 1,
        can_delete: 1,
        can_manage_users: 0,
        can_access_all_groups: 0,
      },
      {
        id: 3,
        name: 'Editor',
        description: 'Can create, read, and update records (no delete)',
        can_create: 1,
        can_read: 1,
        can_update: 1,
        can_delete: 0,
        can_manage_users: 0,
        can_access_all_groups: 0,
      },
      {
        id: 4,
        name: 'Contributor',
        description: 'Can create and read records only',
        can_create: 1,
        can_read: 1,
        can_update: 0,
        can_delete: 0,
        can_manage_users: 0,
        can_access_all_groups: 0,
      },
      {
        id: 5,
        name: 'Viewer',
        description: 'Read-only access to assigned groups',
        can_create: 0,
        can_read: 1,
        can_update: 0,
        can_delete: 0,
        can_manage_users: 0,
        can_access_all_groups: 0,
      },
      {
        id: 6,
        name: 'Self-Service',
        description: 'Can only view and edit own attendance records',
        can_create: 1,
        can_read: 1,
        can_update: 1,
        can_delete: 0,
        can_manage_users: 0,
        can_access_all_groups: 0,
      },
    ];

    for (const role of roles) {
      await db.execute({
        sql: `INSERT OR IGNORE INTO roles (id, name, description, can_create, can_read, can_update, can_delete, can_manage_users, can_access_all_groups)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          role.id,
          role.name,
          role.description,
          role.can_create,
          role.can_read,
          role.can_update,
          role.can_delete,
          role.can_manage_users,
          role.can_access_all_groups,
        ],
      });
    }

    // Add role_id column to users table (only if it doesn't exist)
    const roleIdExists = await columnExists(db, 'users', 'role_id');
    if (!roleIdExists) {
      await db.execute(`
        ALTER TABLE users ADD COLUMN role_id INTEGER REFERENCES roles(id)
      `);
      console.log('✓ role_id column added to users table');
    } else {
      console.log('  role_id column already exists, skipping');
    }

    // Migrate existing users: superusers -> Administrator (role_id = 1), others -> Manager (role_id = 2)
    await db.execute(`
      UPDATE users SET role_id = 1 WHERE (is_superuser = 1) AND (role_id IS NULL)
    `);

    await db.execute(`
      UPDATE users SET role_id = 2 WHERE (is_superuser = 0 OR is_superuser IS NULL) AND (role_id IS NULL)
    `);

    console.log('✓ Roles migration completed successfully');
  },
  down: async (db: Client) => {
    // Note: SQLite doesn't support DROP COLUMN, so we'd need to recreate the table
    // For now, just document the rollback steps
    console.log('Rollback not implemented for add_roles migration');
    console.log('To rollback, you would need to:');
    console.log('1. Recreate users table without role_id column');
    console.log('2. Drop roles table');
  },
};
