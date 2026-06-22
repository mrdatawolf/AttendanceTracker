import { createClient } from '@libsql/client';
import bcrypt from 'bcryptjs';
import { runMigrations } from './migrations';
import { authMigrations } from './migrations/auth/migrations';
import { getDatabasePath, logDataPaths } from './data-paths';

// SEPARATE DATABASE FOR AUTHENTICATION
// Uses centralized data paths for cross-platform compatibility
const authDbPath = getDatabasePath('auth.db');

export const authDb = createClient({
  url: `file:${authDbPath}`,
});

export async function initializeAuthDatabase() {
  // Create groups table
  await authDb.execute(`
    CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      is_master INTEGER DEFAULT 0,
      can_view_all INTEGER DEFAULT 0,
      can_edit_all INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create users table
  await authDb.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE,
      group_id INTEGER NOT NULL,
      is_active INTEGER DEFAULT 1,
      last_login DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (group_id) REFERENCES groups(id)
    )
  `);

  // Create audit_log table
  await authDb.execute(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      table_name TEXT NOT NULL,
      record_id INTEGER,
      old_values TEXT,
      new_values TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Create group_permissions table
  await authDb.execute(`
    CREATE TABLE IF NOT EXISTS group_permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER NOT NULL,
      target_group_id INTEGER NOT NULL,
      can_view INTEGER DEFAULT 0,
      can_edit INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (group_id) REFERENCES groups(id),
      FOREIGN KEY (target_group_id) REFERENCES groups(id),
      UNIQUE(group_id, target_group_id)
    )
  `);

  // Create job_titles table
  await authDb.execute(`
    CREATE TABLE IF NOT EXISTS job_titles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Note: Job titles are seeded via migration 005_seed_job_titles.ts

  // Insert default master group
  await authDb.execute({
    sql: `INSERT OR IGNORE INTO groups (id, name, description, is_master, can_view_all, can_edit_all)
          VALUES (1, 'Master', 'Master administrators with full access', 1, 1, 1)`,
    args: [],
  });

  // Insert default groups
  const groups = [
    { id: 2, name: 'Managers', description: 'Department managers', can_view_all: 1, can_edit_all: 0 },
    { id: 3, name: 'HR', description: 'Human Resources', can_view_all: 1, can_edit_all: 1 },
    { id: 4, name: 'Employees', description: 'Regular employees', can_view_all: 0, can_edit_all: 0 },
  ];

  for (const group of groups) {
    await authDb.execute({
      sql: `INSERT OR IGNORE INTO groups (id, name, description, can_view_all, can_edit_all)
            VALUES (?, ?, ?, ?, ?)`,
      args: [group.id, group.name, group.description, group.can_view_all, group.can_edit_all],
    });
  }

  // Insert default admin user (password: admin123)
  // WARNING: Change this password in production!
  const defaultPasswordHash = await bcrypt.hash('admin123', 10);
  await authDb.execute({
    sql: `INSERT OR IGNORE INTO users (id, username, password_hash, full_name, email, group_id)
          VALUES (1, 'admin', ?, 'System Administrator', 'admin@attendance.local', 1)`,
    args: [defaultPasswordHash],
  });

  console.log('✓ Authentication database initialized');
  console.log('  - Groups table created');
  console.log('  - Users table created');
  console.log('  - Audit log table created');
  console.log('  - Group permissions table created');
  console.log('  - Job titles table created');
  console.log('  - Default admin user created (username: admin, password: admin123)');

  // Run migrations
  console.log('\n🔄 Running auth database migrations...');
  await runMigrations(authDb, authMigrations, 'auth.db');
}

// Singleton initialization - only run once per process
let initPromise: Promise<void> | null = null;

export function ensureAuthInitialized() {
  if (!initPromise && typeof window === 'undefined') {
    // Only initialize at runtime, not during build
    if (process.env.NODE_ENV !== 'production' || process.env.NEXT_PHASE !== 'phase-production-build') {
      initPromise = initializeAuthDatabase();
    }
  }
  return initPromise;
}

// Auto-initialize on module load (server-side only)
if (typeof window === 'undefined') {
  ensureAuthInitialized();
}
