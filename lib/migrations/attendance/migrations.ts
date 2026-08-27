import { Migration } from '../index';
import { getCurrentBrand } from '../../brand-time-codes';
import { migration as nflSalariedVacationRules } from './001_nfl_salaried_vacation_rules';

/**
 * Attendance Database Migrations
 *
 * These migrations are run against the attendance.db database on server
 * startup, tracked in its `migrations` table (mirrors lib/migrations/auth).
 *
 * To add a new migration:
 * 1. Create a new file: 00X_migration_name.ts
 * 2. Export a migration object with name, description, and up/down functions
 * 3. Import and add to this array
 *
 * Brand-specific migrations (like nflSalariedVacationRules) are filtered
 * out here, at list-construction time, rather than inside their own up()
 * with an early return. runMigrations() marks anything it runs as applied
 * whether or not the migration did real work — so a brand check inside
 * up() would permanently mark a no-op as "done", and it would never get a
 * second chance to actually run even if brand-selection.json were fixed
 * later. Keeping a brand-mismatched migration out of this array entirely
 * means it's simply never recorded, and stays eligible to run once the
 * brand is right.
 */
const brand = getCurrentBrand();

export const attendanceMigrations: Migration[] = [
  ...(brand === 'NFL' ? [nflSalariedVacationRules] : []),
];
