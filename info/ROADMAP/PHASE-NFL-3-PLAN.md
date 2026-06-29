# Phase NFL-3: Salaried Sick Leave Balances

**Status:** Approved, not started
**Brand:** NFL
**Depends on:** None

---

## Overview

NFL's actual sick leave policy (`Examples/33. 2026 Paid Sick Leave Policy.pdf`) covers **all** employees under one accrual formula: 1 hour per 30 hours worked, max 80h accrual, max 40h/5-days usage per 12-month period, with rollover. Exempt full-time employees are explicitly handled within that same formula — "considered to have worked 40 hours in each workweek in which they perform any work." That exempt-full-time estimation is already implemented in `lib/accrual-calculations.ts` (`hoursCountedBy.exemptFullTime: { assumedWeeklyHours: 40, condition: 'anyWorkPerformed' }`), and the existing `accrualCalculations.rules.PSL` rule in `public/NFL/brand-features.json` already matches the policy.

There is **no separate flat-grant accrual** for salaried employees — an earlier draft of this plan assumed one and was corrected after reading the policy doc. The real gap is just display: `leaveManagement.leaveTypes.sickLeave.availableBalanceText` ("Check ADP") is applied unconditionally to every employee, hiding the already-correct calculated balance. The estimate is unreliable for hourly/nonexempt employees (this system doesn't track real hours worked), so they should keep "Check ADP." For salaried/exempt-full-time employees the "40h/week if any work performed" assumption is solid enough to show directly.

---

## Goals

### 1. Data model: per-employee salaried flag
- Migration: add `is_salaried_psl INTEGER DEFAULT 0` to the `employees` table (`lib/db-sqlite.ts`, alongside `employment_type` ~line 28), following the existing `ALTER TABLE ... ` try/catch migration pattern (~line 71-77).
- Add a "Salaried (calculate PSL balance)" checkbox to the Employee edit form (`app/employees/page.tsx`, near `employment_type` ~line 799-814), so the flag is a manual, per-employee toggle — not derived from the linked User's role.
- **No scripted rollout/backfill.** Per direction from the user, this is left at the default (0/off) for every employee; managers set it manually per employee as needed. (The earlier draft's "flag these 16 people" data step is explicitly dropped.)

### 2. Display: balance cards & reports
- `components/balance-cards.tsx` (~line 351-366) and `components/balance-breakdown-modal.tsx`: when `is_salaried_psl` is true, run the existing `PSL` `hoursWorked` rule through `calculateAccrual` and show the calculated `${remaining}h` (and used/available breakdown) instead of `config.availableBalanceText`. When false, keep current "Check ADP" behavior.
- Ensure `app/api/reports/attendance-management/route.ts` and the Leave Balance Summary report reflect the same calculated balance for salaried employees, so reports and balance cards stay consistent.
- No new accrual rule type, no new `brand-features.json` rule, no proration logic — this reuses the existing `PSL` rule and engine as-is.

---

## Out of Scope
- Any change to the underlying PSL accrual math — the existing `hoursWorked` rule and exempt-full-time estimation already match the written policy.
- Bulk-flagging any specific set of employees as salaried — left to managers to set per employee going forward.
