/**
 * Brand Features Configuration System
 *
 * This module manages brand-specific feature flags for the application.
 * Each brand can have different features enabled based on their needs.
 *
 * Feature configuration is loaded from public/<brand>/brand-features.json
 */

import { getCurrentBrandId } from './brand-config';

// Leave type configuration
export interface LeaveTypeConfig {
  enabled: boolean;
  timeCode?: string;  // Maps to actual time code in database (e.g., "FLH", "PSL", "V")
  aliases?: string[]; // Legacy/alternate time codes that should be counted the same (e.g., ["V"] for VAC)
  label?: string;     // Display label for UI (e.g., "Floating Holiday", "Paid Sick Leave")
  availableBalanceText?: string;  // Custom text instead of calculated balance (e.g., "Check ADP")
  annualUsageLimit?: number;      // Override the "total" shown on card (e.g., 40 for 40h/year cap)
}

// Company holiday configuration
export interface CompanyHoliday {
  date: string;  // Format: YYYY-MM-DD
  name: string;
}

export interface CompanyHolidaysConfig {
  enabled: boolean;
  year?: number;
  dates?: CompanyHoliday[];
}

// Reports configuration
export interface LeaveBalanceSummaryConfig {
  enabled: boolean;
  warningThreshold?: number;   // Default 0.9 (90%)
  criticalThreshold?: number;  // Default 1.0 (100%)
}

export interface ReportsConfig {
  leaveBalanceSummary?: LeaveBalanceSummaryConfig;
}

// Color customization configuration
export interface ColorCustomizationConfig {
  enabled: boolean;
  allowTimeCodeColors?: boolean;  // Allow customizing time code colors
  allowStatusColors?: boolean;    // Allow customizing status (warning/critical) colors
}

// Status colors configuration
export interface StatusColorsConfig {
  warning?: string;   // Semantic color name (e.g., 'amber')
  critical?: string;  // Semantic color name (e.g., 'red')
  normal?: string;    // Semantic color name (e.g., 'gray')
}

// Break time window configuration
export interface BreakWindow {
  start: string;    // HH:MM format, e.g., "09:00"
  end: string;      // HH:MM format, e.g., "11:00"
  duration: number; // Required duration in minutes
}

// Break tracking feature configuration
export interface BreakTrackingConfig {
  enabled: boolean;
  breaks: {
    break_1?: BreakWindow;
    lunch?: BreakWindow;
    break_2?: BreakWindow;
  };
  requireTimeEntry?: boolean;  // If true, require start/end times (default: false)
  graceMinutes?: number;       // Minutes of flexibility for compliance (default: 0)
}

// Office attendance forecast configuration
export interface OfficeAttendanceForecastConfig {
  enabled: boolean;
  timeOffCodes?: string[];  // Time codes that indicate absence (e.g., ["V", "PTO", "PS"])
  daysToShow?: number;      // Number of days to forecast (default: 5)
}

// Office presence tracking configuration
// When enabled, shows toggle buttons in the navbar for tracking who's in the office
export interface OfficePresenceTrackingConfig {
  enabled: boolean;
  resetTime?: string;  // HH:MM (24h), default "17:00". When reached, presence buttons reset for the next day.
}

// Global read access configuration
// When enabled, all authenticated users can READ all employees' attendance data
// regardless of group permissions. Write permissions are never affected.
export interface GlobalReadAccessConfig {
  enabled: boolean;
  maxOutOfOffice?: number;  // Max employees allowed out at once (0 = no limit)
  capacityWarningCount?: number;  // # of people out that triggers yellow bar (default 3)
  capacityCriticalCount?: number;  // # of people out that triggers red bar (default 5)
}

// Bulk entry configuration
export interface BulkEntryConfig {
  enabled: boolean;
  maxDays?: number;  // Maximum number of days in a single bulk entry (default 90)
}

// Brand features configuration structure
export interface BrandFeatures {
  brandId: string;
  features: {
    leaveManagement: {
      enabled: boolean;
      leaveTypes?: Record<string, LeaveTypeConfig>;
      autogenerateNameAbbreviation?: boolean;
      logoutOnClose?: boolean;
    };
    approvalWorkflows: { enabled: boolean };
    policyEnforcement: { enabled: boolean };
    accrualCalculations: { enabled: boolean; rules?: Record<string, any> };
    companyHolidays?: CompanyHolidaysConfig;
    reports?: ReportsConfig;
    colorCustomization?: ColorCustomizationConfig;
    statusColors?: StatusColorsConfig;
    breakTracking?: BreakTrackingConfig;
    officeAttendanceForecast?: OfficeAttendanceForecastConfig;
    globalReadAccess?: GlobalReadAccessConfig;
    officePresenceTracking?: OfficePresenceTrackingConfig;
    attendanceManagement?: {
      enabled: boolean;
      timeCodeOrder?: string[];  // Display order for summary rows (time code strings). Unlisted codes appear at the end.
    };
    bulkEntry?: BulkEntryConfig;
    attendanceYearLayout?: 'table' | 'calendar';  // Year view layout: 'table' (default 12x31 grid) or 'calendar' (12 month cards)
  };
}

// Default features when no brand-features.json is found
export const DEFAULT_FEATURES: BrandFeatures = {
  brandId: 'Default',
  features: {
    leaveManagement: { enabled: false },
    approvalWorkflows: { enabled: false },
    policyEnforcement: { enabled: false },
    accrualCalculations: { enabled: false },
  },
};

// Cache for loaded brand features
let cachedFeatures: BrandFeatures | null = null;
let cachedBrandId: string | null = null;

/**
 * Get the brand features configuration
 * Loads from public/<brand>/brand-features.json or returns defaults
 *
 * @returns Promise resolving to BrandFeatures
 */
export async function getBrandFeatures(): Promise<BrandFeatures> {
  const brandId = getCurrentBrandId();

  // Return cached if same brand
  if (cachedFeatures && cachedBrandId === brandId) {
    return cachedFeatures;
  }

  try {
    // In browser context, fetch from public folder
    if (typeof window !== 'undefined') {
      const response = await fetch(`/${brandId}/brand-features.json`);
      if (response.ok) {
        const features = await response.json();
        cachedFeatures = features;
        cachedBrandId = brandId;
        return features;
      }
    } else {
      // In server context, read from filesystem
      const fs = await import('fs/promises');
      const path = await import('path');
      const filePath = path.join(process.cwd(), 'public', brandId, 'brand-features.json');

      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const features = JSON.parse(content);
        cachedFeatures = features;
        cachedBrandId = brandId;
        return features;
      } catch {
        // File doesn't exist, return defaults
      }
    }
  } catch (error) {
    console.warn(`Failed to load brand features for ${brandId}:`, error);
  }

  // Return defaults with current brand ID
  return {
    ...DEFAULT_FEATURES,
    brandId,
  };
}

/**
 * Synchronous version for server components
 * Uses cached value or defaults (call getBrandFeatures first to populate cache)
 */
export function getBrandFeaturesSync(): BrandFeatures {
  const brandId = getCurrentBrandId();

  if (cachedFeatures && cachedBrandId === brandId) {
    return cachedFeatures;
  }

  return {
    ...DEFAULT_FEATURES,
    brandId,
  };
}

/**
 * Check if a top-level feature is enabled
 *
 * @param features - The brand features configuration
 * @param feature - The feature to check ('leaveManagement', 'approvalWorkflows', etc.)
 * @returns boolean indicating if the feature is enabled
 */
export function isFeatureEnabled(
  features: BrandFeatures,
  feature: keyof BrandFeatures['features']
): boolean {
  const featureConfig = features.features[feature];
  // Check if the feature config has an 'enabled' property (some configs like statusColors don't)
  if (featureConfig && typeof featureConfig === 'object' && 'enabled' in featureConfig) {
    return (featureConfig as { enabled: boolean }).enabled ?? false;
  }
  return false;
}

/**
 * Check if a specific leave type is enabled
 *
 * @param features - The brand features configuration
 * @param leaveType - The leave type to check ('vacation', 'sickLeave', etc.)
 * @returns boolean indicating if the leave type is enabled
 */
export function isLeaveTypeEnabled(features: BrandFeatures, leaveType: string): boolean {
  // First check if leave management is enabled
  if (!features.features.leaveManagement.enabled) {
    return false;
  }

  // Then check if the specific leave type is enabled
  const leaveTypes = features.features.leaveManagement.leaveTypes;
  if (!leaveTypes) {
    return false;
  }

  return leaveTypes[leaveType]?.enabled ?? false;
}

/**
 * Get all enabled leave types
 *
 * @param features - The brand features configuration
 * @returns Array of enabled leave type names
 */
export function getEnabledLeaveTypes(features: BrandFeatures): string[] {
  if (!features.features.leaveManagement.enabled) {
    return [];
  }

  const leaveTypes = features.features.leaveManagement.leaveTypes;
  if (!leaveTypes) {
    return [];
  }

  return Object.entries(leaveTypes)
    .filter(([, config]) => config.enabled)
    .map(([name]) => name);
}

/**
 * Clear the cached features (useful for testing or brand switching)
 */
export function clearFeaturesCache(): void {
  cachedFeatures = null;
  cachedBrandId = null;
}

/**
 * Get company holidays for a specific year
 *
 * @param features - The brand features configuration
 * @param year - The year to get holidays for
 * @returns Array of holiday dates (YYYY-MM-DD format) or empty array if disabled/no match
 */
export function getCompanyHolidayDates(features: BrandFeatures, year: number): Set<string> {
  const holidaysConfig = features.features.companyHolidays;

  if (!holidaysConfig?.enabled || !holidaysConfig.dates) {
    return new Set();
  }

  // Only return holidays for the matching year
  if (holidaysConfig.year && holidaysConfig.year !== year) {
    return new Set();
  }

  // Return dates that match the requested year
  const dates = holidaysConfig.dates
    .filter(h => h.date.startsWith(`${year}-`))
    .map(h => h.date);

  return new Set(dates);
}

/**
 * Get leave balance summary report configuration
 *
 * @param features - The brand features configuration
 * @returns Configuration with thresholds, or null if disabled
 */
export function getLeaveBalanceSummaryConfig(features: BrandFeatures): {
  enabled: boolean;
  warningThreshold: number;
  criticalThreshold: number;
} {
  const config = features.features.reports?.leaveBalanceSummary;

  return {
    enabled: config?.enabled ?? false,
    warningThreshold: config?.warningThreshold ?? 0.9,
    criticalThreshold: config?.criticalThreshold ?? 1.0,
  };
}

/**
 * Get color customization configuration
 *
 * @param features - The brand features configuration
 * @returns Configuration for color customization feature
 */
export function getColorCustomizationConfig(features: BrandFeatures): {
  enabled: boolean;
  allowTimeCodeColors: boolean;
  allowStatusColors: boolean;
} {
  const config = features.features.colorCustomization;

  return {
    enabled: config?.enabled ?? false,
    allowTimeCodeColors: config?.allowTimeCodeColors ?? false,
    allowStatusColors: config?.allowStatusColors ?? false,
  };
}

/**
 * Get status colors configuration
 *
 * @param features - The brand features configuration
 * @returns Status colors for warning/critical/normal states
 */
export function getStatusColorsConfig(features: BrandFeatures): {
  warning: string;
  critical: string;
  normal: string;
} {
  const config = features.features.statusColors;

  return {
    warning: config?.warning ?? 'amber',
    critical: config?.critical ?? 'red',
    normal: config?.normal ?? 'gray',
  };
}

/**
 * Get break tracking configuration
 *
 * @param features - The brand features configuration
 * @returns Break tracking config if enabled, null otherwise
 */
export function getBreakTrackingConfig(features: BrandFeatures): BreakTrackingConfig | null {
  const config = features.features.breakTracking;

  if (!config?.enabled) {
    return null;
  }

  return {
    ...config,
    requireTimeEntry: config.requireTimeEntry ?? false,
    graceMinutes: config.graceMinutes ?? 0,
  };
}

/**
 * Get office attendance forecast configuration
 *
 * @param features - The brand features configuration
 * @returns Attendance forecast config if enabled, null otherwise
 */
export function getOfficeAttendanceForecastConfig(features: BrandFeatures): OfficeAttendanceForecastConfig | null {
  const config = features.features.officeAttendanceForecast;

  if (!config?.enabled) {
    return null;
  }

  // Default time-off codes if not specified
  const defaultTimeOffCodes = ['V', 'PTO', 'PS', 'S', 'FM', 'B', 'JD', 'FH'];

  return {
    ...config,
    timeOffCodes: config.timeOffCodes || defaultTimeOffCodes,
    daysToShow: config.daysToShow ?? 5,
  };
}

/**
 * Check if global read access is enabled for the current brand.
 * When enabled, all authenticated users can READ all employees'
 * attendance data regardless of group permissions.
 * Write permissions are never affected by this flag.
 */
export function isGlobalReadAccessEnabled(features: BrandFeatures): boolean {
  return features.features.globalReadAccess?.enabled ?? false;
}

/**
 * Check if office presence tracking is enabled
 */
export function isOfficePresenceTrackingEnabled(features: BrandFeatures): boolean {
  return features.features.officePresenceTracking?.enabled ?? false;
}

/**
 * Get office presence tracking configuration with defaults applied.
 *
 * @param features - The brand features configuration
 * @returns Presence tracking config if enabled, null otherwise
 */
export function getOfficePresenceConfig(features: BrandFeatures): OfficePresenceTrackingConfig | null {
  const config = features.features.officePresenceTracking;

  if (!config?.enabled) {
    return null;
  }

  return {
    ...config,
    resetTime: config.resetTime ?? '17:00',
  };
}

/**
 * Get the attendance year view layout style.
 * Returns 'table' (default 12x31 grid) or 'calendar' (12 month cards).
 */
export function getAttendanceYearLayout(features: BrandFeatures): 'table' | 'calendar' {
  return features.features.attendanceYearLayout ?? 'table';
}

/**
 * Returns true when the brand requires users to log in fresh each time
 * the browser window or Electron app is closed and reopened.
 * Default is false (sessions persist across closes).
 */
export function isLogoutOnClose(features: BrandFeatures): boolean {
  return features.features.leaveManagement.logoutOnClose ?? false;
}

/**
 * Returns true when the brand is configured to auto-generate employee
 * abbreviations from their name instead of requiring manual entry.
 * Default is false (manual entry required).
 */
export function isAutoGenerateAbbreviation(features: BrandFeatures): boolean {
  return features.features.leaveManagement.autogenerateNameAbbreviation ?? false;
}

/**
 * Get bulk entry configuration.
 * Returns enabled status and max days limit.
 */
export function getBulkEntryConfig(features: BrandFeatures): {
  enabled: boolean;
  maxDays: number;
} {
  const config = features.features.bulkEntry;

  return {
    enabled: config?.enabled ?? true,
    maxDays: config?.maxDays ?? 90,
  };
}
