# Phase NFL-4: Dashboard Zeros, Password Indicator, Nav Order

**Status:** Approved, not started
**Brand:** NFL
**Depends on:** None

---

## Overview

Three small, independent fixes requested by the NFL brand.

---

## Goals

### 1. Dashboard showing 0s when it should have information
**Files:** `app/page.tsx` (root landing route), `app/dashboard/page.tsx` (stats cards, Time Code Usage/Employee Summary/Entries list)

**Two separate causes found, both fixed:**

1. **Real root cause:** `app/page.tsx` (the page rendered at `/`, which is what users actually land on after login — not `/dashboard`) was a ~300-line stale duplicate of the dashboard that never fetched `/api/attendance` at all. Its `entries` state was permanently `[]`, so every entries-derived stat (Total Entries, Total Hours, Time Codes, Time Code Usage, Employee Summary, Recent Entries) showed 0 regardless of any date window. Fixed by deleting the duplicate and making `/` redirect to `/dashboard` (preserving the existing `last_visited_page` redirect-to-last-page behavior for other routes). `/dashboard` already has strictly more functionality (group/inactive filters from NFL-1, forecast widget, break widget, pagination), so this is a net improvement with no lost behavior.
2. **Secondary issue, also fixed:** even on the real `/dashboard` page, the entries-driven widgets were scoped to a forward-looking "Next 5 Days" window (`today` to `today+4`), which is usually empty since people log PTO for the recent past or just-in-time. Extended to "Next 14 Days" (`today` to `today+13`) per user direction, with matching label updates. The separate "Upcoming Staffing" card (own `/api/dashboard/upcoming-staffing` fetch, own 5-column grid) was intentionally left at 5 days — extending it would need a layout redesign and wasn't part of this ask.

Verified live: after the fix, `/api/attendance?startDate=2026-06-25&endDate=2026-07-08` correctly returns the real entry on 2026-07-03, and the dashboard renders Total Entries: 1, Total Hours: 8.0, with that entry showing in Time Code Usage, Employee Summary, and the Entries list.

### 2. User edit: show "*****" placeholder when a password is already set
**Files:** `app/users/page.tsx` (password input ~line 516-525, `formData.password` init ~line 81, 178, 188), `app/api/users/route.ts` (password_hash stripped from response ~line 54, 61)

- Today the password field is always blank when editing a user, with no indication of whether one is already set. The API already strips `password_hash` from every user object returned, so there's no flag for the frontend to key off of.
- Add a `has_password: boolean` to the API response in `app/api/users/route.ts` (derived from whether `password_hash` is non-null — do not expose the hash itself).
- In `app/users/page.tsx`, when editing a user where `has_password` is true and the password field is untouched, show `*****` (as a placeholder, not a real value) so a manager can see a password already exists without it being readable or accidentally cleared. Leaving the field as `*****`/untouched on save must **not** overwrite the existing password — only submit a new password if the manager actually types one in.

### 3. Reorder header nav tabs
**File:** `components/navbar.tsx` (`NAV_ITEMS` array, line 27-33)

- Current order: Attendance, Employees, Users, Dashboard, Reports.
- Reorder `NAV_ITEMS` to: Dashboard, Attendance, Reports, Employees, Users. The array order drives the rendered tab order directly (`enabledItems` filters but preserves array order), so this is a straight reordering of the literal array — no changes to the filtering/permission logic in lines 52-57 needed.

---

## Out of Scope
- Any new password-strength/visibility features beyond the "*****" set-indicator — this is not a password reveal or change-password flow, just a "something is already set" signal.
- Changing which nav items are visible to which roles — only the order of existing items changes.
