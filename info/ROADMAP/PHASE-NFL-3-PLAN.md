# Phase NFL-3: Salaried Sick Leave Balances

**Status:** Approved, not started
**Brand:** NFL
**Depends on:** None

---

## Overview

NFL's salaried employees (Managers/Administrators, except Andrea who is an hourly Admin) should see a real PSL used/available balance instead of the generic `"Check ADP"` text currently configured in `public/NFL/brand-features.json` (`leaveManagement.leaveTypes.sickLeave.availableBalanceText`). For salaried employees, sick leave is simple: 40 hours granted at the start of each calendar year, deducted as PSL is used — no hours-worked accrual math needed, unlike the hourly PSL rule already defined under `accrualCalculations.rules.PSL`.

Hourly employees keep the existing "Check ADP" behavior unchanged.

---

## Goals

### 1. Data model: per-employee salaried flag
- Migration: add `is_salaried_psl INTEGER DEFAULT 0` to the `employees` table (`lib/db-sqlite.ts`, alongside `employment_type` ~line 28).
- Add a "Salaried (calculate PSL balance)" checkbox to the Employee edit form, so the flag is a manual, per-employee toggle — not derived from the linked User's role. This handles exceptions like Andrea directly: whoever maintains employee records just leaves her flag off, no special-case logic needed in code.

### 2. One-time rollout data step
- After the migration ships, set `is_salaried_psl = 1` for the employees who are currently salaried (linked Users with role Manager or Administrator), excluding Andrea. This is a manual data update, not a code change — confirm the employee list with the user before applying.

### 3. Accrual rule: calendar-year annual grant
- Add a new PSL accrual path for `is_salaried_psl = 1` employees: 40 hours granted on January 1 each year, deducted as PSL entries are used, no carryover (mirrors the pattern already used for `FLH`'s `annualGrant` type in `lib/accrual-calculations.ts`, but on a calendar-year period rather than FLH's June-start benefit year).
- This is a parallel rule to the existing hourly `PSL` `hoursWorked` rule in `brand-features.json` — both apply to time code `PSL`, but the calculation path used per employee depends on `is_salaried_psl`.

### 4. Display: balance cards & reports
- `components/balance-cards.tsx` (~line 351-366) and `components/balance-breakdown-modal.tsx`: when `is_salaried_psl` is true, show calculated `${remaining}h` (and used/available breakdown) instead of `config.availableBalanceText`. When false, keep current "Check ADP" behavior.
- Ensure `app/api/reports/attendance-management/route.ts` and the Leave Balance Summary report reflect the same calculated balance for salaried employees, so reports and balance cards stay consistent.

---

## Open Questions for Implementation
- Confirm the exact list of employees to flag as salaried during rollout (Goal 2) before applying.
- Confirm whether mid-year hires should get a prorated grant in year one, or the full 40 hours regardless of start date (FLH already has proration brackets — decide if PSL needs the same or can stay simple).
