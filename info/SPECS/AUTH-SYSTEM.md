# Authentication & Authorization System

This document describes the complete authentication and authorization system implemented in the Attendance Management application.

## Overview

The system provides:
- User authentication with username/password
- **Dual permission model**: Groups (data visibility) + Roles (action permissions)
- Hierarchical access control
- Complete audit logging of all changes
- Secure password hashing with bcrypt
- JWT-based session management

### Key Concepts

The authorization system separates two independent concerns:

1. **Groups (Data Visibility)** - Control which employees/data a user can see
   - Master group sees all data
   - HR group sees all data
   - Managers group can view all groups
   - Employees group sees only their own group

2. **Roles (Action Permissions)** - Control what operations a user can perform
   - Administrator: Full CRUD + user management
   - Manager: Full CRUD on accessible data
   - Editor: Create, read, update (no delete)
   - Contributor: Create and read only
   - Viewer: Read-only access
   - Self-Service: View and edit own records only

**Important:** A user's Group and Role are independent. For example:
- An "Employees" group member with "Manager" role can fully manage the employees they can see
- A "Master" group member with "Viewer" role can see all data but only read, not modify

## Database Schema

> 📍 **Database Location:** All databases are stored in the `databases/` folder. See [DATABASE-LOCATION.md](DATABASE-LOCATION.md) for path resolution details.

### Tables

#### `users`
Stores user accounts and credentials.
```sql
- id: Unique user identifier
- username: Login username (unique)
- password_hash: Bcrypt hashed password
- full_name: User's display name
- email: Email address (optional, unique)
- group_id: Reference to groups table (controls data visibility)
- role_id: Reference to roles table (controls action permissions)
- is_superuser: DEPRECATED - use role_id instead
- is_active: 1 for active, 0 for deactivated
- last_login: Timestamp of last successful login
- created_at, updated_at: Timestamps
```

#### `roles`
Defines role-based action permissions.
```sql
- id: Unique role identifier
- name: Role name (Administrator, Manager, Editor, etc.)
- description: Role description
- can_create: 1 if role can create new records
- can_read: 1 if role can read/view records
- can_update: 1 if role can update existing records
- can_delete: 1 if role can delete records
- can_manage_users: 1 if role can create/edit user accounts
- can_access_all_groups: 1 if role grants access to all groups (overrides group restrictions)
- created_at, updated_at: Timestamps
```

**Default Roles:**
1. Administrator (ID: 1) - All permissions enabled
2. Manager (ID: 2) - Full CRUD, no user management, group-restricted
3. Editor (ID: 3) - Create, read, update (no delete)
4. Contributor (ID: 4) - Create and read only
5. Viewer (ID: 5) - Read-only access
6. Self-Service (ID: 6) - Limited to own records

#### `groups`
Defines user groups controlling data visibility.
```sql
- id: Unique group identifier
- name: Group name (unique)
- description: Optional description
- is_master: 1 for master admin group with full access
- can_view_all: 1 to view all groups' data
- can_edit_all: 1 to edit all groups' data
- created_at, updated_at: Timestamps
```

#### `group_permissions`
Defines specific permissions between groups.
```sql
- id: Unique identifier
- group_id: The group that has the permission
- target_group_id: The group being accessed
- can_view: 1 if group_id can view target_group_id's data
- can_edit: 1 if group_id can edit target_group_id's data
- created_at: Timestamp
```

#### `audit_log`
Tracks all data changes in the system.
```sql
- id: Unique log entry identifier
- user_id: User who made the change
- action: 'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT'
- table_name: Table that was modified
- record_id: ID of the record modified
- old_values: JSON of old values (for updates/deletes)
- new_values: JSON of new values (for creates/updates)
- ip_address: Client IP address
- user_agent: Client user agent string
- created_at: Timestamp
```

## Default Groups (Data Visibility)

The system creates four default groups that control which data users can see:

### 1. Master (ID: 1)
- **Data Visibility:** All employees and all groups
- Special administrative group
- `is_master = 1`, `can_view_all = 1`, `can_edit_all = 1`
- Default admin user belongs to this group

### 2. Managers (ID: 2)
- **Data Visibility:** Can view all groups' data
- `can_view_all = 1`, `can_edit_all = 0`
- Intended for supervisors who need visibility across departments
- Actual edit permissions depend on user's role

### 3. HR (ID: 3)
- **Data Visibility:** Can view and modify all groups' data
- `can_view_all = 1`, `can_edit_all = 1`
- Intended for HR personnel managing all employees
- Note: `can_edit_all` is a legacy flag; actual permissions now controlled by role

### 4. Employees (ID: 4)
- **Data Visibility:** Limited to own group only
- `can_view_all = 0`, `can_edit_all = 0`
- Most restrictive data visibility
- What they can do with visible data depends on their role

## Default Admin Account

**Username:** admin
**Password:** admin123

⚠️ **IMPORTANT:** Change this password immediately in production!

## API Endpoints

### Authentication

#### POST `/api/auth/login`
Authenticate a user and receive a JWT token.

**Request:**
```json
{
  "username": "admin",
  "password": "admin123"
}
```

**Response:**
```json
{
  "user": {
    "id": 1,
    "username": "admin",
    "full_name": "System Administrator",
    "email": "admin@attendance.local",
    "group_id": 1,
    "role_id": 1,
    "group": {
      "id": 1,
      "name": "Master",
      "is_master": 1,
      "can_view_all": 1,
      "can_edit_all": 1
    },
    "role": {
      "id": 1,
      "name": "Administrator",
      "description": "Full system access with all permissions",
      "can_create": 1,
      "can_read": 1,
      "can_update": 1,
      "can_delete": 1,
      "can_manage_users": 1,
      "can_access_all_groups": 1
    }
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

The token is also set as an HTTP-only cookie named `auth_token`.

#### POST `/api/auth/logout`
Log out the current user and clear the session.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true
}
```

#### GET `/api/auth/verify`
Verify the current session and get user info.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "user": {
    "id": 1,
    "username": "admin",
    "full_name": "System Administrator",
    "group_id": 1,
    "group": { ... }
  }
}
```

### User Management

#### GET `/api/users`
Get all users (requires view_all permission).

**Query Parameters:**
- `id`: Optional, get a specific user by ID

**Headers:**
```
Authorization: Bearer <token>
```

#### POST `/api/users`
Create a new user (requires Master or HR group).

**Request:**
```json
{
  "username": "jdoe",
  "password": "securepassword",
  "full_name": "John Doe",
  "email": "jdoe@example.com",
  "group_id": 4,
  "is_active": 1
}
```

#### PUT `/api/users`
Update an existing user (requires Master or HR group).

**Request:**
```json
{
  "id": 2,
  "full_name": "Jane Doe",
  "email": "janedoe@example.com",
  "group_id": 3,
  "password": "newpassword"  // Optional
}
```

#### DELETE `/api/users?id=2`
Deactivate a user (requires Master group).

### Group Management

#### GET `/api/groups`
Get all groups (requires authentication).

**Query Parameters:**
- `id`: Optional, get a specific group by ID

#### POST `/api/groups`
Create a new group (requires Master group).

**Request:**
```json
{
  "name": "Sales Team",
  "description": "Sales department users",
  "can_view_all": 0,
  "can_edit_all": 0
}
```

#### PUT `/api/groups`
Update a group (requires Master group).

**Request:**
```json
{
  "id": 5,
  "name": "Sales Team",
  "description": "Updated description",
  "can_view_all": 1
}
```

### Audit Log

#### GET `/api/audit`
View audit log entries (requires Master or HR group).

**Query Parameters:**
- `table`: Filter by table name
- `recordId`: Filter by record ID
- `userId`: Filter by user ID
- `limit`: Number of entries (default 100)
- `offset`: Offset for pagination (default 0)

**Examples:**
- `/api/audit` - Get last 100 entries
- `/api/audit?table=employees&recordId=5` - Get all changes to employee #5
- `/api/audit?userId=2&limit=50` - Get last 50 actions by user #2

## Permission System

### Permission Hierarchy

1. **Master Group** (is_master = 1)
   - Full access to everything
   - Bypasses all permission checks

2. **View/Edit All** (can_view_all, can_edit_all)
   - Can view/edit all groups' data
   - Cannot manage groups (only Master can)

3. **Specific Permissions** (group_permissions table)
   - Grant specific view/edit access between groups
   - Example: Managers can view Employees group

4. **Same Group Access**
   - Users can always view/edit data in their own group
   - This is automatic - no explicit `user_group_permissions` entries needed
   - All CRUD operations are allowed on own group by default

5. **Auto-Employee Creation**
   - When a user first accesses the Employees API and no employees exist in their group
   - System automatically creates an employee record for them
   - Uses user's full_name (split into first/last) and email
   - Only happens for non-superusers

### Permission Checks

Every API endpoint that accesses data performs these checks:

1. **Authentication Check**
   - Is the user logged in with a valid token?

2. **Authorization Check**
   - Is the user's group a Master group? → Allow
   - Does the user's group have view_all/edit_all? → Allow
   - Is this the user's own group? → Allow
   - Does a group_permission exist? → Check permission

3. **Audit Log**
   - Log all CREATE, UPDATE, DELETE operations
   - Include old and new values
   - Track IP address and user agent

## Usage Examples

### Client-Side Authentication

```typescript
// Login
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: 'admin123' })
});

const { user, token } = await response.json();

// Store token for subsequent requests
localStorage.setItem('auth_token', token);

// Make authenticated requests
const employees = await fetch('/api/employees', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

// Logout
await fetch('/api/auth/logout', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

### Managing Users

```typescript
// Create a new user
await fetch('/api/users', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    username: 'jsmith',
    password: 'initialPassword',
    full_name: 'John Smith',
    email: 'jsmith@example.com',
    group_id: 4  // Employees group
  })
});

// Update a user
await fetch('/api/users', {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    id: 5,
    full_name: 'Jonathan Smith',
    group_id: 3  // Move to HR group
  })
});
```

### Viewing Audit Logs

```typescript
// Get recent audit entries
const audit = await fetch('/api/audit?limit=50', {
  headers: { 'Authorization': `Bearer ${token}` }
});

const entries = await audit.json();
console.log(entries);
// [
//   {
//     id: 123,
//     user_id: 1,
//     username: "admin",
//     full_name: "System Administrator",
//     action: "UPDATE",
//     table_name: "employees",
//     record_id: 5,
//     old_values: "{\"first_name\":\"John\"}",
//     new_values: "{\"first_name\":\"Jonathan\"}",
//     ip_address: "192.168.1.100",
//     created_at: "2025-12-29 10:30:00"
//   }
// ]
```

## Security Considerations

### Password Security
- Passwords are hashed using bcrypt with 10 salt rounds
- Original passwords are never stored or logged
- Password hashes are never sent in API responses

### Token Security
- JWT tokens expire after 24 hours
- Tokens are signed with a secret key (set via JWT_SECRET environment variable)
- Tokens are stored in HTTP-only cookies to prevent XSS attacks
- Also supported via Authorization header for API clients

### Audit Trail
- All data modifications are logged
- IP addresses and user agents are tracked
- Old and new values are preserved for all updates
- Cannot be modified or deleted by non-Master users

### Best Practices

1. **Change Default Password**
   ```sql
   UPDATE users
   SET password_hash = <new_hash>
   WHERE username = 'admin';
   ```
   Or use the API to update the admin user's password.

2. **Set JWT Secret**
   ```bash
   # In .env or environment variables
   JWT_SECRET=your-very-secure-random-string-here
   ```

3. **Use HTTPS in Production**
   - Tokens and passwords should only be sent over HTTPS
   - Set `secure: true` for cookies in production

4. **Implement Rate Limiting**
   - Add rate limiting to login endpoint to prevent brute force attacks
   - Consider using a package like `express-rate-limit`

5. **Regular Audit Reviews**
   - Periodically review audit logs for suspicious activity
   - Monitor failed login attempts
   - Check for unauthorized access attempts

## Troubleshooting

### "Unauthorized" Error
- Check that the token is being sent correctly
- Verify the token hasn't expired (24 hours)
- Ensure the user is still active (is_active = 1)

### "Forbidden" Error
- User doesn't have permission for the requested action
- Check the user's group permissions
- Verify group_permissions table for specific grants

### Login Not Working
- Verify username and password are correct (note: username is case-insensitive)
- Check that user is active (is_active = 1)
- Review audit log for failed login attempts
- In development mode, the login endpoint returns debug info (e.g., "User not found", "User is inactive", "Password mismatch")

### Database Reset

To reset the database and recreate all tables including auth tables:

```bash
# Development
npm run db:reset

# Or manually
node scripts/reset-database.js
```

This will:
1. Delete the existing database
2. Create fresh tables (employees, users, groups, etc.)
3. Insert default groups and admin user
4. Insert default time codes

**⚠️ WARNING:** This deletes ALL data including users and audit logs!
