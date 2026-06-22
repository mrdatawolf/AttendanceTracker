import { authDb } from '../lib/db-auth';
import { getUserReadableGroups, isSuperuser } from '../lib/queries-auth';

async function checkPermissions() {
  console.log('Checking admin user permissions...\n');

  // Check if admin is superuser
  const adminIsSuperuser = await isSuperuser(1);
  console.log(`✓ Admin is superuser: ${adminIsSuperuser}`);

  // Get readable groups for admin
  const readableGroups = await getUserReadableGroups(1);
  console.log(`\n📋 Readable groups for admin (user ID 1): [${readableGroups.join(', ')}]`);

  // Check user_group_permissions table
  console.log('\n📝 User group permissions in database:');
  const permissionsResult = await authDb.execute('SELECT * FROM user_group_permissions');
  if (permissionsResult.rows.length === 0) {
    console.log('  ⚠️  No permissions found in user_group_permissions table');
  } else {
    for (const row of permissionsResult.rows) {
      const perm = row as any;
      console.log(`  - User ${perm.user_id} -> Group ${perm.group_id}: R=${perm.can_read} W=${perm.can_update} C=${perm.can_create} D=${perm.can_delete}`);
    }
  }

  // Check all groups
  console.log('\n📋 All groups:');
  const groupsResult = await authDb.execute('SELECT id, name FROM groups ORDER BY id');
  for (const row of groupsResult.rows) {
    const group = row as any;
    console.log(`  - Group ${group.id}: ${group.name}`);
  }

  process.exit(0);
}

checkPermissions().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
