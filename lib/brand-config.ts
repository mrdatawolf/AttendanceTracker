/**
 * Brand Configuration System
 *
 * This module manages white-label branding for the application.
 * Brands are selected at build time via the select-brand script.
 *
 * Brand assets are stored in public/<brand-name>/ folders.
 * Each brand folder should contain:
 *   - logo.png (required)
 *   - Any other brand-specific assets
 *
 * Available brands are auto-detected from public/ subfolders.
 */

// This file is generated at build time by scripts/select-brand.js
// DO NOT EDIT MANUALLY - run `npm run select-brand` to change
import brandSelection from './brand-selection.json';

export interface BrandConfig {
  id: string;
  name: string;
  logoPath: string;
  logoAlt: string;
  appTitle: string;
}

// Default brand configuration (used if no brand is selected)
export const DEFAULT_BRAND: BrandConfig = {
  id: 'Default',
  name: 'Default',
  logoPath: '/Default/logo.png',
  logoAlt: 'Logo',
  appTitle: 'Multi-User Attendance',
};

// Brand-specific configurations
const BRAND_CONFIGS: Record<string, Partial<BrandConfig>> = {
  Default: {
    name: 'Default',
    appTitle: 'Multi-User Attendance',
    logoAlt: 'Logo',
  },
  TRL: {
    name: 'Trinity Rehab',
    appTitle: 'TRL Attendance',
    logoAlt: 'Trinity Rehab Logo',
  },
  BT: {
    name: 'BizTech',
    appTitle: 'BizTech Attendance',
    logoAlt: 'BizTech Logo',
  },
  NFL: {
    name: 'NFL',
    appTitle: 'NFL Attendance',
    logoAlt: 'NFL Logo',
  },
  SBS: {
    name: 'SBS',
    appTitle: 'SBS Attendance',
    logoAlt: 'SBS Logo',
  },
};

/**
 * Get the current brand configuration
 * Uses the build-time selected brand from brand-selection.json
 */
export function getBrandConfig(): BrandConfig {
  const selectedBrand = brandSelection?.brand || 'Default';
  const config = BRAND_CONFIGS[selectedBrand] || {};

  return {
    id: selectedBrand,
    name: config.name || selectedBrand,
    logoPath: `/${selectedBrand}/logo.png`,
    logoAlt: config.logoAlt || `${selectedBrand} Logo`,
    appTitle: config.appTitle || 'Multi-User Attendance',
  };
}

/**
 * Get the current brand ID
 */
export function getCurrentBrandId(): string {
  return brandSelection?.brand || 'Default';
}
