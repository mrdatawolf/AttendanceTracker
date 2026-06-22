import type { ViewType } from './attendance-types';

/** Format a Date to YYYY-MM-DD string. */
export function formatDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Parse a YYYY-MM-DD string to a Date (local timezone). */
export function parseDateStr(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Get the first and last day of a month as YYYY-MM-DD. */
export function getMonthBounds(year: number, month: number): { start: string; end: string } {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0); // last day of the month
  return { start: formatDateStr(start), end: formatDateStr(end) };
}

/** Get the Monday–Sunday week bounds containing a given date. Returns YYYY-MM-DD strings. */
export function getWeekBounds(date: Date): { start: string; end: string } {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun, 1=Mon, ...
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: formatDateStr(monday), end: formatDateStr(sunday) };
}

/**
 * Build a month calendar grid: array of week-rows, each containing 7 Date objects (Mon–Sun).
 * Includes leading days from the previous month and trailing days from the next month.
 */
export function getMonthCalendarGrid(year: number, month: number): Date[][] {
  const firstOfMonth = new Date(year, month - 1, 1);
  const lastOfMonth = new Date(year, month, 0);

  // Day of week for the first day (Mon=0 ... Sun=6)
  let startDow = firstOfMonth.getDay() - 1; // shift so Mon=0
  if (startDow < 0) startDow = 6; // Sunday becomes 6

  // Start date: back up to the Monday before (or on) the 1st
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(gridStart.getDate() - startDow);

  const weeks: Date[][] = [];
  const current = new Date(gridStart);

  // Generate weeks until we've passed the last day of the month
  // and completed the week row
  while (true) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    weeks.push(week);

    // Stop after we've passed the last day and filled the row
    if (current > lastOfMonth && weeks.length >= 4) {
      break;
    }
  }

  return weeks;
}

/** Get 7 Date objects for the week containing `date` (Mon–Sun). */
export function getWeekDates(date: Date): Date[] {
  const { start } = getWeekBounds(date);
  const monday = parseDateStr(start);
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d);
  }
  return dates;
}

/** Navigate: given current date and view, go forward or backward one period. */
export function navigatePeriod(view: ViewType, current: Date, direction: 'prev' | 'next'): Date {
  const result = new Date(current);
  const delta = direction === 'next' ? 1 : -1;

  switch (view) {
    case 'year':
      result.setFullYear(result.getFullYear() + delta);
      break;
    case 'month':
      result.setMonth(result.getMonth() + delta);
      break;
    case 'week':
      result.setDate(result.getDate() + delta * 7);
      break;
  }

  return result;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const SHORT_MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** Get a human-readable label for the current period. */
export function getPeriodLabel(view: ViewType, date: Date): string {
  switch (view) {
    case 'year':
      return String(date.getFullYear());
    case 'month':
      return `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
    case 'week': {
      const dates = getWeekDates(date);
      const mon = dates[0];
      const sun = dates[6];
      const monMonth = SHORT_MONTH_NAMES[mon.getMonth()];
      const sunMonth = SHORT_MONTH_NAMES[sun.getMonth()];

      if (mon.getFullYear() !== sun.getFullYear()) {
        // Spans year boundary
        return `${monMonth} ${mon.getDate()}, ${mon.getFullYear()} – ${sunMonth} ${sun.getDate()}, ${sun.getFullYear()}`;
      } else if (mon.getMonth() !== sun.getMonth()) {
        // Spans month boundary
        return `${monMonth} ${mon.getDate()} – ${sunMonth} ${sun.getDate()}, ${sun.getFullYear()}`;
      } else {
        return `${monMonth} ${mon.getDate()} – ${sun.getDate()}, ${sun.getFullYear()}`;
      }
    }
  }
}

/** Get today's date as YYYY-MM-DD in the server's local timezone. */
export function getLocalToday(): string {
  return formatDateStr(new Date());
}

/**
 * Get the "effective date" for office presence tracking.
 *
 * Before the reset time: returns today's date.
 * After the reset time: returns tomorrow's date.
 *
 * This causes presence buttons to "reset" at the configured time
 * because the system queries for the new effective date, finds no rows,
 * and every employee defaults to "in office."
 *
 * @param resetTime - HH:MM string (24-hour), e.g., "17:00". Defaults to "17:00".
 * @returns YYYY-MM-DD string in local timezone
 */
export function getEffectiveDateForPresence(resetTime: string = '17:00'): string {
  const now = new Date();
  const [resetHour, resetMinute] = resetTime.split(':').map(Number);

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const resetMinutes = resetHour * 60 + resetMinute;

  if (currentMinutes >= resetMinutes) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return formatDateStr(tomorrow);
  }

  return formatDateStr(now);
}

/** Check if a date is today. */
export function isToday(date: Date): boolean {
  const now = new Date();
  return date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();
}

/** Check if a date is a weekend (Saturday or Sunday). */
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/** Day-of-week short names (Monday-start). */
export const DAY_NAMES_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
