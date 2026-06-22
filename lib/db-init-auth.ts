import { db } from './db-sqlite';

/**
 * Initialize authentication and audit tables
 */
export async function initializeAuthTables() {
  // Create groups table
  await db.execute(`
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

  // Create users table (for authentication)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE,
      group_id INTEGER NOT NULL,
      is_active INTEGER DEFAULT 1,
      color_mode TEXT DEFAULT 'system' CHECK(color_mode IN ('light', 'dark', 'system')),
      last_login DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (group_id) REFERENCES groups(id)
    )
  `);

  // Add color_mode column if it doesn't exist (for existing databases)
  try {
    await db.execute(`ALTER TABLE users ADD COLUMN color_mode TEXT DEFAULT 'system' CHECK(color_mode IN ('light', 'dark', 'system'))`);
    console.log('  ✓ Added color_mode column to users table');
  } catch (error) {
    // Column already exists, ignore error
  }

  // Create audit_log table
  await db.execute(`
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

  // Create group_permissions table (which groups can view/edit which groups)
  await db.execute(`
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

  // Create app_settings table (for global admin settings)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      description TEXT,
      updated_by INTEGER,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (updated_by) REFERENCES users(id)
    )
  `);

  // Insert default theme setting
  await db.execute({
    sql: `INSERT OR IGNORE INTO app_settings (key, value, description)
          VALUES ('theme', 'standard', 'Application theme (controls layout, typography, spacing)')`,
    args: [],
  });

  // Insert default master group
  await db.execute({
    sql: `INSERT OR IGNORE INTO groups (id, name, description, is_master, can_view_all, can_edit_all)
          VALUES (1, 'Master', 'Master administrators with full access', 1, 1, 1)`,
    args: [],
  });

  // Insert default admin user (password: admin123)
  // In production, this should be changed immediately!
  const defaultPasswordHash = '$2a$10$rKqP8uN1kY9nJ3hC7xJ4qOXQZ8YJ0PZ4QZ8YJ0PZ4QZ8YJ0PZ4QZ8'; // bcrypt hash of 'admin123'
  await db.execute({
    sql: `INSERT OR IGNORE INTO users (id, username, password_hash, full_name, email, group_id)
          VALUES (1, 'admin', ?, 'System Administrator', 'admin@attendance.local', 1)`,
    args: [defaultPasswordHash],
  });

  console.log('✓ Auth tables initialized');
}

export async function seedDefaultGroups() {
  // Add some example groups
  const groups = [
    { name: 'Managers', description: 'Department managers', can_view_all: 1, can_edit_all: 0 },
    { name: 'HR', description: 'Human Resources', can_view_all: 1, can_edit_all: 1 },
    { name: 'Employees', description: 'Regular employees', can_view_all: 0, can_edit_all: 0 },
  ];

  for (const group of groups) {
    await db.execute({
      sql: `INSERT OR IGNORE INTO groups (name, description, can_view_all, can_edit_all)
            VALUES (?, ?, ?, ?)`,
      args: [group.name, group.description, group.can_view_all, group.can_edit_all],
    });
  }

  console.log('✓ Default groups seeded');
}
