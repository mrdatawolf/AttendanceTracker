# Phase 5: Advanced Features

## Overview

Phase 5 introduces enterprise-grade features for attendance management including approval workflows, data lockouts, advanced analytics, and notification systems.

## Goals

### 1. Approval Workflows
- **Submission System**: Employees submit monthly attendance for review
- **Multi-Level Approval**: Support manager → HR → admin approval chains
- **Status Tracking**: Draft, Submitted, Under Review, Approved, Rejected states
- **Rejection Handling**: Comments and re-submission capabilities
- **Deadline Enforcement**: Auto-submit or lock after cutoff dates

### 2. Attendance Lockouts
- **Period Locking**: Lock completed periods to prevent changes
- **Role-Based Override**: Allow admins to unlock periods if needed
- **Audit Trail**: Log all lock/unlock actions
- **Bulk Operations**: Lock/unlock multiple periods at once
- **Visual Indicators**: Show locked periods with distinct styling

### 3. Advanced Analytics
- **Trend Analysis**: Identify attendance patterns and anomalies
- **Predictive Analytics**: Forecast time-off usage
- **Team Comparisons**: Compare usage across groups
- **Custom Reports**: Build and save custom report templates
- **Data Visualization**: Charts and graphs for key metrics
- **Export Options**: PDF, Excel, CSV export with formatting

### 4. Email Notifications
- **Submission Alerts**: Notify approvers of pending submissions
- **Approval/Rejection**: Notify employees of decision
- **Reminder System**: Auto-remind employees of upcoming deadlines
- **Digest Emails**: Daily/weekly summary for managers
- **Custom Templates**: Configurable email templates
- **Unsubscribe Management**: User preference controls

### 5. Multi-Tenant Support
- **Organization Isolation**: Separate data per organization
- **Tenant Administration**: Per-tenant user and group management
- **Custom Branding**: Logo, colors, terminology per tenant
- **Subdomain Routing**: `company1.attendance.app` routing
- **Billing Integration**: Track usage per tenant
- **Data Export/Import**: Tenant migration tools

## Technical Architecture

### Database Changes

#### New Tables

```sql
-- Approval workflows
CREATE TABLE attendance_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  status TEXT DEFAULT 'draft', -- draft, submitted, approved, rejected
  submitted_at DATETIME,
  submitted_by INTEGER,
  reviewed_at DATETIME,
  reviewed_by INTEGER,
  reviewer_comments TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id),
  FOREIGN KEY (submitted_by) REFERENCES users(id),
  FOREIGN KEY (reviewed_by) REFERENCES users(id),
  UNIQUE(employee_id, year, month)
);

-- Period locks
CREATE TABLE attendance_locks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  is_locked INTEGER DEFAULT 1,
  locked_at DATETIME,
  locked_by INTEGER,
  unlock_reason TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (group_id) REFERENCES groups(id),
  FOREIGN KEY (locked_by) REFERENCES users(id)
);

-- Email queue
CREATE TABLE email_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipient_email TEXT NOT NULL,
  recipient_user_id INTEGER,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  template_name TEXT,
  status TEXT DEFAULT 'pending', -- pending, sent, failed
  attempts INTEGER DEFAULT 0,
  last_attempt_at DATETIME,
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  sent_at DATETIME,
  FOREIGN KEY (recipient_user_id) REFERENCES users(id)
);

-- Notification preferences
CREATE TABLE notification_preferences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  email_enabled INTEGER DEFAULT 1,
  submission_alerts INTEGER DEFAULT 1,
  approval_alerts INTEGER DEFAULT 1,
  reminder_alerts INTEGER DEFAULT 1,
  digest_frequency TEXT DEFAULT 'weekly', -- daily, weekly, none
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(user_id)
);

-- Multi-tenant
CREATE TABLE tenants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  subdomain TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#3b82f6',
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Add tenant_id to existing tables
ALTER TABLE users ADD COLUMN tenant_id INTEGER REFERENCES tenants(id);
ALTER TABLE groups ADD COLUMN tenant_id INTEGER REFERENCES tenants(id);
ALTER TABLE employees ADD COLUMN tenant_id INTEGER REFERENCES tenants(id);
```

### API Endpoints

#### Approval Workflows
- `POST /api/attendance/submit` - Submit month for approval
- `GET /api/attendance/pending-approvals` - List pending submissions
- `POST /api/attendance/approve` - Approve submission
- `POST /api/attendance/reject` - Reject with comments
- `GET /api/attendance/submission-history` - Audit trail

#### Lockouts
- `POST /api/attendance/lock-period` - Lock a period
- `POST /api/attendance/unlock-period` - Unlock with reason
- `GET /api/attendance/locked-periods` - List locks
- `GET /api/attendance/is-locked` - Check if period is locked

#### Analytics
- `GET /api/analytics/trends` - Time-series data
- `GET /api/analytics/predictions` - Forecast data
- `GET /api/analytics/comparisons` - Cross-group analysis
- `POST /api/analytics/custom-report` - Run custom queries
- `GET /api/analytics/export` - Export report data

#### Notifications
- `POST /api/notifications/send` - Queue notification
- `GET /api/notifications/preferences` - Get user preferences
- `PUT /api/notifications/preferences` - Update preferences
- `POST /api/notifications/test` - Send test email

## UI Components

### Approval Dashboard
- Pending submissions list with employee details
- One-click approve/reject buttons
- Bulk approval capabilities
- Comment modal for rejections
- Submission history view

### Lockout Management
- Calendar view of locked periods
- Bulk lock/unlock interface
- Override request workflow
- Lock status indicators in attendance grid

### Analytics Dashboard
- Chart library integration (Chart.js or Recharts)
- Date range selectors
- Filter controls (group, employee, time code)
- Real-time data updates
- Export buttons

### Notification Center
- In-app notification badge
- Notification list with read/unread status
- Email preference toggles
- Test email button

## Security Considerations

- **Approval Permissions**: Only authorized users can approve
- **Lock Override Audit**: All overrides logged with justification
- **Data Access**: Analytics respects group permissions
- **Email Security**: Validate recipients, prevent spam
- **Tenant Isolation**: Strict data separation per tenant
- **Rate Limiting**: Prevent notification spam

## Migration Strategy

### Database Migrations
1. Create new tables with migrations system
2. Add tenant_id columns with NULL initially
3. Seed default tenant for existing data
4. Backfill tenant_id for all records
5. Add foreign key constraints

### Feature Rollout
1. **Phase 5.1**: Approval workflows (4-6 weeks)
2. **Phase 5.2**: Lockouts (2-3 weeks)
3. **Phase 5.3**: Analytics (4-5 weeks)
4. **Phase 5.4**: Notifications (3-4 weeks)
5. **Phase 5.5**: Multi-tenant (6-8 weeks)

### Backward Compatibility
- All features optional via feature flags
- Existing workflows continue without changes
- Gradual adoption per organization
- Rollback capability for each sub-phase

## Testing Strategy

### Approval Workflows
- Submit attendance for approval
- Multi-level approval chains
- Rejection and resubmission
- Deadline enforcement
- Concurrent approval handling

### Lockouts
- Lock past periods
- Attempt edits on locked periods (should fail)
- Admin override with audit log
- Bulk lock/unlock operations

### Analytics
- Accurate calculations across large datasets
- Performance with 1000+ employees
- Export file generation
- Chart rendering

### Notifications
- Email delivery success rate
- Preference respect (no emails if disabled)
- Template rendering
- Queue processing

## Performance Targets

- Approval list loads in <500ms with 100+ pending
- Analytics queries return in <2s for 1-year datasets
- Email queue processes 1000 emails/minute
- Tenant switching in <200ms
- Lock check in <50ms (cached)

## Success Criteria

- ✅ 95%+ of submissions approved within SLA
- ✅ Zero unauthorized edits to locked periods
- ✅ Analytics used by 80%+ of managers
- ✅ Email open rate >40%
- ✅ Multi-tenant isolation verified by security audit
- ✅ <5% error rate in approval workflows

## Timeline Estimate

- **Phase 5.1 (Approvals)**: 4-6 weeks
- **Phase 5.2 (Lockouts)**: 2-3 weeks
- **Phase 5.3 (Analytics)**: 4-5 weeks
- **Phase 5.4 (Notifications)**: 3-4 weeks
- **Phase 5.5 (Multi-tenant)**: 6-8 weeks

**Total**: 19-26 weeks (~5-6 months)

## Dependencies

- Email service (SendGrid, AWS SES, etc.)
- Chart library (Chart.js or Recharts)
- Background job processor (for email queue)
- Redis/similar for caching lock status
- Analytics database (optional, for performance)

## Future Considerations (Phase 6+)

- Mobile app for approvals
- Slack/Teams integration for notifications
- AI-powered attendance fraud detection
- Integration with payroll systems
- SSO/SAML authentication
- API for third-party integrations
- Attendance forecasting and capacity planning
