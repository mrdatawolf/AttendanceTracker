# Leave Management System - Technical Specification

**Phases 5-9 Detailed Design**
**Last Updated:** January 15, 2026
**Status:** Planning

---

## Overview

This document provides detailed technical specifications for implementing the leave management system across Phases 5-9. These features are brand-configurable, with initial implementation targeting the NFL brand (North Fork Lumber and related companies).

### Reference Documents

Policy documents are located in `examples/Polices/`:
- `32. 2026 Floating Holiday Policy.pdf`
- `33. 2026 Paid Sick Leave Policy.pdf`
- `32. Vacation Policy.docx`

---

## Phase 5: Employee Data & Brand Features

### 5.1 Employee Table Extensions

Add the following columns to the `employees` table:

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `hire_date` | DATE | YES | NULL | Original date of hire |
| `rehire_date` | DATE | YES | NULL | Most recent rehire date (if applicable) |
| `employment_type` | TEXT | YES | 'full_time' | 'full_time' or 'part_time' |
| `seniority_rank` | INTEGER | YES | NULL | Tiebreaker for same hire_date (1-5, 5=most senior) |

**Migration Script Requirements:**
- Add columns with NULL defaults
- Existing employees retain NULL values until updated
- No data loss on migration

**Seniority Calculation:**
```sql
-- Order employees by seniority (most senior first)
SELECT * FROM employees
WHERE is_active = 1
ORDER BY
  COALESCE(rehire_date, hire_date) ASC,  -- Earlier date = more senior
  seniority_rank DESC NULLS LAST          -- Higher rank = more senior (when dates match)
```

### 5.2 Brand Feature Configuration

Each brand folder will contain a `brand-features.json` file:

**File Location:** `public/<brand>/brand-features.json`

**Schema:**
```json
{
  "$schema": "./brand-features.schema.json",
  "brandId": "NFL",
  "features": {
    "leaveManagement": {
      "enabled": true,
      "leaveTypes": {
        "vacation": { "enabled": true },
        "sickLeave": { "enabled": true },
        "floatingHoliday": { "enabled": true },
        "paidHoliday": { "enabled": true }
      }
    },
    "approvalWorkflows": {
      "enabled": true
    },
    "policyEnforcement": {
      "enabled": true
    },
    "accrualCalculations": {
      "enabled": true
    }
  }
}
```

**Default Brand Configuration:**
```json
{
  "brandId": "Default",
  "features": {
    "leaveManagement": { "enabled": false },
    "approvalWorkflows": { "enabled": false },
    "policyEnforcement": { "enabled": false },
    "accrualCalculations": { "enabled": false }
  }
}
```

### 5.3 Feature Flag Utility

Create `lib/brand-features.ts`:

```typescript
interface BrandFeatures {
  leaveManagement: {
    enabled: boolean;
    leaveTypes: Record<string, { enabled: boolean }>;
  };
  approvalWorkflows: { enabled: boolean };
  policyEnforcement: { enabled: boolean };
  accrualCalculations: { enabled: boolean };
}

export function getBrandFeatures(): BrandFeatures;
export function isFeatureEnabled(feature: string): boolean;
export function isLeaveTypeEnabled(leaveType: string): boolean;
```

### 5.4 UI Updates

**Employee Edit Form:**
- Add hire date picker
- Add rehire date picker (optional, collapsible)
- Add employment type dropdown (Full-time / Part-time)
- Add seniority rank input (1-5, only shown when hire_date matches another employee)

**Employee List:**
- Add hire date column (sortable)
- Add employment type column (filterable)

---

## Phase 6: Leave Types & Balance Tracking

### 6.1 Database Schema

**Table: `leave_types`**
| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PRIMARY KEY | |
| `code` | TEXT UNIQUE | 'VAC', 'SICK', 'FH', 'HOL' |
| `name` | TEXT | Display name |
| `description` | TEXT | |
| `year_type` | TEXT | 'calendar' or 'custom' |
| `year_start_month` | INTEGER | 1-12 (for custom year) |
| `year_start_day` | INTEGER | 1-31 (for custom year) |
| `is_active` | INTEGER | 1 or 0 |
| `created_at` | DATETIME | |

**Table: `employee_balances`**
| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PRIMARY KEY | |
| `employee_id` | INTEGER FK | |
| `leave_type_id` | INTEGER FK | |
| `year` | INTEGER | The year this balance applies to |
| `balance_hours` | REAL | Current available balance |
| `used_hours` | REAL | Hours used this year |
| `accrued_hours` | REAL | Hours accrued (for accrual-based types) |
| `carried_over_hours` | REAL | Hours carried from previous year |
| `adjusted_hours` | REAL | Manual adjustments |
| `updated_at` | DATETIME | |
| `updated_by` | INTEGER FK | User who last updated |

**Table: `balance_adjustments`** (Audit Log)
| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PRIMARY KEY | |
| `employee_balance_id` | INTEGER FK | |
| `adjustment_type` | TEXT | 'manual', 'accrual', 'usage', 'payout', 'carryover' |
| `hours` | REAL | Positive or negative |
| `reason` | TEXT | |
| `created_at` | DATETIME | |
| `created_by` | INTEGER FK | |

### 6.2 Default Leave Types (NFL)

| Code | Name | Year Type | Year Start |
|------|------|-----------|------------|
| VAC | Vacation | custom | June 1 |
| SICK | Sick Leave | calendar | January 1 |
| FH | Floating Holiday | custom | June 1 |
| HOL | Paid Holiday | calendar | January 1 |

### 6.3 Year Boundary Logic

```typescript
function getYearForDate(date: Date, leaveType: LeaveType): number {
  if (leaveType.year_type === 'calendar') {
    return date.getFullYear();
  }

  // Custom year (e.g., June 1 - May 31)
  const yearStart = new Date(
    date.getFullYear(),
    leaveType.year_start_month - 1,
    leaveType.year_start_day
  );

  if (date < yearStart) {
    return date.getFullYear(); // Before year start, use current calendar year as identifier
  }
  return date.getFullYear() + 1; // After year start, use next calendar year as identifier
}
```

### 6.4 Balance Display Component

Show on employee cards:
- Current balance per leave type
- Hours used this year
- Year-to-date summary

---

## Phase 7: Leave Request & Approval Workflow

### 7.1 Database Schema

**Table: `leave_requests`**
| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PRIMARY KEY | |
| `employee_id` | INTEGER FK | |
| `leave_type_id` | INTEGER FK | |
| `status` | TEXT | 'draft', 'pending', 'approved', 'denied', 'cancelled' |
| `start_date` | DATE | |
| `end_date` | DATE | |
| `hours_requested` | REAL | |
| `reason` | TEXT | Optional |
| `submitted_by` | INTEGER FK | User who submitted |
| `submitted_at` | DATETIME | |
| `reviewed_by` | INTEGER FK | User who approved/denied |
| `reviewed_at` | DATETIME | |
| `review_notes` | TEXT | |
| `created_at` | DATETIME | |
| `updated_at` | DATETIME | |

**Table: `leave_request_days`** (For multi-day requests)
| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PRIMARY KEY | |
| `leave_request_id` | INTEGER FK | |
| `date` | DATE | |
| `hours` | REAL | Hours for this specific day |

### 7.2 Request States

```
┌─────────┐
│  Draft  │──────────────────────────────────────┐
└────┬────┘                                      │
     │ Submit                                    │ Delete
     ▼                                           ▼
┌─────────┐     Approve     ┌──────────┐    ┌─────────┐
│ Pending │────────────────▶│ Approved │    │ Deleted │
└────┬────┘                 └──────────┘    └─────────┘
     │ Deny                      │
     ▼                           │ Cancel (by submitter)
┌─────────┐                      ▼
│ Denied  │◀────────────────┌───────────┐
└─────────┘                 │ Cancelled │
                            └───────────┘
```

### 7.3 Approval Logic

```typescript
async function canApproveRequest(
  userId: number,
  request: LeaveRequest
): Promise<boolean> {
  const user = await getUser(userId);

  // Super admins can approve any request
  if (user.group?.is_master) {
    return true;
  }

  // Check if user is the employee's supervisor
  const employee = await getEmployee(request.employee_id);
  // TODO: Define supervisor relationship

  return false;
}
```

### 7.4 Manager Dashboard

New page: `/dashboard/approvals`

- List of pending requests for employees user can manage
- Quick approve/deny actions
- Bulk approval capability
- Filter by employee, leave type, date range

### 7.5 Balance Deduction

On approval:
1. Calculate hours to deduct
2. Update `employee_balances.used_hours`
3. Update `employee_balances.balance_hours`
4. Create `balance_adjustments` audit record

On cancellation (if previously approved):
1. Reverse the balance deduction
2. Create reversal audit record

---

## Phase 8: Policy Engine

### 8.1 Policy Configuration Schema

Add to `brand-features.json`:

```json
{
  "policies": {
    "sickLeave": {
      "eligibilityDays": 90,
      "accrualRate": { "hours": 1, "perHoursWorked": 30 },
      "maxBankHours": 80,
      "maxAnnualUseHours": 40,
      "minIncrementHours": 2,
      "payoutDate": { "month": 12, "day": 15 },
      "consecutiveDaysForDocumentation": 3
    },
    "floatingHoliday": {
      "eligibilityYears": 1,
      "maxDays": 3,
      "incrementType": "full_day",
      "prorationTable": [
        { "anniversaryRange": ["06-01", "08-31"], "days": 3 },
        { "anniversaryRange": ["09-01", "11-30"], "days": 2 },
        { "anniversaryRange": ["12-01", "02-28"], "days": 1 },
        { "anniversaryRange": ["03-01", "05-31"], "days": 0 }
      ],
      "payoutDate": { "month": 6, "day": 1 }
    },
    "paidHoliday": {
      "eligibilityDays": 90,
      "requireAdjacentWorkDays": true,
      "holidays": [
        { "name": "New Year's Day", "month": 1, "day": 1 },
        { "name": "Memorial Day", "rule": "last_monday_may" },
        { "name": "Independence Day", "month": 7, "day": 4 },
        { "name": "Labor Day", "rule": "first_monday_september" },
        { "name": "Thanksgiving", "rule": "fourth_thursday_november" },
        { "name": "Day After Thanksgiving", "rule": "fourth_friday_november" },
        { "name": "Christmas Eve", "month": 12, "day": 24 },
        { "name": "Christmas Day", "month": 12, "day": 25 }
      ]
    },
    "vacation": {
      "yearStart": { "month": 6, "day": 1 }
    }
  }
}
```

### 8.2 Eligibility Checks

```typescript
interface EligibilityResult {
  eligible: boolean;
  reason?: string;
  daysUntilEligible?: number;
}

function checkEligibility(
  employee: Employee,
  leaveType: LeaveType,
  requestDate: Date
): EligibilityResult {
  const policy = getPolicy(leaveType.code);
  const effectiveHireDate = employee.rehire_date || employee.hire_date;

  if (!effectiveHireDate) {
    return { eligible: false, reason: 'No hire date on record' };
  }

  if (policy.eligibilityDays) {
    const daysSinceHire = daysBetween(effectiveHireDate, requestDate);
    if (daysSinceHire < policy.eligibilityDays) {
      return {
        eligible: false,
        reason: `Must be employed ${policy.eligibilityDays} days`,
        daysUntilEligible: policy.eligibilityDays - daysSinceHire
      };
    }
  }

  if (policy.eligibilityYears) {
    const yearsSinceHire = yearsBetween(effectiveHireDate, requestDate);
    if (yearsSinceHire < policy.eligibilityYears) {
      return {
        eligible: false,
        reason: `Must be employed ${policy.eligibilityYears} year(s)`,
      };
    }
  }

  if (policy.employmentType === 'full_time' && employee.employment_type !== 'full_time') {
    return { eligible: false, reason: 'Full-time employees only' };
  }

  return { eligible: true };
}
```

### 8.3 Increment Validation

```typescript
function validateIncrement(
  leaveType: LeaveType,
  hoursRequested: number
): { valid: boolean; message?: string } {
  const policy = getPolicy(leaveType.code);

  if (policy.incrementType === 'full_day') {
    if (hoursRequested % 8 !== 0) {
      return { valid: false, message: 'Must be used in full-day (8 hour) increments' };
    }
  }

  if (policy.minIncrementHours) {
    if (hoursRequested < policy.minIncrementHours) {
      return { valid: false, message: `Minimum ${policy.minIncrementHours} hours required` };
    }
  }

  return { valid: true };
}
```

### 8.4 Period Lockouts

**Table: `payroll_periods`**
| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PRIMARY KEY | |
| `start_date` | DATE | |
| `end_date` | DATE | |
| `is_locked` | INTEGER | 1 = locked, 0 = open |
| `locked_at` | DATETIME | |
| `locked_by` | INTEGER FK | |

When a period is locked:
- Prevent new leave requests for dates in that period
- Prevent edits to approved requests in that period
- Prevent attendance changes in that period

---

## Phase 9: Accruals & Payouts

### 9.1 Sick Leave Accrual

**Trigger:** After timesheet entry save/update

```typescript
async function calculateSickLeaveAccrual(
  employeeId: number,
  periodStart: Date,
  periodEnd: Date
): Promise<number> {
  const policy = getPolicy('SICK');

  // Get hours worked in period
  const hoursWorked = await getHoursWorked(employeeId, periodStart, periodEnd);

  // Calculate accrual (1 hour per 30 hours worked)
  const accruedHours = Math.floor(hoursWorked / policy.accrualRate.perHoursWorked)
                       * policy.accrualRate.hours;

  // Get current balance
  const balance = await getBalance(employeeId, 'SICK');

  // Cap at maximum bank
  const newBalance = Math.min(
    balance.balance_hours + accruedHours,
    policy.maxBankHours
  );

  return newBalance - balance.balance_hours; // Actual accrual after cap
}
```

### 9.2 Payout Calculations

**Sick Leave Payout (December 15):**
```typescript
async function calculateSickLeavePayout(employeeId: number): Promise<PayoutResult> {
  const policy = getPolicy('SICK');
  const balance = await getBalance(employeeId, 'SICK');

  // Payout = max annual use - actual used
  const payoutHours = Math.max(0, policy.maxAnnualUseHours - balance.used_hours);

  return {
    employeeId,
    leaveType: 'SICK',
    payoutHours,
    remainingBalance: balance.balance_hours, // Rolls over
  };
}
```

**Floating Holiday Payout (June 1):**
```typescript
async function calculateFloatingHolidayPayout(employeeId: number): Promise<PayoutResult> {
  const balance = await getBalance(employeeId, 'FH');

  // All remaining balance is paid out
  return {
    employeeId,
    leaveType: 'FH',
    payoutHours: balance.balance_hours,
    remainingBalance: 0, // Does not roll over
  };
}
```

### 9.3 Year-End Processing

**Sick Leave (January 1):**
1. Calculate and record any final accruals for December
2. Roll over balance (up to 80 hour cap)
3. Reset `used_hours` to 0 for new year

**Floating Holiday (June 1):**
1. Calculate payout for remaining balance
2. Generate payout report
3. Reset balance to new allocation based on eligibility
4. Apply pro-ration for employees in their first eligible year

### 9.4 Documentation Tracking

**Table: `documentation_requirements`**
| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER PRIMARY KEY | |
| `leave_request_id` | INTEGER FK | |
| `requirement_type` | TEXT | 'doctors_note', 'extended_absence' |
| `status` | TEXT | 'pending', 'received', 'waived' |
| `due_date` | DATE | |
| `received_at` | DATETIME | |
| `notes` | TEXT | |

Auto-create documentation requirement when:
- Sick leave request >= 3 consecutive days
- Annual sick leave usage > 40 hours

---

## API Endpoints

### Phase 5
- `GET /api/employees/:id` - Include new fields
- `PUT /api/employees/:id` - Update new fields
- `GET /api/brand/features` - Get current brand features

### Phase 6
- `GET /api/leave-types` - List enabled leave types
- `GET /api/employees/:id/balances` - Get employee balances
- `POST /api/employees/:id/balances/:type/adjust` - Manual adjustment

### Phase 7
- `GET /api/leave-requests` - List requests (filtered by permissions)
- `POST /api/leave-requests` - Create new request
- `PUT /api/leave-requests/:id` - Update request
- `POST /api/leave-requests/:id/submit` - Submit for approval
- `POST /api/leave-requests/:id/approve` - Approve request
- `POST /api/leave-requests/:id/deny` - Deny request
- `POST /api/leave-requests/:id/cancel` - Cancel request

### Phase 8
- `GET /api/policies/:leaveType` - Get policy configuration
- `POST /api/leave-requests/:id/validate` - Validate against policies
- `GET /api/payroll-periods` - List periods
- `POST /api/payroll-periods/:id/lock` - Lock period

### Phase 9
- `POST /api/accruals/calculate` - Trigger accrual calculation
- `GET /api/payouts/preview` - Preview upcoming payouts
- `POST /api/payouts/process` - Process payouts
- `GET /api/employees/:id/documentation` - Documentation requirements

---

## Testing Considerations

### Test Scenarios for Policy Engine
1. Employee hired < 90 days requesting sick leave (should fail)
2. Employee hired < 1 year requesting floating holiday (should fail)
3. Part-time employee requesting paid holiday (should fail for NFL)
4. Sick leave request for 1 hour (should fail - 2hr minimum)
5. Floating holiday for 4 hours (should fail - full day only)
6. Sick leave balance at 80 hours with additional accrual (should cap)
7. Pro-rated floating holiday for employee with September anniversary

### Test Scenarios for Year Boundaries
1. Vacation request spanning May 31 / June 1 (year boundary)
2. Sick leave request on December 31 vs January 1
3. Balance rollover at year-end

---

## Migration Path

### Phase 5 Migration
```sql
ALTER TABLE employees ADD COLUMN hire_date DATE;
ALTER TABLE employees ADD COLUMN rehire_date DATE;
ALTER TABLE employees ADD COLUMN employment_type TEXT DEFAULT 'full_time';
ALTER TABLE employees ADD COLUMN seniority_rank INTEGER;
```

### Phase 6 Migration
```sql
CREATE TABLE leave_types (...);
CREATE TABLE employee_balances (...);
CREATE TABLE balance_adjustments (...);
INSERT INTO leave_types (code, name, ...) VALUES ('VAC', 'Vacation', ...);
-- etc.
```

### Phase 7 Migration
```sql
CREATE TABLE leave_requests (...);
CREATE TABLE leave_request_days (...);
```

---

## Appendix A: NFL Vacation Policy Details

### Important Clarifications (from policy owner)

1. **Vacation is NOT paid when taken.** Employees take unpaid time off for vacation, then receive a lump-sum payout at the end of May (or at other times they specify during the year). The system tracks *time off allowance*, not *paid vacation hours*.

2. **Vacation eligibility is based on hours worked**, not calendar time. The base year threshold is **1,200 hours**, which includes:
   - Hours worked
   - Paid Holiday hours
   - Jury Duty hours
   - Bereavement Leave hours

3. **Only hourly (non-exempt) employees** are tracked in this system. All references to exempt employee handling in policy documents can be disregarded.

### Vacation Longevity Tiers

Vacation allowance is determined by years of service. The policy document contains two columns per tier:
- **Weeks Vacation** - Time off allowance (what we track)
- **Hours Pay** - Payout calculation (handled by payroll, not this system)

**Vacation Longevity Tier Table** (from `32. Vacation Policy.rtf`):

| Base Years Completed | Weeks Vacation | Hours Pay* |
|----------------------|----------------|------------|
| Up to 2              | 1 Week (40 hrs)| 40 Hrs     |
| 3 to 4               | 2 Weeks (80 hrs)| 80 Hrs    |
| 5 to 7               | 2 Weeks (80 hrs)| 120 Hrs   |
| 8 to 14              | 3 Weeks (120 hrs)| 160 Hrs  |
| 15+                  | 4 Weeks (160 hrs)| 200 Hrs  |

*Hours Pay column is for payroll payout calculations - not tracked in this system.*

**Note:** A "base year" is completed when an employee works 1,200 qualifying hours during the vacation year (June 1 - May 31).

### Vacation Year Calculation

To determine if an employee has completed a "base year" for vacation eligibility:

```typescript
async function hasCompletedBaseYear(
  employeeId: number,
  asOfDate: Date
): Promise<{ completed: boolean; hoursAccumulated: number }> {
  const VACATION_BASE_HOURS = 1200;

  // Get qualifying hours since hire date (or last vacation year anniversary)
  const qualifyingHours = await getQualifyingHours(employeeId, {
    includeHoursWorked: true,
    includePaidHoliday: true,
    includeJuryDuty: true,
    includeBereavement: true,
  });

  return {
    completed: qualifyingHours >= VACATION_BASE_HOURS,
    hoursAccumulated: qualifyingHours,
  };
}
```

### Vacation Policy Configuration (NFL)

```json
{
  "policies": {
    "vacation": {
      "yearStart": { "month": 6, "day": 1 },
      "baseYearHours": 1200,
      "qualifyingHourTypes": ["worked", "paid_holiday", "jury_duty", "bereavement"],
      "payoutNotTracked": true,
      "longevityTiers": [
        { "minBaseYears": 1, "maxBaseYears": 2, "weeksVacation": 1, "hoursVacation": 40 },
        { "minBaseYears": 3, "maxBaseYears": 4, "weeksVacation": 2, "hoursVacation": 80 },
        { "minBaseYears": 5, "maxBaseYears": 7, "weeksVacation": 2, "hoursVacation": 80 },
        { "minBaseYears": 8, "maxBaseYears": 14, "weeksVacation": 3, "hoursVacation": 120 },
        { "minBaseYears": 15, "maxBaseYears": null, "weeksVacation": 4, "hoursVacation": 160 }
      ]
    }
  }
}
```

### Additional Leave Types for Tracking

Based on vacation qualification rules, we need to track these additional time types:
- **Jury Duty** - Counts toward vacation base year
- **Bereavement Leave** - Counts toward vacation base year

These may need to be added as leave types or time codes in the system.

---

## Appendix B: System Scope Clarifications

### In Scope
- Hourly (non-exempt) employees only
- Time off tracking (not pay calculations)
- Balance management and approval workflows
- Policy enforcement for leave requests

### Out of Scope
- Exempt employee tracking
- Payroll calculations (handled by external system)
- Vacation payout amounts (only track time allowance)

---

## Open Questions

1. **Supervisor Relationship:** How is the supervisor for an employee determined?
   - Option A: Add `supervisor_id` to employees table
   - Option B: Derive from group membership
   - Option C: All managers can approve for employees they can view
   **STATUS:** Deferred - will decide when implementing Phase 7

2. ~~**Exempt vs Non-Exempt:** Do we need to track exempt status for accrual calculations?~~
   **RESOLVED:** Only tracking hourly employees. Exempt handling not needed.

3. ~~**Holiday Observed Dates:** When a holiday falls on a weekend, what's the observed date logic?~~
   **STATUS:** Deferred - will address in Phase 8

4. **Partial Day Holiday Pay:** If someone works on a holiday, how are hours calculated?
   **STATUS:** Pending - need more information from policy owner

5. ~~**Vacation Longevity Tiers:** Need to extract the complete tier table from the vacation policy document.~~
   **RESOLVED:** Table extracted from `32. Vacation Policy.rtf` and added to Appendix A.

6. ~~**Jury Duty / Bereavement:** Are these existing time codes, or do they need to be added as trackable leave types?~~
   **RESOLVED:** Already exist as time codes in the system.

---

**Document Version:** 1.3
**Author:** Claude (AI Assistant)
**Review Status:** Draft - Awaiting Review
**Change Log:**
- v1.3: Added vacation longevity tier table from policy document, updated policy config JSON
- v1.2: Updated open questions with resolution status
- v1.1: Added Appendix A (NFL Vacation Policy) and Appendix B (Scope Clarifications)
