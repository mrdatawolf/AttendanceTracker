/**
 * Theme System (Layer 2 of Two-Layer Architecture)
 *
 * Central registry for all application themes.
 * These themes control layout, typography, spacing, and components.
 * Colors are managed separately via lib/color-modes.ts
 *
 * To add a new theme:
 * 1. Create a new file in lib/themes/ (e.g., 'spacious.ts')
 * 2. Define your theme configuration using ThemeConfig interface
 * 3. Import and add it to the THEMES array below
 * 4. Update ThemeId type in types.ts to include your theme id
 *
 * BRANDING: Brand assets (logos, etc.) are controlled by the build-time
 * brand selection. Run `npm run select-brand` to choose a brand.
 * Brand config is merged into theme branding at runtime.
 */

import { ThemeConfig, ThemeId } from './types';
import { standardTheme } from './trinity';
import { compactTheme } from './default';
import { comfortableTheme } from './comfortable';
import { getBrandConfig } from '../brand-config';

/**
 * All available themes
 * Add new themes to this array to make them available throughout the app
 */
export const THEMES: ThemeConfig[] = [
  standardTheme,
  compactTheme,
  comfortableTheme,
];

/**
 * Get a theme configuration by ID
 * Merges build-time brand config into the theme's branding
 * @param themeId - The theme identifier
 * @returns The theme configuration with brand-specific overrides
 */
export function getTheme(themeId: ThemeId): ThemeConfig {
  const baseTheme = THEMES.find(theme => theme.id === themeId) || standardTheme;
  const brandConfig = getBrandConfig();

  // Merge brand config into theme branding
  return {
    ...baseTheme,
    branding: {
      ...baseTheme.branding,
      logo: brandConfig.logoPath,
      logoAlt: brandConfig.logoAlt,
      appTitle: brandConfig.appTitle,
    },
  };
}

/**
 * Get all available theme IDs
 * @returns Array of theme IDs
 */
export function getAvailableThemeIds(): ThemeId[] {
  return THEMES.map(theme => theme.id);
}

/**
 * Validate if a theme ID exists
 * @param themeId - The theme identifier to validate
 * @returns True if the theme exists
 */
export function isValidThemeId(themeId: string): themeId is ThemeId {
  return THEMES.some(theme => theme.id === themeId);
}

// Re-export types for convenience
export type { ThemeConfig, ThemeId } from './types';
