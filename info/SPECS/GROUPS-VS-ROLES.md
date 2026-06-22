# Groups vs Roles: Clear Separation of Concerns

This document clarifies the important distinction between **Groups** and **Roles** in the authentication system.

## Core Principle

**Groups** and **Roles** are completely independent and serve different purposes:

- **Group** = **WHAT DATA** you can see (data visibility/scope)
- **Role** = **WHAT ACTIONS** you can perform (permissions)

## Groups: Data Visibility

Groups control which employees and data a user can access:

| Group | Data Access |
|-------|-------------|
| **Master** | All employees, all groups |
| **Managers** | Can view all groups (read visibility) |
| **HR** | Can view all groups |
| **Employees** | Only their own group |

### Group Permissions in Code
```typescript
// From useAuth() context:
isMaster          // User is in Master group
canViewAll        // Group can view all groups
canEditAll        // Group can edit all groups (legacy)
```

## Roles: Action Permissions

Roles control what operations a user can perform on the data they can see:

| Role | Create | Read | Update | Delete | Manage Users | Access All Groups |
|------|--------|------|--------|--------|--------------|-------------------|
| **Administrator** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Manager** | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| **Editor** | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| **Contributor** | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| **Viewer** | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ |
| **Self-Service** | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |

### Role Permissions in Code
```typescript
// From useAuth() context:
isAdministrator    // Has Administrator role (role_id = 1)
isManager          // Has Manager role (role_id = 2)
canCreate          // Role allows creating records
canRead            // Role allows reading records
canUpdate          // Role allows updating records
canDelete          // Role allows deleting records
canManageUsers     // Role allows managing user accounts
canAccessAllGroups // Role grants access to all groups (overrides group restrictions)
```

## Independence: Real-World Examples

### Example 1: Department Manager
- **Group:** Employees (can only see their own department)
- **Role:** Manager (full CRUD on what they can see)
- **Result:** Can fully manage employees in their department, but can't see other departments

### Example 2: Company-Wide Auditor
- **Group:** Master (can see all employees across all departments)
- **Role:** Viewer (read-only access)
- **Result:** Can view all data across the company, but cannot modify anything

### Example 3: HR Specialist
- **Group:** HR (can see all groups)
- **Role:** Editor (can create, read, update but not delete)
- **Result:** Can manage employee records across all departments, but cannot delete records

### Example 4: Admin Assistant
- **Group:** Managers (can view all groups)
- **Role:** Contributor (can create and read only)
- **Result:** Can view all employees and add new records, but cannot modify existing ones

## Migration Notes

The system automatically migrated existing users:
- Users with `is_superuser = 1` → **Administrator** role (role_id: 1)
- Users with `is_superuser = 0` → **Manager** role (role_id: 2)

The `is_superuser` column is now deprecated in favor of the role system.

## Implementation Notes

### Correct Permission Checks

**For Data Visibility (use Group):**
```typescript
if (isMaster || canViewAll) {
  // Show all employees
} else {
  // Show only user's group employees
}
```

**For Action Permissions (use Role):**
```typescript
if (canDelete) {
  // Show delete button
}

if (canManageUsers) {
  // Show user management section
}
```

### Incorrect Pattern (Don't Do This)
```typescript
// ❌ WRONG: Don't check group for action permissions
if (isMaster) {
  // Allow delete - this mixes concerns!
}

// ✓ CORRECT: Check role for action permissions
if (canDelete) {
  // Allow delete
}
```

## Database Schema

### users table
```sql
- group_id: Which group (controls data visibility)
- role_id: Which role (controls action permissions)
```

### groups table
```sql
- is_master: Special admin group flag
- can_view_all: Group can view all groups' data
- can_edit_all: Legacy flag, use roles instead
```

### roles table
```sql
- can_create: Can create new records
- can_read: Can read/view records
- can_update: Can update existing records
- can_delete: Can delete records
- can_manage_users: Can manage user accounts
- can_access_all_groups: Override group restrictions
```

## Future Role Management

Roles are stored in the database and can be edited:
- Role names can be changed (e.g., "Manager" → "Department Lead")
- New roles can be added
- Role permissions can be modified
- A future admin UI can allow role management

This provides flexibility to adapt the system to organizational needs without code changes.
