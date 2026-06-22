# Phase 7: Reporting System

**Status:** In Progress
**Started:** January 22, 2026

---

## Overview

Build a flexible reporting system that supports both common reports shared across all brands and brand-specific custom reports. The system uses a hybrid approach: coded React components for complex reports and JSON-driven configuration for simpler custom reports.

---

## Architecture

### Directory Structure

```
app/
  reports/
    page.tsx                    # Reports landing page (list of available reports)
    [reportId]/
      page.tsx                  # Dynamic report viewer
  api/
    reports/
      route.ts                  # Reports metadata API
      [reportId]/
        route.ts                # Report data API

components/
  reports/
    report-engine.tsx           # Generic report renderer
    report-filters.tsx          # Reusable filter components (date range, employee, etc.)
    report-export.tsx           # Export to CSV/PDF functionality
    report-table.tsx            # Standard table display component
    report-chart.tsx            # Chart display component (optional)
    common/                     # Shared report templates
      attendance-summary.tsx    # Attendance summary by employee/period
      leave-balances.tsx        # Current leave balances report
      accrual-history.tsx       # Accrual transaction history
      time-off-calendar.tsx     # Visual calendar of time off

public/{brand}/
  reports/
    report-definitions.json     # Brand-specific report configuration
```

### Report Definition Schema

Each brand's `report-definitions.json` defines available reports:

```json
{
  "reports": [
    {
      "id": "attendance-summary",
      "type": "common",
      "enabled": true,
      "label": "Attendance Summary",
      "description": "Summary of attendance entries by employee and time code",
      "icon": "ClipboardList",
      "category": "attendance",
      "permissions": ["viewer", "editor", "manager", "administrator"],
      "config": {
        "showDepartment": true,
        "showJobTitle": true,
        "defaultRange": "month",
        "columns": ["employee", "timeCode", "hours", "date"]
      }
    },
    {
      "id": "custom-overtime",
      "type": "custom",
      "enabled": true,
      "label": "Overtime Analysis",
      "description": "Weekly overtime hours by employee",
      "icon": "Clock",
      "category": "payroll",
      "permissions": ["manager", "administrator"],
      "dataSource": {
        "endpoint": "/api/reports/overtime",
        "method": "GET"
      },
      "columns": [
        { "key": "employeeName", "label": "Employee", "sortable": true },
        { "key": "weekOf", "label": "Week Of", "type": "date", "sortable": true },
        { "key": "regularHours", "label": "Regular Hours", "type": "number" },
        { "key": "overtimeHours", "label": "OT Hours", "type": "number" }
      ],
      "filters": [
        { "key": "dateRange", "type": "dateRange", "label": "Date Range", "required": true },
        { "key": "employeeId", "type": "employee", "label": "Employee", "required": false }
      ],
      "groupBy": ["employee", "week"],
      "export": ["csv", "pdf"]
    }
  ],
  "categories": [
    { "id": "attendance", "label": "Attendance", "icon": "Calendar" },
    { "id": "leave", "label": "Leave & Balances", "icon": "Palmtree" },
    { "id": "payroll", "label": "Payroll", "icon": "DollarSign" },
    { "id": "compliance", "label": "Compliance", "icon": "Shield" }
  ]
}
```

---

## Common Reports (All Brands)

### 1. Attendance Summary
- **Purpose:** Show attendance entries grouped by employee, time code, and period
- **Filters:** Date range, employee, time code, department
- **Output:** Table with totals, exportable to CSV

### 2. Leave Balances
- **Purpose:** Current leave balances for all employees
- **Filters:** Employee, leave type
- **Output:** Table showing allocated, used, accrued, remaining

### 3. Accrual History
- **Purpose:** Detailed log of accrual transactions
- **Filters:** Date range, employee, accrual type
- **Output:** Transaction log with running balance

### 4. Time-Off Calendar
- **Purpose:** Visual calendar view of all time off
- **Filters:** Date range, employee, department
- **Output:** Calendar grid with color-coded entries

---

## Implementation Steps

### Step 1: Core Infrastructure
- [ ] Create `app/reports/page.tsx` - Reports landing page
- [ ] Create `components/reports/report-engine.tsx` - Generic report renderer
- [ ] Create `components/reports/report-filters.tsx` - Filter components
- [ ] Create `components/reports/report-table.tsx` - Table display
- [ ] Create `components/reports/report-export.tsx` - Export functionality
- [ ] Create `/api/reports/route.ts` - Reports metadata endpoint

### Step 2: Common Reports
- [ ] Implement Attendance Summary report
- [ ] Implement Leave Balances report
- [ ] Implement Accrual History report
- [ ] Implement Time-Off Calendar report

### Step 3: Brand Configuration
- [ ] Create `public/TRL/reports/report-definitions.json`
- [ ] Create `public/NFL/reports/report-definitions.json`
- [ ] Create `public/SBS/reports/report-definitions.json`
- [ ] Add report loading to brand system

### Step 4: Custom Report Engine
- [ ] Build JSON-driven custom report renderer
- [ ] Support custom columns, filters, grouping
- [ ] Add custom data source endpoints as needed

### Step 5: Polish
- [ ] Add report navigation to main nav
- [ ] Implement report permissions checking
- [ ] Add loading states and error handling
- [ ] Add print-friendly styles

---

## API Endpoints

### Reports Metadata
```
GET /api/reports
Returns: List of available reports for current user/brand
```

### Report Data
```
GET /api/reports/[reportId]?filters=...
Returns: Report data based on filters
```

### Common Report Endpoints
```
GET /api/reports/attendance-summary?startDate=&endDate=&employeeId=
GET /api/reports/leave-balances?employeeId=&leaveType=
GET /api/reports/accrual-history?startDate=&endDate=&employeeId=
```

---

## UI Components

### Reports Landing Page
- Grid/list of available reports organized by category
- Search/filter reports
- Recent reports section
- Quick access to favorites

### Report Viewer
- Header with report title and description
- Filter panel (collapsible)
- Results table/chart
- Export buttons (CSV, PDF)
- Print button

---

## Permissions

Reports respect the existing role system:
- **Viewer:** Can view reports for employees in their group
- **Editor:** Same as viewer
- **Manager:** Can view reports for employees in their group
- **Administrator:** Can view all reports, all employees

Some reports may be restricted to certain roles (defined in `permissions` array).

---

## Export Formats

### CSV
- Standard comma-separated values
- Includes headers
- UTF-8 encoding

### PDF (Future)
- Formatted report with header/footer
- Brand logo
- Date generated
- Page numbers

---

## Notes

- Report definitions follow the same brand folder pattern as time-codes.json and help-content.json
- The report engine handles both "common" (coded) and "custom" (JSON-driven) report types
- Common reports are more flexible but require code changes
- Custom reports are limited but can be added via JSON configuration alone
- All reports require authentication and respect group permissions
