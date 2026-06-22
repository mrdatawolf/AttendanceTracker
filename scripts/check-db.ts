import { db } from '../lib/db-sqlite';

async function checkTables() {
  try {
    // Check if tables exist
    const tables = await db.execute(`
      SELECT name FROM sqlite_master WHERE type='table' ORDER BY name
    `);

    console.log('Tables in database:');
    tables.rows.forEach(row => console.log('  -', (row as any).name));

    // Check if admin user exists
    console.log('\nChecking for admin user:');
    try {
      const users = await db.execute('SELECT id, username, full_name, group_id FROM users');
      console.log('Users found:', users.rows.length);
      users.rows.forEach(row => console.log('  -', row));
    } catch (err) {
      console.log('Error querying users:', (err as Error).message);
    }

    // Check groups
    console.log('\nChecking for groups:');
    try {
      const groups = await db.execute('SELECT id, name, is_master, can_view_all, can_edit_all FROM groups');
      console.log('Groups found:', groups.rows.length);
      groups.rows.forEach(row => console.log('  -', row));
    } catch (err) {
      console.log('Error querying groups:', (err as Error).message);
    }
  } catch (err) {
    console.error('Error:', err);
  }

  process.exit(0);
}

checkTables();
