# Phase NFL-2: Print-Ready PDF Reports

**Status:** Approved, not started
**Brand:** NFL
**Depends on:** None

---

## Overview

Team Leaders need to hand out reports as print-ready documents. Today every report (`components/reports/report-export.tsx`, `components/reports/leave-balance-export.tsx`) only supports CSV export via `json2csv`. Rather than adding a PDF-generation library (jsPDF, pdfmake, etc.), this phase adds a browser print stylesheet and a "Print / Save as PDF" action — no new dependencies, and users get a real PDF via the browser's native print-to-PDF.

This applies to **all reports**, not just the Attendance Summary Report.

---

## Goals

### 1. Print stylesheet
- Add `@media print` rules (global CSS or a dedicated `print.css`) that:
  - Hide navigation, sidebar, filter controls, and action buttons
  - Show only the report title, applied filter summary (date range, group, etc.), and the report table
  - Force light background / black text regardless of the active color theme
  - Avoid breaking table rows across pages where possible (`break-inside: avoid` on `<tr>`)

### 2. Print action
- Add a "Print / Save as PDF" button next to the existing CSV export button in `report-export.tsx` and `leave-balance-export.tsx`.
- Button calls `window.print()`. Since the shared print stylesheet handles layout, no per-report custom code should be needed — confirm this holds for every report type (see QA below).
- The `pdf: boolean` flag already present on the report `export` config (`app/reports/page.tsx` ~line 71-75) gates which reports show this button — it currently exists but is unused; wire it up now.

### 3. QA pass across report types
- Verify print layout for: Leave Balance Summary (pivot table), Attendance Management report, Attendance Summary Report (including the YTD tab fixed in Phase NFL-1), and any brand-specific custom reports defined in `public/NFL/reports/report-definitions.json`.
- Check wide tables (e.g. pivot-style reports with many columns) don't get cut off — may need landscape orientation hint (`@page { size: landscape; }`) for those specific reports.

---

## Out of Scope
- True client-generated PDF files (no `window.print()` dependency) — explicitly deferred; revisit only if the print-stylesheet approach proves insufficient for Team Leaders' workflow.
