# Multi-User Attendance Application

A modern Next.js-based employee Attendance management system that replaces Excel templates with an enhanced, responsive UI.

## Overview

This application digitizes the traditional Excel-based Attendance process with:
- **Calendar-based attendance entry** - Year, month, and week views with interactive grids
- **Dialog-based editing** - Clean modal interface for entry management
- **Balance tracking** - Real-time tracking of time code usage and limits
- **Theming system** - Trinity (light) and Default (dark) themes with layout customization
- **Settings page** - Centralized application preferences and theme selection
- **Dashboard** - Statistics and summaries (optional feature)
- **Reports** - Filterable reports with CSV export (optional feature)
- **SQLite database** - Fast, reliable data persistence
- **Employee management** - Add and manage employee records with custom time allocations
- **Time code tracking** - Vacation, Holiday, Personal, and more
- **Custom allocations** - Set employee-specific time off limits per year

## Time Codes

The system tracks these time entry codes:
- **D** - Discipline
- **B** - Bereavement (24 Hours PD/16 Unpaid)
- **FE** - Family Emergency
- **FM** - FMLA
- **H** - Holiday
- **JD** - Jury Duty
- **FH** - Floating Holiday (24 Hours total)
- **DP** - Designated Person
- **P** - Personal
- **LOW** - Lack of Work
- **PS** - Personal Sick Day (40 Hours total)
- **T** - Tardy
- **V** - Vacation
- **WC** - Workers Comp

## Tech Stack

- **Frontend**: Next.js 16.0.10 (App Router with Turbopack), React 19, TypeScript
- **UI Components**: shadcn/ui (Radix UI primitives + Tailwind CSS)
- **Database**: SQLite via @libsql/client (Turso/libSQL client)
- **Authentication**: JWT tokens with bcrypt password hashing
- **Styling**: Tailwind CSS 3.4+
- **Icons**: Lucide React
- **Data Export**: json2csv for CSV generation
- **Excel Processing**: xlsx library

## Authentication & Security

The application includes a complete authentication and authorization system with separate concepts for data visibility and action permissions:

### Groups (Data Visibility)
Groups control **which employees/data** a user can see:
- **Master** - Full visibility to all groups and employees
- **Managers** - View all groups (read-only by default)
- **HR** - View and edit all groups
- **Employees** - Limited to own group only

### Roles (Action Permissions)
Roles control **what operations** a user can perform on the data they can see:
- **Administrator** - Full CRUD + user management + access to all groups
- **Manager** - Full CRUD on assigned groups
- **Editor** - Create, read, and update (no delete)
- **Contributor** - Create and read only
- **Viewer** - Read-only access
- **Self-Service** - View and edit own records only

**Key Principle:** Group and Role are independent. A user in the "Employees" group (limited visibility) could have a "Manager" role (full CRUD permissions on what they can see).

- **Audit Logging** - Complete tracking of all data changes
- **Secure Authentication** - JWT tokens with bcrypt password hashing

**Default Admin Account:**
- Username: `admin`
- Password: `admin123`
- ⚠️ **IMPORTANT:** Change this password in production!

See [AUTH-SYSTEM.md](info/AUTH-SYSTEM.md) for complete authentication documentation.

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Initialize database with schema and seed data
npm run db:init

# Start development server
npm run dev
```

Open [http://localhost:6029](http://localhost:6029) to view the application.

### Database Management

> ⚠️ **IMPORTANT:** All databases are stored in the `databases/` folder at the project root. See [DATABASE-LOCATION.md](info/DATABASE-LOCATION.md) for details.

```bash
# Reset database (deletes all data and recreates with auth tables)
npm run db:reset

# Initialize database (create tables and seed data) - LEGACY
npm run db:init

# Run migrations only - LEGACY
npm run db:migrate

# Seed sample data - LEGACY
npm run db:seed
```

**Recommended:** Use `npm run db:reset` to initialize a fresh database with authentication tables and default admin user.

See [DATABASE-MANAGEMENT.md](info/DATABASE-MANAGEMENT.md) for complete database management documentation.

## Project Structure

```
├── app/                          # Next.js app directory
│   ├── api/                      # API routes
│   │   ├── employees/           # Employee CRUD endpoints
│   │   ├── employee-allocations/ # Employee time allocation endpoints
│   │   ├── reports/             # Report generation endpoint
│   │   ├── time-codes/          # Time code endpoints
│   │   ├── app-settings/       # Admin app settings (office capacity, etc.)
│   │   ├── break-entries/      # Break/lunch entry CRUD
│   │   ├── user-employee-link/ # User-to-employee linking API
│   │   └── attendance/          # Attendance entries + daily-summary
│   ├── dashboard/               # Dashboard page (optional)
│   ├── link-employee/           # Employee linking page (forced for unlinked users)
│   ├── reports/                 # Reports page (optional)
│   ├── settings/                # Settings page (theme selection, preferences)
│   ├── attendance/              # Main Attendance page
│   ├── globals.css              # Global styles with Tailwind
│   ├── layout.tsx               # Root layout with navbar
│   └── page.tsx                 # Home/landing page
├── components/
│   ├── ui/                      # shadcn/ui base components
│   ├── balance-cards.tsx        # Time code balance display
│   ├── entry-edit-dialog.tsx   # Entry editing modal
│   ├── employee-allocations-dialog.tsx  # Employee time allocation management
│   ├── navbar.tsx               # Navigation bar
│   ├── providers.tsx            # Context providers (Auth, Theme)
│   ├── office-capacity-settings.tsx # Admin office capacity config
│   ├── employee-link-settings.tsx  # User-employee link management
│   ├── break-entry-widget.tsx      # Break/lunch logging widget
│   ├── attendance-grid.tsx      # Year view table grid component (default)
│   ├── attendance-grid-year-calendar.tsx # Year view calendar card layout (brand option)
│   ├── attendance-grid-month.tsx # Month view calendar grid
│   ├── attendance-grid-week.tsx  # Week view day cards
│   ├── view-toggle.tsx          # Year/Month/Week segmented toggle
│   └── period-navigator.tsx     # Period navigation (arrows, today, year picker)
├── lib/
│   ├── config.ts                # Feature flags and settings
│   ├── db-sqlite.ts             # Database connection
│   ├── app-settings.ts          # App settings helpers (office capacity, etc.)
│   ├── break-tracking.ts        # Break/lunch compliance utilities
│   ├── attendance-types.ts      # Shared attendance type definitions
│   ├── date-helpers.ts          # Date calculation utilities (calendar grids, week bounds)
│   ├── queries-sqlite.ts        # Database queries
│   ├── schema.sql               # Database schema
│   ├── auth-context.tsx         # Authentication context provider
│   ├── theme-context.tsx        # Theme context provider
│   ├── themes/                  # Theme system
│   │   ├── types.ts            # Theme type definitions
│   │   ├── index.ts            # Theme registry
│   │   ├── trinity.ts          # Trinity theme (light)
│   │   ├── default.ts          # Default theme (dark)
│   │   └── README.md           # Theme creation guide
│   └── utils.ts                 # Utility functions
├── scripts/
│   ├── init-db.ts               # Database initialization
│   ├── migrate.js               # Database migration
│   ├── seed.js                  # Sample data seeding
│   └── read-excel.js            # Excel analysis tool
└── examples/
    └── employee attendance 1.xlsx  # Original Excel template
```

## Database Schema

The database includes the following tables:

**Core Tables:**
- `employees` - Employee records with group assignments
- `time_codes` - Time entry code definitions with default allocations
- `attendance_entries` - Daily time entries
- `employee_time_allocations` - Custom time off allocations per employee per year

**Break Tracking Tables:**
- `break_entries` - Break/lunch entries with compliance tracking and override flags

**Authentication & Security Tables (auth.db):**
- `users` - User accounts with encrypted passwords, role assignments, and `employee_id` link
- `roles` - Role definitions with action permissions (Administrator, Manager, Editor, etc.)
- `groups` - User groups controlling data visibility (Master, Managers, HR, Employees)
- `group_permissions` - Granular group-to-group permissions
- `user_group_permissions` - Per-user permissions to specific groups
- `audit_log` - Complete change tracking for all modifications
- `app_settings` - Key-value admin settings (office capacity thresholds, etc.)
- `color_config` - Custom color overrides for time codes and statuses

See [AUTH-SYSTEM.md](info/AUTH-SYSTEM.md) for detailed schema documentation.

## Configuration

The application uses feature flags to enable/disable optional features. Edit `lib/config.ts` to configure:

```typescript
export const config = {
  features: {
    enableDashboard: true,  // Enable/disable dashboard page
    enableReports: true,     // Enable/disable reports page
  },
  app: {
    name: 'Multi-User Attendance',
    version: '1.0.0',
  },
};
```

When features are disabled:
- Navigation links are hidden
- Landing page cards are hidden
- Direct access shows a "feature disabled" message

### Brand-Level Feature Flags (`brand-features.json`)

Brand-specific features are configured in `public/{brand}/brand-features.json`. All brands should include all feature keys — set `"enabled": false` to make a feature available but inactive.

```json
{
  "leaveManagement": { "enabled": true, "leaveTypes": { ... } },
  "approvalWorkflows": { "enabled": true },
  "policyEnforcement": { "enabled": true },
  "accrualCalculations": { "enabled": true },
  "colorCustomization": { "enabled": true, "allowTimeCodeColors": true, "allowStatusColors": true },
  "statusColors": { "warning": "amber", "critical": "red", "normal": "gray" },
  "companyHolidays": { "enabled": true, "year": 2026, "dates": [...] },
  "reports": { "leaveBalanceSummary": { "enabled": true } },
  "breakTracking": { "enabled": true, "breaks": { ... }, "graceMinutes": 5 },
  "officeAttendanceForecast": { "enabled": true, "timeOffCodes": [...], "daysToShow": 5 },
  "globalReadAccess": { "enabled": true, "maxOutOfOffice": 5, "capacityWarningCount": 3, "capacityCriticalCount": 5 },
  "officePresenceTracking": { "enabled": true },
  "attendanceManagement": { "enabled": true, "timeCodeOrder": [...] },
  "attendanceYearLayout": "table"
}
```

| Feature | Description |
|---------|-------------|
| `leaveManagement` | Leave type definitions mapping to time codes |
| `approvalWorkflows` | Approval workflows and submission system |
| `policyEnforcement` | Policy enforcement rules |
| `accrualCalculations` | Leave accrual calculation rules |
| `colorCustomization` | Admin UI for customizing time code and status colors |
| `statusColors` | Default semantic colors for warning/critical/normal states |
| `companyHolidays` | Company holiday dates (greyed out in attendance grids) |
| `reports` | Report configurations (leave balance summary thresholds) |
| `breakTracking` | Break/lunch compliance tracking with configurable windows |
| `officeAttendanceForecast` | Upcoming days-out forecast widget |
| `globalReadAccess` | All users see all attendance data (read-only) with capacity bars |
| `officePresenceTracking` | Navbar toggle buttons for in-office/out-of-office status |
| `attendanceManagement` | Attendance summary with configurable time code display order |
| `attendanceYearLayout` | Year view layout: `"table"` (default 12x31 grid) or `"calendar"` (12 month cards in a 3-column grid) |

**Brand defaults:** Default and BT have most features enabled. Other brands have all keys present but new features disabled.

See [lib/CONFIG.md](lib/CONFIG.md) for detailed configuration documentation.

## Available Scripts

- `npm run dev` - Start development server on port 6029 (with Turbopack)
- `npm run build` - Build for production
- `npm run start` - Start production server on port 6029
- `npm run start:standalone` - Run standalone server from .next/standalone
- `npm run server:package` - Package standalone server for distribution (includes version in startup banner)
- `npm run server:installer` - Build NSIS installer with bundled Node.js (includes version in startup banner)
- `npm run lint` - Run ESLint
- `npm run db:reset` - Reset database with authentication tables (recommended)
- `npm run db:init` - Initialize database with schema and seed data (legacy)
- `npm run db:migrate` - Run database migrations only (legacy)
- `npm run db:seed` - Seed sample data only (legacy)

**Default Port:** 6029 (can be changed in `.env` file)

## Features

### Theming System
- **Trinity Theme** - Light mode with original layout (Balance Cards → Attendance Record)
- **Default Theme** - Dark mode with optimized layout (Attendance Record → Balance Cards)
- Theme selection persists across sessions via localStorage
- Visual month separators in Default theme for improved readability
- Seamless theme switching without page reload
- **Easy to customize**: All themes defined in `lib/themes/` folder
- Create new themes by copying existing theme files and modifying colors/layout
- See [lib/themes/README.md](lib/themes/README.md) for complete theme creation guide

### Settings Page
- Centralized application preferences
- Theme selection (Trinity or Default)
- Accessible via navbar "Settings" link
- Clean, organized settings interface

### Attendance Grid & View Switching
- **Three view modes**: Year, Month, and Week — toggled via a segmented control
- **Year view (table)** — Interactive 31-day × 12-month grid (the default layout)
- **Year view (calendar)** — 12 month cards in a 3-column grid, each with a 7-column Mon–Sun calendar. Enabled via `"attendanceYearLayout": "calendar"` in `brand-features.json`
- **Month view** — Traditional 7-column calendar grid (Mon–Sun) with larger day cells
- **Week view** — 7 day-cards showing entry details, responsive stacking on mobile
- **Period navigation** — Prev/next arrows, year picker, and "Today" button for month/week views
- **View preference** — Saved to localStorage and synced to URL params (`?view=month&month=2026-02`) for bookmarkability
- **Responsive auto-switch** — Screens below 768px auto-switch from year to week view
- Click any cell/card to edit time entry via the same dialog
- Visual indicators for entries with notes
- Invalid dates (e.g., Feb 31) automatically disabled
- Compact, responsive design
- Theme-dependent layout and styling

### Entry Editing
- Modal dialog for clean editing experience
- Time code selection with descriptions
- Hours input (0-24)
- Optional notes field
- Validation and error handling

### Balance Tracking
- Real-time calculation of time code usage
- Dynamic allocation limits per employee (customizable in Users tab)
- Progress bars for limited codes (Floating Holiday, Personal Sick, etc.)
- Color-coded remaining hours
- Separate cards for each time code type
- Automatic sync between Users tab (allocation management) and Attendance tab (balance display)

### Employee Time Allocations
- Customize time off allocations per employee per year
- Override default allocations (e.g., part-time employees with reduced PTO)
- Manage allocations via clock icon in Users tab
- Changes immediately reflected in Attendance tab balance cards
- Revert to defaults option for any allocation
- Support for mid-year adjustments and custom arrangements

### Employee Management
- Add, edit, and deactivate employee records
- **Reactivate deactivated employees** - Master users can view inactive employees and reactivate them with a single click
- Group-based visibility controls
- Custom time allocations per employee

### User-Employee Linking
Each user account is linked to an employee profile via `employee_id` on the users table. This enables:
- **Automatic default selection** — the attendance grid defaults to the logged-in user's own employee
- **Forced linking at login** — non-master-admin users without a linked employee are redirected to `/link-employee` to select or create one
- **Settings page management** — all users can view, change, or create their employee link in **Settings > Employee Profile Link**
- **Master admin exemption** — users in the Master group are never forced to link (they manage all employees)
- **Auto-link on creation** — when an employee is auto-created for a new user's group, the link is set automatically

### Global Read Access & Office Capacity
When the `globalReadAccess` feature flag is enabled in `brand-features.json`, every authenticated user can see all employees' attendance data on their own attendance grid (read-only — write permissions are never affected).

Each cell in the attendance grid shows:
- **Capacity bar** (2px at bottom) — color indicates office staffing level:
  - **Grey** — normal, few people out
  - **Amber/Yellow** — warning threshold reached (configurable # of people out)
  - **Red** — critical threshold reached, or over the hard max-out-of-office limit
- **Badge count** (top-left corner) — number of employees out that day
- **Who's-out popover** — click the badge to see employee names, time codes, and hours

Thresholds are expressed as **people counts** (not percentages), so admins see exactly how many people out triggers each color. Three admin-configurable settings control the behavior:

| Setting | Description | Default |
|---------|-------------|---------|
| `maxOutOfOffice` | Hard cap — badge turns red when exceeded (0 = no limit) | 0 |
| `capacityWarningCount` | # of people out that turns bar yellow | 3 |
| `capacityCriticalCount` | # of people out that turns bar red | 5 |

**Setting resolution chain:** Admin DB override → `brand-features.json` default → hardcoded default

Admins configure these in **Settings > Office Capacity**. Settings are stored in the `app_settings` table in `auth.db`.

When `globalReadAccess` is **disabled** (e.g., Default brand), none of these features appear — the attendance grid works exactly as before with no bars, badges, or popovers.

**Key files:**
- Feature flag: `public/{brand}/brand-features.json` → `globalReadAccess`
- Daily summary API: `app/api/attendance/daily-summary/route.ts`
- Settings helpers: `lib/app-settings.ts`
- Admin UI: `components/office-capacity-settings.tsx`
- Grid rendering: `components/attendance-grid.tsx`

### Break/Lunch Compliance Tracking
When the `breakTracking` feature flag is enabled in `brand-features.json`, the system tracks employee break and lunch compliance:
- **Dashboard widget** — employees log breaks (Break 1, Lunch, Break 2) with one-click buttons
- **Compliance checking** — each break is checked against configured time windows and minimum durations
- **Self-override** — if a break is flagged as non-compliant, the employee can confirm they took it properly
- **Break Compliance Report** — HR can view compliance status across all employees for a date range, with CSV export
- **Configurable windows** — each break type has a start time, end time, required duration, and grace period

### Brand-Specific Time Codes
- Time codes are configured per brand in `brand-features.json`
- Each leave type maps to a specific time code via the `timeCode` property
- Balance cards dynamically use the configured time codes
- Example configuration:
  ```json
  "leaveTypes": {
    "vacation": { "enabled": true, "timeCode": "V", "label": "Vacation" },
    "sickLeave": { "enabled": true, "timeCode": "PSL", "label": "Paid Sick Leave" },
    "floatingHoliday": { "enabled": true, "timeCode": "FLH", "label": "Floating Holiday" },
    "paidHoliday": { "enabled": true, "timeCode": "HL", "label": "Holiday" }
  }
  ```

### Dashboard (Optional)
- Total employees, entries, hours statistics
- Time code usage summary
- Employee activity summary
- Recent entries feed

### Reports (Optional)
- Filter by employee, time code, date range
- Sortable results table
- CSV export functionality
- Real-time query results

## Current Status

✅ **Phase 1: COMPLETE**
- Core Attendance functionality
- Dialog-based editing
- Balance tracking
- Dashboard and reports (optional)

✅ **Phase 2: COMPLETE**
- User-centric permission system
- Granular CRUD permissions
- Superuser role
- User management UI
- Automatic database migrations

✅ **Phase 3: COMPLETE**
- Multiple entries per day
- Enhanced multi-entry dialog
- Validation and balance tracking

⏳ **Phase 4: IN PROGRESS**
- Automated backup system
- 7-day, 4-week, 12-month rotation

⏳ **Phase 5-8: PLANNED**
- Phase 5: Advanced features (approval workflows, analytics, notifications)
- Phase 6: Interactive contextual help system
- Phase 7: Employee self-service portal and enhanced views
- Phase 8: External system integrations (ADP, Paychex, etc.)

## Documentation

All detailed documentation is located in the [`info/`](info/) folder:

### Core Documentation
- **[AUTH-SYSTEM.md](info/AUTH-SYSTEM.md)** - Complete authentication and authorization system documentation
  - User management and groups
  - Permission model and access controls
  - Audit logging
  - Security best practices

- **[DATABASE-LOCATION.md](info/DATABASE-LOCATION.md)** - Database file locations and structure
  - Where databases are stored
  - Why the `databases/` folder approach
  - Migration considerations

- **[DATABASE-MANAGEMENT.md](info/DATABASE-MANAGEMENT.md)** - Database operations guide
  - Initialization and reset procedures
  - Migration scripts
  - Seeding data
  - Backup and restore

- **[DEPLOYMENT.md](info/DEPLOYMENT.md)** - Deployment and build instructions
  - Electron desktop application builds
  - Standalone Node.js server distribution
  - Custom theme and icon configuration
  - Build troubleshooting

### Development Documentation
- **[CHANGES-SUMMARY.md](info/CHANGES-SUMMARY.md)** - Detailed changelog of all features and fixes
  - Phase 1 implementation history
  - Bug fixes and improvements
  - Architecture decisions

### Phase Planning Documentation
- **[PHASE-2-PLAN.md](info/PHASE-2-PLAN.md)** - User-Centric Permission System (COMPLETE)
  - Manager/admin permission system
  - Granular CRUD permissions per user per group
  - Superuser role and user management
  - Automatic database migrations
  - Complete audit trail

- **[PHASE-3-PLAN.md](info/PHASE-3-PLAN.md)** - Multiple Entries Per Day (COMPLETE)
  - Support multiple time entries for same day
  - Enhanced multi-entry dialog
  - Batch update with validation
  - Grid display with *totalHours

- **[PHASE-4-PLAN.md](info/PHASE-4-PLAN.md)** - Automated Backup System (In Progress)
  - 7-day, 4-week, 12-month rotation strategy
  - Manual backup and restore
  - Storage-efficient retention policy

- **[PHASE-5-PLAN.md](info/PHASE-5-PLAN.md)** - Advanced Features (Planned)
  - Approval workflows and submission system
  - Attendance period lockouts
  - Advanced analytics and reporting
  - Email notifications
  - Multi-tenant support

- **[PHASE-6-PLAN.md](info/PHASE-6-PLAN.md)** - Interactive Help System (Planned)
  - Modal help overlays
  - Contextual hover tooltips
  - Welcome tour for new users
  - Progress tracking

- **[PHASE-7-PLAN.md](info/PHASE-7-PLAN.md)** - Employee Self-Service (Planned)
  - Employee portal with read-only attendance
  - Personalized dashboards by role
  - Calendar visualization (month/week views)
  - Manager-employee relationships
  - Enhanced date range filtering

- **[PHASE-8-PLAN.md](info/PHASE-8-PLAN.md)** - External System Integrations (Planned)
  - ADP Workforce Now OAuth 2.0 integration
  - Employee roster sync and timecard export
  - Pluggable integration framework
  - Field mapping and conflict resolution
  - Automated sync scheduling

### Component Documentation
- **[lib/themes/README.md](lib/themes/README.md)** - Theme system creation guide
  - How to create custom themes
  - Theme configuration options
  - Color mode vs theme explained

- **[lib/CONFIG.md](lib/CONFIG.md)** - Feature flags and configuration
  - Enabling/disabling features
  - Configuration options
  - Environment variables

## Contributing

When adding new features or making changes:
1. Update relevant documentation in the `info/` folder
2. Update this README if the change affects core functionality
3. Follow the existing code structure and patterns
4. Add tests for new features
5. Update CHANGES-SUMMARY.md with your changes

## Support

For questions or issues:
1. Check the documentation in the [`info/`](info/) folder first
2. Review the relevant `.md` files for your use case
3. Check existing issues or create a new one

