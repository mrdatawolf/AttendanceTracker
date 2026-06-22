import { Migration, tableExists } from '../index';

/**
 * Migration: Add app_settings table for admin-configurable settings
 *
 * Changes:
 * - Creates app_settings table for key-value admin settings
 * - Used for settings like maxOutOfOffice capacity limit
 */
export const migration: Migration = {
  name: '007_app_settings',
  description: 'Add app_settings table for admin-configurable settings',

  async up(db) {
    const appSettingsExists = await tableExists(db, 'app_settings');
    if (!appSettingsExists) {
      await db.execute(`
        CREATE TABLE app_settings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          key TEXT NOT NULL UNIQUE,
          value TEXT,
          description TEXT,
          updated_by INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('     Created app_settings table');
    } else {
      console.log('     Table app_settings already exists');
    }
  },

  async down(db) {
    await db.execute('DROP TABLE IF EXISTS app_settings');
    console.log('     Dropped app_settings table');
  },
};
