/**
 * Employee Data Validation Utilities
 *
 * This module validates employee data according to Phase 5 rules:
 * - employment_type: must be 'full_time' or 'part_time'
 * - seniority_rank: must be 1-5 or null/undefined
 * - rehire_date: must be after date_of_hire if both are set
 * - Date formats: must be valid YYYY-MM-DD format
 */

import type { Employee } from './queries-sqlite';

// Valid employment types
export const VALID_EMPLOYMENT_TYPES = ['full_time', 'part_time'] as const;
export type EmploymentType = typeof VALID_EMPLOYMENT_TYPES[number];

// Seniority rank range
export const MIN_SENIORITY_RANK = 1;
export const MAX_SENIORITY_RANK = 5;

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Validate employment type
 * Must be 'full_time' or 'part_time'
 *
 * @param employmentType - The employment type to validate
 * @returns True if valid
 */
export function isValidEmploymentType(employmentType: string | undefined | null): boolean {
  if (employmentType === undefined || employmentType === null) {
    return true; // NULL/undefined is valid (defaults to 'full_time')
  }
  return VALID_EMPLOYMENT_TYPES.includes(employmentType as EmploymentType);
}

/**
 * Validate seniority rank
 * Must be 1-5 or null/undefined
 *
 * @param seniorityRank - The seniority rank to validate
 * @returns True if valid
 */
export function isValidSeniorityRank(seniorityRank: number | undefined | null): boolean {
  if (seniorityRank === undefined || seniorityRank === null) {
    return true; // NULL/undefined is valid
  }
  if (!Number.isInteger(seniorityRank)) {
    return false; // Must be an integer
  }
  return seniorityRank >= MIN_SENIORITY_RANK && seniorityRank <= MAX_SENIORITY_RANK;
}

/**
 * Validate date format (YYYY-MM-DD)
 *
 * @param dateStr - The date string to validate
 * @returns True if valid format and real date
 */
export function isValidDateFormat(dateStr: string | undefined | null): boolean {
  if (dateStr === undefined || dateStr === null || dateStr === '') {
    return true; // NULL/undefined/empty is valid
  }

  // Check format YYYY-MM-DD
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateStr)) {
    return false;
  }

  // Check if it's a real date
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    return false;
  }

  // Verify the parsed date matches the input (catches invalid dates like 2024-02-30)
  const [year, month, day] = dateStr.split('-').map(Number);
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day
  );
}

/**
 * Validate that rehire_date is after date_of_hire
 *
 * @param hireDate - Original hire date
 * @param rehireDate - Rehire date
 * @returns True if valid (rehire after hire or either is null)
 */
export function isRehireDateValid(
  hireDate: string | undefined | null,
  rehireDate: string | undefined | null
): boolean {
  // If either date is not set, the relationship is valid
  if (!hireDate || !rehireDate) {
    return true;
  }

  // Both dates are set - rehire must be after hire
  return rehireDate > hireDate;
}

/**
 * Validate all Phase 5 employee fields
 *
 * @param employee - Partial employee data to validate
 * @returns Validation result with errors if any
 */
export function validateEmployeePhase5Fields(
  employee: Partial<Pick<Employee, 'date_of_hire' | 'rehire_date' | 'employment_type' | 'seniority_rank'>>
): ValidationResult {
  const errors: ValidationError[] = [];

  // Validate employment_type
  if (!isValidEmploymentType(employee.employment_type)) {
    errors.push({
      field: 'employment_type',
      message: `Must be one of: ${VALID_EMPLOYMENT_TYPES.join(', ')}`,
    });
  }

  // Validate seniority_rank
  if (!isValidSeniorityRank(employee.seniority_rank)) {
    errors.push({
      field: 'seniority_rank',
      message: `Must be an integer between ${MIN_SENIORITY_RANK} and ${MAX_SENIORITY_RANK}`,
    });
  }

  // Validate date_of_hire format
  if (!isValidDateFormat(employee.date_of_hire)) {
    errors.push({
      field: 'date_of_hire',
      message: 'Must be a valid date in YYYY-MM-DD format',
    });
  }

  // Validate rehire_date format
  if (!isValidDateFormat(employee.rehire_date)) {
    errors.push({
      field: 'rehire_date',
      message: 'Must be a valid date in YYYY-MM-DD format',
    });
  }

  // Validate rehire_date is after date_of_hire
  if (
    isValidDateFormat(employee.date_of_hire) &&
    isValidDateFormat(employee.rehire_date) &&
    !isRehireDateValid(employee.date_of_hire, employee.rehire_date)
  ) {
    errors.push({
      field: 'rehire_date',
      message: 'Rehire date must be after the original hire date',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get the display label for an employment type
 *
 * @param employmentType - The employment type code
 * @returns Display label
 */
export function getEmploymentTypeLabel(employmentType: string | undefined | null): string {
  switch (employmentType) {
    case 'full_time':
      return 'Full-time';
    case 'part_time':
      return 'Part-time';
    default:
      return 'Full-time'; // Default
  }
}

/**
 * Normalize employment type to valid value
 * Returns 'full_time' as default if invalid or not set
 *
 * @param employmentType - The employment type to normalize
 * @returns Valid employment type
 */
export function normalizeEmploymentType(employmentType: string | undefined | null): EmploymentType {
  if (employmentType === 'part_time') {
    return 'part_time';
  }
  return 'full_time';
}
