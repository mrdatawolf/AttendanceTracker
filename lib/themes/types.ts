/**
 * Theme Configuration System (Two-Layer Architecture)
 *
 * This file defines the structure for theme configurations.
 *
 * IMPORTANT: This is Layer 2 of the two-layer theme system:
 * - Layer 1 (Color Mode): User controls light/dark/system - handles ONLY colors
 * - Layer 2 (Theme): Admin controls layout, fonts, spacing - handles everything EXCEPT colors
 *
 * Colors are now managed separately via lib/color-modes.ts
 */

export type ThemeId = 'standard' | 'compact' | 'comfortable';

export type LayoutDensity = 'compact' | 'standard' | 'comfortable';

export interface FontSettings {
  /** Font family for body text */
  family: string;

  /** Base font size in rem */
  baseSize: string;

  /** Font weight for headings */
  headingWeight: number;

  /** Font weight for body text */
  bodyWeight: number;

  /** Line height multiplier */
  lineHeight: number;
}

export interface SpacingScale {
  /** Extra small spacing (0.25rem default) */
  xs: string;

  /** Small spacing (0.5rem default) */
  sm: string;

  /** Medium spacing (1rem default) */
  md: string;

  /** Large spacing (1.5rem default) */
  lg: string;

  /** Extra large spacing (2rem default) */
  xl: string;

  /** 2X extra large spacing (3rem default) */
  '2xl': string;
}

export interface ComponentStyling {
  /** Border radius values */
  borderRadius: {
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };

  /** Shadow depths */
  shadows: {
    sm: string;
    md: string;
    lg: string;
  };

  /** Input field styling */
  input: {
    height: string;
    padding: string;
  };

  /** Button styling */
  button: {
    height: string;
    padding: string;
  };

  /** Card styling */
  card: {
    padding: string;
    gap: string;
  };
}

export interface ThemeConfig {
  /** Unique identifier for the theme */
  id: ThemeId;

  /** Display name shown to users */
  name: string;

  /** Brief description of the theme */
  description: string;

  /** Overall layout density */
  density: LayoutDensity;

  /** Typography settings */
  typography: FontSettings;

  /** Spacing scale */
  spacing: SpacingScale;

  /** Component-specific styling */
  components: ComponentStyling;

  /** Layout preferences for different pages */
  layout: {
    /** Attendance page layout configuration */
    attendance: {
      /** Order of sections: 'balanceFirst' or 'recordFirst' */
      sectionOrder: 'balanceFirst' | 'recordFirst';

      /** Whether to show visual separators between months */
      showMonthSeparators: boolean;
    };
  };

  /** Branding configuration */
  branding: {
    /** Logo file path (relative to /public) */
    logo?: string;

    /** Logo alt text */
    logoAlt?: string;

    /** Application title */
    appTitle: string;
  };

  /** Optional CSS class to apply to the root element */
  cssClass?: string;

  /** Optional custom styles or overrides */
  customization?: {
    /** Any additional settings for future expansion */
    [key: string]: any;
  };
}
