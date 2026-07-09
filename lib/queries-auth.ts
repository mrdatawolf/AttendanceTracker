import { authDb as db } from './db-auth';

export interface Role {
  id: number;
  name: string;
  description?: string;
  can_create: number;
  can_read: number;
  can_update: number;
  can_delete: number;
  can_manage_users: number;
  can_access_all_groups: number;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: number;
  username: string;
  password_hash: string;
  full_name: string;
  email?: string;
  group_id: number;
  is_active: number;
  is_superuser?: number; // Deprecated, use role_id instead
  role_id?: number;
  employee_id?: number;
  must_change_password?: number;
  color_mode?: 'light' | 'dark' | 'system';
  last_login?: string;
  created_at: string;
  updated_at: string;
}

export interface Group {
  id: number;
  name: string;
  description?: string;
  is_master: number;
  can_view_all: number;
  can_edit_all: number;
  created_at: string;
  updated_at: string;
}

export interface AuditLogEntry {
  id: number;
  user_id: number;
  action: string;
  table_name: string;
  record_id?: number;
  old_values?: string;
  new_values?: string;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export interface GroupPermission {
  id: number;
  group_id: number;
  target_group_id: number;
  can_view: number;
  can_edit: number;
}

// User queries
export async function getUserByUsername(username: string): Promise<User | null> {
  const result = await db.execute({
    sql: 'SELECT * FROM users WHERE username = ? COLLATE NOCASE AND is_active = 1',
    args: [username],
  });
  return (result.rows[0] as unknown as User) || null;
}

export async function getUserById(id: number): Promise<User | null> {
  const result = await db.execute({
    sql: 'SELECT * FROM users WHERE id = ?',
    args: [id],
  });
  return (result.rows[0] as unknown as User) || null;
}

export interface UserWithDetails extends User {
  group?: Group;
  role?: Role;
}

export async function getAllUsers(): Promise<UserWithDetails[]> {
  const result = await db.execute(`
    SELECT
      u.*,
      g.id as group__id,
      g.name as group__name,
      g.description as group__description,
      g.is_master as group__is_master,
      g.can_view_all as group__can_view_all,
      g.can_edit_all as group__can_edit_all,
      r.id as role__id,
      r.name as role__name,
      r.description as role__description,
      r.can_create as role__can_create,
      r.can_read as role__can_read,
      r.can_update as role__can_update,
      r.can_delete as role__can_delete,
      r.can_manage_users as role__can_manage_users,
      r.can_access_all_groups as role__can_access_all_groups
    FROM users u
    LEFT JOIN groups g ON u.group_id = g.id
    LEFT JOIN roles r ON u.role_id = r.id
    ORDER BY u.full_name
  `);

  // Transform flat result into nested structure
  return result.rows.map((row: any) => {
    const user: UserWithDetails = {
      id: row.id,
      username: row.username,
      password_hash: row.password_hash,
      full_name: row.full_name,
      email: row.email,
      group_id: row.group_id,
      is_active: row.is_active,
      is_superuser: row.is_superuser,
      role_id: row.role_id,
      color_mode: row.color_mode,
      last_login: row.last_login,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };

    if (row.group__id) {
      user.group = {
        id: row.group__id,
        name: row.group__name,
        description: row.group__description,
        is_master: row.group__is_master,
        can_view_all: row.group__can_view_all,
        can_edit_all: row.group__can_edit_all,
        created_at: '',
        updated_at: '',
      };
    }

    if (row.role__id) {
      user.role = {
        id: row.role__id,
        name: row.role__name,
        description: row.role__description,
        can_create: row.role__can_create,
        can_read: row.role__can_read,
        can_update: row.role__can_update,
        can_delete: row.role__can_delete,
        can_manage_users: row.role__can_manage_users,
        can_access_all_groups: row.role__can_access_all_groups,
        created_at: '',
        updated_at: '',
      };
    }

    return user;
  });
}

export async function createUser(user: Omit<User, 'id' | 'created_at' | 'updated_at' | 'last_login'>): Promise<User> {
  const result = await db.execute({
    sql: `INSERT INTO users (username, password_hash, full_name, email, group_id, role_id, is_active, is_superuser, color_mode, must_change_password)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      user.username,
      user.password_hash,
      user.full_name,
      user.email || null,
      user.group_id,
      user.role_id || null,
      user.is_active,
      user.is_superuser || 0,
      user.color_mode || 'system',
      user.must_change_password ?? 1,
    ],
  });

  const id = Number(result.lastInsertRowid);
  return { id, ...user, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
}

export async function updateUserLastLogin(userId: number): Promise<void> {
  await db.execute({
    sql: 'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
    args: [userId],
  });
}

export async function setUserEmployeeId(userId: number, employeeId: number): Promise<void> {
  await db.execute({
    sql: 'UPDATE users SET employee_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    args: [employeeId, userId],
  });
}

export async function clearEmployeeIdByEmployee(employeeId: number): Promise<void> {
  await db.execute({
    sql: 'UPDATE users SET employee_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE employee_id = ?',
    args: [employeeId],
  });
}

// Group queries
export async function getAllGroups(): Promise<Group[]> {
  const result = await db.execute('SELECT * FROM groups ORDER BY name');
  return result.rows as unknown as Group[];
}

export async function getGroupById(id: number): Promise<Group | null> {
  const result = await db.execute({
    sql: 'SELECT * FROM groups WHERE id = ?',
    args: [id],
  });
  return (result.rows[0] as unknown as Group) || null;
}

export async function createGroup(group: Omit<Group, 'id' | 'created_at' | 'updated_at'>): Promise<Group> {
  const result = await db.execute({
    sql: `INSERT INTO groups (name, description, is_master, can_view_all, can_edit_all)
          VALUES (?, ?, ?, ?, ?)`,
    args: [
      group.name,
      group.description || null,
      group.is_master || 0,
      group.can_view_all || 0,
      group.can_edit_all || 0,
    ],
  });

  const id = Number(result.lastInsertRowid);
  return { id, ...group, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
}

// Permission queries
export async function getGroupPermissions(groupId: number): Promise<GroupPermission[]> {
  const result = await db.execute({
    sql: 'SELECT * FROM group_permissions WHERE group_id = ?',
    args: [groupId],
  });
  return result.rows as unknown as GroupPermission[];
}

export async function setGroupPermission(
  groupId: number,
  targetGroupId: number,
  canView: boolean,
  canEdit: boolean
): Promise<void> {
  await db.execute({
    sql: `INSERT OR REPLACE INTO group_permissions (group_id, target_group_id, can_view, can_edit)
          VALUES (?, ?, ?, ?)`,
    args: [groupId, targetGroupId, canView ? 1 : 0, canEdit ? 1 : 0],
  });
}

export async function canUserViewGroup(userId: number, targetGroupId: number): Promise<boolean> {
  const user = await getUserById(userId);
  if (!user) return false;

  const group = await getGroupById(user.group_id);
  if (!group) return false;

  // Master group can view all
  if (group.is_master || group.can_view_all) return true;

  // Check specific permission
  const result = await db.execute({
    sql: `SELECT can_view FROM group_permissions
          WHERE group_id = ? AND target_group_id = ? AND can_view = 1`,
    args: [user.group_id, targetGroupId],
  });

  return result.rows.length > 0;
}

export async function canUserEditGroup(userId: number, targetGroupId: number): Promise<boolean> {
  const user = await getUserById(userId);
  if (!user) return false;

  const group = await getGroupById(user.group_id);
  if (!group) return false;

  // Master group can edit all
  if (group.is_master || group.can_edit_all) return true;

  // Check specific permission
  const result = await db.execute({
    sql: `SELECT can_edit FROM group_permissions
          WHERE group_id = ? AND target_group_id = ? AND can_edit = 1`,
    args: [user.group_id, targetGroupId],
  });

  return result.rows.length > 0;
}

// Audit log queries
export async function logAudit(entry: Omit<AuditLogEntry, 'id' | 'created_at'>): Promise<void> {
  await db.execute({
    sql: `INSERT INTO audit_log (user_id, action, table_name, record_id, old_values, new_values, ip_address, user_agent)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      entry.user_id,
      entry.action,
      entry.table_name,
      entry.record_id || null,
      entry.old_values || null,
      entry.new_values || null,
      entry.ip_address || null,
      entry.user_agent || null,
    ],
  });
}

export async function getAuditLog(limit = 100, offset = 0): Promise<AuditLogEntry[]> {
  const result = await db.execute({
    sql: `SELECT al.*, u.username, u.full_name
          FROM audit_log al
          JOIN users u ON al.user_id = u.id
          ORDER BY al.created_at DESC
          LIMIT ? OFFSET ?`,
    args: [limit, offset],
  });
  return result.rows as unknown as AuditLogEntry[];
}

export async function getAuditLogForRecord(tableName: string, recordId: number): Promise<AuditLogEntry[]> {
  const result = await db.execute({
    sql: `SELECT al.*, u.username, u.full_name
          FROM audit_log al
          JOIN users u ON al.user_id = u.id
          WHERE al.table_name = ? AND al.record_id = ?
          ORDER BY al.created_at DESC`,
    args: [tableName, recordId],
  });
  return result.rows as unknown as AuditLogEntry[];
}

export async function getAuditLogForUser(userId: number, limit = 50): Promise<AuditLogEntry[]> {
  const result = await db.execute({
    sql: `SELECT al.*, u.username, u.full_name
          FROM audit_log al
          JOIN users u ON al.user_id = u.id
          WHERE al.user_id = ?
          ORDER BY al.created_at DESC
          LIMIT ?`,
    args: [userId, limit],
  });
  return result.rows as unknown as AuditLogEntry[];
}

// App settings queries (for global admin settings like theme)
export async function getAppSetting(key: string): Promise<string | null> {
  const result = await db.execute({
    sql: 'SELECT value FROM app_settings WHERE key = ?',
    args: [key],
  });
  return result.rows[0] ? (result.rows[0] as any).value : null;
}

export async function setAppSetting(key: string, value: string, userId?: number): Promise<void> {
  await db.execute({
    sql: `INSERT OR REPLACE INTO app_settings (key, value, updated_by, updated_at)
          VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
    args: [key, value, userId || null],
  });
}

// User preferences queries
export async function updateUserColorMode(userId: number, colorMode: 'light' | 'dark' | 'system'): Promise<void> {
  await db.execute({
    sql: 'UPDATE users SET color_mode = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    args: [colorMode, userId],
  });
}

// ============================================================================
// PHASE 2: User-specific CRUD permissions
// ============================================================================

export interface UserGroupPermission {
  id: number;
  user_id: number;
  group_id: number;
  can_create: number;
  can_read: number;
  can_update: number;
  can_delete: number;
  created_at: string;
  updated_at: string;
}

/**
 * Get all group permissions for a user
 */
export async function getUserGroupPermissions(userId: number): Promise<UserGroupPermission[]> {
  const result = await db.execute({
    sql: 'SELECT * FROM user_group_permissions WHERE user_id = ?',
    args: [userId],
  });
  return result.rows as unknown as UserGroupPermission[];
}

/**
 * Get permission for a specific user and group
 */
export async function getUserGroupPermission(userId: number, groupId: number): Promise<UserGroupPermission | null> {
  const result = await db.execute({
    sql: 'SELECT * FROM user_group_permissions WHERE user_id = ? AND group_id = ?',
    args: [userId, groupId],
  });
  return (result.rows[0] as unknown as UserGroupPermission) || null;
}

/**
 * Set CRUD permissions for a user on a specific group
 */
export async function setUserGroupPermission(
  userId: number,
  groupId: number,
  permissions: { can_create: boolean; can_read: boolean; can_update: boolean; can_delete: boolean }
): Promise<void> {
  await db.execute({
    sql: `INSERT OR REPLACE INTO user_group_permissions
          (user_id, group_id, can_create, can_read, can_update, can_delete, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    args: [
      userId,
      groupId,
      permissions.can_create ? 1 : 0,
      permissions.can_read ? 1 : 0,
      permissions.can_update ? 1 : 0,
      permissions.can_delete ? 1 : 0,
    ],
  });
}

/**
 * Remove all permissions for a user on a specific group
 */
export async function removeUserGroupPermission(userId: number, groupId: number): Promise<void> {
  await db.execute({
    sql: 'DELETE FROM user_group_permissions WHERE user_id = ? AND group_id = ?',
    args: [userId, groupId],
  });
}

/**
 * Check if user is a superuser
 */
export async function isSuperuser(userId: number): Promise<boolean> {
  const user = await getUserById(userId);
  return user?.is_superuser === 1;
}

/**
 * Check if user can create employees in a group
 */
export async function canUserCreateInGroup(userId: number, groupId: number): Promise<boolean> {
  // Superuser can do anything
  if (await isSuperuser(userId)) return true;

  // Users can always create in their own group
  const user = await getUserById(userId);
  if (user && user.group_id === groupId) return true;

  const permission = await getUserGroupPermission(userId, groupId);
  return permission?.can_create === 1;
}

/**
 * Check if user can read/view employees in a group
 */
export async function canUserReadGroup(userId: number, groupId: number): Promise<boolean> {
  // Superuser can do anything
  if (await isSuperuser(userId)) return true;

  // Users can always read their own group
  const user = await getUserById(userId);
  if (user && user.group_id === groupId) return true;

  const permission = await getUserGroupPermission(userId, groupId);
  return permission?.can_read === 1;
}

/**
 * Check if user can update employees in a group
 */
export async function canUserUpdateInGroup(userId: number, groupId: number): Promise<boolean> {
  // Superuser can do anything
  if (await isSuperuser(userId)) return true;

  // Users can always update their own group
  const user = await getUserById(userId);
  if (user && user.group_id === groupId) return true;

  const permission = await getUserGroupPermission(userId, groupId);
  return permission?.can_update === 1;
}

/**
 * Check if user can delete employees in a group
 */
export async function canUserDeleteInGroup(userId: number, groupId: number): Promise<boolean> {
  // Superuser can do anything
  if (await isSuperuser(userId)) return true;

  // Users can always delete in their own group
  const user = await getUserById(userId);
  if (user && user.group_id === groupId) return true;

  const permission = await getUserGroupPermission(userId, groupId);
  return permission?.can_delete === 1;
}

/**
 * Get all groups a user can read (view)
 */
export async function getUserReadableGroups(userId: number): Promise<number[]> {
  // Superuser can read all groups
  if (await isSuperuser(userId)) {
    const allGroups = await getAllGroups();
    return allGroups.map(g => g.id);
  }

  const permissions = await getUserGroupPermissions(userId);
  const readableGroupIds = permissions.filter(p => p.can_read === 1).map(p => p.group_id);

  // Always include user's own group
  const user = await getUserById(userId);
  if (user && user.group_id && !readableGroupIds.includes(user.group_id)) {
    readableGroupIds.push(user.group_id);
  }

  return readableGroupIds;
}

/**
 * Get all groups a user can create employees in
 */
export async function getUserCreatableGroups(userId: number): Promise<number[]> {
  // Superuser can create in all groups
  if (await isSuperuser(userId)) {
    const allGroups = await getAllGroups();
    return allGroups.map(g => g.id);
  }

  const permissions = await getUserGroupPermissions(userId);
  return permissions.filter(p => p.can_create === 1).map(p => p.group_id);
}

// ============================================================================
// EXPLICIT-ONLY GROUP PERMISSIONS (no auto-own-group)
// Used by attendance & employees APIs where group membership alone
// should NOT grant access — explicit user_group_permissions entries required.
// ============================================================================

/**
 * Get group IDs where user has explicit can_read=1 permission.
 * Unlike getUserReadableGroups(), does NOT auto-include user's own group.
 */
export async function getExplicitReadableGroupIds(userId: number): Promise<number[]> {
  if (await isSuperuser(userId)) {
    const allGroups = await getAllGroups();
    return allGroups.map(g => g.id);
  }

  const permissions = await getUserGroupPermissions(userId);
  return permissions.filter(p => p.can_read === 1).map(p => p.group_id);
}

/**
 * Check if user has explicit can_read permission for a group.
 * Unlike canUserReadGroup(), does NOT auto-include user's own group.
 */
export async function canUserExplicitlyReadGroup(userId: number, groupId: number): Promise<boolean> {
  if (await isSuperuser(userId)) return true;

  const permission = await getUserGroupPermission(userId, groupId);
  return permission?.can_read === 1;
}

/**
 * Check if user has explicit can_update permission for a group.
 * Unlike canUserUpdateInGroup(), does NOT auto-include user's own group.
 */
export async function canUserExplicitlyUpdateGroup(userId: number, groupId: number): Promise<boolean> {
  if (await isSuperuser(userId)) return true;

  const permission = await getUserGroupPermission(userId, groupId);
  return permission?.can_update === 1;
}

/**
 * Check if user has explicit can_delete permission for a group.
 * Unlike canUserDeleteInGroup(), does NOT auto-include user's own group.
 */
export async function canUserExplicitlyDeleteGroup(userId: number, groupId: number): Promise<boolean> {
  if (await isSuperuser(userId)) return true;

  const permission = await getUserGroupPermission(userId, groupId);
  return permission?.can_delete === 1;
}

// ============================================================================
// ROLE-BASED PERMISSIONS
// ============================================================================

/**
 * Get all roles
 */
export async function getAllRoles(): Promise<Role[]> {
  const result = await db.execute('SELECT * FROM roles ORDER BY id');
  return result.rows as unknown as Role[];
}

/**
 * Get role by ID
 */
export async function getRoleById(id: number): Promise<Role | null> {
  const result = await db.execute({
    sql: 'SELECT * FROM roles WHERE id = ?',
    args: [id],
  });
  return (result.rows[0] as unknown as Role) || null;
}

/**
 * Get user's role
 */
export async function getUserRole(userId: number): Promise<Role | null> {
  const user = await getUserById(userId);
  if (!user || !user.role_id) return null;
  return getRoleById(user.role_id);
}

/**
 * Check if user has Administrator role (role_id = 1)
 */
export async function isAdministrator(userId: number): Promise<boolean> {
  const user = await getUserById(userId);
  return user?.role_id === 1;
}

/**
 * Check if user can create records (based on role)
 */
export async function canUserCreate(userId: number): Promise<boolean> {
  const role = await getUserRole(userId);
  return role?.can_create === 1;
}

/**
 * Check if user can read records (based on role)
 */
export async function canUserRead(userId: number): Promise<boolean> {
  const role = await getUserRole(userId);
  return role?.can_read === 1;
}

/**
 * Check if user can update records (based on role)
 */
export async function canUserUpdate(userId: number): Promise<boolean> {
  const role = await getUserRole(userId);
  return role?.can_update === 1;
}

/**
 * Check if user can delete records (based on role)
 */
export async function canUserDelete(userId: number): Promise<boolean> {
  const role = await getUserRole(userId);
  return role?.can_delete === 1;
}

/**
 * Check if user can manage other users (based on role)
 */
export async function canUserManageUsers(userId: number): Promise<boolean> {
  const role = await getUserRole(userId);
  return role?.can_manage_users === 1;
}

/**
 * Check if user can access all groups (based on role)
 */
export async function canUserAccessAllGroups(userId: number): Promise<boolean> {
  const role = await getUserRole(userId);
  return role?.can_access_all_groups === 1;
}

// ============================================================================
// JOB TITLE MANAGEMENT
// ============================================================================

export interface JobTitle {
  id: number;
  name: string;
  description?: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

/**
 * Get all job titles
 */
export async function getAllJobTitles(): Promise<JobTitle[]> {
  const result = await db.execute('SELECT * FROM job_titles ORDER BY name');
  return result.rows as unknown as JobTitle[];
}

/**
 * Get active job titles only
 */
export async function getActiveJobTitles(): Promise<JobTitle[]> {
  const result = await db.execute('SELECT * FROM job_titles WHERE is_active = 1 ORDER BY name');
  return result.rows as unknown as JobTitle[];
}

/**
 * Get job title by ID
 */
export async function getJobTitleById(id: number): Promise<JobTitle | null> {
  const result = await db.execute({
    sql: 'SELECT * FROM job_titles WHERE id = ?',
    args: [id],
  });
  return (result.rows[0] as unknown as JobTitle) || null;
}

/**
 * Create a new job title
 */
export async function createJobTitle(jobTitle: Omit<JobTitle, 'id' | 'created_at' | 'updated_at'>): Promise<JobTitle> {
  const result = await db.execute({
    sql: `INSERT INTO job_titles (name, description, is_active)
          VALUES (?, ?, ?)`,
    args: [
      jobTitle.name,
      jobTitle.description || null,
      jobTitle.is_active ?? 1,
    ],
  });

  const id = Number(result.lastInsertRowid);
  return { id, ...jobTitle, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
}

/**
 * Update a job title
 */
export async function updateJobTitle(id: number, updates: Partial<Omit<JobTitle, 'id' | 'created_at' | 'updated_at'>>): Promise<JobTitle | null> {
  const setClauses: string[] = [];
  const args: any[] = [];

  if (updates.name !== undefined) {
    setClauses.push('name = ?');
    args.push(updates.name);
  }

  if (updates.description !== undefined) {
    setClauses.push('description = ?');
    args.push(updates.description);
  }

  if (updates.is_active !== undefined) {
    setClauses.push('is_active = ?');
    args.push(updates.is_active);
  }

  if (setClauses.length === 0) {
    return getJobTitleById(id);
  }

  setClauses.push('updated_at = CURRENT_TIMESTAMP');
  args.push(id);

  await db.execute({
    sql: `UPDATE job_titles SET ${setClauses.join(', ')} WHERE id = ?`,
    args,
  });

  return getJobTitleById(id);
}

/**
 * Delete a job title
 */
export async function deleteJobTitle(id: number): Promise<void> {
  await db.execute({
    sql: 'DELETE FROM job_titles WHERE id = ?',
    args: [id],
  });
}

// ============================================================================
// API KEY MANAGEMENT
// ============================================================================

export interface ApiKey {
  id: number;
  name: string;
  key_prefix: string;
  key_hash: string;
  user_id: number;
  is_active: number;
  expires_at?: string;
  last_used_at?: string;
  created_by?: number;
  created_at: string;
}

export interface ApiKeyWithUser extends Omit<ApiKey, 'key_hash'> {
  username?: string;
  user_full_name?: string;
}

/**
 * Get all API keys with their owning user (never exposes key_hash)
 */
export async function getAllApiKeys(): Promise<ApiKeyWithUser[]> {
  const result = await db.execute(`
    SELECT k.id, k.name, k.key_prefix, k.user_id, k.is_active, k.expires_at,
           k.last_used_at, k.created_by, k.created_at,
           u.username, u.full_name as user_full_name
    FROM api_keys k
    LEFT JOIN users u ON k.user_id = u.id
    ORDER BY k.created_at DESC
  `);
  return result.rows as unknown as ApiKeyWithUser[];
}

/**
 * Look up an active, unexpired API key by its hash
 */
export async function getActiveApiKeyByHash(keyHash: string): Promise<ApiKey | null> {
  const result = await db.execute({
    sql: `SELECT * FROM api_keys
          WHERE key_hash = ? AND is_active = 1
            AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
    args: [keyHash],
  });
  return (result.rows[0] as unknown as ApiKey) || null;
}

/**
 * Create an API key record (caller generates and hashes the key)
 */
export async function createApiKey(key: Omit<ApiKey, 'id' | 'is_active' | 'last_used_at' | 'created_at'>): Promise<ApiKeyWithUser> {
  const result = await db.execute({
    sql: `INSERT INTO api_keys (name, key_prefix, key_hash, user_id, expires_at, created_by)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [
      key.name,
      key.key_prefix,
      key.key_hash,
      key.user_id,
      key.expires_at || null,
      key.created_by || null,
    ],
  });

  const id = Number(result.lastInsertRowid);
  const { key_hash, ...rest } = key;
  return { id, is_active: 1, created_at: new Date().toISOString(), ...rest };
}

/**
 * Revoke (deactivate) an API key
 */
export async function revokeApiKey(id: number): Promise<void> {
  await db.execute({
    sql: 'UPDATE api_keys SET is_active = 0 WHERE id = ?',
    args: [id],
  });
}

/**
 * Get an API key by ID (without hash)
 */
export async function getApiKeyById(id: number): Promise<ApiKeyWithUser | null> {
  const result = await db.execute({
    sql: `SELECT k.id, k.name, k.key_prefix, k.user_id, k.is_active, k.expires_at,
                 k.last_used_at, k.created_by, k.created_at,
                 u.username, u.full_name as user_full_name
          FROM api_keys k
          LEFT JOIN users u ON k.user_id = u.id
          WHERE k.id = ?`,
    args: [id],
  });
  return (result.rows[0] as unknown as ApiKeyWithUser) || null;
}

/**
 * Record that an API key was used
 */
export async function touchApiKeyUsage(id: number): Promise<void> {
  await db.execute({
    sql: 'UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?',
    args: [id],
  });
}
