import pkg from '../package.json';

/**
 * OpenAPI 3.1 specification for the AttendanceTracker API.
 *
 * Served at /api/openapi.json and rendered at /api-docs.
 * A vitest check (lib/__tests__/openapi-spec.test.ts) fails if a route
 * handler exists on disk that is not documented here (or vice versa),
 * so keep this in sync when adding or removing routes.
 *
 * Authentication: every endpoint (unless marked otherwise) accepts
 *   Authorization: Bearer <jwt-from-login>   — interactive sessions
 *   Authorization: Bearer atk_...            — API keys (Settings → API Keys)
 * The auth_token HTTP-only cookie set by /api/auth/login also works.
 */

const errorResponse = (description: string) => ({
  description,
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/Error' },
    },
  },
});

const jsonResponse = (description: string, schema: Record<string, unknown>) => ({
  description,
  content: { 'application/json': { schema } },
});

const std401 = errorResponse('Not authenticated');
const std403 = errorResponse('Not permitted');
const std404 = errorResponse('Not found');

export const openApiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'AttendanceTracker API',
    version: pkg.version,
    description: [
      'REST API for the AttendanceTracker application. All data operations available in the UI are exposed here.',
      '',
      '## Authentication',
      'Two ways to authenticate, both sent as a bearer token in the `Authorization` header:',
      '- **Login session (JWT)**: `POST /api/auth/login` with username/password returns a `token`. The same token is also set as an HTTP-only `auth_token` cookie for browser use.',
      '- **API key**: created by an admin under *Settings → API Keys*, prefixed `atk_`. A key acts with the permissions of the user account it belongs to. For system integrations, create a dedicated service-account user and issue the key against it.',
      '',
      'Permissions are enforced per user via groups, roles, and per-group grants; a `403` means the authenticated account lacks access to that data.',
    ].join('\n'),
  },
  servers: [{ url: '/', description: 'This server' }],
  security: [{ bearerAuth: [] }, { cookieAuth: [] }],
  tags: [
    { name: 'Auth', description: 'Login, logout, session verification' },
    { name: 'Employees', description: 'Employee records' },
    { name: 'Attendance', description: 'Attendance entries and summaries' },
    { name: 'Breaks', description: 'Break tracking (brand feature; 403 when disabled)' },
    { name: 'Office Presence', description: 'In/out office status (brand feature; 403 when disabled)' },
    { name: 'Reports', description: 'Reporting endpoints' },
    { name: 'Dashboard', description: 'Dashboard widgets' },
    { name: 'Users & Permissions', description: 'User accounts, groups, roles, per-group grants' },
    { name: 'API Keys', description: 'Programmatic access keys (admin only)' },
    { name: 'Reference Data', description: 'Time codes, job titles, report definitions, brand info' },
    { name: 'Settings', description: 'Application settings (admin only)' },
    { name: 'Backups', description: 'Database backup management (admin only)' },
    { name: 'Import', description: 'Bulk data import (admin only)' },
    { name: 'Audit', description: 'Audit log' },
    { name: 'Meta', description: 'API metadata' },
  ],
  paths: {
    // ------------------------------------------------------------ Auth
    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Log in and obtain a token',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['username', 'password'],
                properties: {
                  username: { type: 'string' },
                  password: { type: 'string', format: 'password' },
                },
              },
            },
          },
        },
        responses: {
          '200': jsonResponse('Logged in; token is also set as an HTTP-only auth_token cookie', {
            type: 'object',
            properties: {
              user: { $ref: '#/components/schemas/AuthUser' },
              token: { type: 'string', description: 'JWT bearer token' },
            },
          }),
          '401': errorResponse('Invalid username or password'),
        },
      },
    },
    '/api/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Log out (clears the auth cookie)',
        responses: {
          '200': jsonResponse('Logged out', { $ref: '#/components/schemas/Success' }),
        },
      },
    },
    '/api/auth/verify': {
      get: {
        tags: ['Auth'],
        summary: 'Verify the current token and return the authenticated user',
        responses: {
          '200': jsonResponse('Token is valid', {
            type: 'object',
            properties: { user: { $ref: '#/components/schemas/AuthUser' } },
          }),
          '401': std401,
        },
      },
    },
    '/api/auth/change-password': {
      post: {
        tags: ['Auth'],
        summary: 'Change the current user’s password',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['currentPassword', 'newPassword'],
                properties: {
                  currentPassword: { type: 'string', format: 'password' },
                  newPassword: { type: 'string', format: 'password', minLength: 6 },
                },
              },
            },
          },
        },
        responses: {
          '200': jsonResponse('Password changed', {
            type: 'object',
            properties: { message: { type: 'string' } },
          }),
          '400': errorResponse('Missing fields or new password too short'),
          '401': std401,
          '403': errorResponse('Current password is incorrect'),
        },
      },
    },

    // ------------------------------------------------------- Employees
    '/api/employees': {
      get: {
        tags: ['Employees'],
        summary: 'List employees (scoped to what the caller may see)',
        parameters: [
          { name: 'id', in: 'query', schema: { type: 'integer' }, description: 'Return a single employee by ID' },
          { name: 'includeInactive', in: 'query', schema: { type: 'string', enum: ['true', 'false'] }, description: 'Include deactivated employees' },
        ],
        responses: {
          '200': jsonResponse('Employee list (or single employee when id is given)', {
            type: 'array',
            items: { $ref: '#/components/schemas/Employee' },
          }),
          '401': std401,
          '404': std404,
        },
      },
      post: {
        tags: ['Employees'],
        summary: 'Create an employee',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/EmployeeInput' },
            },
          },
        },
        responses: {
          '200': jsonResponse('Created employee', { $ref: '#/components/schemas/Employee' }),
          '400': errorResponse('Validation failed (e.g. abbreviation or employee number already taken)'),
          '401': std401,
          '403': std403,
          '409': errorResponse('Conflicts with an inactive employee (reactivate or permanently delete them first)'),
        },
      },
      put: {
        tags: ['Employees'],
        summary: 'Update an employee',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                allOf: [
                  { type: 'object', required: ['id'], properties: { id: { type: 'integer' } } },
                  { $ref: '#/components/schemas/EmployeeInput' },
                ],
              },
            },
          },
        },
        responses: {
          '200': jsonResponse('Updated employee', { $ref: '#/components/schemas/Employee' }),
          '400': errorResponse('Validation failed'),
          '401': std401,
          '403': std403,
          '404': std404,
          '409': errorResponse('Conflicts with an inactive employee'),
        },
      },
      delete: {
        tags: ['Employees'],
        summary: 'Deactivate an employee (or permanently delete)',
        parameters: [
          { name: 'id', in: 'query', required: true, schema: { type: 'integer' } },
          { name: 'permanent', in: 'query', schema: { type: 'string', enum: ['true'] }, description: 'Permanently delete instead of deactivating (removes attendance history)' },
        ],
        responses: {
          '200': jsonResponse('Deactivated or deleted', { $ref: '#/components/schemas/Success' }),
          '401': std401,
          '403': std403,
          '404': std404,
        },
      },
    },

    // ------------------------------------------------------ Attendance
    '/api/attendance': {
      get: {
        tags: ['Attendance'],
        summary: 'List attendance entries',
        description: 'Without employeeId, returns entries for all employees the caller can see. Date range defaults to the given (or current) year.',
        parameters: [
          { name: 'employeeId', in: 'query', schema: { type: 'integer' } },
          { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'year', in: 'query', schema: { type: 'integer' }, description: 'Used when startDate/endDate are omitted (defaults to current year)' },
        ],
        responses: {
          '200': jsonResponse('Attendance entries', {
            type: 'array',
            items: { $ref: '#/components/schemas/AttendanceEntry' },
          }),
          '401': std401,
          '403': std403,
          '404': errorResponse('Employee not found'),
        },
      },
      post: {
        tags: ['Attendance'],
        summary: 'Create, update, or delete attendance entries',
        description: [
          'Multi-action endpoint controlled by the `action` field:',
          '- *(no action)* — upsert a single entry for `employee_id` + `entry_date`',
          '- `update_day` — replace all entries for a date with `entries[]`; optionally move them via `target_entry_date`',
          '- `bulk_update_range` — apply one time code across a date range (`start_date`, `end_date`, `skip_weekends`, `overwrite_existing`, `over_limit_acknowledged`)',
          '- `delete` — remove all entries for `employee_id` + `entry_date`',
        ].join('\n'),
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['employee_id'],
                properties: {
                  action: { type: 'string', enum: ['update_day', 'bulk_update_range', 'delete'], description: 'Omit for a single-entry upsert' },
                  employee_id: { type: 'integer' },
                  entry_date: { type: 'string', format: 'date' },
                  time_code: { type: 'string' },
                  hours: { type: 'number' },
                  notes: { type: 'string' },
                  entries: {
                    type: 'array',
                    description: 'update_day only: replacement entries for the date',
                    items: {
                      type: 'object',
                      properties: {
                        time_code: { type: 'string' },
                        hours: { type: 'number' },
                        notes: { type: 'string' },
                      },
                    },
                  },
                  target_entry_date: { type: 'string', format: 'date', description: 'update_day only: move entries to this date' },
                  start_date: { type: 'string', format: 'date', description: 'bulk_update_range only' },
                  end_date: { type: 'string', format: 'date', description: 'bulk_update_range only' },
                  skip_weekends: { type: 'boolean', description: 'bulk_update_range only' },
                  overwrite_existing: { type: 'boolean', description: 'bulk_update_range only' },
                  over_limit_acknowledged: { type: 'boolean', description: 'bulk_update_range only: proceed past the allocation-limit check' },
                },
              },
            },
          },
        },
        responses: {
          '200': jsonResponse('Result; bulk actions include created/skipped counts', {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              created_count: { type: 'integer' },
              skipped_count: { type: 'integer' },
              skipped_dates: { type: 'array', items: { type: 'string' } },
              entries: { type: 'array', items: { $ref: '#/components/schemas/AttendanceEntry' } },
            },
          }),
          '400': errorResponse('Validation failed; error may be `over_limit`, `range_too_large`, or `date_occupied` with extra detail fields'),
          '401': std401,
          '403': std403,
          '404': errorResponse('Employee not found'),
        },
      },
    },
    '/api/attendance/daily-summary': {
      get: {
        tags: ['Attendance'],
        summary: 'Per-day attendance summary for a year',
        parameters: [
          { name: 'year', in: 'query', schema: { type: 'integer' }, description: 'Defaults to current year' },
        ],
        responses: {
          '200': jsonResponse('Summary keyed by date', { type: 'object', additionalProperties: true }),
          '401': std401,
        },
      },
    },

    // ---------------------------------------------------------- Breaks
    '/api/break-entries': {
      get: {
        tags: ['Breaks'],
        summary: 'Get break entries for an employee on a date',
        parameters: [
          { name: 'employeeId', in: 'query', required: true, schema: { type: 'integer' } },
          { name: 'date', in: 'query', schema: { type: 'string', format: 'date' }, description: 'Defaults to today' },
          { name: 'withCompliance', in: 'query', schema: { type: 'string', enum: ['true', 'false'] }, description: 'Include compliance status (default true)' },
        ],
        responses: {
          '200': jsonResponse('Break configuration and entries', {
            type: 'object',
            properties: {
              config: { type: 'object', additionalProperties: true },
              entries: { type: 'array', items: { $ref: '#/components/schemas/BreakEntry' } },
            },
          }),
          '400': errorResponse('employeeId missing or invalid'),
          '401': std401,
          '403': errorResponse('Break tracking disabled, or no permission for this employee'),
          '404': errorResponse('Employee not found'),
        },
      },
      post: {
        tags: ['Breaks'],
        summary: 'Create or update a break entry',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['employeeId', 'breakType', 'durationMinutes'],
                properties: {
                  employeeId: { type: 'integer' },
                  date: { type: 'string', format: 'date', description: 'Defaults to today' },
                  breakType: { type: 'string', enum: ['break_1', 'lunch', 'break_2'] },
                  startTime: { type: 'string', description: 'HH:MM; defaults to current time' },
                  durationMinutes: { type: 'integer' },
                  notes: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': jsonResponse('Saved break entry', { type: 'object', additionalProperties: true }),
          '400': errorResponse('Missing required field'),
          '401': std401,
          '403': std403,
          '404': errorResponse('Employee not found'),
        },
      },
      put: {
        tags: ['Breaks'],
        summary: 'Set a compliance override on a break entry',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['employeeId', 'breakType', 'complianceOverride'],
                properties: {
                  employeeId: { type: 'integer' },
                  date: { type: 'string', format: 'date', description: 'Defaults to today' },
                  breakType: { type: 'string', enum: ['break_1', 'lunch', 'break_2'] },
                  complianceOverride: { type: 'boolean' },
                },
              },
            },
          },
        },
        responses: {
          '200': jsonResponse('Override saved', { $ref: '#/components/schemas/Success' }),
          '401': std401,
          '403': std403,
          '404': std404,
        },
      },
      delete: {
        tags: ['Breaks'],
        summary: 'Delete a break entry',
        parameters: [
          { name: 'id', in: 'query', required: true, schema: { type: 'integer' } },
        ],
        responses: {
          '200': jsonResponse('Deleted', { $ref: '#/components/schemas/Success' }),
          '401': std401,
          '403': std403,
          '404': std404,
        },
      },
    },

    // ------------------------------------------------- Office presence
    '/api/office-presence': {
      get: {
        tags: ['Office Presence'],
        summary: 'Today’s in/out status for all active employees',
        description: 'Employees with no row for today are "in". Status auto-resets daily.',
        responses: {
          '200': jsonResponse('Presence per employee', {
            type: 'object',
            properties: {
              employees: { type: 'array', items: { type: 'object', additionalProperties: true } },
            },
          }),
          '401': std401,
          '403': errorResponse('Office presence tracking is not enabled'),
        },
      },
      post: {
        tags: ['Office Presence'],
        summary: 'Toggle an employee’s presence for today',
        description: 'Users can toggle themselves; admins can toggle anyone.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['employeeId'],
                properties: { employeeId: { type: 'integer' } },
              },
            },
          },
        },
        responses: {
          '200': jsonResponse('New status', { type: 'object', additionalProperties: true }),
          '400': errorResponse('employeeId is required'),
          '401': std401,
          '403': errorResponse('Feature disabled, or trying to toggle someone else without admin rights'),
        },
      },
    },

    // --------------------------------------------------------- Reports
    '/api/reports': {
      get: {
        tags: ['Reports'],
        summary: 'Attendance report rows for a date range',
        parameters: [
          { name: 'startDate', in: 'query', required: true, schema: { type: 'string', format: 'date' } },
          { name: 'endDate', in: 'query', required: true, schema: { type: 'string', format: 'date' } },
          { name: 'employeeId', in: 'query', schema: { type: 'integer' } },
          { name: 'timeCode', in: 'query', schema: { type: 'string' } },
          { name: 'groupId', in: 'query', schema: { type: 'integer' } },
          { name: 'inactive', in: 'query', schema: { type: 'string', enum: ['true', 'false'] }, description: 'Include inactive employees' },
        ],
        responses: {
          '200': jsonResponse('Report rows', { type: 'array', items: { type: 'object', additionalProperties: true } }),
          '400': errorResponse('Start date and end date are required'),
          '401': std401,
        },
      },
    },
    '/api/reports/attendance-management': {
      get: {
        tags: ['Reports'],
        summary: 'Attendance management report (occurrences/points)',
        parameters: [
          { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'employeeId', in: 'query', schema: { type: 'integer' } },
        ],
        responses: {
          '200': jsonResponse('Report data', { type: 'object', additionalProperties: true }),
          '401': std401,
        },
      },
    },
    '/api/reports/break-compliance': {
      get: {
        tags: ['Reports'],
        summary: 'Break compliance report',
        parameters: [
          { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'employeeId', in: 'query', schema: { type: 'integer' } },
          { name: 'groupId', in: 'query', schema: { type: 'integer' } },
          { name: 'inactive', in: 'query', schema: { type: 'string', enum: ['true', 'false'] } },
        ],
        responses: {
          '200': jsonResponse('Report data', { type: 'object', additionalProperties: true }),
          '401': std401,
          '403': errorResponse('Break tracking is not enabled'),
        },
      },
    },
    '/api/reports/leave-balance-summary': {
      get: {
        tags: ['Reports'],
        summary: 'Leave balance summary per employee',
        parameters: [
          { name: 'year', in: 'query', schema: { type: 'integer' }, description: 'Defaults to current year' },
        ],
        responses: {
          '200': jsonResponse('Balances per employee and time code', { type: 'object', additionalProperties: true }),
          '401': std401,
        },
      },
    },
    '/api/report-definitions': {
      get: {
        tags: ['Reference Data'],
        summary: 'Available report definitions for the active brand',
        security: [],
        parameters: [
          { name: 'id', in: 'query', schema: { type: 'string' }, description: 'Return a single report definition' },
        ],
        responses: {
          '200': jsonResponse('Report definitions', { type: 'array', items: { type: 'object', additionalProperties: true } }),
          '404': std404,
        },
      },
    },

    // ------------------------------------------------------- Dashboard
    '/api/dashboard/attendance-forecast': {
      get: {
        tags: ['Dashboard'],
        summary: 'Attendance forecast for upcoming days',
        parameters: [
          { name: 'days', in: 'query', schema: { type: 'integer' }, description: 'Days ahead to forecast' },
        ],
        responses: {
          '200': jsonResponse('Forecast data', { type: 'array', items: { type: 'object', additionalProperties: true } }),
          '401': std401,
        },
      },
    },
    '/api/dashboard/upcoming-staffing': {
      get: {
        tags: ['Dashboard'],
        summary: 'Upcoming staffing levels (scheduled absences)',
        parameters: [
          { name: 'days', in: 'query', schema: { type: 'integer' } },
        ],
        responses: {
          '200': jsonResponse('Staffing rows', { type: 'array', items: { type: 'object', additionalProperties: true } }),
          '401': std401,
        },
      },
    },

    // ------------------------------------------- Users and permissions
    '/api/users': {
      get: {
        tags: ['Users & Permissions'],
        summary: 'List user accounts (admin/manager only)',
        parameters: [
          { name: 'id', in: 'query', schema: { type: 'integer' }, description: 'Return a single user' },
        ],
        responses: {
          '200': jsonResponse('Users (password hashes omitted)', { type: 'array', items: { $ref: '#/components/schemas/User' } }),
          '401': std401,
          '403': std403,
          '404': std404,
        },
      },
      post: {
        tags: ['Users & Permissions'],
        summary: 'Create a user account (admin only)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['username', 'password', 'full_name', 'group_id'],
                properties: {
                  username: { type: 'string' },
                  password: { type: 'string', format: 'password' },
                  full_name: { type: 'string' },
                  email: { type: 'string' },
                  group_id: { type: 'integer' },
                  role_id: { type: 'integer' },
                  is_active: { type: 'integer', enum: [0, 1] },
                },
              },
            },
          },
        },
        responses: {
          '200': jsonResponse('Created user', { $ref: '#/components/schemas/User' }),
          '400': errorResponse('Missing required fields'),
          '401': std401,
          '403': std403,
        },
      },
      put: {
        tags: ['Users & Permissions'],
        summary: 'Update a user account (admin only)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['id'],
                properties: {
                  id: { type: 'integer' },
                  full_name: { type: 'string' },
                  email: { type: 'string' },
                  group_id: { type: 'integer' },
                  role_id: { type: 'integer' },
                  is_active: { type: 'integer', enum: [0, 1] },
                  password: { type: 'string', format: 'password', description: 'Set a new password' },
                },
              },
            },
          },
        },
        responses: {
          '200': jsonResponse('Updated user', { $ref: '#/components/schemas/User' }),
          '400': errorResponse('No fields to update'),
          '401': std401,
          '403': std403,
          '404': std404,
        },
      },
      delete: {
        tags: ['Users & Permissions'],
        summary: 'Deactivate a user account (admin only)',
        parameters: [
          { name: 'id', in: 'query', required: true, schema: { type: 'integer' } },
        ],
        responses: {
          '200': jsonResponse('Deactivated', { $ref: '#/components/schemas/Success' }),
          '401': std401,
          '403': std403,
          '404': std404,
        },
      },
    },
    '/api/groups': {
      get: {
        tags: ['Users & Permissions'],
        summary: 'List groups',
        parameters: [
          { name: 'id', in: 'query', schema: { type: 'integer' } },
        ],
        responses: {
          '200': jsonResponse('Groups', { type: 'array', items: { $ref: '#/components/schemas/Group' } }),
          '401': std401,
        },
      },
      post: {
        tags: ['Users & Permissions'],
        summary: 'Create a group (admin only)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/GroupInput' },
            },
          },
        },
        responses: {
          '200': jsonResponse('Created group', { $ref: '#/components/schemas/Group' }),
          '401': std401,
          '403': std403,
        },
      },
      put: {
        tags: ['Users & Permissions'],
        summary: 'Update a group (admin only)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                allOf: [
                  { type: 'object', required: ['id'], properties: { id: { type: 'integer' } } },
                  { $ref: '#/components/schemas/GroupInput' },
                ],
              },
            },
          },
        },
        responses: {
          '200': jsonResponse('Updated group', { $ref: '#/components/schemas/Group' }),
          '401': std401,
          '403': std403,
          '404': std404,
        },
      },
      delete: {
        tags: ['Users & Permissions'],
        summary: 'Delete a group (admin only)',
        parameters: [
          { name: 'id', in: 'query', required: true, schema: { type: 'integer' } },
        ],
        responses: {
          '200': jsonResponse('Deleted', { $ref: '#/components/schemas/Success' }),
          '401': std401,
          '403': std403,
          '404': std404,
        },
      },
    },
    '/api/roles': {
      get: {
        tags: ['Users & Permissions'],
        summary: 'List roles',
        responses: {
          '200': jsonResponse('Roles', { type: 'array', items: { $ref: '#/components/schemas/Role' } }),
          '401': std401,
        },
      },
    },
    '/api/user-group-permissions': {
      get: {
        tags: ['Users & Permissions'],
        summary: 'Per-group permission grants for a user (superuser only)',
        parameters: [
          { name: 'userId', in: 'query', required: true, schema: { type: 'integer' } },
        ],
        responses: {
          '200': jsonResponse('Grants', {
            type: 'object',
            properties: { permissions: { type: 'array', items: { type: 'object', additionalProperties: true } } },
          }),
          '400': errorResponse('userId is required'),
          '401': std401,
          '403': std403,
        },
      },
      post: {
        tags: ['Users & Permissions'],
        summary: 'Set a user’s permissions for a group (superuser only)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['userId', 'groupId'],
                properties: {
                  userId: { type: 'integer' },
                  groupId: { type: 'integer' },
                  can_create: { type: 'integer', enum: [0, 1] },
                  can_read: { type: 'integer', enum: [0, 1] },
                  can_update: { type: 'integer', enum: [0, 1] },
                  can_delete: { type: 'integer', enum: [0, 1] },
                },
              },
            },
          },
        },
        responses: {
          '200': jsonResponse('Grant saved', { type: 'object', additionalProperties: true }),
          '400': errorResponse('userId and groupId are required'),
          '401': std401,
          '403': std403,
        },
      },
      delete: {
        tags: ['Users & Permissions'],
        summary: 'Remove a user’s permissions for a group (superuser only)',
        parameters: [
          { name: 'userId', in: 'query', required: true, schema: { type: 'integer' } },
          { name: 'groupId', in: 'query', required: true, schema: { type: 'integer' } },
        ],
        responses: {
          '200': jsonResponse('Removed', { $ref: '#/components/schemas/Success' }),
          '400': errorResponse('userId and groupId are required'),
          '401': std401,
          '403': std403,
        },
      },
    },
    '/api/user-employee-link': {
      get: {
        tags: ['Users & Permissions'],
        summary: 'Get the employee linked to the current user',
        responses: {
          '200': jsonResponse('Link status and employee (if linked)', { type: 'object', additionalProperties: true }),
          '401': std401,
        },
      },
      post: {
        tags: ['Users & Permissions'],
        summary: 'Link the current user to an employee record',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  employeeId: { type: 'integer', description: 'Link to an existing employee' },
                  createNew: { type: 'boolean', description: 'Create a new employee record instead' },
                  firstName: { type: 'string', description: 'When createNew is true' },
                  lastName: { type: 'string', description: 'When createNew is true' },
                  email: { type: 'string', description: 'When createNew is true' },
                },
              },
            },
          },
        },
        responses: {
          '200': jsonResponse('Linked', { type: 'object', additionalProperties: true }),
          '400': errorResponse('Validation failed'),
          '401': std401,
        },
      },
    },

    // -------------------------------------------------------- API keys
    '/api/api-keys': {
      get: {
        tags: ['API Keys'],
        summary: 'List API keys (admin only)',
        description: 'Requires a login session; requests authenticated with an API key are rejected.',
        responses: {
          '200': jsonResponse('API keys (hashes never included)', { type: 'array', items: { $ref: '#/components/schemas/ApiKey' } }),
          '401': std401,
          '403': std403,
        },
      },
      post: {
        tags: ['API Keys'],
        summary: 'Create an API key (admin only)',
        description: 'The plaintext key is returned once in this response and never stored or shown again.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'user_id'],
                properties: {
                  name: { type: 'string', description: 'What the key is for, e.g. "Power BI reports"' },
                  user_id: { type: 'integer', description: 'The key acts with this user’s permissions' },
                  expires_in_days: { type: 'number', description: 'Omit for no expiration' },
                },
              },
            },
          },
        },
        responses: {
          '200': jsonResponse('Created key, including the one-time plaintext `key`', {
            allOf: [
              { $ref: '#/components/schemas/ApiKey' },
              { type: 'object', properties: { key: { type: 'string', description: 'Plaintext key (atk_...); shown only once' } } },
            ],
          }),
          '400': errorResponse('Missing name/user_id, or user is not active'),
          '401': std401,
          '403': std403,
        },
      },
      delete: {
        tags: ['API Keys'],
        summary: 'Revoke an API key (admin only)',
        parameters: [
          { name: 'id', in: 'query', required: true, schema: { type: 'integer' } },
        ],
        responses: {
          '200': jsonResponse('Revoked', { $ref: '#/components/schemas/Success' }),
          '401': std401,
          '403': std403,
          '404': std404,
        },
      },
    },

    // -------------------------------------------------- Reference data
    '/api/time-codes': {
      get: {
        tags: ['Reference Data'],
        summary: 'List time codes for the active brand',
        security: [],
        responses: {
          '200': jsonResponse('Time codes', { type: 'array', items: { type: 'object', additionalProperties: true } }),
        },
      },
    },
    '/api/job-titles': {
      get: {
        tags: ['Reference Data'],
        summary: 'List job titles',
        parameters: [
          { name: 'id', in: 'query', schema: { type: 'integer' } },
          { name: 'active', in: 'query', schema: { type: 'string', enum: ['true'] }, description: 'Only active job titles' },
        ],
        responses: {
          '200': jsonResponse('Job titles', { type: 'array', items: { $ref: '#/components/schemas/JobTitle' } }),
          '401': std401,
        },
      },
      post: {
        tags: ['Reference Data'],
        summary: 'Create a job title (admin only)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string' },
                  is_active: { type: 'integer', enum: [0, 1] },
                },
              },
            },
          },
        },
        responses: {
          '200': jsonResponse('Created job title', { $ref: '#/components/schemas/JobTitle' }),
          '401': std401,
          '403': std403,
        },
      },
      put: {
        tags: ['Reference Data'],
        summary: 'Update a job title (admin only)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['id'],
                properties: {
                  id: { type: 'integer' },
                  name: { type: 'string' },
                  description: { type: 'string' },
                  is_active: { type: 'integer', enum: [0, 1] },
                },
              },
            },
          },
        },
        responses: {
          '200': jsonResponse('Updated job title', { $ref: '#/components/schemas/JobTitle' }),
          '401': std401,
          '403': std403,
          '404': std404,
        },
      },
      delete: {
        tags: ['Reference Data'],
        summary: 'Delete a job title (admin only)',
        parameters: [
          { name: 'id', in: 'query', required: true, schema: { type: 'integer' } },
        ],
        responses: {
          '200': jsonResponse('Deleted', { $ref: '#/components/schemas/Success' }),
          '401': std401,
          '403': std403,
          '404': std404,
        },
      },
    },
    '/api/employee-allocations': {
      get: {
        tags: ['Reference Data'],
        summary: 'Per-employee time-code hour allocations',
        parameters: [
          { name: 'employeeId', in: 'query', schema: { type: 'integer' } },
          { name: 'year', in: 'query', schema: { type: 'integer' }, description: 'Defaults to current year' },
        ],
        responses: {
          '200': jsonResponse('Allocations', { type: 'object', additionalProperties: true }),
          '401': std401,
        },
      },
      post: {
        tags: ['Reference Data'],
        summary: 'Set an employee’s allocation for a time code (admin only)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['employee_id', 'time_code', 'allocated_hours', 'year'],
                properties: {
                  employee_id: { type: 'integer' },
                  time_code: { type: 'string' },
                  allocated_hours: { type: 'number' },
                  year: { type: 'integer' },
                  notes: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': jsonResponse('Saved allocation', { type: 'object', additionalProperties: true }),
          '401': std401,
          '403': std403,
        },
      },
      delete: {
        tags: ['Reference Data'],
        summary: 'Remove an employee’s allocation override (admin only)',
        parameters: [
          { name: 'employeeId', in: 'query', required: true, schema: { type: 'integer' } },
          { name: 'timeCode', in: 'query', required: true, schema: { type: 'string' } },
          { name: 'year', in: 'query', required: true, schema: { type: 'integer' } },
        ],
        responses: {
          '200': jsonResponse('Removed', { $ref: '#/components/schemas/Success' }),
          '401': std401,
          '403': std403,
        },
      },
    },
    '/api/brand-selection': {
      get: {
        tags: ['Reference Data'],
        summary: 'Active brand for this installation',
        security: [],
        responses: {
          '200': jsonResponse('Brand info', {
            type: 'object',
            properties: {
              brand: { type: 'string' },
              selectedAt: { type: 'string', nullable: true },
            },
          }),
        },
      },
    },
    '/api/roadmap': {
      get: {
        tags: ['Reference Data'],
        summary: 'Product roadmap content (master group only)',
        responses: {
          '200': jsonResponse('Markdown content', {
            type: 'object',
            properties: { content: { type: 'string' } },
          }),
          '401': std401,
          '403': std403,
        },
      },
    },

    // -------------------------------------------------------- Settings
    '/api/app-settings': {
      get: {
        tags: ['Settings'],
        summary: 'List global app settings (admin only)',
        responses: {
          '200': jsonResponse('Settings key/value list', { type: 'object', additionalProperties: true }),
          '401': std401,
          '403': std403,
        },
      },
      put: {
        tags: ['Settings'],
        summary: 'Update a global app setting (admin only)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['key', 'value'],
                properties: {
                  key: { type: 'string' },
                  value: {},
                },
              },
            },
          },
        },
        responses: {
          '200': jsonResponse('Saved', {
            type: 'object',
            properties: { success: { type: 'boolean' }, key: { type: 'string' }, value: { type: 'string' } },
          }),
          '400': errorResponse('key and value are required'),
          '401': std401,
          '403': std403,
        },
      },
    },
    '/api/color-config': {
      get: {
        tags: ['Settings'],
        summary: 'Color configuration for time codes / UI elements',
        parameters: [
          { name: 'configType', in: 'query', schema: { type: 'string' } },
          { name: 'configKey', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          '200': jsonResponse('Color configs', { type: 'object', additionalProperties: true }),
          '401': std401,
        },
      },
      post: {
        tags: ['Settings'],
        summary: 'Set a color config (admin only)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['configType', 'configKey', 'colorName'],
                properties: {
                  configType: { type: 'string' },
                  configKey: { type: 'string' },
                  colorName: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': jsonResponse('Saved', { type: 'object', additionalProperties: true }),
          '400': errorResponse('Config key is required'),
          '401': std401,
          '403': std403,
        },
      },
      delete: {
        tags: ['Settings'],
        summary: 'Reset a color config to default (admin only)',
        parameters: [
          { name: 'configType', in: 'query', schema: { type: 'string' } },
          { name: 'configKey', in: 'query', schema: { type: 'string' } },
        ],
        responses: {
          '200': jsonResponse('Reset', { type: 'object', additionalProperties: true }),
          '401': std401,
          '403': std403,
        },
      },
    },
    '/api/settings/data-path': {
      get: {
        tags: ['Settings'],
        summary: 'Current database storage path (super admin only)',
        responses: {
          '200': jsonResponse('Path info', { type: 'object', additionalProperties: true }),
          '401': std401,
          '403': std403,
        },
      },
      post: {
        tags: ['Settings'],
        summary: 'Change the database storage path (super admin only)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  customPath: { type: 'string', nullable: true, description: 'null resets to the default location' },
                },
              },
            },
          },
        },
        responses: {
          '200': jsonResponse('Path updated; server restart required to take effect', { type: 'object', additionalProperties: true }),
          '400': errorResponse('Path is not writable or invalid'),
          '401': std401,
          '403': std403,
        },
      },
    },
    '/api/settings/seed-demo': {
      post: {
        tags: ['Settings'],
        summary: 'Seed demo data (admin only; destructive to existing data)',
        responses: {
          '200': jsonResponse('Seeded', { type: 'object', additionalProperties: true }),
          '401': std401,
          '403': std403,
        },
      },
    },

    // --------------------------------------------------------- Backups
    '/api/backup': {
      get: {
        tags: ['Backups'],
        summary: 'List backups, or get backup status',
        parameters: [
          { name: 'action', in: 'query', schema: { type: 'string', enum: ['status'] }, description: 'With action=status, returns backup system status instead of the list' },
        ],
        responses: {
          '200': jsonResponse('Backups or status', {
            type: 'object',
            properties: { backups: { type: 'array', items: { type: 'object', additionalProperties: true } } },
          }),
          '401': std401,
          '403': std403,
        },
      },
      post: {
        tags: ['Backups'],
        summary: 'Create a new backup',
        responses: {
          '200': jsonResponse('Created backup', { type: 'object', additionalProperties: true }),
          '401': std401,
          '403': std403,
        },
      },
    },
    '/api/backup/{id}': {
      get: {
        tags: ['Backups'],
        summary: 'Get a backup’s details, or verify its integrity',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'action', in: 'query', schema: { type: 'string', enum: ['verify'] } },
        ],
        responses: {
          '200': jsonResponse('Backup details or verification result', { type: 'object', additionalProperties: true }),
          '401': std401,
          '403': std403,
          '404': std404,
        },
      },
      post: {
        tags: ['Backups'],
        summary: 'Restore from a backup',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': jsonResponse('Restore result; a restart may be required', { type: 'object', additionalProperties: true }),
          '401': std401,
          '403': std403,
          '404': std404,
        },
      },
      delete: {
        tags: ['Backups'],
        summary: 'Delete a backup',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': jsonResponse('Deleted', { $ref: '#/components/schemas/Success' }),
          '401': std401,
          '403': std403,
          '404': std404,
        },
      },
    },
    '/api/backup/{id}/download': {
      get: {
        tags: ['Backups'],
        summary: 'Download backup files',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'db', in: 'query', schema: { type: 'string', enum: ['attendance', 'auth', 'both'], default: 'both' } },
        ],
        responses: {
          '200': {
            description: 'Backup file download',
            content: { 'application/octet-stream': { schema: { type: 'string', format: 'binary' } } },
          },
          '401': std401,
          '403': std403,
          '404': std404,
        },
      },
    },

    // ---------------------------------------------------------- Import
    '/api/import/attendance': {
      post: {
        tags: ['Import'],
        summary: 'Bulk-import attendance records (admin only)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['records'],
                properties: {
                  records: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['employee_id', 'entry_date', 'time_code', 'hours'],
                      properties: {
                        employee_id: { type: 'integer' },
                        entry_date: { type: 'string', format: 'date' },
                        time_code: { type: 'string' },
                        hours: { type: 'number' },
                        notes: { type: 'string' },
                        overwrite: { type: 'boolean' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': jsonResponse('Import result', {
            type: 'object',
            properties: {
              imported: { type: 'integer' },
              skipped: { type: 'integer' },
              errors: { type: 'array', items: { type: 'string' } },
            },
          }),
          '400': errorResponse('No records to import'),
          '401': std401,
          '403': std403,
        },
      },
    },

    // ----------------------------------------------------------- Audit
    '/api/audit': {
      get: {
        tags: ['Audit'],
        summary: 'Query the audit log (admin only)',
        parameters: [
          { name: 'table', in: 'query', schema: { type: 'string' }, description: 'Filter by table name (requires recordId)' },
          { name: 'recordId', in: 'query', schema: { type: 'integer' } },
          { name: 'userId', in: 'query', schema: { type: 'integer' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 100 } },
          { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
        ],
        responses: {
          '200': jsonResponse('Audit entries', { type: 'array', items: { $ref: '#/components/schemas/AuditEntry' } }),
          '401': std401,
          '403': std403,
        },
      },
    },

    // ------------------------------------------------------------ Meta
    '/api/openapi.json': {
      get: {
        tags: ['Meta'],
        summary: 'This OpenAPI specification',
        security: [],
        responses: {
          '200': jsonResponse('OpenAPI 3.1 document', { type: 'object', additionalProperties: true }),
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        description: 'JWT from /api/auth/login, or an API key (atk_...) from Settings → API Keys',
      },
      cookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'auth_token',
        description: 'HTTP-only cookie set by /api/auth/login (browser sessions)',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          message: { type: 'string', description: 'Optional human-readable detail' },
        },
        required: ['error'],
        additionalProperties: true,
      },
      Success: {
        type: 'object',
        properties: { success: { type: 'boolean' } },
      },
      AuthUser: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          username: { type: 'string' },
          full_name: { type: 'string' },
          email: { type: 'string' },
          group_id: { type: 'integer' },
          role_id: { type: 'integer' },
          employee_id: { type: 'integer' },
          employee_abbreviation: { type: 'string' },
          must_change_password: { type: 'integer', enum: [0, 1] },
          group: { $ref: '#/components/schemas/Group' },
          role: { $ref: '#/components/schemas/Role' },
        },
        additionalProperties: true,
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          username: { type: 'string' },
          full_name: { type: 'string' },
          email: { type: 'string' },
          group_id: { type: 'integer' },
          role_id: { type: 'integer' },
          employee_id: { type: 'integer' },
          is_active: { type: 'integer', enum: [0, 1] },
          has_password: { type: 'boolean' },
          last_login: { type: 'string' },
          created_at: { type: 'string' },
          updated_at: { type: 'string' },
        },
        additionalProperties: true,
      },
      Group: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          description: { type: 'string' },
          is_master: { type: 'integer', enum: [0, 1] },
          can_view_all: { type: 'integer', enum: [0, 1] },
          can_edit_all: { type: 'integer', enum: [0, 1] },
        },
        additionalProperties: true,
      },
      GroupInput: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          is_master: { type: 'integer', enum: [0, 1] },
          can_view_all: { type: 'integer', enum: [0, 1] },
          can_edit_all: { type: 'integer', enum: [0, 1] },
        },
        required: ['name'],
      },
      Role: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          description: { type: 'string' },
          can_create: { type: 'integer', enum: [0, 1] },
          can_read: { type: 'integer', enum: [0, 1] },
          can_update: { type: 'integer', enum: [0, 1] },
          can_delete: { type: 'integer', enum: [0, 1] },
          can_manage_users: { type: 'integer', enum: [0, 1] },
          can_access_all_groups: { type: 'integer', enum: [0, 1] },
        },
        additionalProperties: true,
      },
      Employee: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          first_name: { type: 'string' },
          last_name: { type: 'string' },
          email: { type: 'string' },
          abbreviation: { type: 'string' },
          employee_number: { type: 'string' },
          role: { type: 'string', description: 'Job title name' },
          group_id: { type: 'integer' },
          employment_type: { type: 'string' },
          date_of_hire: { type: 'string', format: 'date' },
          rehire_date: { type: 'string', format: 'date' },
          seniority_rank: { type: 'integer' },
          is_active: { type: 'integer', enum: [0, 1] },
          is_salaried_psl: { type: 'integer', enum: [0, 1] },
          show_in_office_presence: { type: 'integer', enum: [0, 1] },
        },
        additionalProperties: true,
      },
      EmployeeInput: {
        type: 'object',
        properties: {
          first_name: { type: 'string' },
          last_name: { type: 'string' },
          email: { type: 'string' },
          abbreviation: { type: 'string' },
          employee_number: { type: 'string' },
          role: { type: 'string' },
          group_id: { type: 'integer' },
          employment_type: { type: 'string' },
          date_of_hire: { type: 'string', format: 'date' },
          rehire_date: { type: 'string', format: 'date' },
          seniority_rank: { type: 'integer' },
          is_active: { type: 'integer', enum: [0, 1] },
          is_salaried_psl: { type: 'integer', enum: [0, 1] },
          show_in_office_presence: { type: 'integer', enum: [0, 1] },
        },
      },
      AttendanceEntry: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          employee_id: { type: 'integer' },
          entry_date: { type: 'string', format: 'date' },
          time_code: { type: 'string' },
          hours: { type: 'number' },
          notes: { type: 'string' },
        },
        additionalProperties: true,
      },
      BreakEntry: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          employee_id: { type: 'integer' },
          entry_date: { type: 'string', format: 'date' },
          break_type: { type: 'string', enum: ['break_1', 'lunch', 'break_2'] },
          start_time: { type: 'string' },
          duration_minutes: { type: 'integer' },
          notes: { type: 'string' },
        },
        additionalProperties: true,
      },
      JobTitle: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          description: { type: 'string' },
          is_active: { type: 'integer', enum: [0, 1] },
        },
        additionalProperties: true,
      },
      ApiKey: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          key_prefix: { type: 'string', description: 'First characters of the key, for identification' },
          user_id: { type: 'integer' },
          username: { type: 'string' },
          user_full_name: { type: 'string' },
          is_active: { type: 'integer', enum: [0, 1] },
          expires_at: { type: 'string', nullable: true },
          last_used_at: { type: 'string', nullable: true },
          created_by: { type: 'integer' },
          created_at: { type: 'string' },
        },
        additionalProperties: true,
      },
      AuditEntry: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          user_id: { type: 'integer' },
          action: { type: 'string', description: 'CREATE, UPDATE, DELETE, LOGIN, ...' },
          table_name: { type: 'string' },
          record_id: { type: 'integer' },
          old_values: { type: 'string', description: 'JSON string' },
          new_values: { type: 'string', description: 'JSON string' },
          ip_address: { type: 'string' },
          user_agent: { type: 'string' },
          created_at: { type: 'string' },
        },
        additionalProperties: true,
      },
    },
  },
} as const;
