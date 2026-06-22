/**
 * Database Reset Script
 *
 * This script will:
 * 1. Delete the existing database
 * 2. Recreate it with a fresh schema including auth tables
 * 3. Add default time codes, groups, and admin user
 *
 * WARNING: This will DELETE ALL DATA!
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeDatabase } from '../lib/db-sqlite';
import { initializeAuthDatabase } from '../lib/db-auth';

// Get the project root directory (one level up from scripts/)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Database paths are always in the project's databases/ folder
const dbPath = path.join(projectRoot, 'databases', 'attendance.db');
const authDbPath = path.join(projectRoot, 'databases', 'auth.db');

console.log('==========================================');
console.log('  Database Reset Tool');
console.log('==========================================');
console.log('');
console.log('WARNING: This will DELETE ALL existing data!');
console.log('Attendance DB location:', dbPath);
console.log('Auth DB location:', authDbPath);
console.log('');

// Delete existing database files
const filesToDelete = [
  dbPath,
  `${dbPath}-shm`,
  `${dbPath}-wal`,
  authDbPath,
  `${authDbPath}-shm`,
  `${authDbPath}-wal`
];

console.log('Deleting existing database files...');
let filesDeleted = true;
filesToDelete.forEach(file => {
  if (fs.existsSync(file)) {
    try {
      fs.unlinkSync(file);
      console.log('  Deleted:', file);
    } catch (err) {
      if ((err as any).code === 'EBUSY') {
        console.log('  File is locked, will recreate tables instead:', file);
        filesDeleted = false;
      } else {
        throw err;
      }
    }
  }
});

console.log('');
if (filesDeleted) {
  console.log('Creating fresh database with authentication system...');
} else {
  console.log('Database file is locked. Dropping and recreating tables...');
}

async function resetDatabase() {
  // If files weren't deleted (database is locked), drop all tables first
  if (!filesDeleted) {
    const { db } = await import('../lib/db-sqlite');
    const { authDb } = await import('../lib/db-auth');

    // Drop all attendance database tables
    const attendanceTablesToDrop = [
      'attendance_entries',
      'employee_time_allocations',
      'employees',
      'time_codes',
      'migrations'
    ];

    console.log('Dropping attendance database tables...');
    for (const table of attendanceTablesToDrop) {
      try {
        await db.execute(`DROP TABLE IF EXISTS ${table}`);
        console.log(`  ✓ Dropped table: ${table}`);
      } catch (err) {
        console.log(`  ⚠ Could not drop table ${table}:`, (err as Error).message);
      }
    }

    // Drop all auth database tables
    const authTablesToDrop = [
      'audit_log',
      'user_group_permissions',
      'group_permissions',
      'users',
      'groups',
      'app_settings',
      'migrations'
    ];

    console.log('Dropping auth database tables...');
    for (const table of authTablesToDrop) {
      try {
        await authDb.execute(`DROP TABLE IF EXISTS ${table}`);
        console.log(`  ✓ Dropped table: ${table}`);
      } catch (err) {
        console.log(`  ⚠ Could not drop table ${table}:`, (err as Error).message);
      }
    }
    console.log('');
  }

  // Initialize both databases
  await initializeAuthDatabase();
  console.log('');
  await initializeDatabase();

  console.log('');
  console.log('==========================================');
  console.log('  Database reset complete!');
  console.log('==========================================');
  console.log('');
  console.log('The database has been reset with:');
  console.log('  - Authentication tables (users, groups, audit_log, permissions)');
  console.log('  - Default groups: Master, Managers, HR, Employees');
  console.log('  - Default admin user (username: admin, password: admin123)');
  console.log('  - Empty employees table');
  console.log('  - Empty attendance entries');
  console.log('  - 14 default time codes');
  console.log('');
  console.log('⚠️  IMPORTANT: Change the default admin password!');
  console.log('');
  console.log('You can now start the server and login with:');
  console.log('  Username: admin');
  console.log('  Password: admin123');
}

resetDatabase()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error resetting database:', err);
    process.exit(1);
  });
