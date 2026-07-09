import { Migration } from '../index';
import { migration as addSuperuser } from './001_add_superuser_to_users';
import { migration as createUserGroupPermissions } from './002_create_user_group_permissions';
import { migration as addUserPreferences } from './003_add_user_preferences';
import { migration as addRoles } from './004_add_roles';
import { migration as seedJobTitles } from './005_seed_job_titles';
import { migration as colorConfig } from './006_color_config';
import { migration as appSettings } from './007_app_settings';
import { migration as addEmployeeIdToUsers } from './008_add_employee_id_to_users';
import { migration as addMustChangePassword } from './009_add_must_change_password';
import { migration as createApiKeys } from './010_create_api_keys';

/**
 * Auth Database Migrations
 *
 * These migrations are run against the auth.db database
 * on server startup. They are executed in order and tracked
 * in the migrations table.
 *
 * To add a new migration:
 * 1. Create a new file: 00X_migration_name.ts
 * 2. Export a migration object with name, description, and up/down functions
 * 3. Import and add to this array
 */
export const authMigrations: Migration[] = [
  addSuperuser,
  createUserGroupPermissions,
  addUserPreferences,
  addRoles,
  seedJobTitles,
  colorConfig,
  appSettings,
  addEmployeeIdToUsers,
  addMustChangePassword,
  createApiKeys,
];
