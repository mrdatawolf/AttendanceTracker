/**
 * Application Configuration
 *
 * Feature flags and settings for the attendance application
 */

export const config = {
  /**
   * Feature Flags
   */
  features: {
    // Enable/disable the dashboard page
    enableDashboard: true,

    // Enable/disable the reports page
    enableReports: true,
  },

  /**
   * Application Settings
   */
  app: {
    name: 'Multi-User Attendance',
    version: '1.0.0',
  },

  /**
   * API Configuration
   *
   * API URL can be set via NEXT_PUBLIC_API_URL environment variable during build.
   * If not set, uses relative paths (default for single-server deployment).
   *
   * Example brandURI values in brand-features.json:
   * - "http://192.168.1.100:6029" - for remote server
   * - "" - for relative paths (client and server on same host)
   */
  api: {
    baseURL: process.env.NEXT_PUBLIC_API_URL || '',
  },
} as const;

export default config;
