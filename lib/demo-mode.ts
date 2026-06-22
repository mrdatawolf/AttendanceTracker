/**
 * Demo Mode Utility
 *
 * Manages demo mode state for the application.
 * When demo mode is enabled:
 * - Database is cleared and reseeded on startup
 * - Demo data is consistent for presentations
 * - Data does not persist after the application closes
 *
 * Demo mode is enabled by (in priority order):
 * 1. demo-mode.json file in server working directory (written by build script)
 * 2. Brand's brand-features.json having DemoMode: true
 * 3. Setting DEMO_MODE=true environment variable (fallback)
 *
 * For unit tests:
 * - Tests can use setDemoModeOverride() to force demo mode state
 */

import * as fs from 'fs';
import * as path from 'path';

// Internal state for testing overrides
let demoModeOverride: boolean | null = null;

// Cache for demo mode (to avoid repeated file reads)
let demoModeCache: boolean | undefined = undefined;

/**
 * Read demo mode from demo-mode.json (written by build script)
 */
function getDemoModeFromFlag(): boolean | null {
  try {
    // Check current working directory (server's directory)
    const configPath = path.join(process.cwd(), 'demo-mode.json');

    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf8');
      const config = JSON.parse(content);
      console.log('[DEMO-MODE] Found demo-mode.json, demoMode:', config.demoMode);
      return config.demoMode === true;
    }

    return null;
  } catch (error) {
    console.log('[DEMO-MODE] Error reading demo-mode.json:', error);
    return null;
  }
}

/**
 * Read demo mode from brand config files
 */
function getDemoModeFromBrandConfig(): boolean | null {
  try {
    // Try to find brand config in current working directory
    const cwd = process.cwd();
    const brandSelectionPath = path.join(cwd, 'lib', 'brand-selection.json');

    if (!fs.existsSync(brandSelectionPath)) {
      return null;
    }

    const brandSelection = JSON.parse(fs.readFileSync(brandSelectionPath, 'utf8'));
    if (!brandSelection.brand) {
      return null;
    }

    const brandFeaturesPath = path.join(cwd, 'public', brandSelection.brand, 'brand-features.json');
    if (!fs.existsSync(brandFeaturesPath)) {
      return null;
    }

    const brandFeatures = JSON.parse(fs.readFileSync(brandFeaturesPath, 'utf8'));
    if (typeof brandFeatures.DemoMode === 'boolean') {
      console.log('[DEMO-MODE] Found DemoMode in brand config:', brandFeatures.DemoMode);
      return brandFeatures.DemoMode;
    }

    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Clear the demo mode cache (for testing)
 */
export function clearBrandDemoModeCache(): void {
  demoModeCache = undefined;
}

/**
 * Check if the application is running in demo mode
 *
 * @returns true if demo mode is enabled
 */
export function isDemoMode(): boolean {
  // Allow tests to override
  if (demoModeOverride !== null) {
    return demoModeOverride;
  }

  // Return cached value if available
  if (demoModeCache !== undefined) {
    return demoModeCache;
  }

  // 1. Check demo-mode.json flag file (highest priority - written by build)
  const flagValue = getDemoModeFromFlag();
  if (flagValue !== null) {
    demoModeCache = flagValue;
    return flagValue;
  }

  // 2. Check brand config
  const brandValue = getDemoModeFromBrandConfig();
  if (brandValue !== null) {
    demoModeCache = brandValue;
    return brandValue;
  }

  // 3. Check environment variable
  const envValue = process.env.DEMO_MODE;
  const result = envValue === 'true' || envValue === '1';
  demoModeCache = result;
  console.log('[DEMO-MODE] Using env var DEMO_MODE:', envValue, '-> result:', result);
  return result;
}

/**
 * Override demo mode state (for testing)
 *
 * @param value - true to force demo mode, false to disable, null to use environment
 */
export function setDemoModeOverride(value: boolean | null): void {
  demoModeOverride = value;
  demoModeCache = undefined;
}

/**
 * Get demo mode status for logging
 *
 * @returns Human-readable demo mode status
 */
export function getDemoModeStatus(): string {
  if (isDemoMode()) {
    return 'DEMO MODE ENABLED - Database will be reset on each startup';
  }
  return 'Production mode - Database persists normally';
}

/**
 * Log demo mode banner if enabled
 */
export function logDemoModeBanner(): void {
  if (isDemoMode()) {
    console.log('');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║                      DEMO MODE ACTIVE                      ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log('║  - Database will be cleared and reseeded on startup        ║');
    console.log('║  - Changes will NOT persist after the application closes   ║');
    console.log('║  - Pre-loaded with sample data for demonstration           ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('');
  }
}

// Legacy export for compatibility (no longer used)
export function getRuntimeDataPath(): string | null {
  return null;
}
