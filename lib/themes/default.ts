import { ThemeConfig } from './types';

/**
 * Compact Theme
 *
 * Space-efficient layout with tighter spacing and smaller components.
 * Features:
 * - Compact density for displaying more information
 * - Attendance Record prioritized (shown first)
 * - Visual month separators for improved readability
 * - Reduced padding and margins for efficient space usage
 */
export const compactTheme: ThemeConfig = {
  id: 'compact',
  name: 'Compact',
  description: 'Space-efficient layout with tighter spacing',

  density: 'compact',

  typography: {
    family: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    baseSize: '0.875rem',
    headingWeight: 600,
    bodyWeight: 400,
    lineHeight: 1.4,
  },

  spacing: {
    xs: '0.125rem',
    sm: '0.25rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    '2xl': '1.5rem',
  },

  components: {
    borderRadius: {
      sm: '0.125rem',
      md: '0.25rem',
      lg: '0.375rem',
      xl: '0.5rem',
    },
    shadows: {
      sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
      md: '0 2px 4px -1px rgb(0 0 0 / 0.1)',
      lg: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
    },
    input: {
      height: '2rem',
      padding: '0.25rem 0.5rem',
    },
    button: {
      height: '2rem',
      padding: '0.25rem 0.75rem',
    },
    card: {
      padding: '0.75rem',
      gap: '0.5rem',
    },
  },

  layout: {
    attendance: {
      sectionOrder: 'recordFirst',
      showMonthSeparators: true,
    },
  },

  branding: {
    logo: '/biztech.png',
    logoAlt: 'TRLC Logo',
    appTitle: 'Multi-User Attendance',
  },

  cssClass: 'theme-compact',
};
