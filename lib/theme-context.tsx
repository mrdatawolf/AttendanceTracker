'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ThemeId, getTheme, isValidThemeId } from '@/lib/themes';
import { ColorMode, getColorPalette, getResolvedMode, isValidColorMode } from '@/lib/color-modes';
import { appConfig } from '@/lib/app-config';

/**
 * Two-Layer Theme System Context
 *
 * Layer 1 (Color Mode): User controls light/dark/system - handles ONLY colors
 * Layer 2 (Theme): Admin controls layout, fonts, spacing - handles everything EXCEPT colors
 */
interface ThemeContextType {
  /** Layer 2: Theme ID (admin setting) */
  theme: ThemeId;
  /** Layer 2: Set theme (admin only) */
  setTheme: (theme: ThemeId) => void;

  /** Layer 1: Color mode (user preference) */
  colorMode: ColorMode;
  /** Layer 1: Set color mode (user setting) */
  setColorMode: (mode: ColorMode) => void;

  /** Layer 1: Resolved color mode (light or dark) */
  resolvedColorMode: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(appConfig.defaultTheme);
  const [colorMode, setColorModeState] = useState<ColorMode>(appConfig.defaultColorMode);
  const [resolvedColorMode, setResolvedColorMode] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);

  // Listen for system color scheme changes
  useEffect(() => {
    if (colorMode !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      const resolved = getResolvedMode('system');
      setResolvedColorMode(resolved);
      applyColorMode('system');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [colorMode]);

  useEffect(() => {
    setMounted(true);

    // Load Layer 2 (Theme) - admin setting, defaults from appConfig
    const storedTheme = localStorage.getItem('app_theme');
    if (storedTheme && isValidThemeId(storedTheme)) {
      setThemeState(storedTheme);
    }

    // Load Layer 1 (Color Mode) - user preference, defaults from appConfig
    const storedColorMode = localStorage.getItem('app_color_mode');
    if (storedColorMode && isValidColorMode(storedColorMode)) {
      setColorModeState(storedColorMode);
      setResolvedColorMode(getResolvedMode(storedColorMode));
    } else {
      setResolvedColorMode(getResolvedMode(appConfig.defaultColorMode));
    }

    // Apply both layers
    applyTheme(storedTheme && isValidThemeId(storedTheme) ? storedTheme : appConfig.defaultTheme);
    applyColorMode(storedColorMode && isValidColorMode(storedColorMode) ? storedColorMode : appConfig.defaultColorMode);
  }, []);

  const applyColorMode = (mode: ColorMode) => {
    const root = document.documentElement;
    const colors = getColorPalette(mode);
    const resolved = getResolvedMode(mode);

    // Apply color palette to CSS variables
    root.style.setProperty('--background', colors.background);
    root.style.setProperty('--foreground', colors.foreground);
    root.style.setProperty('--card', colors.card);
    root.style.setProperty('--card-foreground', colors.cardForeground);
    root.style.setProperty('--popover', colors.popover);
    root.style.setProperty('--popover-foreground', colors.popoverForeground);
    root.style.setProperty('--primary', colors.primary);
    root.style.setProperty('--primary-foreground', colors.primaryForeground);
    root.style.setProperty('--secondary', colors.secondary);
    root.style.setProperty('--secondary-foreground', colors.secondaryForeground);
    root.style.setProperty('--muted', colors.muted);
    root.style.setProperty('--muted-foreground', colors.mutedForeground);
    root.style.setProperty('--accent', colors.accent);
    root.style.setProperty('--accent-foreground', colors.accentForeground);
    root.style.setProperty('--destructive', colors.destructive);
    root.style.setProperty('--destructive-foreground', colors.destructiveForeground);
    root.style.setProperty('--border', colors.border);
    root.style.setProperty('--input', colors.input);
    root.style.setProperty('--ring', colors.ring);

    // Apply dark/light class for CSS-based color adjustments
    root.classList.remove('light', 'dark');
    root.classList.add(resolved);
  };

  const applyTheme = (themeId: ThemeId) => {
    const root = document.documentElement;
    const themeConfig = getTheme(themeId);

    // Apply typography CSS variables
    root.style.setProperty('--font-family', themeConfig.typography.family);
    root.style.setProperty('--font-size-base', themeConfig.typography.baseSize);
    root.style.setProperty('--font-weight-heading', themeConfig.typography.headingWeight.toString());
    root.style.setProperty('--font-weight-body', themeConfig.typography.bodyWeight.toString());
    root.style.setProperty('--line-height', themeConfig.typography.lineHeight.toString());

    // Apply spacing CSS variables
    root.style.setProperty('--spacing-xs', themeConfig.spacing.xs);
    root.style.setProperty('--spacing-sm', themeConfig.spacing.sm);
    root.style.setProperty('--spacing-md', themeConfig.spacing.md);
    root.style.setProperty('--spacing-lg', themeConfig.spacing.lg);
    root.style.setProperty('--spacing-xl', themeConfig.spacing.xl);
    root.style.setProperty('--spacing-2xl', themeConfig.spacing['2xl']);

    // Apply component styling CSS variables
    root.style.setProperty('--radius-sm', themeConfig.components.borderRadius.sm);
    root.style.setProperty('--radius-md', themeConfig.components.borderRadius.md);
    root.style.setProperty('--radius-lg', themeConfig.components.borderRadius.lg);
    root.style.setProperty('--radius-xl', themeConfig.components.borderRadius.xl);

    root.style.setProperty('--shadow-sm', themeConfig.components.shadows.sm);
    root.style.setProperty('--shadow-md', themeConfig.components.shadows.md);
    root.style.setProperty('--shadow-lg', themeConfig.components.shadows.lg);

    root.style.setProperty('--input-height', themeConfig.components.input.height);
    root.style.setProperty('--input-padding', themeConfig.components.input.padding);

    root.style.setProperty('--button-height', themeConfig.components.button.height);
    root.style.setProperty('--button-padding', themeConfig.components.button.padding);

    root.style.setProperty('--card-padding', themeConfig.components.card.padding);
    root.style.setProperty('--card-gap', themeConfig.components.card.gap);

    // Apply theme CSS class
    if (themeConfig.cssClass) {
      // Remove all theme-specific classes first
      root.classList.forEach(className => {
        if (className.startsWith('theme-')) {
          root.classList.remove(className);
        }
      });
      root.classList.add(themeConfig.cssClass);
    }
  };

  const setTheme = (newTheme: ThemeId) => {
    setThemeState(newTheme);
    localStorage.setItem('app_theme', newTheme);
    applyTheme(newTheme);
  };

  const setColorMode = (mode: ColorMode) => {
    setColorModeState(mode);
    const resolved = getResolvedMode(mode);
    setResolvedColorMode(resolved);
    localStorage.setItem('app_color_mode', mode);
    applyColorMode(mode);
  };

  // Prevent flash of wrong theme/colors
  if (!mounted) {
    return <>{children}</>;
  }

  const value: ThemeContextType = {
    theme,
    setTheme,
    colorMode,
    setColorMode,
    resolvedColorMode,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    // Return default values for SSR/SSG
    return {
      theme: appConfig.defaultTheme,
      setTheme: () => {},
      colorMode: appConfig.defaultColorMode,
      setColorMode: () => {},
      resolvedColorMode: 'light' as const,
    };
  }
  return context;
}
