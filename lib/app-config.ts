/**
 * Application Configuration
 *
 * This file contains default configuration values for the application.
 * These can be changed to customize the default user experience.
 *
 * Available themes: 'standard', 'compact', 'comfortable'
 * Available color modes: 'light', 'dark', 'system'
 */

import { ThemeId } from './themes/types';
import { ColorMode } from './color-modes';

export interface AppConfig {
  /** Default theme for new users (Layer 2: Layout & Typography) */
  defaultTheme: ThemeId;
  /** Default color mode for new users (Layer 1: Light/Dark colors) */
  defaultColorMode: ColorMode;
}

export const appConfig: AppConfig = {
  // Change this to set the default theme
  // Options: 'standard' (balanced), 'compact' (dense), 'comfortable' (spacious)
  defaultTheme: 'standard',

  // Change this to set the default color mode
  // Options: 'light', 'dark', 'system' (follows OS preference)
  defaultColorMode: 'system',
};
