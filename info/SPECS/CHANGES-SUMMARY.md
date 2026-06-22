# Database Path Fix - Changes Summary

## Issue Fixed

**Problem:** Databases were being created in random locations depending on where the Node.js process was started from, instead of always being in the `databases/` folder.

**Root Cause:** Code was using `process.cwd()` which returns the current working directory where the process was started, not the project root.

## Changes Made

### 1. Fixed Database Path Resolution

#### [lib/db-sqlite.ts](lib/db-sqlite.ts)
**Before:**
```typescript
const dbPath = path.join(process.cwd(), 'databases', 'attendance.db');
```

**After:**
```typescript
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// IMPORTANT: Database path is always relative to project root
const dbPath = path.join(projectRoot, 'databases', 'attendance.db');
```

#### [scripts/reset-database.ts](scripts/reset-database.ts)
**Before:**
```typescript
const dbPath = path.join(process.cwd(), 'databases', 'attendance.db');
```

**After:**
```typescript
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const dbPath = path.join(projectRoot, 'databases', 'attendance.db');
```

### 2. Documentation Created/Updated

#### New Documentation:
- **[DATABASE-LOCATION.md](DATABASE-LOCATION.md)** - Complete guide on database path resolution
  - Explains why `process.cwd()` should not be used
  - Shows correct path resolution pattern
  - Troubleshooting section
  - Deployment notes

#### Updated Documentation:
- **[README.md](README.md)**
  - Updated port number from 3000 to 6029
  - Added database location warning
  - Added authentication section
  - Updated available scripts
  - Updated database schema section

- **[DATABASE-MANAGEMENT.md](DATABASE-MANAGEMENT.md)**
  - Added warning about database location
  - Link to DATABASE-LOCATION.md

- **[AUTH-SYSTEM.md](AUTH-SYSTEM.md)**
  - Added database location note
  - Link to DATABASE-LOCATION.md

### 3. Cleanup

- Deleted old `scripts/reset-database.js` (replaced by TypeScript version)
- Removed test files (`test-login.json`, `scripts/check-db.ts`, `scripts/check-password.ts`)

## Why This Approach?

### ✅ Benefits of Using `fileURLToPath` + `import.meta.url`:

1. **Consistent Path Resolution**
   - Always resolves relative to the file's location
   - Independent of where the process is started

2. **Works Across All Environments**
   - Development server
   - Production build
   - Standalone executables
   - Different operating systems

3. **Prevents Data Loss**
   - No more databases created in unexpected locations
   - All data stays in `databases/` folder
   - Easy to backup and manage

### ❌ Why Not `process.cwd()`?

```bash
# Example of the problem:
cd /some/other/directory
npm --prefix /path/to/project run dev
# Database would be created in /some/other/directory/databases/
```

## Verification

To verify the fix is working:

1. **Check the database path:**
   ```bash
   # From any directory, run:
   cd /some/random/directory
   npm --prefix c:\Users\Public\Projects\GitHub\AttendanceTracker run dev

   # Database should still be created in:
   # c:\Users\Public\Projects\GitHub\AttendanceTracker\databases\attendance.db
   ```

2. **Reset the database:**
   ```bash
   npm run db:reset
   ```

3. **Verify only one database exists:**
   ```bash
   # Windows
   dir attendance.db /s

   # Should only show: <project-root>\databases\attendance.db
   ```

## Testing Done

- ✅ Build succeeded with new imports
- ✅ Database reset works correctly
- ✅ Path resolution uses project root
- ✅ Authentication system still working
- ✅ Login endpoint tested successfully

## Files Modified

1. `lib/db-sqlite.ts` - Fixed path resolution
2. `scripts/reset-database.ts` - Fixed path resolution
3. `README.md` - Updated documentation
4. `DATABASE-MANAGEMENT.md` - Added location warning
5. `AUTH-SYSTEM.md` - Added location note

## Files Created

1. `DATABASE-LOCATION.md` - Complete database location guide
2. `CHANGES-SUMMARY.md` - This file

## Files Deleted

1. `scripts/reset-database.js` - Old JavaScript version
2. `test-login.json` - Test file
3. `scripts/check-db.ts` - Debug script
4. `scripts/check-password.ts` - Debug script

## Next Steps

No action required. The fix is complete and tested.

**Important Reminder:**
- Always use `databases/` folder for all database files
- Never use `process.cwd()` for database paths
- Import database from `lib/db-sqlite.ts` for consistent access
- See [DATABASE-LOCATION.md](DATABASE-LOCATION.md) for guidelines

## Server Status

- Default port: **6029** (configured in `.env` and `package.json`)
- Database location: **`<project-root>/databases/attendance.db`**
- Authentication: **Enabled** (default admin:admin123)

---

# Theme System Implementation - Changes Summary

## Feature Added

**Enhancement:** Added a comprehensive theming system with two themes and a dedicated settings page for user preferences.

## Changes Made

### 1. Theme Context and Provider

#### [lib/theme-context.tsx](lib/theme-context.tsx) - CREATED
- Created React context for theme state management
- Implemented localStorage persistence for theme preferences
- Added SSR/SSG support with default fallback values
- Applies dark mode CSS class to `<html>` element based on theme selection
- Two themes available:
  - **Trinity** - Light mode with original layout
  - **Default** - Dark mode with optimized layout

**Key Features:**
- Theme persists across browser sessions
- Prevents flash of wrong theme on page load
- Works with Next.js server-side rendering
- Provides `useTheme()` hook for components

### 2. Settings Page

#### [app/settings/page.tsx](app/settings/page.tsx) - CREATED
- Created dedicated Settings page for user preferences
- Theme selection dropdown with descriptions
- Clean card-based interface using shadcn/ui components
- Organized into "Appearance" section for future settings expansion

**Features:**
- Accessible via navbar "Settings" link
- Clear theme descriptions (Trinity vs Default)
- Immediate theme switching with visual feedback

### 3. Navbar Updates

#### [components/navbar.tsx](components/navbar.tsx) - MODIFIED
- Added "Settings" link to main navigation
- Removed theme toggle from user dropdown menu (moved to Settings page)
- Settings link always visible to authenticated users

### 4. Providers Setup

#### [components/providers.tsx](components/providers.tsx) - MODIFIED
- Wrapped AuthProvider with ThemeProvider
- Ensures theme context available throughout app
- Proper provider hierarchy for React context

### 5. Conditional Layout Rendering

#### [app/attendance/page.tsx](app/attendance/page.tsx) - MODIFIED
- Theme-dependent layout rendering
- **Trinity theme:** Balance Cards → Attendance Record (original layout)
- **Default theme:** Attendance Record → Balance Cards (optimized layout)
- Uses `useTheme()` hook to determine active theme

### 6. Visual Enhancements

#### [components/attendance-grid.tsx](components/attendance-grid.tsx) - MODIFIED
- Added month separators for Default theme
- Small gaps between months for improved readability
- Used React Fragment with proper keys to fix React warnings
- Theme-aware rendering using `useTheme()` hook

## Why These Themes?

### Trinity Theme (Light Mode)
- Original layout preserved for users familiar with existing interface
- Light background for traditional office environments
- Balance Cards displayed first (original design)

### Default Theme (Dark Mode)
- Reduces eye strain for extended use
- Modern dark UI aesthetic
- Attendance Record prioritized (first position)
- Enhanced visual separation between months

## Technical Implementation

### Theme Switching Flow:
1. User navigates to Settings page
2. Selects theme from dropdown
3. `setTheme()` updates context state
4. Theme saved to localStorage
5. JavaScript directly sets CSS variables on `:root` element
6. Components re-render with new theme
7. Layout conditionally changes based on theme

### Color System:
- Colors defined directly in theme configuration files (lib/themes/)
- Each theme has a complete `colors` object with all palette values
- Colors stored as HSL values WITHOUT `hsl()` wrapper (e.g., `'222.2 84% 4.9%'`)
- Tailwind CSS automatically wraps values with `hsl()` when applying classes
- JavaScript applies colors via `root.style.setProperty()` for instant updates

### SSR Compatibility:
- Theme context returns default values during SSR
- Prevents "useTheme must be used within a ThemeProvider" errors
- Client-side hydration applies saved theme from localStorage

## Files Created

1. **lib/theme-context.tsx** - Theme context provider with CSS variable management
2. **lib/themes/types.ts** - TypeScript interfaces for theme configuration
3. **lib/themes/index.ts** - Theme registry and utility functions
4. **lib/themes/trinity.ts** - Trinity (light) theme configuration
5. **lib/themes/default.ts** - Default (dark) theme configuration
6. **lib/themes/README.md** - Complete theme system documentation
7. **app/settings/page.tsx** - Settings page with theme selection

## Files Modified

1. **components/navbar.tsx** - Added Settings link, removed theme from dropdown
2. **components/providers.tsx** - Added ThemeProvider wrapper
3. **app/attendance/page.tsx** - Conditional layout and authentication checks
4. **components/attendance-grid.tsx** - Month separators based on theme config
5. **app/globals.css** - Simplified CSS variables (no dark mode classes)
6. **tailwind.config.ts** - Removed `darkMode` configuration (not needed)
7. **README.md** - Updated with theme system documentation
8. **CHANGES-SUMMARY.md** - This update

## Configuration

**Tailwind CSS:**
- CSS variables defined in `:root` with default values
- Theme system overrides variables via JavaScript
- No `darkMode` configuration needed (colors set directly)

**Next.js:**
- Client components use `'use client'` directive
- ThemeProvider handles client-side only operations
- SSR-compatible with default fallback values

**Theme Files:**
- Each theme is a simple TypeScript configuration object
- Colors use HSL format: `'hue saturation% lightness%'`
- Easy to create new themes by copying existing files

## Testing Done

- ✅ Build succeeds without errors
- ✅ Theme switching works correctly
- ✅ localStorage persistence working
- ✅ Layout changes based on theme
- ✅ Month separators appear only in Default theme
- ✅ No React key warnings
- ✅ SSR/SSG pre-rendering works
- ✅ Settings page accessible via navbar
- ✅ Dark mode styles applied correctly

## Next Steps

Settings page is now ready for additional preferences:
- Email notification settings
- Date format preferences
- Time zone selection
- Display density options
- Language preferences

## Version

**Current Version:** 0.8.0 (includes theme system)

---

# Dynamic Employee Allocations - Changes Summary

## Feature Added

**Enhancement:** Employee time allocations now dynamically load in the Attendance tab, displaying custom allocation limits set in the Users tab.

## Changes Made

### 1. Attendance Page - Dynamic Allocations Loading

#### [app/attendance/page.tsx](app/attendance/page.tsx) - MODIFIED
- Added `TimeAllocation` interface for type safety
- Added `allocations` state to store employee-specific time allocations
- Added `pathname` tracking from `usePathname()` hook
- Modified `loadAttendanceData()` to fetch allocations from API endpoint
- Added parallel data fetching for attendance entries and allocations
- Added pathname-based effect to reload data when navigating to Attendance tab
- Passed `allocations` prop to `BalanceCards` component

**Key Features:**
- Allocations automatically reload when switching to Attendance tab
- Uses authentication token for secure API access
- Parallel data fetching for optimal performance
- Real-time sync with Users tab allocation changes

### 2. Balance Cards - Dynamic Display

#### [components/balance-cards.tsx](components/balance-cards.tsx) - MODIFIED
- Added `TimeAllocation` interface
- Updated `BalanceCardsProps` to accept `allocations` array
- Added `getAllocatedHours()` helper function to lookup allocation by time code
- Replaced hardcoded limits (24h, 40h) with dynamic values from allocations
- Updated all balance card displays to use dynamic allocation data

**Previous Behavior:**
- Floating Holiday limit: Hardcoded 24 hours
- Personal Sick Days limit: Hardcoded 40 hours

**New Behavior:**
- Floating Holiday limit: Retrieved from employee allocations or default
- Personal Sick Days limit: Retrieved from employee allocations or default
- All time codes use database-driven allocation limits

### 3. Data Flow

**Complete Workflow:**
1. Admin opens Users tab and clicks clock icon for employee
2. `EmployeeAllocationsDialog` loads current allocations from API
3. Admin modifies allocation (e.g., Personal Sick Days from 40h to 20h)
4. POST request saves new allocation to `employee_time_allocations` table
5. User switches to Attendance tab
6. Pathname change triggers data reload
7. GET request fetches updated allocations from API
8. `BalanceCards` displays new limit (20h instead of 40h)

### 4. API Integration

**Endpoint Used:** `/api/employee-allocations`
- **GET:** Retrieves all time codes with employee-specific overrides
- Returns combined data: default allocations + custom overrides
- Requires authentication (Bearer token)
- Parameters: `employeeId`, `year`

**Response Structure:**
```json
{
  "employee_id": 2,
  "year": 2026,
  "allocations": [
    {
      "time_code": "PS",
      "time_code_id": 11,
      "description": "Personal Sick Day",
      "default_allocation": 40,
      "allocated_hours": 20,
      "is_override": true,
      "notes": null
    }
  ]
}
```

## Why This Enhancement?

### Benefits:
1. **Flexibility:** Different employees can have different time allocations
2. **Accuracy:** Balance cards reflect actual employee entitlements
3. **Real-time Updates:** Changes in Users tab immediately visible in Attendance tab
4. **Centralized Management:** All allocation changes managed through one interface
5. **Database-Driven:** No hardcoded limits in frontend code

### Use Cases:
- Part-time employees with reduced PTO allocations
- New employees with prorated time off
- Custom arrangements per employment contract
- Mid-year allocation adjustments

## Technical Implementation

### Navigation-Based Reload:
```typescript
useEffect(() => {
  if (pathname === '/attendance' && selectedEmployeeId && token) {
    loadAttendanceData();
  }
}, [pathname]);
```

### Parallel Data Fetching:
```typescript
const [attendanceRes, allocationsRes] = await Promise.all([
  fetch(`/api/attendance?employeeId=${selectedEmployeeId}&year=${year}`),
  fetch(`/api/employee-allocations?employeeId=${selectedEmployeeId}&year=${year}`, {
    headers: { Authorization: `Bearer ${token}` }
  })
]);
```

### Dynamic Allocation Lookup:
```typescript
const getAllocatedHours = (code: string): number => {
  const allocation = allocations.find(a => a.time_code === code);
  return allocation?.allocated_hours ?? 0;
};
```

## Files Modified

1. **app/attendance/page.tsx** - Added allocations state and API fetching
2. **components/balance-cards.tsx** - Dynamic allocation display

## Testing Done

- ✅ Allocations load correctly when opening Attendance tab
- ✅ Changes made in Users tab reflect immediately after navigation
- ✅ Authentication token properly included in API requests
- ✅ Pathname change triggers data reload
- ✅ Fallback to default allocations when no override exists
- ✅ All time codes display correct limits

## Known Behavior

**Important:** The employee allocations are based on:
1. Custom allocations set in Users tab (if exists)
2. Default allocations from time_codes table (fallback)

**Example:**
- Personal Sick Days default: 40 hours
- If custom allocation set to 20 hours → displays 20h
- If custom allocation deleted → reverts to 40h

## Next Steps

No action required. The feature is complete and working correctly.

**Usage:**
1. Navigate to Users tab
2. Click clock icon for any employee
3. Adjust their time allocations as needed
4. Switch to Attendance tab to see updated balance limits

## Version

**Current Version:** 0.8.1 (includes dynamic employee allocations)

---

# User Authentication & Permissions Improvements - Changes Summary

*February 2, 2026*

## Features Added

### 1. Case-Insensitive Username Login

**Problem:** Usernames were case-sensitive, causing login failures when users typed "Patrick" instead of "patrick".

**Solution:** Added `COLLATE NOCASE` to username queries in SQLite.

#### Files Modified:
- **lib/queries-auth.ts** - `getUserByUsername()` now uses case-insensitive comparison
- **app/api/auth/login/route.ts** - Debug query also case-insensitive

**Code Change:**
```sql
-- Before
SELECT * FROM users WHERE username = ? AND is_active = 1

-- After
SELECT * FROM users WHERE username = ? COLLATE NOCASE AND is_active = 1
```

### 2. Automatic Own-Group CRUD Permissions

**Problem:** Users needed explicit `user_group_permissions` entries to access their own group's data.

**Solution:** Modified all CRUD permission functions to automatically return `true` if the target group is the user's own group.

#### Files Modified:
- **lib/queries-auth.ts** - Updated 5 functions:
  - `canUserCreateInGroup()` - Added own-group check
  - `canUserReadGroup()` - Added own-group check
  - `canUserUpdateInGroup()` - Added own-group check
  - `canUserDeleteInGroup()` - Added own-group check
  - `getUserReadableGroups()` - Includes own group in results
- **app/api/employees/route.ts** - Also includes own group in readable groups

**Code Pattern:**
```typescript
export async function canUserReadGroup(userId: number, groupId: number): Promise<boolean> {
  if (await isSuperuser(userId)) return true;

  // Users can always read their own group
  const user = await getUserById(userId);
  if (user && user.group_id === groupId) return true;

  const permission = await getUserGroupPermission(userId, groupId);
  return permission?.can_read === 1;
}
```

### 3. Auto-Employee Creation for First User in Group

**Problem:** When a new user logged in and their group had no employees, they couldn't use the system.

**Solution:** When fetching employees, if a non-superuser's group has no employees, automatically create an employee record for them.

#### Files Modified:
- **app/api/employees/route.ts** - Added auto-creation logic in GET handler

**Behavior:**
1. Non-superuser requests employee list
2. System filters to their readable groups
3. If no employees exist in user's own group:
   - Parse user's `full_name` into first/last name
   - Create employee with user's email
   - Log audit entry with `auto_created: true`
   - Include new employee in response

### 4. Enhanced Login Debugging (Development Mode)

**Problem:** Login failures gave generic "Invalid username or password" with no debug info.

**Solution:** In development mode, the login endpoint now provides specific debug info.

#### Files Modified:
- **app/api/auth/login/route.ts** - Added detailed error checking

**Debug Messages:**
- `"User not found"` - Username doesn't exist in database
- `"User is inactive"` - User exists but `is_active = 0`
- `"Password mismatch"` - Username correct but password wrong

### 5. Time Codes JSON as Source of Truth

**Problem:** Time codes in brand JSON files weren't syncing properly to the database.

**Solution:** On server start, all time codes from JSON sync to database, including `is_active` status.

#### Files Modified:
- **lib/db-sqlite.ts** - Syncs brand time codes during database initialization
- **lib/brand-time-codes.ts** - Added `includeInactive` parameter
- **app/api/time-codes/route.ts** - Syncs all codes, returns only active
- **components/balance-cards.tsx** - Hides cards for inactive time codes

**Behavior:**
- JSON `is_active: 0` → Time code hidden from dropdowns and balance cards
- JSON `is_active: 1` → Time code visible and usable
- Database always matches JSON on server restart

## Files Created
None

## Files Modified

1. **lib/queries-auth.ts** - Case-insensitive login, own-group permissions
2. **app/api/auth/login/route.ts** - Debug logging, case-insensitive query
3. **app/api/employees/route.ts** - Auto-employee creation, own-group permissions
4. **lib/db-sqlite.ts** - Time code sync from JSON
5. **lib/brand-time-codes.ts** - Added includeInactive parameter
6. **app/api/time-codes/route.ts** - Syncs all, returns active only
7. **components/balance-cards.tsx** - Hides inactive time code cards
8. **info/CLAUDE.md** - Updated documentation
9. **info/SPECS/AUTH-SYSTEM.md** - Updated documentation
10. **info/SPECS/CHANGES-SUMMARY.md** - This section

## Testing Done

- ✅ Login works with any case (Patrick, PATRICK, patrick)
- ✅ Users can access their own group without explicit permissions
- ✅ Auto-employee created when first user in group
- ✅ Time codes sync from JSON on server start
- ✅ Inactive time codes hidden from UI
- ✅ Build succeeds

## Breaking Changes
None - all changes are backward compatible.

## Version

**Current Version:** 0.8.2 (includes user auth improvements)

---

# Dashboard Upcoming Staffing & Reports Permissions - Changes Summary

*February 2, 2026*

## Features Added

### 1. Dashboard "Upcoming Staffing" Section

**Enhancement:** Added a 5-day staffing overview to both dashboard pages (`/` and `/dashboard`) showing who will be out or working remotely.

#### Files Created:
- **app/api/dashboard/upcoming-staffing/route.ts** - New API endpoint for upcoming staffing data

#### Files Modified:
- **app/page.tsx** - Added upcoming staffing section to home page
- **app/dashboard/page.tsx** - Added upcoming staffing section to dashboard page

**Features:**
- Shows next 5 days in a responsive grid (5 columns on desktop, 1 on mobile)
- Displays employee name, time code, and hours for each entry
- Single entry: `Patrick M. (V8)` - Vacation, 8 hours
- Multiple entries: `Patrick M. (*5)` - Multiple codes totaling 5 hours
- Shows "No entries" when a day has no scheduled time off/remote work
- **Intentionally shows ALL employees** - lets everyone see office staffing

**API Endpoint:** `GET /api/dashboard/upcoming-staffing?days=5`
- Available to ALL authenticated users (not permission-filtered)
- Returns only basic info: employee name, date, time code, hours
- Does NOT expose sensitive balance/allocation data
- Filters to active employees only

### 2. Reports API Permission Filtering

**Problem:** The reports page showed all employees' data regardless of user permissions.

**Solution:** Added authentication and group-based permission filtering to the reports API.

#### Files Modified:
- **app/api/reports/route.ts** - Complete rewrite with permission filtering

**Changes:**
- Added authentication check (returns 401 if not logged in)
- Superusers see all employee data
- Non-superusers only see:
  - Employees in their own group
  - Employees in groups they have explicit read permission for
  - Employees with no group assigned

**Code Pattern:**
```typescript
if (!userIsSuperuser) {
  const readableGroupIds = await getUserReadableGroups(authUser.id);
  if (authUser.group_id && !readableGroupIds.includes(authUser.group_id)) {
    readableGroupIds.push(authUser.group_id);
  }
  sql += ` AND (e.group_id IS NULL OR e.group_id IN (${placeholders}))`;
}
```

## Technical Implementation

### Dashboard Staffing Data Flow:
1. User loads dashboard page
2. `loadDashboardData()` fetches from `/api/dashboard/upcoming-staffing?days=5`
3. API queries attendance_entries joined with employees for date range
4. Frontend groups entries by employee per day
5. Multiple entries for same person/day consolidated with total hours

### Entry Grouping Logic:
```typescript
const entriesByEmployee = upcomingStaffingData
  .filter(entry => entry.entry_date === dateStr)
  .reduce((acc, entry) => {
    const key = `${entry.first_name}-${entry.last_name}`;
    if (!acc[key]) {
      acc[key] = { firstName, lastName, entries: [], totalHours: 0 };
    }
    acc[key].entries.push({ timeCode, hours });
    acc[key].totalHours += hours;
    return acc;
  }, {});
```

### Display Format:
- Single entry: `(${timeCode}${hours})` → `(V8)`
- Multiple entries: `(*${totalHours})` → `(*5)`

## Files Created

1. **app/api/dashboard/upcoming-staffing/route.ts** - Staffing data endpoint

## Files Modified

1. **app/page.tsx** - Home page with staffing section
2. **app/dashboard/page.tsx** - Dashboard page with staffing section
3. **app/api/reports/route.ts** - Permission-filtered reports
4. **info/CLAUDE.md** - Updated documentation
5. **info/SPECS/CHANGES-SUMMARY.md** - This section

## Testing Done

- ✅ Dashboard shows upcoming staffing for all employees
- ✅ Multiple entries per person/day consolidated correctly
- ✅ Reports filtered by user's readable groups
- ✅ Superusers see all report data
- ✅ Non-superusers only see their group's data
- ✅ No authentication errors on dashboard

## Breaking Changes

None - all changes are backward compatible.

## Version

**Current Version:** 0.8.3 (includes dashboard staffing & reports permissions)
