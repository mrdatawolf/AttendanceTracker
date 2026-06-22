/**
 * Color Mode System
 *
 * Defines light and dark color palettes that are independent of themes.
 * Users can choose their preferred color mode (light/dark/system).
 */

export type ColorMode = 'light' | 'dark' | 'system';

export interface ColorPalette {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
  input: string;
  ring: string;
}

/**
 * Light mode color palette
 * Based on shadcn/ui defaults
 */
export const lightColors: ColorPalette = {
  background: '0 0% 100%',
  foreground: '222.2 84% 4.9%',
  card: '0 0% 100%',
  cardForeground: '222.2 84% 4.9%',
  popover: '0 0% 100%',
  popoverForeground: '222.2 84% 4.9%',
  primary: '222.2 47.4% 11.2%',
  primaryForeground: '210 40% 98%',
  secondary: '210 40% 96.1%',
  secondaryForeground: '222.2 47.4% 11.2%',
  muted: '210 40% 96.1%',
  mutedForeground: '215.4 16.3% 46.9%',
  accent: '210 40% 96.1%',
  accentForeground: '222.2 47.4% 11.2%',
  destructive: '0 84.2% 60.2%',
  destructiveForeground: '210 40% 98%',
  border: '214.3 31.8% 91.4%',
  input: '214.3 31.8% 91.4%',
  ring: '222.2 84% 4.9%',
};

/**
 * Dark mode color palette
 * Slightly brighter than the shadcn/ui default so dark brand marks remain
 * visible in the navbar and dense tool surfaces.
 */
export const darkColors: ColorPalette = {
  background: '218 44% 14%',
  foreground: '210 40% 98%',
  card: '218 42% 16%',
  cardForeground: '210 40% 98%',
  popover: '218 42% 16%',
  popoverForeground: '210 40% 98%',
  primary: '210 40% 98%',
  primaryForeground: '218 44% 14%',
  secondary: '216 34% 24%',
  secondaryForeground: '210 40% 98%',
  muted: '216 34% 24%',
  mutedForeground: '214 24% 76%',
  accent: '215 36% 28%',
  accentForeground: '210 40% 98%',
  destructive: '0 62.8% 30.6%',
  destructiveForeground: '210 40% 98%',
  border: '215 32% 30%',
  input: '215 32% 30%',
  ring: '212.7 26.8% 83.9%',
};

/**
 * Get the color palette for a given mode
 * Resolves 'system' to light or dark based on OS preference
 */
export function getColorPalette(mode: ColorMode): ColorPalette {
  if (mode === 'system') {
    // Check system preference
    if (typeof window !== 'undefined' && window.matchMedia) {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      return prefersDark ? darkColors : lightColors;
    }
    // Default to light if system preference can't be determined
    return lightColors;
  }

  return mode === 'dark' ? darkColors : lightColors;
}

/**
 * Get the resolved mode (light or dark) from a color mode
 */
export function getResolvedMode(mode: ColorMode): 'light' | 'dark' {
  if (mode === 'system') {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  }
  return mode;
}

/**
 * Validate if a string is a valid color mode
 */
export function isValidColorMode(mode: string): mode is ColorMode {
  return mode === 'light' || mode === 'dark' || mode === 'system';
}
