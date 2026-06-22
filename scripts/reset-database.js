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

const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'databases', 'attendance.db');

console.log('==========================================');
console.log('  Database Reset Tool');
console.log('==========================================');
console.log('');
console.log('WARNING: This will DELETE ALL existing data!');
console.log('Database location:', dbPath);
console.log('');

// Delete existing database files
const filesToDelete = [
  dbPath,
  `${dbPath}-shm`,
  `${dbPath}-wal`
];

console.log('Deleting existing database files...');
filesToDelete.forEach(file => {
  if (fs.existsSync(file)) {
    fs.unlinkSync(file);
    console.log('  Deleted:', file);
  }
});

console.log('');
console.log('Creating fresh database with authentication system...');

// Import and run the database initialization from lib/db-sqlite.ts
// We need to use dynamic import since this is a .js file
async function resetDatabase() {
  // Create the database file by importing the db module
  const { initializeDatabase } = await import('../lib/db-sqlite.ts');

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
