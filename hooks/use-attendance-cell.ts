import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import type { AttendanceEntry, DailySummary } from '@/lib/attendance-types';

// Mapping of semantic colors to Tailwind background classes for cells
export const CELL_BG_COLOR_MAP: Record<string, string> = {
  blue: 'bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:hover:bg-blue-800 dark:text-blue-100',
  amber: 'bg-amber-100 hover:bg-amber-200 dark:bg-amber-900 dark:hover:bg-amber-800 dark:text-amber-100',
  red: 'bg-red-100 hover:bg-red-200 dark:bg-red-900 dark:hover:bg-red-800 dark:text-red-100',
  teal: 'bg-teal-100 hover:bg-teal-200 dark:bg-teal-900 dark:hover:bg-teal-800 dark:text-teal-100',
  purple: 'bg-purple-100 hover:bg-purple-200 dark:bg-purple-900 dark:hover:bg-purple-800 dark:text-purple-100',
  green: 'bg-green-100 hover:bg-green-200 dark:bg-green-900 dark:hover:bg-green-800 dark:text-green-100',
  gray: 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-100',
};

interface TimeCodeColorInfo {
  code: string;
  defaultColor: string;
}

interface ColorConfig {
  config_type: string;
  config_key: string;
  color_name: string;
}

export interface FullnessInfo {
  outCount: number;
  inOfficePercent: number;
  barColor: string;
  isOverLimit: boolean;
}

interface UseAttendanceCellOptions {
  entries: AttendanceEntry[];
  dailySummary?: DailySummary | null;
  totalActiveEmployees?: number;
  maxOutOfOffice?: number;
  capacityWarningCount?: number;
  capacityCriticalCount?: number;
}

export function useAttendanceCell({
  entries,
  dailySummary,
  totalActiveEmployees = 0,
  maxOutOfOffice = 0,
  capacityWarningCount = 3,
  capacityCriticalCount = 5,
}: UseAttendanceCellOptions) {
  const { authFetch } = useAuth();

  // Time code colors state
  const [timeCodeColors, setTimeCodeColors] = useState<Map<string, string>>(new Map());

  // Fetch time code colors from the API
  useEffect(() => {
    const loadColorConfig = async () => {
      try {
        const response = await authFetch('/api/color-config');
        if (response.ok) {
          const data = await response.json();
          const colorMap = new Map<string, string>();

          // First, set defaults from the JSON time codes
          if (data.timeCodes) {
            data.timeCodes.forEach((tc: TimeCodeColorInfo) => {
              if (tc.defaultColor) {
                colorMap.set(tc.code, tc.defaultColor);
              }
            });
          }

          // Then, override with any custom configs from the database
          if (data.colorConfigs) {
            data.colorConfigs.forEach((config: ColorConfig) => {
              if (config.config_type === 'time_code') {
                colorMap.set(config.config_key, config.color_name);
              }
            });
          }

          setTimeCodeColors(colorMap);
        }
      } catch (error) {
        console.error('Failed to load color config:', error);
      }
    };
    loadColorConfig();
  }, [authFetch]);

  // Group entries by date
  const entriesByDate = useMemo(() => {
    const map = new Map<string, AttendanceEntry[]>();
    entries.forEach(entry => {
      const existing = map.get(entry.entry_date) || [];
      existing.push(entry);
      map.set(entry.entry_date, existing);
    });
    return map;
  }, [entries]);

  const getEntriesForDate = (dateStr: string): AttendanceEntry[] => {
    return entriesByDate.get(dateStr) || [];
  };

  const getCellDisplay = (entriesForDate: AttendanceEntry[]): string => {
    if (entriesForDate.length === 0) {
      return '-';
    }

    if (entriesForDate.length === 1) {
      const entry = entriesForDate[0];
      return `${entry.time_code} (${entry.hours})`;
    }

    // Multiple entries: show *totalHours
    const totalHours = entriesForDate.reduce((sum, e) => sum + e.hours, 0);
    return `*${totalHours.toFixed(1)}`;
  };

  const hasNotes = (entriesForDate: AttendanceEntry[]): boolean => {
    return entriesForDate.some(e => e.notes && e.notes.trim().length > 0);
  };

  const getCellColorClass = (entriesForDate: AttendanceEntry[]): string => {
    if (entriesForDate.length === 0) {
      return '';
    }

    if (entriesForDate.length === 1) {
      const colorName = timeCodeColors.get(entriesForDate[0].time_code);
      if (colorName) {
        return CELL_BG_COLOR_MAP[colorName] || '';
      }
    }

    // Multiple entries: use gray
    return CELL_BG_COLOR_MAP.gray || '';
  };

  const getFullnessInfo = (dateStr: string): FullnessInfo | null => {
    if (!dailySummary || !totalActiveEmployees || totalActiveEmployees === 0) {
      return null;
    }

    const daySummary = dailySummary[dateStr];
    const outCount = daySummary?.outCount ?? 0;
    const inOfficePercent = ((totalActiveEmployees - outCount) / totalActiveEmployees) * 100;
    const isOverLimit = maxOutOfOffice > 0 && outCount > maxOutOfOffice;

    let barColor: string;
    if (isOverLimit || (capacityCriticalCount > 0 && outCount >= capacityCriticalCount)) {
      barColor = 'bg-red-400';
    } else if (capacityWarningCount > 0 && outCount >= capacityWarningCount) {
      barColor = 'bg-amber-400';
    } else {
      barColor = 'bg-gray-300';
    }

    return { outCount, inOfficePercent, barColor, isOverLimit };
  };

  return {
    entriesByDate,
    timeCodeColors,
    getEntriesForDate,
    getCellDisplay,
    getCellColorClass,
    getFullnessInfo,
    hasNotes,
  };
}
