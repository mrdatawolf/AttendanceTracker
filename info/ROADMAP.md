# Product Roadmap - Multi-User Timesheet Application

**Last Updated:** June 24, 2026
**Current Status:** NFL Phase 1 In Progress

> **Note:** The numbered Phase docs below (and the legacy `info/ROADMAP/PHASE-7-PLAN.md` / `PHASE-8-PLAN.md`) predate a codebase split and may not reflect this repo's actual history — treat them as historical reference, not an authoritative sequence. New work going forward is tracked under the **NFL Brand Enhancement Phases** section below.

---

## NFL Brand Enhancement Phases

A set of changes requested by the NFL brand, tracked as their own phase sequence (independent of the legacy numbering above).

| Phase | Status | Description |
|-------|--------|-------------|
| NFL-1 | **In Progress** | Attendance/Dashboard group filters ("Employees" hidden, "Inactive" added), YTD date-wrap fix |
| NFL-2 | Approved | Print-ready PDF export for all reports (browser print stylesheet) |
| NFL-3 | Approved | Calculated sick-leave balances for salaried employees (vs. "Check ADP") |

**See:** [PHASE-NFL-1-PLAN.md](PHASE-NFL-1-PLAN.md) · [ROADMAP/PHASE-NFL-2-PLAN.md](ROADMAP/PHASE-NFL-2-PLAN.md) · [ROADMAP/PHASE-NFL-3-PLAN.md](ROADMAP/PHASE-NFL-3-PLAN.md)

---

## Vision

Transform Excel-based timesheet tracking into a modern, secure web application with enterprise integrations, policy-driven leave management, and self-service capabilities.

---

## Folder Structure

| Folder | Purpose |
|--------|---------|
| `info/` | Current phase being worked on |
| `info/COMPLETE/` | Completed phases |
| `info/ROADMAP/` | Approved future phases |
| `info/POTENTIAL/` | Phases under consideration |
| `info/SPECS/` | Technical specifications & documentation |

---

## Key Milestones

- [x] Excel replacement complete (Phase 1)
- [x] Multi-user security implemented (Phase 2)
- [x] Flexible time tracking enabled (Phase 3)
- [x] Data protection automated (Phase 4)
- [x] White labeling & brand URI (Phase 4.5)
- [x] Interactive help system (Phase 6)
- [X] Reporting system (Phase 7)
- [X] Approval workflows (Phase 8)
- [X] Policy automation (Phase 9)

---

## Potential Phases

These phases are under consideration but not yet approved.

### Advanced Features (formerly Phase 5)
**Plan:** [POTENTIAL/PHASE-5-PLAN.md](POTENTIAL/PHASE-5-PLAN.md)

Enterprise-grade features including:
- Approval workflows for attendance submissions
- Attendance period lockouts
- Advanced analytics & trend analysis
- Email notifications
- Multi-tenant support

---

## Future Considerations

The following features may be considered for future phases:
- Employee self-service portal (read-only attendance view)
- External system integrations (ADP, Paychex, BambooHR)
- Mobile app for approvals
- Slack/Teams integration

---

## Architecture

**Current:** Next.js web application with SQLite database, JWT authentication, responsive UI, build-time brand configuration, and customizable color themes.

**Phase 8+:** Leave management system, policy engine, approval workflows.

---

## Related Documents

- [SPECS/PHASE-5-9-SPEC.md](SPECS/PHASE-5-9-SPEC.md) - Detailed specifications for leave management
- [SPECS/BRAND-URI-CONFIGURATION.md](SPECS/BRAND-URI-CONFIGURATION.md) - Brand URI build configuration
- [SPECS/DEPLOYMENT.md](SPECS/DEPLOYMENT.md) - Deployment guide
- [SPECS/AUTH-SYSTEM.md](SPECS/AUTH-SYSTEM.md) - Authentication system details

---

**Document Version:** 4.1
**Visibility:** Superuser Only
