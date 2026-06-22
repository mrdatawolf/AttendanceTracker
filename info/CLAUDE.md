# Claude Project Summary

**Quick Reference for AI Assistants**
*Last Updated: February 5, 2026*

---

## What This Project Is

A **Next.js-based employee attendance/timesheet management system** that replaces Excel templates. It tracks employee time off (vacation, sick, holidays, etc.) with a calendar grid interface.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| UI | shadcn/ui (Radix UI + Tailwind CSS) |
| Database | SQLite via @libsql/client (Turso) |
| Auth | JWT tokens + bcrypt |
| Icons | Lucide React |

**Port:** 6029 (default)

---

## Project Structure

```
app/                    # Next.js pages and API routes
  api/                  # REST endpoints
    employees/          # Employee CRUD
    attendance/         # Time entries
    color-config/       # Color configuration (admin)
    dashboard/          # Dashboard-specific endpoints
      upcoming-staffing/ # Upcoming staffing (all users visible)
    groups/             # Group management
    job-titles/         # Job title management
    reports/            # Report generation (permission-filtered)
      leave-balance-summary/ # Leave balance pivot report
    time-codes/         # Time code definitions
  attendance/           # Main attendance page
  dashboard/            # Dashboard page with staffing overview
  employees/            # Employee management page
  settings/             # Settings page
  users/                # User management (admin)

components/
  ui/                   # shadcn/ui base components
  reports/              # Report components
    leave-balance-summary.tsx  # Leave balance pivot table
    leave-balance-export.tsx   # CSV export for leave balances
    report-table.tsx    # Generic report table
    report-filters.tsx  # Report filter controls
    report-export.tsx   # Generic CSV export
  group-management.tsx  # Groups CRUD UI
  job-title-management.tsx  # Job titles CRUD UI
  color-config-management.tsx  # Color customization UI (admin)
  balance-cards.tsx     # Time balance display (with usage alerts)
  attendance-grid.tsx   # Year view calendar grid (with company holidays, time code colors)
  attendance-grid-month.tsx  # Month view (7-column calendar grid)
  attendance-grid-week.tsx   # Week view (7 day-cards, responsive)
  view-toggle.tsx       # Year/Month/Week segmented toggle
  period-navigator.tsx  # Prev/next/today navigation for month/week views
  help-area.tsx         # Contextual help wrapper

hooks/
  use-attendance-cell.ts  # Shared attendance cell logic (colors, display, capacity)
  use-media-query.ts      # SSR-safe responsive breakpoint hook

lib/
  attendance-types.ts   # Shared attendance types (AttendanceEntry, DailySummary, ViewType)
  date-helpers.ts       # Date utilities (calendar grids, week bounds, period navigation)
  db-auth.ts            # Auth database init + migrations
  db-sqlite.ts          # Main database connection
  queries-auth.ts       # Auth-related queries
  queries-sqlite.ts     # Data queries
  auth-context.tsx      # Auth state provider
  help-context.tsx      # Help system provider
  accrual-calculations.ts  # Leave accrual calculation engine
  color-config.ts       # Color configuration utilities
  migrations/           # Database migrations
    auth/               # Auth DB migrations
      005_seed_job_titles.ts  # Seeds default job titles
      006_color_config.ts     # Color configuration table

public/
  {brand}/              # Brand-specific assets (TRL, NFL, etc.)
    help-content.json   # Help tooltips content
    time-codes.json     # Time code definitions
    brand-features.json # Feature flags, holidays, report config
    reports/
      report-definitions.json  # Available reports for this brand

databases/              # SQLite database files (gitignored)
```

---

## Key Concepts

### Authentication Model
- **Users** = System login accounts (managers, admins)
- **Employees** = People whose time is tracked (may not have logins)
- **Groups** = Control data visibility (Master, Managers, HR, Employees)
- **Roles** = Control actions (Administrator, Manager, Editor, Viewer)

**Default Admin:** `admin` / `admin123`

### Database Architecture
Two separate SQLite databases:
1. **auth.db** - Users, groups, roles, permissions, job_titles, audit_log
2. **attendance.db** - Employees, time_codes, attendance_entries, allocations

### Brand System
Multi-tenant via `public/{brand}/` folders. Each brand can have:
- Custom time codes with colors (`time-codes.json`)
- Custom help content (`help-content.json`)
- Feature flags, accrual rules, holidays, reports, color config (`brand-features.json`)
- Report definitions (`reports/report-definitions.json`)

Brand selected at build time via `lib/brand-selection.json`.

### Company Holidays
Company-wide holidays are defined in `brand-features.json` under `features.companyHolidays`:
```json
"companyHolidays": {
  "enabled": true,
  "year": 2026,
  "dates": [
    { "date": "2026-01-01", "name": "New Year's Day" },
    { "date": "2026-12-25", "name": "Christmas Day" }
  ]
}
```
- Holidays appear **greyed out** on the attendance grid (like invalid month days)
- Employees cannot enter time on company holidays
- Holidays must be updated yearly in the JSON file
- Different from **Floating Holidays** which employees can use anytime

### Usage Alert Thresholds
Leave balance cards and reports show color-coded warnings when usage approaches limits:
```json
"reports": {
  "leaveBalanceSummary": {
    "enabled": true,
    "warningThreshold": 0.9,
    "criticalThreshold": 1.0
  }
}
```
- **Warning (amber)**: Usage >= 90% of allocation
- **Critical (red)**: Usage >= 100% of allocation
- Applied to both attendance page balance cards and Leave Balance Summary report

### Color Customization
Admins can customize colors for time codes and status indicators via Settings > Color Configuration.

**Feature flag** in `brand-features.json`:
```json
"colorCustomization": {
  "enabled": true,
  "allowTimeCodeColors": true,
  "allowStatusColors": true
}
```

**Time code colors** in `time-codes.json`:
```json
{
  "code": "V",
  "description": "Vacation",
  "color": "blue"
}
```

**Available colors**: blue, amber, red, teal, purple, green, gray

**Resolution priority**:
1. Database (admin customizations via Settings UI)
2. Brand JSON defaults (`time-codes.json`, `brand-features.json`)
3. System hardcoded defaults

Colors are applied to:
- Attendance grid cells (time code colors)
- Balance cards (status colors for warning/critical)
- Leave Balance Summary report cells (status colors)

### Accrual Calculation Engine
The system supports multiple leave accrual types defined in `brand-features.json`:

| Type | Description | Example |
|------|-------------|---------|
| `quarterly` | Earns hours per quarter | Floating Holiday: 8 hrs/quarter, max 24/year |
| `hoursWorked` | Earns hours based on hours worked | PSL: 1 hr per 30 hrs worked, max 80 |
| `tieredSeniority` | Earns based on years of service | Vacation: Tiers from 40-200 hrs based on tenure |

Accrual rules are brand-specific and support:
- Eligibility wait periods (days, months, years)
- Maximum accrual and usage limits
- Custom accrual periods (calendar year, fiscal year, custom dates)
- Employee type differentiation (full-time, part-time, exempt)

---

## Current Phase: 7 (Reporting)

**Goal:** Build a flexible reporting system with common reports shared across brands and brand-specific custom reports.

**Architecture:**
- Common report components in `components/reports/common/`
- Brand-specific report definitions in `public/{brand}/reports/report-definitions.json`
- Generic report engine that renders reports based on JSON configuration
- Hybrid approach: coded components for complex reports, JSON-driven for simpler custom reports

**See:** [PHASE-7-PLAN.md](PHASE-7-PLAN.md) for detailed implementation plan

---

## Development Phases

| Phase | Status | Description |
|-------|--------|-------------|
| 1 | ✅ | Core attendance grid, entry dialogs, balance cards |
| 2 | ✅ | User permissions, groups, roles, audit logging |
| 3 | ✅ | Multiple entries per day |
| 4 | ✅ | Automated backups (7-day, 4-week, 12-month) |
| 4.5 | ✅ | White labeling, brand URI configuration |
| 6 | ✅ | Contextual help, groups/job titles management |
| **7** | **In Progress** | Reporting system (common + brand-specific reports) |
| 8 | Planned | Leave request & approval workflows |
| 9 | Planned | Policy engine (eligibility, limits, lockouts) |

---

## Common Tasks

### Run Development Server
```bash
npm run dev
```

### Reset Database
```bash
npm run db:reset
```

### Create Migration
1. Create file: `lib/migrations/auth/00X_name.ts`
2. Export `migration` object with `name`, `description`, `up()` function
3. Add to `lib/migrations/auth/migrations.ts` array

### Add New Component
1. Use shadcn/ui pattern (see `components/ui/`)
2. For settings features, add to `app/settings/page.tsx`
3. Create dedicated component file in `components/`

---

## API Patterns

**All endpoints require JWT auth header:**
```typescript
headers: { Authorization: `Bearer ${token}` }
```

**Standard CRUD pattern:**
- `GET /api/{resource}` - List all
- `GET /api/{resource}?id=X` - Get one
- `POST /api/{resource}` - Create
- `PUT /api/{resource}` - Update (id in body)
- `DELETE /api/{resource}?id=X` - Delete

---

## Important Files

| Purpose | File |
|---------|------|
| Auth DB init | `lib/db-auth.ts` |
| Auth queries | `lib/queries-auth.ts` |
| Migrations | `lib/migrations/auth/migrations.ts` |
| Brand config | `lib/brand-selection.json` |
| Help content | `public/{brand}/help-content.json` |
| Time codes | `public/{brand}/time-codes.json` |
| Feature flags | `public/{brand}/brand-features.json` |
| Report definitions | `public/{brand}/reports/report-definitions.json` |
| Accrual engine | `lib/accrual-calculations.ts` |
| Brand features API | `lib/brand-features.ts` |
| Brand reports API | `lib/brand-reports.ts` |
| Color config API | `lib/color-config.ts` |
| Attendance types | `lib/attendance-types.ts` |
| Date helpers | `lib/date-helpers.ts` |
| Attendance cell hook | `hooks/use-attendance-cell.ts` |
| Media query hook | `hooks/use-media-query.ts` |

---

## Gotchas & Patterns

1. **Migrations run on server start** - Auth DB migrations auto-run when any auth endpoint is hit

2. **useCallback + toast = infinite loop** - Don't include `toast` in useCallback dependencies; it causes re-renders

3. **Brand folders** - Each brand (TRL, NFL, etc.) needs its own folder in `public/` with JSON config files

4. **Job titles use name strings** - Currently `employees.role` stores job title name, not ID (future: add foreign key)

5. **Settings page is super-admin only** - Groups and Job Titles management only visible to superusers

6. **Time codes are configured in leaveTypes** - In `brand-features.json`, each leave type in `leaveManagement.leaveTypes` must include a `timeCode` property that maps to the actual code in the database/time-codes.json. Example: `"floatingHoliday": { "enabled": true, "timeCode": "FLH", "label": "Floating Holiday" }`. The accrual rules keys (e.g., `"PSL"`, `"FLH"`, `"V"`) must also match these time codes.

7. **Employees are soft-deleted** - DELETE on employees sets `is_active = 0`, not actual deletion. Reactivation is done via PUT with `is_active: 1`. Master users can view inactive employees via "Show Inactive" toggle and reactivate them.

8. **Username login is case-insensitive** - Usernames are matched using `COLLATE NOCASE` in SQLite. "Patrick", "patrick", and "PATRICK" all match the same user.

9. **Users have automatic CRUD access to their own group** - Users don't need explicit `user_group_permissions` entries to CRUD employees in their own group. The permission functions (`canUserCreateInGroup`, `canUserReadGroup`, `canUserUpdateInGroup`, `canUserDeleteInGroup`) automatically return true if `groupId === user.group_id`.

10. **Auto-employee creation for first user in group** - When a non-superuser accesses the employees API and there are no employees in their group, the system automatically creates an employee record for them using their user info (full_name split into first/last name, email).

11. **Time codes JSON is source of truth** - Brand-specific `time-codes.json` files sync to the database on server start. Set `is_active: 0` in JSON to hide time codes from dropdowns and balance cards.

12. **Users vs Employees** - These are separate entities. A User (in auth.db) is a login account. An Employee (in attendance.db) is someone whose time is tracked. They may or may not be linked.

13. **Dashboard Upcoming Staffing shows ALL employees** - The `/api/dashboard/upcoming-staffing` endpoint is intentionally accessible to all authenticated users and returns ALL employees' upcoming entries. This allows everyone to see office staffing for the next 5 days. Detailed data (balances, allocations) remains protected.

14. **Reports are permission-filtered** - The `/api/reports` endpoint filters data based on user's readable groups. Non-superusers only see report data for employees in their own group or groups they have explicit read permission for.

15. **Dashboard entry display format** - Single entries show as `(CODE+HOURS)` like `(V8)`. Multiple entries for same person/day show as `(*TOTAL)` like `(*5)` to indicate combined hours.

16. **Company Holidays vs Floating Holidays** - Company Holidays are specific dates when the office is closed (greyed out on calendar, defined in `companyHolidays`). Floating Holidays (FH) are hours employees can use anytime (tracked like vacation). Don't confuse the two.

17. **Leave Balance Summary report** - A pivot-table style report showing all employees' leave balances. Uses `attendance_entries.time_code` directly (TEXT field), not a JOIN on `time_code_id`. API endpoint: `/api/reports/leave-balance-summary`.

18. **Report definitions are brand-specific** - Each brand can have different reports in `public/{brand}/reports/report-definitions.json`. Falls back to Default brand if no brand-specific file exists.

19. **API caching** - Report APIs use `export const dynamic = 'force-dynamic'` to prevent Next.js caching and ensure fresh data on each request.

20. **Color customization requires feature flag** - The Color Configuration section in Settings only appears if `colorCustomization.enabled: true` in brand-features.json. Admin overrides are stored in `auth.db` (color_config table), JSON files provide defaults.

21. **Semantic color names** - Colors use semantic names (blue, amber, red, teal, purple, green, gray) that map to Tailwind classes on the client side via `COLOR_CLASS_MAP` objects. Don't use hex codes or Tailwind classes directly in config.

22. **Attendance view switching** - The attendance page supports Year, Month, and Week views via a segmented toggle. View preference is stored in localStorage (key: `attendance_view`). The current view and period are synced to URL params (`?view=month&month=2026-02` or `?view=week&week=2026-02-02`) for bookmarkability. All three views share the same `useAttendanceCell` hook for cell display logic and the same `MultiEntryDialog` for editing. Data is always fetched as a full year — views filter client-side.

23. **Responsive auto-switch** - On screens below 768px, the attendance page auto-switches from year to week view (one-way — doesn't switch back when enlarged, since the user may have manually chosen week). The `useMediaQuery` hook in `hooks/use-media-query.ts` is SSR-safe (returns false before mount).

24. **Attendance page uses Suspense** - Because it uses `useSearchParams`, the attendance page wraps its content in a `<Suspense>` boundary (same pattern as the login page). The actual component is `AttendanceContent`, the default export is the Suspense wrapper.

25. **Dates must use local time, not UTC** - Never use `new Date().toISOString().split('T')[0]` for "today" calculations. `.toISOString()` returns UTC which shifts the date at the wrong local time (e.g., 4 PM PST). Use `getLocalToday()` from `lib/date-helpers.ts` for today's date, or `formatDateStr(date)` for any Date object. For office presence, use `getEffectiveDateForPresence(resetTime)` which applies the configurable reset time.

26. **Office presence reset time** - The office presence buttons reset at a configurable time (default 17:00) instead of midnight. Configure via `officePresenceTracking.resetTime` in `brand-features.json` (HH:MM 24h format). The `getOfficePresenceConfig()` getter in `lib/brand-features.ts` applies the default. The `getEffectiveDateForPresence()` helper in `lib/date-helpers.ts` returns today's date before the reset time and tomorrow's date after it, which naturally resets all presence buttons.

---

## Related Documentation

- [ROADMAP.md](ROADMAP.md) - Phase planning and status
- [PHASE-6-PLAN.md](PHASE-6-PLAN.md) - Current phase details
- [SPECS/](SPECS/) - Technical specifications
- [COMPLETE/](COMPLETE/) - Completed phase plans
