import { Migration, tableExists } from '../index';

export const migration: Migration = {
  name: '010_create_api_keys',
  description: 'Create api_keys table for programmatic API access (keys act on behalf of a user account)',

  async up(db) {
    const hasTable = await tableExists(db, 'api_keys');
    if (!hasTable) {
      await db.execute(`
        CREATE TABLE api_keys (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          key_prefix TEXT NOT NULL,
          key_hash TEXT NOT NULL UNIQUE,
          user_id INTEGER NOT NULL,
          is_active INTEGER NOT NULL DEFAULT 1,
          expires_at DATETIME,
          last_used_at DATETIME,
          created_by INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id),
          FOREIGN KEY (created_by) REFERENCES users(id)
        )
      `);
      await db.execute('CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash)');
      console.log('     Created api_keys table');
    } else {
      console.log('     Table api_keys already exists');
    }
  },

  async down(db) {
    await db.execute('DROP TABLE IF EXISTS api_keys');
  },
};
