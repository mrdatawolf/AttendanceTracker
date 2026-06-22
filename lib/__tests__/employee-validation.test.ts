/**
 * Unit tests for Employee Data Validation
 *
 * These tests verify the validation rules from Phase 5:
 * - employment_type: must be 'full_time' or 'part_time'
 * - seniority_rank: must be 1-5 or null/undefined
 * - rehire_date: must be after date_of_hire if both are set
 * - Date formats: must be valid YYYY-MM-DD format
 */

import { describe, it, expect } from 'vitest';
import {
  isValidEmploymentType,
  isValidSeniorityRank,
  isValidDateFormat,
  isRehireDateValid,
  validateEmployeePhase5Fields,
  getEmploymentTypeLabel,
  normalizeEmploymentType,
  VALID_EMPLOYMENT_TYPES,
  MIN_SENIORITY_RANK,
  MAX_SENIORITY_RANK,
} from '../employee-validation';

describe('Employee Data Validation', () => {
  describe('isValidEmploymentType', () => {
    it('should accept "full_time"', () => {
      expect(isValidEmploymentType('full_time')).toBe(true);
    });

    it('should accept "part_time"', () => {
      expect(isValidEmploymentType('part_time')).toBe(true);
    });

    it('should accept null (defaults to full_time)', () => {
      expect(isValidEmploymentType(null)).toBe(true);
    });

    it('should accept undefined (defaults to full_time)', () => {
      expect(isValidEmploymentType(undefined)).toBe(true);
    });

    it('should reject invalid values', () => {
      expect(isValidEmploymentType('contractor')).toBe(false);
      expect(isValidEmploymentType('FULL_TIME')).toBe(false);
      expect(isValidEmploymentType('full-time')).toBe(false);
      expect(isValidEmploymentType('')).toBe(false);
    });

    it('should have exactly two valid types defined', () => {
      expect(VALID_EMPLOYMENT_TYPES).toEqual(['full_time', 'part_time']);
    });
  });

  describe('isValidSeniorityRank', () => {
    it('should accept null', () => {
      expect(isValidSeniorityRank(null)).toBe(true);
    });

    it('should accept undefined', () => {
      expect(isValidSeniorityRank(undefined)).toBe(true);
    });

    it('should accept valid ranks 1-5', () => {
      expect(isValidSeniorityRank(1)).toBe(true);
      expect(isValidSeniorityRank(2)).toBe(true);
      expect(isValidSeniorityRank(3)).toBe(true);
      expect(isValidSeniorityRank(4)).toBe(true);
      expect(isValidSeniorityRank(5)).toBe(true);
    });

    it('should reject ranks below 1', () => {
      expect(isValidSeniorityRank(0)).toBe(false);
      expect(isValidSeniorityRank(-1)).toBe(false);
    });

    it('should reject ranks above 5', () => {
      expect(isValidSeniorityRank(6)).toBe(false);
      expect(isValidSeniorityRank(10)).toBe(false);
    });

    it('should reject non-integer values', () => {
      expect(isValidSeniorityRank(1.5)).toBe(false);
      expect(isValidSeniorityRank(3.14)).toBe(false);
    });

    it('should have correct min/max constants', () => {
      expect(MIN_SENIORITY_RANK).toBe(1);
      expect(MAX_SENIORITY_RANK).toBe(5);
    });
  });

  describe('isValidDateFormat', () => {
    it('should accept valid YYYY-MM-DD dates', () => {
      expect(isValidDateFormat('2024-01-15')).toBe(true);
      expect(isValidDateFormat('2023-12-31')).toBe(true);
      expect(isValidDateFormat('2020-02-29')).toBe(true); // Leap year
    });

    it('should accept null and undefined', () => {
      expect(isValidDateFormat(null)).toBe(true);
      expect(isValidDateFormat(undefined)).toBe(true);
    });

    it('should accept empty string', () => {
      expect(isValidDateFormat('')).toBe(true);
    });

    it('should reject invalid formats', () => {
      expect(isValidDateFormat('01-15-2024')).toBe(false); // MM-DD-YYYY
      expect(isValidDateFormat('2024/01/15')).toBe(false); // Wrong separator
      expect(isValidDateFormat('2024-1-15')).toBe(false); // Single digit month
      expect(isValidDateFormat('24-01-15')).toBe(false); // Two digit year
    });

    it('should reject invalid dates', () => {
      expect(isValidDateFormat('2024-02-30')).toBe(false); // Feb 30 doesn't exist
      expect(isValidDateFormat('2023-02-29')).toBe(false); // Not a leap year
      expect(isValidDateFormat('2024-13-01')).toBe(false); // Invalid month
      expect(isValidDateFormat('2024-00-15')).toBe(false); // Zero month
      expect(isValidDateFormat('2024-01-32')).toBe(false); // Invalid day
    });
  });

  describe('isRehireDateValid', () => {
    it('should accept when rehire_date is after date_of_hire', () => {
      expect(isRehireDateValid('2020-01-15', '2024-03-01')).toBe(true);
    });

    it('should reject when rehire_date equals date_of_hire', () => {
      expect(isRehireDateValid('2020-01-15', '2020-01-15')).toBe(false);
    });

    it('should reject when rehire_date is before date_of_hire', () => {
      expect(isRehireDateValid('2020-01-15', '2019-01-01')).toBe(false);
    });

    it('should accept when either date is null', () => {
      expect(isRehireDateValid(null, '2024-03-01')).toBe(true);
      expect(isRehireDateValid('2020-01-15', null)).toBe(true);
      expect(isRehireDateValid(null, null)).toBe(true);
    });

    it('should accept when either date is undefined', () => {
      expect(isRehireDateValid(undefined, '2024-03-01')).toBe(true);
      expect(isRehireDateValid('2020-01-15', undefined)).toBe(true);
    });
  });

  describe('validateEmployeePhase5Fields', () => {
    it('should pass for valid complete data', () => {
      const result = validateEmployeePhase5Fields({
        date_of_hire: '2020-01-15',
        rehire_date: '2024-03-01',
        employment_type: 'full_time',
        seniority_rank: 3,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should pass for minimal data (all null/undefined)', () => {
      const result = validateEmployeePhase5Fields({});

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail for invalid employment_type', () => {
      const result = validateEmployeePhase5Fields({
        employment_type: 'contractor',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('employment_type');
    });

    it('should fail for invalid seniority_rank', () => {
      const result = validateEmployeePhase5Fields({
        seniority_rank: 10,
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('seniority_rank');
    });

    it('should fail for invalid date format', () => {
      const result = validateEmployeePhase5Fields({
        date_of_hire: '01-15-2020',
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('date_of_hire');
    });

    it('should fail when rehire_date is before date_of_hire', () => {
      const result = validateEmployeePhase5Fields({
        date_of_hire: '2020-01-15',
        rehire_date: '2019-01-01',
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.field === 'rehire_date')).toBe(true);
    });

    it('should return multiple errors for multiple issues', () => {
      const result = validateEmployeePhase5Fields({
        date_of_hire: 'invalid',
        rehire_date: 'also-invalid',
        employment_type: 'contractor',
        seniority_rank: 100,
      });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe('getEmploymentTypeLabel', () => {
    it('should return "Full-time" for full_time', () => {
      expect(getEmploymentTypeLabel('full_time')).toBe('Full-time');
    });

    it('should return "Part-time" for part_time', () => {
      expect(getEmploymentTypeLabel('part_time')).toBe('Part-time');
    });

    it('should return "Full-time" as default for null/undefined', () => {
      expect(getEmploymentTypeLabel(null)).toBe('Full-time');
      expect(getEmploymentTypeLabel(undefined)).toBe('Full-time');
    });

    it('should return "Full-time" for unknown values', () => {
      expect(getEmploymentTypeLabel('unknown')).toBe('Full-time');
    });
  });

  describe('normalizeEmploymentType', () => {
    it('should return "full_time" for full_time', () => {
      expect(normalizeEmploymentType('full_time')).toBe('full_time');
    });

    it('should return "part_time" for part_time', () => {
      expect(normalizeEmploymentType('part_time')).toBe('part_time');
    });

    it('should return "full_time" as default for null/undefined', () => {
      expect(normalizeEmploymentType(null)).toBe('full_time');
      expect(normalizeEmploymentType(undefined)).toBe('full_time');
    });

    it('should return "full_time" for invalid values', () => {
      expect(normalizeEmploymentType('contractor')).toBe('full_time');
    });
  });

  describe('Real-world scenarios from seed data', () => {
    it('should validate David Martinez (rehired employee)', () => {
      const result = validateEmployeePhase5Fields({
        date_of_hire: '2020-02-01',
        rehire_date: '2024-02-01',
        employment_type: 'full_time',
        seniority_rank: 3,
      });

      expect(result.valid).toBe(true);
    });

    it('should validate Lisa Garcia (part-time employee)', () => {
      const result = validateEmployeePhase5Fields({
        date_of_hire: '2024-03-15',
        rehire_date: null,
        employment_type: 'part_time',
        seniority_rank: null,
      });

      expect(result.valid).toBe(true);
    });

    it('should validate John Smith (standard employee)', () => {
      const result = validateEmployeePhase5Fields({
        date_of_hire: '2023-01-15',
        rehire_date: null,
        employment_type: 'full_time',
        seniority_rank: null,
      });

      expect(result.valid).toBe(true);
    });
  });

  describe('NFL brand scenarios', () => {
    it('should accept all seniority ranks for tiebreaker scenarios', () => {
      // Per spec: seniority_rank is 1-5 where 5 = most senior
      for (let rank = 1; rank <= 5; rank++) {
        const result = validateEmployeePhase5Fields({
          date_of_hire: '2023-01-15',
          seniority_rank: rank,
        });
        expect(result.valid).toBe(true);
      }
    });

    it('should validate employment_type for leave eligibility checks', () => {
      // Per spec: Part-time employees may have different eligibility
      const fullTime = validateEmployeePhase5Fields({
        employment_type: 'full_time',
      });
      const partTime = validateEmployeePhase5Fields({
        employment_type: 'part_time',
      });

      expect(fullTime.valid).toBe(true);
      expect(partTime.valid).toBe(true);
    });
  });

  describe('Default brand scenarios (features disabled)', () => {
    it('should still validate employee data even when features are disabled', () => {
      // Default brand doesn't have leave management, but data validation still applies
      const result = validateEmployeePhase5Fields({
        date_of_hire: '2023-06-15',
        employment_type: 'full_time',
      });

      expect(result.valid).toBe(true);
    });

    it('should allow nullable Phase 5 fields for backwards compatibility', () => {
      // Existing employees should work without new fields
      const result = validateEmployeePhase5Fields({
        date_of_hire: undefined,
        rehire_date: undefined,
        employment_type: undefined,
        seniority_rank: undefined,
      });

      expect(result.valid).toBe(true);
    });
  });
});
