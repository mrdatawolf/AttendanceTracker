/**
 * Employee Seniority Calculation Utilities
 *
 * This module implements the seniority ordering rules from Phase 5:
 * - Earlier effective hire date = more senior
 * - Effective hire date = rehire_date if set, otherwise date_of_hire
 * - When dates match, higher seniority_rank = more senior (1-5, 5 = most senior)
 * - NULL seniority_rank is treated as least senior when dates match
 */

import type { Employee } from './queries-sqlite';

/**
 * Get the effective hire date for seniority calculations
 * Uses rehire_date if set, otherwise uses date_of_hire
 *
 * @param employee - The employee record
 * @returns The effective hire date string or null
 */
export function getEffectiveHireDate(employee: Pick<Employee, 'date_of_hire' | 'rehire_date'>): string | null {
  return employee.rehire_date || employee.date_of_hire || null;
}

/**
 * Compare two employees by seniority
 * Returns negative if a is more senior, positive if b is more senior, 0 if equal
 *
 * Seniority rules:
 * 1. Earlier effective hire date = more senior
 * 2. When dates match, higher seniority_rank = more senior
 * 3. NULL effective date is treated as least senior
 * 4. NULL seniority_rank is treated as least senior when dates match
 *
 * @param a - First employee
 * @param b - Second employee
 * @returns Comparison result (-1, 0, or 1)
 */
export function compareBySeniority(
  a: Pick<Employee, 'date_of_hire' | 'rehire_date' | 'seniority_rank'>,
  b: Pick<Employee, 'date_of_hire' | 'rehire_date' | 'seniority_rank'>
): number {
  const dateA = getEffectiveHireDate(a);
  const dateB = getEffectiveHireDate(b);

  // Handle null dates - employees with no hire date are least senior
  if (!dateA && !dateB) {
    // Both have no date, compare by seniority_rank
    return compareSeniorityRank(a.seniority_rank, b.seniority_rank);
  }
  if (!dateA) return 1;  // a has no date, b is more senior
  if (!dateB) return -1; // b has no date, a is more senior

  // Compare dates - earlier date = more senior (comes first)
  const dateComparison = dateA.localeCompare(dateB);
  if (dateComparison !== 0) {
    return dateComparison; // Earlier date (lower string value) comes first
  }

  // Dates match - use seniority_rank as tiebreaker
  return compareSeniorityRank(a.seniority_rank, b.seniority_rank);
}

/**
 * Compare seniority ranks
 * Higher rank = more senior (comes first in sorted order)
 * NULL is treated as least senior
 *
 * @param rankA - First rank (1-5 or null)
 * @param rankB - Second rank (1-5 or null)
 * @returns Comparison result
 */
function compareSeniorityRank(rankA: number | undefined | null, rankB: number | undefined | null): number {
  // Convert undefined to null for consistent handling
  const a = rankA ?? null;
  const b = rankB ?? null;

  // Both null = equal
  if (a === null && b === null) return 0;

  // NULL is least senior
  if (a === null) return 1;  // a has no rank, b is more senior
  if (b === null) return -1; // b has no rank, a is more senior

  // Higher rank = more senior (comes first, so reverse comparison)
  return b - a;
}

/**
 * Sort an array of employees by seniority (most senior first)
 *
 * @param employees - Array of employees to sort
 * @returns New sorted array (does not mutate original)
 */
export function sortBySeniority<T extends Pick<Employee, 'date_of_hire' | 'rehire_date' | 'seniority_rank'>>(
  employees: T[]
): T[] {
  return [...employees].sort(compareBySeniority);
}

/**
 * Get the seniority rank of an employee within a list
 * Returns 1 for most senior, higher numbers for less senior
 *
 * @param employee - The employee to find
 * @param allEmployees - All employees to compare against
 * @returns The seniority position (1-based)
 */
export function getSeniorityPosition<T extends Pick<Employee, 'id' | 'date_of_hire' | 'rehire_date' | 'seniority_rank'>>(
  employee: T,
  allEmployees: T[]
): number {
  const sorted = sortBySeniority(allEmployees);
  const index = sorted.findIndex(e => e.id === employee.id);
  return index + 1; // 1-based position
}

/**
 * Check if two employees have the same effective hire date
 * Used to determine when seniority_rank matters
 *
 * @param a - First employee
 * @param b - Second employee
 * @returns True if dates match (including both being null)
 */
export function hasSameEffectiveHireDate(
  a: Pick<Employee, 'date_of_hire' | 'rehire_date'>,
  b: Pick<Employee, 'date_of_hire' | 'rehire_date'>
): boolean {
  return getEffectiveHireDate(a) === getEffectiveHireDate(b);
}
