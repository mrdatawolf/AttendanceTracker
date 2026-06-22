export interface AttendanceEntry {
  id?: number;
  employee_id?: number;
  entry_date: string;
  time_code: string;
  hours: number;
  notes?: string;
}

export interface DailySummaryDay {
  outCount: number;
}

export type DailySummary = Record<string, DailySummaryDay>;

export type ViewType = 'year' | 'month' | 'week';

export interface EntryChangeResult {
  success: boolean;
  error?: string;
}
