/**
 * One-time cleanup script for NFL production client.
 *
 * Actions:
 *   1. Delete the 'Team Leaders' group (must have no users)
 *   2. Delete the 'Employee' group (must have no users)
 *   3. Move all users in the 'HR' group into the 'Admin' group
 *
 * Run with:  npx tsx scripts/cleanup-groups-nfl.ts --dry-run
 * Use --dry-run to preview changes without committing them.
 *
 * Dependencies needed: @libsql/client (already installed by the app — no extras required)
 */

import { createClient } from '@libsql/client';
import { getDatabasePath } from '../lib/data-paths';

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  const dbPath = getDatabasePath('auth.db');
  console.log(`Database: ${dbPath}\n`);

  const db = createClient({ url: `file:${dbPath}` });

  if (DRY_RUN) {
    console.log('=== DRY RUN — no changes will be written ===\n');
  }

  // ── 1. Snapshot current state ───────────────────────────────────────────────
  const groupsRes = await db.execute('SELECT id, name FROM groups ORDER BY id');
  console.log('Current groups:');
  for (const row of groupsRes.rows) {
    const r = row as any;
    console.log(`  [${r.id}] ${r.name}`);
  }
  console.log();

  const groups = groupsRes.rows as any[];
  const find = (name: string) => groups.find((g) => g.name === name);

  const grpTeamLeaders = find('Team Leaders');
  const grpEmployees    = find('Employees');
  const grpHR          = find('HR');
  const grpAdmin       = find('Admin');

  // ── 2. Pre-flight checks ────────────────────────────────────────────────────
  let ok = true;

  if (!grpTeamLeaders) { console.warn("⚠️  Group 'Team Leaders' not found — skipping delete."); }
  if (!grpEmployees)    { console.warn("⚠️  Group 'Employees' not found — skipping delete."); }
  if (!grpHR)          { console.warn("⚠️  Group 'HR' not found — skipping HR→Admin migration."); }
  if (!grpAdmin)       { console.error("✗  Group 'Admin' not found — cannot move HR users. Aborting."); ok = false; }

  for (const grp of [grpTeamLeaders, grpEmployees].filter(Boolean)) {
    const usersRes  = await db.execute({ sql: 'SELECT COUNT(*) AS n FROM users WHERE group_id = ?', args: [grp.id] });
    const userCount = (usersRes.rows[0] as any).n;
    if (userCount > 0) {
      console.error(`✗  Group '${grp.name}' still has ${userCount} user(s). Remove them first.`);
      ok = false;
    } else {
      console.log(`✓  Group '${grp.name}' has no users — safe to delete.`);
    }
  }

  if (!ok) {
    console.error('\nPre-flight checks failed. No changes made.');
    process.exit(1);
  }
  console.log();

  // ── 3. Show HR users that will move ─────────────────────────────────────────
  if (grpHR && grpAdmin) {
    const hrUsersRes = await db.execute({
      sql: 'SELECT id, username, full_name FROM users WHERE group_id = ?',
      args: [grpHR.id],
    });
    if (hrUsersRes.rows.length === 0) {
      console.log("No users found in 'HR' group — nothing to migrate.");
    } else {
      console.log(`Users to move from '${grpHR.name}' → '${grpAdmin.name}':`);
      for (const u of hrUsersRes.rows) {
        const r = u as any;
        console.log(`  [${r.id}] ${r.username} (${r.full_name})`);
      }
      console.log();
    }
  }

  if (DRY_RUN) {
    console.log('Dry run complete — re-run without --dry-run to apply changes.');
    process.exit(0);
  }

  // ── 4. Move HR users to Admin ───────────────────────────────────────────────
  if (grpHR && grpAdmin) {
    await db.execute({
      sql: 'UPDATE users SET group_id = ? WHERE group_id = ?',
      args: [grpAdmin.id, grpHR.id],
    });
    console.log(`✓ Moved HR users to Admin`);
  }

  // ── 5. Delete empty groups ──────────────────────────────────────────────────
  for (const grp of [grpTeamLeaders, grpEmployees].filter(Boolean)) {
    await db.execute({ sql: 'DELETE FROM groups WHERE id = ?', args: [grp.id] });
    console.log(`✓ Deleted group '${grp.name}' (id: ${grp.id})`);
  }

  // ── 6. Confirm final state ──────────────────────────────────────────────────
  console.log('\nGroups after cleanup:');
  const finalRes = await db.execute('SELECT id, name FROM groups ORDER BY id');
  for (const row of finalRes.rows) {
    const r = row as any;
    console.log(`  [${r.id}] ${r.name}`);
  }

  console.log('\nDone.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
