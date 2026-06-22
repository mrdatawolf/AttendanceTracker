# Application Configuration

This document describes how to configure the attendance application.

## Configuration File

The configuration is located at `lib/config.ts`.

## Feature Flags

Feature flags allow you to enable or disable specific features of the application.

### Dashboard

**Setting:** `features.enableDashboard`
**Type:** `boolean`
**Default:** `false`

Controls whether the dashboard page is accessible.

- When `true`: Users can access `/dashboard` to view statistics and summaries
- When `false`: The dashboard page shows a disabled message with instructions

### Reports

**Setting:** `features.enableReports`
**Type:** `boolean`
**Default:** `false`

Controls whether the reports page is accessible.

- When `true`: Users can access `/reports` to generate and export attendance reports
- When `false`: The reports page shows a disabled message with instructions

## Example Configuration

```typescript
export const config = {
  features: {
    // Enable the dashboard
    enableDashboard: true,

    // Keep reports disabled
    enableReports: false,
  },

  app: {
    name: 'Multi-User Attendance',
    version: '1.0.0',
  },
} as const;
```

## Enabling Features

To enable a feature:

1. Open `lib/config.ts`
2. Change the desired feature flag from `false` to `true`
3. Save the file
4. The dev server will automatically reload

Example - to enable the dashboard:

```typescript
features: {
  enableDashboard: true,  // Changed from false to true
  enableReports: false,
}
```

## Notes

- Each feature can be enabled/disabled independently
- Changes take effect immediately (hot reload in development)
- No server restart required in development mode
- Feature flags are compile-time constants
