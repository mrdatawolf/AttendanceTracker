import { authDb } from '../lib/db-auth';

async function checkAuthDb() {
  console.log('Checking auth.db structure...\n');

  // Check tables
  const tablesResult = await authDb.execute(`
    SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;
  `);

  console.log('📋 Tables in auth.db:');
  for (const row of tablesResult.rows) {
    console.log(`  - ${(row as any).name}`);
  }

  // Check users table structure
  console.log('\n👤 Users table columns:');
  const usersColumnsResult = await authDb.execute(`PRAGMA table_info(users)`);
  for (const row of usersColumnsResult.rows) {
    const col = row as any;
    console.log(`  - ${col.name} (${col.type})`);
  }

  // Check if is_superuser exists
  const hasSuperuser = usersColumnsResult.rows.some((row: any) => row.name === 'is_superuser');
  console.log(`\n✓ is_superuser column exists: ${hasSuperuser}`);

  // Check user_group_permissions table
  const hasPermissionsTable = tablesResult.rows.some((row: any) => row.name === 'user_group_permissions');
  console.log(`✓ user_group_permissions table exists: ${hasPermissionsTable}`);

  // Check migrations table
  console.log('\n📝 Applied migrations:');
  try {
    const migrationsResult = await authDb.execute('SELECT * FROM migrations ORDER BY id');
    for (const row of migrationsResult.rows) {
      const migration = row as any;
      console.log(`  - ${migration.name}: ${migration.description}`);
    }
  } catch (e) {
    console.log('  ⚠️  No migrations table found');
  }

  // Check admin user
  console.log('\n👨‍💼 Admin user:');
  const adminResult = await authDb.execute(`SELECT id, username, is_superuser FROM users WHERE username = 'admin'`);
  if (adminResult.rows.length > 0) {
    const admin = adminResult.rows[0] as any;
    console.log(`  - ID: ${admin.id}`);
    console.log(`  - Username: ${admin.username}`);
    console.log(`  - is_superuser: ${admin.is_superuser !== undefined ? admin.is_superuser : 'MISSING'}`);
  } else {
    console.log('  ⚠️  No admin user found');
  }

  process.exit(0);
}

checkAuthDb().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
