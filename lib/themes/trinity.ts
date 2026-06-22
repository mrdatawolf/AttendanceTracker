import { ThemeConfig } from './types';

/**
 * Standard Theme
 *
 * Balanced layout with comfortable spacing and standard component sizes.
 * Features:
 * - Standard density for general use
 * - Balance Cards displayed first
 * - System font stack for broad compatibility
 * - Moderate spacing and padding
 */
export const standardTheme: ThemeConfig = {
  id: 'standard',
  name: 'Standard',
  description: 'Balanced layout with comfortable spacing',

  density: 'standard',

  typography: {
    family: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    baseSize: '1rem',
    headingWeight: 600,
    bodyWeight: 400,
    lineHeight: 1.5,
  },

  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
  },

  components: {
    borderRadius: {
      sm: '0.25rem',
      md: '0.375rem',
      lg: '0.5rem',
      xl: '0.75rem',
    },
    shadows: {
      sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
      md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
      lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
    },
    input: {
      height: '2.5rem',
      padding: '0.5rem 0.75rem',
    },
    button: {
      height: '2.5rem',
      padding: '0.5rem 1rem',
    },
    card: {
      padding: '1.5rem',
      gap: '1rem',
    },
  },

  layout: {
    attendance: {
      sectionOrder: 'balanceFirst',
      showMonthSeparators: false,
    },
  },

  branding: {
    logo: '/TRLC_logo_smaller.png',
    logoAlt: 'TRLC Logo',
    appTitle: 'Multi-User Attendance',
  },

  cssClass: 'theme-standard',
};
