import { Migration, columnExists } from '../index';

export const migration: Migration = {
  name: '009_add_must_change_password',
  description: 'Add must_change_password column to users table for forced first-login password resets',

  async up(db) {
    const hasColumn = await columnExists(db, 'users', 'must_change_password');
    if (!hasColumn) {
      await db.execute('ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0');
      console.log('     Added must_change_password column to users table');
    } else {
      console.log('     Column must_change_password already exists on users table');
    }
  },

  async down(db) {
    console.log('     No-op: Cannot drop column in SQLite');
  },
};
