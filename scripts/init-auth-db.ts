/**
 * Initialize Authentication Database
 *
 * This script creates the auth.db database with user authentication tables.
 * It does NOT touch the attendance.db database, preserving all production data.
 */

import { initializeAuthDatabase } from '../lib/db-auth';

console.log('==========================================');
console.log('  Initialize Authentication Database');
console.log('==========================================');
console.log('');
console.log('Creating auth.db with authentication tables...');
console.log('');

initializeAuthDatabase()
  .then(() => {
    console.log('');
    console.log('==========================================');
    console.log('  SUCCESS!');
    console.log('==========================================');
    console.log('');
    console.log('Authentication database created at: databases/auth.db');
    console.log('');
    console.log('Default admin credentials:');
    console.log('  Username: admin');
    console.log('  Password: admin123');
    console.log('');
    console.log('⚠️  IMPORTANT: Change this password in production!');
    console.log('');
    console.log('Your attendance.db database was NOT modified.');
    console.log('All existing employee and attendance data is preserved.');
    console.log('');
    process.exit(0);
  })
  .catch(err => {
    console.error('');
    console.error('==========================================');
    console.error('  ERROR!');
    console.error('==========================================');
    console.error('');
    console.error('Failed to initialize authentication database:', err);
    console.error('');
    process.exit(1);
  });
