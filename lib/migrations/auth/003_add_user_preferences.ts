import { Migration, columnExists, tableExists } from '../index';

/**
 * Migration: Add user preferences and app settings
 *
 * Changes:
 * - Adds color_mode column to users table for theme preferences
 * - Creates app_settings table for global application settings
 */
export const migration: Migration = {
  name: '003_add_user_preferences',
  description: 'Add user preferences (color_mode) and app_settings table',

  async up(db) {
    // Add color_mode column to users table
    const colorModeExists = await columnExists(db, 'users', 'color_mode');
    if (!colorModeExists) {
      await db.execute(`
        ALTER TABLE users ADD COLUMN color_mode TEXT DEFAULT 'system'
      `);
      console.log('     Added color_mode column to users table');
    } else {
      console.log('     Column color_mode already exists in users table');
    }

    // Create app_settings table
    const settingsTableExists = await tableExists(db, 'app_settings');
    if (!settingsTableExists) {
      await db.execute(`
        CREATE TABLE app_settings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          key TEXT UNIQUE NOT NULL,
          value TEXT,
          description TEXT,
          updated_by INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (updated_by) REFERENCES users(id)
        )
      `);
      console.log('     Created app_settings table');
    } else {
      console.log('     Table app_settings already exists');
    }
  },

  async down(db) {
    // SQLite doesn't support DROP COLUMN easily
    // We'll leave the column for safety
    await db.execute('DROP TABLE IF EXISTS app_settings');
    console.log('     Dropped app_settings table (color_mode column preserved)');
  },
};
