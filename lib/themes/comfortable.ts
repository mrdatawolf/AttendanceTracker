import { ThemeConfig } from './types';

/**
 * Comfortable Theme
 *
 * Spacious layout with generous padding and larger components.
 * Features:
 * - Comfortable density for relaxed viewing
 * - Balance Cards displayed first
 * - Larger text and components for accessibility
 * - Generous spacing for reduced visual clutter
 */
export const comfortableTheme: ThemeConfig = {
  id: 'comfortable',
  name: 'Comfortable',
  description: 'Spacious layout with generous padding',

  density: 'comfortable',

  typography: {
    family: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    baseSize: '1.125rem',
    headingWeight: 600,
    bodyWeight: 400,
    lineHeight: 1.6,
  },

  spacing: {
    xs: '0.5rem',
    sm: '0.75rem',
    md: '1.5rem',
    lg: '2rem',
    xl: '2.5rem',
    '2xl': '4rem',
  },

  components: {
    borderRadius: {
      sm: '0.375rem',
      md: '0.5rem',
      lg: '0.75rem',
      xl: '1rem',
    },
    shadows: {
      sm: '0 1px 3px 0 rgb(0 0 0 / 0.1)',
      md: '0 6px 10px -2px rgb(0 0 0 / 0.1)',
      lg: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
    },
    input: {
      height: '3rem',
      padding: '0.75rem 1rem',
    },
    button: {
      height: '3rem',
      padding: '0.75rem 1.5rem',
    },
    card: {
      padding: '2rem',
      gap: '1.5rem',
    },
  },

  layout: {
    attendance: {
      sectionOrder: 'balanceFirst',
      showMonthSeparators: false,
    },
  },

  branding: {
    appTitle: 'Multi-User Attendance',
  },

  cssClass: 'theme-comfortable',
};
