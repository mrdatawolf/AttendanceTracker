import { Client } from '@libsql/client';

export interface Migration {
  name: string;
  description: string;
  up: (db: Client) => Promise<void>;
  down?: (db: Client) => Promise<void>;
}

/**
 * Migration runner
 * - Tracks which migrations have been applied
 * - Executes migrations in order
 * - Safe to run multiple times
 */
export async function runMigrations(db: Client, migrations: Migration[], dbName: string = 'database'): Promise<void> {
  // Create migrations tracking table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Get list of already-applied migrations
  const appliedResult = await db.execute('SELECT name FROM migrations ORDER BY id');
  const appliedMigrations = new Set(appliedResult.rows.map((row: any) => row.name));

  // Run pending migrations
  let appliedCount = 0;
  for (const migration of migrations) {
    if (appliedMigrations.has(migration.name)) {
      // Migration already applied, skip
      continue;
    }

    console.log(`  ⏳ Running migration [${dbName}]: ${migration.name}`);
    console.log(`     ${migration.description}`);

    try {
      // Execute migration
      await migration.up(db);

      // Record migration as applied
      await db.execute({
        sql: 'INSERT INTO migrations (name, description) VALUES (?, ?)',
        args: [migration.name, migration.description],
      });

      console.log(`  ✓ Migration applied: ${migration.name}`);
      appliedCount++;
    } catch (error) {
      console.error(`  ✗ Migration failed: ${migration.name}`);
      console.error(`     Error:`, error);
      throw new Error(`Migration ${migration.name} failed: ${error}`);
    }
  }

  if (appliedCount === 0) {
    console.log(`  ✓ All migrations up to date for ${dbName}`);
  } else {
    console.log(`  ✓ Applied ${appliedCount} migration(s) to ${dbName}`);
  }
}

/**
 * Check if a column exists in a table
 * Helper function for migrations
 */
export async function columnExists(db: Client, tableName: string, columnName: string): Promise<boolean> {
  const result = await db.execute({
    sql: `PRAGMA table_info(${tableName})`,
    args: [],
  });

  return result.rows.some((row: any) => row.name === columnName);
}

/**
 * Check if a table exists
 * Helper function for migrations
 */
export async function tableExists(db: Client, tableName: string): Promise<boolean> {
  const result = await db.execute({
    sql: `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
    args: [tableName],
  });

  return result.rows.length > 0;
}
