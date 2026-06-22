# Phase 7: Employee Self-Service & Enhanced Views

## Overview

Phase 7 introduces employee-facing features that complement the manager-centric system built in Phase 2. While Phase 2 focused on users (managers/admins) managing employee data, Phase 7 enables employees to view their own attendance records, access personalized dashboards, and provides enhanced visualization tools for both employees and managers.

**Key Distinction:**
- **Phase 2 Users**: Managers/admins who log in to manage multiple employees
- **Phase 7 Employees**: Individual employees who log in to view their own data

## Goals

### 1. Employee Self-Service Portal
- **Employee Login**: Separate authentication for employees to view their own records
- **My Attendance View**: Read-only access to personal attendance history
- **Personal Dashboard**: Individual statistics and time-off balances
- **Profile Viewing**: View personal information and group assignment
- **Request Tracking**: See status of time-off requests (if approval workflows enabled)

### 2. Enhanced Date Range Filtering
- **Date Range Picker**: Select custom start/end dates for attendance views
- **Quick Filters**: "Current Month", "Current Year", "Last 30 Days", "Last Quarter"
- **URL Parameters**: Deep-linkable employee and date selection
- **Persistent Filters**: Remember last-used filter preferences
- **Export by Range**: Download attendance data for selected date ranges

### 3. Calendar Visualization
- **Month View**: Traditional calendar layout showing time codes per day
- **Week View**: Detailed weekly attendance with hourly breakdowns
- **Team Calendar**: See team availability and time-off at a glance
- **Color Coding**: Visual distinction between time code types
- **Hover Details**: Quick preview of entry details on hover
- **Print-Friendly**: Optimized calendar printing for physical records

### 4. Personalized Dashboards
- **Employee Dashboard**: Personal stats, upcoming time off, balance warnings
- **Manager Dashboard**: Team overview, pending approvals, attendance trends
- **Admin Dashboard**: System-wide statistics, user activity, group summaries
- **Customizable Widgets**: Drag-and-drop dashboard customization
- **Role-Based Landing**: Redirect to appropriate dashboard on login

### 5. Manager-Employee Relationships
- **Direct Manager Assignment**: Link employees to their direct manager
- **My Team View**: Managers see only their direct reports
- **Delegation**: Managers can delegate team visibility to other managers
- **Hierarchy Support**: Multi-level organizational structure
- **Manager Notifications**: Alerts when team members request time off

## Technical Architecture

### Database Changes

#### New Tables

```sql
-- Employee login credentials (separate from system users)
CREATE TABLE employee_credentials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL UNIQUE,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  email TEXT,
  last_login DATETIME,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

-- Manager-employee relationships
CREATE TABLE manager_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  manager_id INTEGER NOT NULL,  -- References employees table
  is_primary INTEGER DEFAULT 1,
  assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  assigned_by INTEGER,  -- User who made the assignment
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (manager_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by) REFERENCES users(id),
  UNIQUE(employee_id, manager_id)
);

-- User preferences for filters and dashboard
CREATE TABLE user_preferences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  employee_id INTEGER,
  preference_key TEXT NOT NULL,
  preference_value TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  CHECK ((user_id IS NOT NULL AND employee_id IS NULL) OR (user_id IS NULL AND employee_id IS NOT NULL))
);

-- Dashboard widget configurations
CREATE TABLE dashboard_widgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  employee_id INTEGER,
  widget_type TEXT NOT NULL,  -- 'balance', 'recent_entries', 'team_calendar', etc.
  position INTEGER DEFAULT 0,
  size TEXT DEFAULT 'medium',  -- 'small', 'medium', 'large'
  config TEXT,  -- JSON configuration for widget
  is_visible INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  CHECK ((user_id IS NOT NULL AND employee_id IS NULL) OR (user_id IS NULL AND employee_id IS NOT NULL))
);
```

#### Schema Updates

```sql
-- Add manager flag to employees table
ALTER TABLE employees ADD COLUMN is_manager INTEGER DEFAULT 0;

-- Add default dashboard preference to users
ALTER TABLE users ADD COLUMN default_dashboard TEXT DEFAULT 'manager';  -- 'manager', 'admin', 'employee'
```

### Authentication Updates

**Dual Authentication System:**
- **System Users**: Managers/admins (existing auth.db users table)
- **Employee Users**: Employees with self-service access (new employee_credentials table)

```typescript
// Updated auth types
interface EmployeeAuthUser {
  id: number;
  employee_id: number;
  username: string;
  full_name: string;
  email?: string;
  group_id?: number;
  type: 'employee';  // Distinguish from system users
}

interface SystemAuthUser {
  id: number;
  username: string;
  full_name: string;
  email?: string;
  group_id: number;
  is_superuser?: number;
  type: 'user';  // System user
}

type AuthUser = EmployeeAuthUser | SystemAuthUser;
```

### API Endpoints

#### Employee Authentication
- `POST /api/auth/employee/login` - Employee login
- `POST /api/auth/employee/logout` - Employee logout
- `GET /api/auth/employee/verify` - Verify employee token
- `POST /api/auth/employee/change-password` - Change password

#### Employee Self-Service
- `GET /api/employee/attendance` - Get own attendance (read-only)
- `GET /api/employee/profile` - Get own profile info
- `GET /api/employee/dashboard` - Get personal dashboard data
- `GET /api/employee/balances` - Get time-off balances

#### Manager Relationships
- `GET /api/managers/my-team` - Get direct reports
- `POST /api/managers/assign` - Assign manager to employee (admin only)
- `DELETE /api/managers/unassign` - Remove manager assignment
- `GET /api/managers/team-calendar` - Get team availability

#### Date Range Filtering
- `GET /api/attendance?employeeId=X&startDate=Y&endDate=Z` - Already exists, enhance
- `GET /api/reports/date-range` - Generate reports for date ranges

#### Dashboards
- `GET /api/dashboard/widgets` - Get user's dashboard widgets
- `POST /api/dashboard/widgets` - Save widget configuration
- `PUT /api/dashboard/widgets/:id` - Update widget
- `DELETE /api/dashboard/widgets/:id` - Remove widget

## UI Components

### Employee Portal Pages

#### 1. Employee Login Page (`app/employee/login/page.tsx`)
```tsx
// Separate login page for employees
// Different route from system user login
// Simple username/password form
// Redirect to employee dashboard on success
```

#### 2. Employee Dashboard (`app/employee/dashboard/page.tsx`)
```tsx
// Personal statistics
// Time-off balances with progress bars
// Recent attendance entries
// Upcoming holidays
// Quick links to My Attendance
```

#### 3. My Attendance (`app/employee/attendance/page.tsx`)
```tsx
// Read-only attendance grid
// Same visual layout as manager view
// Only shows logged-in employee's data
// Date range filtering
// Export to PDF/CSV
```

### Enhanced Manager Views

#### 4. Date Range Picker Component (`components/date-range-picker.tsx`)
```tsx
// Calendar popup for selecting date ranges
// Quick filter buttons (This Month, Last Quarter, etc.)
// Apply/Clear buttons
// Persist selection to URL parameters
```

#### 5. Calendar View Component (`components/calendar-view.tsx`)
```tsx
// Traditional calendar grid (month/week views)
// Color-coded time code cells
// Hover tooltips with entry details
// Click to view/edit (if permissions allow)
// Print-friendly styling
```

#### 6. Team Calendar (`app/managers/team-calendar/page.tsx`)
```tsx
// Shows all direct reports in calendar format
// Filter by team member
// Color coding by time code type
// Export team schedule
// Request tracking (if approvals enabled)
```

### Dashboard Widgets

#### Widget Components (`components/dashboard/widgets/*`)
```tsx
// BalanceWidget - Show time-off balances
// RecentEntriesWidget - Last 10 entries
// TeamCalendarWidget - Mini team calendar
// StatsWidget - Key metrics (hours, days off, etc.)
// NotificationsWidget - Recent activity
// QuickLinksWidget - Common actions
```

#### Dashboard Layout (`components/dashboard/dashboard-layout.tsx`)
```tsx
// Grid-based layout system
// Drag-and-drop widget positioning
// Add/remove widgets
// Resize widgets
// Save layout preferences
```

## Implementation Steps

### Phase 7.1: Employee Authentication (2 weeks)
1. Create `employee_credentials` table migration
2. Implement employee authentication endpoints
3. Update auth middleware for dual auth types
4. Create employee login page
5. Add employee password management
6. Update JWT tokens with user type

### Phase 7.2: Employee Self-Service (3 weeks)
1. Create employee dashboard page
2. Build "My Attendance" read-only view
3. Personal profile page
4. Time-off balance display
5. Export personal attendance data
6. Mobile-responsive employee portal

### Phase 7.3: Date Range Filtering (2 weeks)
1. Build date range picker component
2. Add URL parameter support
3. Update attendance API for date ranges
4. Quick filter buttons
5. Save filter preferences
6. Export by date range

### Phase 7.4: Calendar Visualization (3 weeks)
1. Month view calendar component
2. Week view calendar component
3. Color coding system for time codes
4. Hover tooltips and details
5. Print-friendly calendar styles
6. Team calendar view

### Phase 7.5: Manager Relationships (2 weeks)
1. Create manager assignments table
2. Manager assignment UI (admin only)
3. "My Team" filtered view for managers
4. Team-based permissions
5. Manager delegation support
6. Team calendar integration

### Phase 7.6: Personalized Dashboards (3 weeks)
1. Dashboard widget system architecture
2. Individual widget components
3. Drag-and-drop layout system
4. Widget configuration UI
5. Role-based default dashboards
6. Dashboard preferences API

### Phase 7.7: Testing & Polish (2 weeks)
1. Unit tests for employee auth
2. Integration tests for dashboards
3. Permission testing (read-only enforcement)
4. Mobile responsiveness testing
5. Performance optimization
6. Documentation updates

## Security Considerations

### Employee Access Control
- **Read-Only Enforcement**: Employees can ONLY view their own data, never edit
- **Scope Isolation**: Employee tokens can only access own records
- **No Cross-Employee Access**: Employees cannot view other employees' data
- **Manager Verification**: Validate manager-employee relationships before showing team data
- **Audit Logging**: Log all employee portal access

### Permission Matrix

| User Type | Own Data | Team Data | All Employees | User Management |
|-----------|----------|-----------|---------------|-----------------|
| Employee  | Read     | None      | None          | None            |
| Manager   | Read/Write | Read/Write | None      | None            |
| Admin     | Read/Write | Read/Write | Read/Write | None         |
| Superuser | Read/Write | Read/Write | Read/Write | Full         |

### Password Requirements
```typescript
// Employee password policy
const PASSWORD_POLICY = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecialChar: false,  // Optional for employee ease
  expiryDays: 90,  // Force password change every 90 days
};
```

## Success Criteria

- ✅ Employees can log in and view their own attendance
- ✅ Employees cannot access other employees' data
- ✅ Employees cannot edit any attendance records
- ✅ Managers can view only their direct reports
- ✅ Date range filters work across all views
- ✅ Calendar views display correctly for month/week
- ✅ Dashboards are customizable per user type
- ✅ Performance: Dashboard loads in <1s with 1 year of data
- ✅ Mobile: All employee portal pages are mobile-friendly
- ✅ Security audit passes with no critical findings

## Timeline Estimate

- **Phase 7.1 (Employee Auth)**: 2 weeks
- **Phase 7.2 (Self-Service)**: 3 weeks
- **Phase 7.3 (Date Ranges)**: 2 weeks
- **Phase 7.4 (Calendar Views)**: 3 weeks
- **Phase 7.5 (Manager Relations)**: 2 weeks
- **Phase 7.6 (Dashboards)**: 3 weeks
- **Phase 7.7 (Testing)**: 2 weeks

**Total**: 17 weeks (~4 months)

## Dependencies

### Required Libraries
- **react-big-calendar** or **fullcalendar** - Calendar component
- **react-grid-layout** - Dashboard widget positioning
- **date-fns** - Date manipulation and formatting
- **recharts** or **chart.js** - Dashboard charts

### Phase Dependencies
- **Phase 2 (Complete)**: Permission system must be in place
- **Phase 3 (Complete)**: Multiple entries per day support
- **Phase 5 (Optional)**: Approval workflows integrate with employee portal
- **Phase 6 (Optional)**: Help system covers employee portal

## Future Enhancements (Phase 8+)

### Mobile Apps
- Native iOS/Android apps for employees
- Push notifications for approvals
- Biometric login
- Offline viewing of attendance

### Advanced Features
- Time-off request submission (self-service)
- Manager approval from mobile
- Team chat/messaging
- Shift scheduling integration
- GPS-based clock in/out

### Integrations
- Google Calendar sync
- Outlook calendar sync
- Slack notifications
- HRIS system integration

## Migration Notes

### Enabling Employee Portal for Existing Employees

```sql
-- Create credentials for all active employees
INSERT INTO employee_credentials (employee_id, username, password_hash, email)
SELECT
  id,
  LOWER(REPLACE(full_name, ' ', '.')),  -- john.doe
  '$2b$10$...',  -- Default password (must change on first login)
  email
FROM employees
WHERE is_active = 1;
```

### Manager Assignment

```sql
-- Assign managers based on group hierarchy
-- This is organization-specific and requires manual review
INSERT INTO manager_assignments (employee_id, manager_id, is_primary, assigned_by)
VALUES (?, ?, 1, ?);
```

## Rollout Strategy

### Phase 1: Pilot (2 weeks)
- Enable for one department (10-20 employees)
- Collect feedback
- Fix critical bugs
- Refine UI based on usage

### Phase 2: Gradual Rollout (4 weeks)
- Enable for additional departments weekly
- Monitor performance and errors
- Provide training materials
- Support tickets and FAQ

### Phase 3: Full Deployment (2 weeks)
- Enable for all employees
- Announce via email/company-wide
- Provide training sessions
- Monitor adoption rates

**Total Rollout**: 8 weeks

---

**Document Version:** 1.0
**Created:** January 8, 2026
**Status:** Planned
**Expected Duration:** 17 weeks implementation + 8 weeks rollout = 25 weeks (~6 months)
**Priority:** Medium (Nice-to-have after core manager features are solid)
