import { Migration, tableExists } from '../index';

/**
 * Migration: Add color_config table for admin color customization
 *
 * Changes:
 * - Creates color_config table for storing admin color overrides
 * - Allows customization of time code colors and status colors
 */
export const migration: Migration = {
  name: '006_color_config',
  description: 'Add color_config table for admin color customization',

  async up(db) {
    const colorConfigExists = await tableExists(db, 'color_config');
    if (!colorConfigExists) {
      await db.execute(`
        CREATE TABLE color_config (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          config_type TEXT NOT NULL,
          config_key TEXT NOT NULL,
          color_name TEXT NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(config_type, config_key)
        )
      `);
      console.log('     Created color_config table');
    } else {
      console.log('     Table color_config already exists');
    }
  },

  async down(db) {
    await db.execute('DROP TABLE IF EXISTS color_config');
    console.log('     Dropped color_config table');
  },
};
