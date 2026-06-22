'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { HelpContent, fetchBrandHelpContent, getHelpForScreen, getHelpForSection as findHelpForSection } from './help-content';

/**
 * Help System Context
 *
 * Provides global help mode state and helper functions for the contextual help system.
 * Help content is loaded dynamically from the current brand's help-content.json file.
 */

interface HelpContextType {
  /** Whether help mode is currently active */
  isHelpMode: boolean;
  /** Toggle help mode on/off */
  toggleHelpMode: () => void;
  /** Set help mode directly */
  setHelpMode: (enabled: boolean) => void;
  /** Current screen being viewed */
  currentScreen: string;
  /** Set the current screen (for help content filtering) */
  setCurrentScreen: (screen: string) => void;
  /** Get all help content for the current screen */
  getScreenHelp: () => HelpContent[];
  /** Get help content for a specific section on the current screen */
  getSectionHelp: (section: string) => HelpContent | undefined;
  /** Check if user has seen help for a screen */
  hasSeenHelp: (screen: string) => boolean;
  /** Mark a screen's help as seen */
  markHelpAsSeen: (screen: string) => void;
  /** Reset all help progress */
  resetHelpProgress: () => void;
  /** Whether the welcome tour should be shown */
  shouldShowWelcome: boolean;
  /** Mark welcome tour as complete */
  completeWelcomeTour: () => void;
  /** Whether help content is still loading */
  isLoadingHelp: boolean;
  /** All loaded help content */
  helpContent: HelpContent[];
}

const HelpContext = createContext<HelpContextType | undefined>(undefined);

const HELP_STORAGE_KEY = 'app_help_progress';
const WELCOME_STORAGE_KEY = 'app_welcome_complete';

interface HelpProgress {
  seenScreens: string[];
  lastUpdated: string;
}

export function HelpProvider({ children }: { children: ReactNode }) {
  const [isHelpMode, setIsHelpMode] = useState(false);
  const [currentScreen, setCurrentScreen] = useState('');
  const [helpProgress, setHelpProgress] = useState<HelpProgress>({ seenScreens: [], lastUpdated: '' });
  const [welcomeComplete, setWelcomeComplete] = useState(true); // Default true to prevent flash
  const [mounted, setMounted] = useState(false);
  const [helpContent, setHelpContent] = useState<HelpContent[]>([]);
  const [isLoadingHelp, setIsLoadingHelp] = useState(true);

  // Load help content from brand folder on mount
  useEffect(() => {
    setMounted(true);

    // Load help progress from localStorage
    try {
      const stored = localStorage.getItem(HELP_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as HelpProgress;
        setHelpProgress(parsed);
      }

      const welcomeStored = localStorage.getItem(WELCOME_STORAGE_KEY);
      setWelcomeComplete(welcomeStored === 'true');
    } catch {
      // Ignore localStorage errors
    }

    // Load help content from brand's JSON file
    fetchBrandHelpContent()
      .then(content => {
        setHelpContent(content);
        setIsLoadingHelp(false);
      })
      .catch(() => {
        setHelpContent([]);
        setIsLoadingHelp(false);
      });
  }, []);

  // Save help progress to localStorage when it changes
  useEffect(() => {
    if (!mounted) return;

    try {
      localStorage.setItem(HELP_STORAGE_KEY, JSON.stringify(helpProgress));
    } catch {
      // Ignore localStorage errors
    }
  }, [helpProgress, mounted]);

  const toggleHelpMode = useCallback(() => {
    setIsHelpMode(prev => !prev);
  }, []);

  const setHelpModeCallback = useCallback((enabled: boolean) => {
    setIsHelpMode(enabled);
  }, []);

  const getScreenHelp = useCallback((): HelpContent[] => {
    return getHelpForScreen(helpContent, currentScreen);
  }, [currentScreen, helpContent]);

  const getSectionHelp = useCallback((section: string): HelpContent | undefined => {
    return findHelpForSection(helpContent, currentScreen, section);
  }, [currentScreen, helpContent]);

  const hasSeenHelp = useCallback((screen: string): boolean => {
    return helpProgress.seenScreens.includes(screen);
  }, [helpProgress.seenScreens]);

  const markHelpAsSeen = useCallback((screen: string) => {
    setHelpProgress(prev => {
      if (prev.seenScreens.includes(screen)) return prev;
      return {
        seenScreens: [...prev.seenScreens, screen],
        lastUpdated: new Date().toISOString(),
      };
    });
  }, []);

  const resetHelpProgress = useCallback(() => {
    setHelpProgress({ seenScreens: [], lastUpdated: new Date().toISOString() });
    setWelcomeComplete(false);
    try {
      localStorage.removeItem(HELP_STORAGE_KEY);
      localStorage.removeItem(WELCOME_STORAGE_KEY);
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const completeWelcomeTour = useCallback(() => {
    setWelcomeComplete(true);
    try {
      localStorage.setItem(WELCOME_STORAGE_KEY, 'true');
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Don't render context until mounted to prevent hydration issues
  if (!mounted) {
    return <>{children}</>;
  }

  const value: HelpContextType = {
    isHelpMode,
    toggleHelpMode,
    setHelpMode: setHelpModeCallback,
    currentScreen,
    setCurrentScreen,
    getScreenHelp,
    getSectionHelp,
    hasSeenHelp,
    markHelpAsSeen,
    resetHelpProgress,
    shouldShowWelcome: !welcomeComplete,
    completeWelcomeTour,
    isLoadingHelp,
    helpContent,
  };

  return <HelpContext.Provider value={value}>{children}</HelpContext.Provider>;
}

export function useHelp() {
  const context = useContext(HelpContext);
  if (context === undefined) {
    // Return default values for SSR/SSG
    return {
      isHelpMode: false,
      toggleHelpMode: () => {},
      setHelpMode: () => {},
      currentScreen: '',
      setCurrentScreen: () => {},
      getScreenHelp: () => [],
      getSectionHelp: () => undefined,
      hasSeenHelp: () => false,
      markHelpAsSeen: () => {},
      resetHelpProgress: () => {},
      shouldShowWelcome: false,
      completeWelcomeTour: () => {},
      isLoadingHelp: false,
      helpContent: [],
    };
  }
  return context;
}
