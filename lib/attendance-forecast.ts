/**
 * Office Attendance Forecast Utilities
 *
 * Calculates expected in-office headcount based on:
 * - Total active employees
 * - Employees with time-off entries for each day
 */

import { db } from './db-sqlite';
import { getBrandFeatures, getOfficeAttendanceForecastConfig } from './brand-features';
import { formatDateStr } from './date-helpers';

export interface EmployeeOut {
  id: number;
  firstName: string;
  lastName: string;
  timeCode: string;
  hours: number;
}

export interface DayForecast {
  date: string;
  dayName: string;
  expectedInOffice: number;
  percentCapacity: number;
  employeesOut: EmployeeOut[];
}

export interface AttendanceForecast {
  totalActiveEmployees: number;
  daysToShow: number;
  timeOffCodes: string[];
  forecast: DayForecast[];
}

/**
 * Check if attendance forecast feature is enabled
 */
export async function isAttendanceForecastEnabled(): Promise<boolean> {
  const features = await getBrandFeatures();
  const config = getOfficeAttendanceForecastConfig(features);
  return config !== null;
}

/**
 * Generate attendance forecast for upcoming days
 *
 * @param days - Number of days to forecast (overrides config)
 * @returns Forecast data or null if feature is disabled
 */
export async function generateAttendanceForecast(days?: number): Promise<AttendanceForecast | null> {
  const features = await getBrandFeatures();
  const config = getOfficeAttendanceForecastConfig(features);

  if (!config) {
    return null;
  }

  const daysToShow = days ?? config.daysToShow ?? 5;
  const timeOffCodes = config.timeOffCodes ?? ['V', 'PTO', 'PS', 'S', 'FM', 'B', 'JD', 'FH'];

  // Get total active employees
  const countResult = await db.execute('SELECT COUNT(*) as count FROM employees WHERE is_active = 1');
  const totalActiveEmployees = Number((countResult.rows[0] as unknown as { count: number }).count);

  const forecast: DayForecast[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < daysToShow; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const dateStr = formatDateStr(date);
    const dayName = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

    // Get employees with time-off entries for this date
    const placeholders = timeOffCodes.map(() => '?').join(', ');
    const outResult = await db.execute({
      sql: `
        SELECT DISTINCT e.id, e.first_name, e.last_name, ae.time_code, SUM(ae.hours) as hours
        FROM employees e
        JOIN attendance_entries ae ON e.id = ae.employee_id
        WHERE ae.entry_date = ?
          AND ae.time_code IN (${placeholders})
          AND e.is_active = 1
        GROUP BY e.id, e.first_name, e.last_name, ae.time_code
      `,
      args: [dateStr, ...timeOffCodes],
    });

    const employeesOut: EmployeeOut[] = outResult.rows.map((row) => {
      const r = row as unknown as { id: number; first_name: string; last_name: string; time_code: string; hours: number };
      return {
        id: r.id,
        firstName: r.first_name,
        lastName: r.last_name,
        timeCode: r.time_code,
        hours: r.hours,
      };
    });

    // Count unique employees out (in case one employee has multiple time-off codes)
    const uniqueEmployeeIds = new Set(employeesOut.map(e => e.id));
    const uniqueEmployeesOut = uniqueEmployeeIds.size;

    const expectedInOffice = totalActiveEmployees - uniqueEmployeesOut;
    const percentCapacity = totalActiveEmployees > 0
      ? Math.round((expectedInOffice / totalActiveEmployees) * 100)
      : 0;

    forecast.push({
      date: dateStr,
      dayName,
      expectedInOffice,
      percentCapacity,
      employeesOut,
    });
  }

  return {
    totalActiveEmployees,
    daysToShow,
    timeOffCodes,
    forecast,
  };
}
