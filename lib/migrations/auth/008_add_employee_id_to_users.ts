import { Migration, columnExists } from '../index';

/**
 * Migration: Add employee_id column to users table
 *
 * Links users (auth.db) to employees (attendance.db) by storing the
 * employee ID directly on the user record. This enables:
 * - Defaulting to the logged-in user's employee in the attendance grid
 * - Forcing non-admin users to link to an employee at login
 */
export const migration: Migration = {
  name: '008_add_employee_id_to_users',
  description: 'Add employee_id column to users table for user-employee linking',

  async up(db) {
    const hasColumn = await columnExists(db, 'users', 'employee_id');
    if (!hasColumn) {
      await db.execute('ALTER TABLE users ADD COLUMN employee_id INTEGER');
      console.log('     Added employee_id column to users table');
    } else {
      console.log('     Column employee_id already exists on users table');
    }
  },

  async down(db) {
    // SQLite doesn't support DROP COLUMN in older versions
    // This is a no-op; the column will remain but be unused
    console.log('     No-op: Cannot drop column in SQLite');
  },
};
