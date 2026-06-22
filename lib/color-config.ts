/**
 * Color Configuration System
 *
 * Provides color management for time codes and status indicators.
 * Color resolution priority:
 * 1. Database (admin customizations)
 * 2. Brand JSON defaults
 * 3. System defaults
 */

import { authDb } from './db-auth';
import { getBrandTimeCodes, BrandTimeCode } from './brand-time-codes';
import { getBrandFeatures as getBrandFeaturesFromLib } from './brand-features';

// Available semantic colors in the palette
export type SemanticColor = 'blue' | 'amber' | 'red' | 'teal' | 'purple' | 'green' | 'gray';

// Color variant for light/dark mode
export interface ColorVariant {
  bg: string;      // Background color (hex)
  text: string;    // Text color (hex)
  border?: string; // Border color (hex)
}

// Full color definition with light/dark variants
export interface ColorDefinition {
  light: ColorVariant;
  dark: ColorVariant;
}

// Color configuration entry (from database)
export interface ColorConfig {
  id: number;
  config_type: 'time_code' | 'status';
  config_key: string;
  color_name: SemanticColor;
  created_at: string;
  updated_at: string;
}

// Default color palette with light/dark variants
export const DEFAULT_COLOR_PALETTE: Record<SemanticColor, ColorDefinition> = {
  blue: {
    light: { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd' },
    dark: { bg: '#1e3a5f', text: '#93c5fd', border: '#3b82f6' },
  },
  amber: {
    light: { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' },
    dark: { bg: '#451a03', text: '#fcd34d', border: '#f59e0b' },
  },
  red: {
    light: { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' },
    dark: { bg: '#450a0a', text: '#fca5a5', border: '#ef4444' },
  },
  teal: {
    light: { bg: '#ccfbf1', text: '#115e59', border: '#5eead4' },
    dark: { bg: '#042f2e', text: '#5eead4', border: '#14b8a6' },
  },
  purple: {
    light: { bg: '#f3e8ff', text: '#6b21a8', border: '#d8b4fe' },
    dark: { bg: '#2e1065', text: '#d8b4fe', border: '#a855f7' },
  },
  green: {
    light: { bg: '#dcfce7', text: '#166534', border: '#86efac' },
    dark: { bg: '#052e16', text: '#86efac', border: '#22c55e' },
  },
  gray: {
    light: { bg: '#f3f4f6', text: '#374151', border: '#d1d5db' },
    dark: { bg: '#1f2937', text: '#d1d5db', border: '#4b5563' },
  },
};

// Default time code colors (used when no JSON or DB config)
export const DEFAULT_TIME_CODE_COLORS: Record<string, SemanticColor> = {
  V: 'blue',      // Vacation
  PS: 'purple',   // Personal Sick
  FH: 'teal',     // Floating Holiday
  H: 'green',     // Holiday
  B: 'gray',      // Bereavement
  JD: 'gray',     // Jury Duty
  FM: 'gray',     // FMLA
};

// Default status colors
export const DEFAULT_STATUS_COLORS: Record<string, SemanticColor> = {
  warning: 'amber',
  critical: 'red',
  normal: 'gray',
};

// Cache for color configurations
let colorConfigCache: ColorConfig[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 30000; // 30 seconds

/**
 * Get all color configurations from database
 */
export async function getColorConfigs(): Promise<ColorConfig[]> {
  const now = Date.now();
  if (colorConfigCache && (now - cacheTimestamp) < CACHE_TTL) {
    return colorConfigCache;
  }

  try {
    const result = await authDb.execute('SELECT * FROM color_config ORDER BY config_type, config_key');
    colorConfigCache = result.rows as unknown as ColorConfig[];
    cacheTimestamp = now;
    return colorConfigCache;
  } catch (error) {
    // Table might not exist yet (migration not run)
    console.warn('Could not load color configs:', error);
    return [];
  }
}

/**
 * Get a specific color config from database
 */
export async function getColorConfig(configType: string, configKey: string): Promise<ColorConfig | null> {
  const configs = await getColorConfigs();
  return configs.find(c => c.config_type === configType && c.config_key === configKey) || null;
}

/**
 * Save or update a color configuration
 */
export async function saveColorConfig(
  configType: 'time_code' | 'status',
  configKey: string,
  colorName: SemanticColor
): Promise<void> {
  await authDb.execute({
    sql: `
      INSERT INTO color_config (config_type, config_key, color_name, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(config_type, config_key) DO UPDATE SET
        color_name = excluded.color_name,
        updated_at = CURRENT_TIMESTAMP
    `,
    args: [configType, configKey, colorName],
  });

  // Clear cache
  colorConfigCache = null;
}

/**
 * Delete a color configuration (revert to default)
 */
export async function deleteColorConfig(configType: string, configKey: string): Promise<void> {
  await authDb.execute({
    sql: 'DELETE FROM color_config WHERE config_type = ? AND config_key = ?',
    args: [configType, configKey],
  });

  // Clear cache
  colorConfigCache = null;
}

/**
 * Clear the color config cache
 */
export function clearColorConfigCache(): void {
  colorConfigCache = null;
  cacheTimestamp = 0;
}

/**
 * Get the color for a time code
 * Resolution: DB override -> JSON default -> System default
 */
export async function getTimeCodeColor(timeCode: string): Promise<SemanticColor> {
  // 1. Check database for admin override
  const dbConfig = await getColorConfig('time_code', timeCode);
  if (dbConfig) {
    return dbConfig.color_name;
  }

  // 2. Check brand JSON defaults
  const brandTimeCodes = getBrandTimeCodes();
  if (brandTimeCodes) {
    const tc = brandTimeCodes.find((t: BrandTimeCode) => t.code === timeCode);
    if (tc && 'color' in tc && typeof (tc as BrandTimeCode & { color?: string }).color === 'string') {
      return (tc as BrandTimeCode & { color?: string }).color as SemanticColor;
    }
  }

  // 3. Return system default
  return DEFAULT_TIME_CODE_COLORS[timeCode] || 'gray';
}

/**
 * Get all time code colors as a map (for batch operations)
 */
export async function getTimeCodeColorMap(timeCodes: string[]): Promise<Record<string, SemanticColor>> {
  const result: Record<string, SemanticColor> = {};

  // Get all DB configs at once
  const dbConfigs = await getColorConfigs();
  const dbTimeCodeConfigs = dbConfigs.filter(c => c.config_type === 'time_code');
  const dbMap = new Map(dbTimeCodeConfigs.map(c => [c.config_key, c.color_name]));

  // Get brand JSON defaults
  const brandTimeCodes = getBrandTimeCodes();
  const brandMap = new Map<string, SemanticColor>();
  if (brandTimeCodes) {
    brandTimeCodes.forEach((tc: BrandTimeCode) => {
      if ('color' in tc && typeof (tc as BrandTimeCode & { color?: string }).color === 'string') {
        brandMap.set(tc.code, (tc as BrandTimeCode & { color?: string }).color as SemanticColor);
      }
    });
  }

  // Resolve each time code
  for (const code of timeCodes) {
    result[code] = dbMap.get(code) || brandMap.get(code) || DEFAULT_TIME_CODE_COLORS[code] || 'gray';
  }

  return result;
}

/**
 * Get the color for a status (warning, critical, normal)
 * Resolution: DB override -> JSON default -> System default
 */
export async function getStatusColor(status: 'warning' | 'critical' | 'normal'): Promise<SemanticColor> {
  // 1. Check database for admin override
  const dbConfig = await getColorConfig('status', status);
  if (dbConfig) {
    return dbConfig.color_name;
  }

  // 2. Check brand JSON defaults (from brand-features.json)
  const brandFeatures = await getBrandFeaturesFromLib();
  const statusColors = (brandFeatures?.features as Record<string, unknown> & { statusColors?: Record<string, SemanticColor> })?.statusColors;
  if (statusColors && statusColors[status]) {
    return statusColors[status];
  }

  // 3. Return system default
  return DEFAULT_STATUS_COLORS[status];
}

/**
 * Get all status colors
 */
export async function getStatusColors(): Promise<Record<string, SemanticColor>> {
  const result: Record<string, SemanticColor> = { ...DEFAULT_STATUS_COLORS };

  // Get brand JSON defaults
  const brandFeatures = await getBrandFeaturesFromLib();
  const statusColors = (brandFeatures?.features as Record<string, unknown> & { statusColors?: Record<string, SemanticColor> })?.statusColors;
  if (statusColors) {
    Object.assign(result, statusColors);
  }

  // Get DB overrides
  const dbConfigs = await getColorConfigs();
  const dbStatusConfigs = dbConfigs.filter(c => c.config_type === 'status');
  for (const config of dbStatusConfigs) {
    result[config.config_key] = config.color_name;
  }

  return result;
}

/**
 * Get color styles for a semantic color name
 */
export function getColorStyles(
  colorName: SemanticColor,
  mode: 'light' | 'dark'
): ColorVariant {
  const colorDef = DEFAULT_COLOR_PALETTE[colorName] || DEFAULT_COLOR_PALETTE.gray;
  return colorDef[mode];
}

/**
 * Convert color styles to inline CSS style object
 */
export function colorToInlineStyles(
  colorName: SemanticColor,
  mode: 'light' | 'dark',
  options: { includeBorder?: boolean; includeBackground?: boolean } = {}
): React.CSSProperties {
  const { includeBorder = true, includeBackground = true } = options;
  const colors = getColorStyles(colorName, mode);

  const styles: React.CSSProperties = {
    color: colors.text,
  };

  if (includeBackground) {
    styles.backgroundColor = colors.bg;
  }

  if (includeBorder && colors.border) {
    styles.borderColor = colors.border;
  }

  return styles;
}

/**
 * Check if color customization feature is enabled
 */
export async function isColorCustomizationEnabled(): Promise<{
  enabled: boolean;
  allowTimeCodeColors: boolean;
  allowStatusColors: boolean;
}> {
  const brandFeatures = await getBrandFeaturesFromLib();
  const colorCustomization = (brandFeatures?.features as Record<string, unknown> & {
    colorCustomization?: {
      enabled?: boolean;
      allowTimeCodeColors?: boolean;
      allowStatusColors?: boolean;
    };
  })?.colorCustomization;

  return {
    enabled: colorCustomization?.enabled ?? false,
    allowTimeCodeColors: colorCustomization?.allowTimeCodeColors ?? false,
    allowStatusColors: colorCustomization?.allowStatusColors ?? false,
  };
}

/**
 * Get the list of available colors in the palette
 */
export function getAvailableColors(): { name: SemanticColor; label: string }[] {
  return [
    { name: 'blue', label: 'Blue' },
    { name: 'amber', label: 'Amber' },
    { name: 'red', label: 'Red' },
    { name: 'teal', label: 'Teal' },
    { name: 'purple', label: 'Purple' },
    { name: 'green', label: 'Green' },
    { name: 'gray', label: 'Gray' },
  ];
}
