import type { Employee } from './queries-sqlite';
import type { BrandTimeCode } from './brand-time-codes';

/**
 * Default mapping from Excel "Type of Absence" values to database time codes.
 * Keys are lowercased for case-insensitive lookup.
 */
export const DEFAULT_ABSENCE_MAPPINGS: Record<string, string> = {
  'vacation': 'VAC',
  'fmla': 'FMLA',
  'floating holiday': 'FLH',
  'personal': 'PER',
  'sick leave - self': 'PSL',
  'sick leave - family': 'PSL',
  'sick leave': 'PSL',
  "worker's comp": 'WC',
  'workers comp': 'WC',
};

/**
 * Build a mapping from Excel absence types to time codes, pre-filling known matches.
 */
export function buildAbsenceTypeMapping(
  uniqueAbsenceTypes: string[],
  timeCodes: BrandTimeCode[]
): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const absenceType of uniqueAbsenceTypes) {
    const key = absenceType.toLowerCase().trim();
    if (DEFAULT_ABSENCE_MAPPINGS[key]) {
      const code = DEFAULT_ABSENCE_MAPPINGS[key];
      if (timeCodes.some(tc => tc.code === code)) {
        mapping[absenceType] = code;
      }
    }
  }
  return mapping;
}

/**
 * Auto-match Excel employee names to database employees.
 * Returns a map of "Last, First" -> employee id (or null if no match).
 */
export function matchEmployees(
  excelNames: string[],
  employees: Employee[]
): Record<string, number | null> {
  const result: Record<string, number | null> = {};

  for (const name of excelNames) {
    const parts = name.split(',').map(s => s.trim());
    if (parts.length < 2) {
      result[name] = null;
      continue;
    }
    const [excelLast, excelFirst] = parts;

    const match = employees.find(emp =>
      emp.last_name.toLowerCase() === excelLast.toLowerCase() &&
      emp.first_name.toLowerCase() === excelFirst.toLowerCase()
    );

    result[name] = match ? match.id : null;
  }

  return result;
}

export interface ImportRow {
  excelName: string;
  lastName: string;
  firstName: string;
  dateOfAbsence: string; // YYYY-MM-DD
  dayOfWeek: string;
  typeOfAbsence: string;
  timeMissed: number;
  reasonGiven: string;
}

export interface ImportRecord {
  employee_id: number;
  entry_date: string;
  time_code: string;
  hours: number;
  notes: string;
  overwrite: boolean;
}
