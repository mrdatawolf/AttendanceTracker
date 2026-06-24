# Phase NFL-1: Attendance & Dashboard Filters

**Status:** Current
**Brand:** NFL

---

## Overview

Three small, independent fixes requested by the NFL brand for the Attendance and Dashboard tabs. No schema changes required.

---

## Goals

### 1. Attendance Tab — Groups dropdown
**File:** `app/attendance/page.tsx` (group filter ~line 324, dropdown render ~line 633-705)

- Exclude the **"Employees"** group from the dropdown's selectable options. This is a display-only exclusion (filter the `groups` array by name before rendering `SelectItem`s) — do **not** delete the group from the database. The group was previously removed via `scripts/cleanup-groups-nfl.ts` and reinstated at the users' request, so the data layer should be left alone; only the filter UI changes.
- Add an **"Inactive"** option to the same dropdown. Selecting it should show inactive employees, reusing the existing `includeInactive=true` query-param pattern already used on the Employees page (`app/employees/page.tsx`, `showInactive` state, ~line 81/128/147). Attendance currently fetches `/api/employees` with no inactive param at all — when "Inactive" is selected, refetch with `includeInactive=true` and filter the grid to show only inactive employees (mirroring how a normal group selection filters to that group).

### 2. Dashboard Tab — Group/Inactive filter parity
**File:** `app/dashboard/page.tsx`

- Add the same Group filter dropdown (including the "Employees" exclusion and "Inactive" option from Goal 1) to the Dashboard tab.
- Wire it into the existing data fetch — `/api/employees`, `/api/dashboard/upcoming-staffing` — so stats cards, the time-code usage list, and the employee summary all respect the selected filter instead of always showing all employees. Note: per CLAUDE.md gotcha #13, Upcoming Staffing is intentionally unfiltered for all-employee office presence visibility — confirm with the user whether that widget specifically should stay unfiltered or also respect the new filter once this phase starts.

### 3. Attendance Summary Report — YTD tab date wrapping
**Files:** `components/reports/report-table.tsx`, `components/reports/report-filters.tsx` (YTD button ~line 185-196)

- The date column in the YTD view wraps onto two lines. Fix via `whitespace-nowrap` on the date `TableCell`/header and/or a `min-w-` constraint on that column, rather than widening the whole table.

---

## Out of Scope
- Re-running or re-deciding the groups cleanup script — explicitly off the table; the data layer stays as the users currently have it.
- Filtering the Upcoming Staffing widget (see note above) unless confirmed during implementation.
