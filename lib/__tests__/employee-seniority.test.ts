/**
 * Unit tests for Employee Seniority Calculation
 *
 * These tests verify the seniority calculation rules from Phase 5:
 * - Earlier effective hire date = more senior
 * - Effective hire date = rehire_date if set, otherwise date_of_hire
 * - When dates match, higher seniority_rank = more senior (1-5, 5 = most senior)
 * - NULL seniority_rank is treated as least senior when dates match
 */

import { describe, it, expect } from 'vitest';
import {
  getEffectiveHireDate,
  compareBySeniority,
  sortBySeniority,
  getSeniorityPosition,
  hasSameEffectiveHireDate,
} from '../employee-seniority';

describe('Employee Seniority Calculation', () => {
  describe('getEffectiveHireDate', () => {
    it('should return date_of_hire when rehire_date is not set', () => {
      const employee = { date_of_hire: '2020-01-15', rehire_date: undefined };
      expect(getEffectiveHireDate(employee)).toBe('2020-01-15');
    });

    it('should return rehire_date when set (overrides date_of_hire)', () => {
      const employee = { date_of_hire: '2020-01-15', rehire_date: '2024-03-01' };
      expect(getEffectiveHireDate(employee)).toBe('2024-03-01');
    });

    it('should return null when neither date is set', () => {
      const employee = { date_of_hire: undefined, rehire_date: undefined };
      expect(getEffectiveHireDate(employee)).toBeNull();
    });

    it('should return rehire_date even when date_of_hire is null', () => {
      const employee = { date_of_hire: null, rehire_date: '2024-03-01' };
      expect(getEffectiveHireDate(employee)).toBe('2024-03-01');
    });
  });

  describe('compareBySeniority', () => {
    describe('comparing by hire date only', () => {
      it('should rank employee with earlier hire date as more senior', () => {
        const senior = { date_of_hire: '2020-01-15', seniority_rank: null };
        const junior = { date_of_hire: '2023-06-10', seniority_rank: null };

        expect(compareBySeniority(senior, junior)).toBeLessThan(0);
        expect(compareBySeniority(junior, senior)).toBeGreaterThan(0);
      });

      it('should use rehire_date for seniority when set', () => {
        // Original hire was 2020, but rehired in 2024
        const rehired = { date_of_hire: '2020-01-15', rehire_date: '2024-03-01', seniority_rank: null };
        // Hired in 2022, no rehire
        const continuous = { date_of_hire: '2022-05-01', seniority_rank: null };

        // Continuous employee is more senior because rehired employee's effective date is 2024
        expect(compareBySeniority(continuous, rehired)).toBeLessThan(0);
        expect(compareBySeniority(rehired, continuous)).toBeGreaterThan(0);
      });

      it('should treat employee with no hire date as least senior', () => {
        const dated = { date_of_hire: '2020-01-15', seniority_rank: null };
        const undated = { date_of_hire: undefined, seniority_rank: null };

        expect(compareBySeniority(dated, undated)).toBeLessThan(0);
        expect(compareBySeniority(undated, dated)).toBeGreaterThan(0);
      });
    });

    describe('comparing by seniority_rank when dates match', () => {
      it('should rank employee with higher seniority_rank as more senior when dates match', () => {
        const senior = { date_of_hire: '2020-01-15', seniority_rank: 5 };
        const junior = { date_of_hire: '2020-01-15', seniority_rank: 2 };

        expect(compareBySeniority(senior, junior)).toBeLessThan(0);
        expect(compareBySeniority(junior, senior)).toBeGreaterThan(0);
      });

      it('should treat null seniority_rank as least senior when dates match', () => {
        const ranked = { date_of_hire: '2020-01-15', seniority_rank: 1 };
        const unranked = { date_of_hire: '2020-01-15', seniority_rank: null };

        expect(compareBySeniority(ranked, unranked)).toBeLessThan(0);
        expect(compareBySeniority(unranked, ranked)).toBeGreaterThan(0);
      });

      it('should treat equal ranks as equal', () => {
        const a = { date_of_hire: '2020-01-15', seniority_rank: 3 };
        const b = { date_of_hire: '2020-01-15', seniority_rank: 3 };

        expect(compareBySeniority(a, b)).toBe(0);
      });

      it('should treat two null ranks as equal', () => {
        const a = { date_of_hire: '2020-01-15', seniority_rank: null };
        const b = { date_of_hire: '2020-01-15', seniority_rank: null };

        expect(compareBySeniority(a, b)).toBe(0);
      });
    });

    describe('edge cases', () => {
      it('should handle both employees having no dates', () => {
        const a = { date_of_hire: undefined, seniority_rank: 5 };
        const b = { date_of_hire: undefined, seniority_rank: 2 };

        // Fall back to seniority_rank comparison
        expect(compareBySeniority(a, b)).toBeLessThan(0);
      });

      it('should handle undefined seniority_rank same as null', () => {
        const ranked = { date_of_hire: '2020-01-15', seniority_rank: 3 };
        const undefinedRank = { date_of_hire: '2020-01-15', seniority_rank: undefined };

        expect(compareBySeniority(ranked, undefinedRank)).toBeLessThan(0);
      });
    });
  });

  describe('sortBySeniority', () => {
    it('should sort employees by seniority (most senior first)', () => {
      const employees = [
        { id: 1, date_of_hire: '2023-06-10', seniority_rank: null },
        { id: 2, date_of_hire: '2020-01-15', seniority_rank: null },
        { id: 3, date_of_hire: '2022-03-20', seniority_rank: null },
      ];

      const sorted = sortBySeniority(employees);

      expect(sorted[0].id).toBe(2); // 2020 - most senior
      expect(sorted[1].id).toBe(3); // 2022
      expect(sorted[2].id).toBe(1); // 2023 - least senior
    });

    it('should not mutate the original array', () => {
      const employees = [
        { id: 1, date_of_hire: '2023-06-10', seniority_rank: null },
        { id: 2, date_of_hire: '2020-01-15', seniority_rank: null },
      ];

      const sorted = sortBySeniority(employees);

      expect(employees[0].id).toBe(1); // Original unchanged
      expect(sorted[0].id).toBe(2); // Sorted is different
    });

    it('should handle mixed dates and ranks correctly', () => {
      const employees = [
        { id: 1, date_of_hire: '2020-01-15', seniority_rank: 2 }, // Same date, rank 2
        { id: 2, date_of_hire: '2020-01-15', seniority_rank: 5 }, // Same date, rank 5 (more senior)
        { id: 3, date_of_hire: '2019-01-01', seniority_rank: 1 }, // Earlier date (most senior)
        { id: 4, date_of_hire: '2020-01-15', seniority_rank: null }, // Same date, no rank (least)
      ];

      const sorted = sortBySeniority(employees);

      expect(sorted[0].id).toBe(3); // 2019 - most senior by date
      expect(sorted[1].id).toBe(2); // 2020, rank 5
      expect(sorted[2].id).toBe(1); // 2020, rank 2
      expect(sorted[3].id).toBe(4); // 2020, no rank
    });

    it('should handle employees with rehire dates correctly', () => {
      const employees = [
        { id: 1, date_of_hire: '2018-01-01', rehire_date: '2024-01-01', seniority_rank: null }, // Rehired
        { id: 2, date_of_hire: '2022-06-15', seniority_rank: null }, // Continuous since 2022
        { id: 3, date_of_hire: '2020-03-01', seniority_rank: null }, // Continuous since 2020
      ];

      const sorted = sortBySeniority(employees);

      expect(sorted[0].id).toBe(3); // 2020 - most senior (continuous)
      expect(sorted[1].id).toBe(2); // 2022
      expect(sorted[2].id).toBe(1); // 2024 effective date (rehired)
    });
  });

  describe('getSeniorityPosition', () => {
    it('should return 1-based position in seniority order', () => {
      const employees = [
        { id: 1, date_of_hire: '2023-06-10', seniority_rank: null },
        { id: 2, date_of_hire: '2020-01-15', seniority_rank: null },
        { id: 3, date_of_hire: '2022-03-20', seniority_rank: null },
      ];

      expect(getSeniorityPosition(employees[0], employees)).toBe(3); // Least senior
      expect(getSeniorityPosition(employees[1], employees)).toBe(1); // Most senior
      expect(getSeniorityPosition(employees[2], employees)).toBe(2); // Middle
    });
  });

  describe('hasSameEffectiveHireDate', () => {
    it('should return true when dates match', () => {
      const a = { date_of_hire: '2020-01-15' };
      const b = { date_of_hire: '2020-01-15' };

      expect(hasSameEffectiveHireDate(a, b)).toBe(true);
    });

    it('should return false when dates differ', () => {
      const a = { date_of_hire: '2020-01-15' };
      const b = { date_of_hire: '2020-01-16' };

      expect(hasSameEffectiveHireDate(a, b)).toBe(false);
    });

    it('should use rehire_date when set', () => {
      const a = { date_of_hire: '2020-01-15', rehire_date: '2024-03-01' };
      const b = { date_of_hire: '2024-03-01' };

      expect(hasSameEffectiveHireDate(a, b)).toBe(true);
    });

    it('should return true when both have no dates', () => {
      const a = { date_of_hire: undefined };
      const b = { date_of_hire: undefined };

      expect(hasSameEffectiveHireDate(a, b)).toBe(true);
    });
  });

  describe('Real-world scenarios from spec', () => {
    it('should correctly order employees per SQL example from spec', () => {
      // From spec: ORDER BY COALESCE(rehire_date, hire_date) ASC, seniority_rank DESC NULLS LAST
      const employees = [
        { id: 1, date_of_hire: '2021-11-05', seniority_rank: null }, // Emily
        { id: 2, date_of_hire: '2022-03-20', seniority_rank: null }, // Sarah
        { id: 3, date_of_hire: '2023-01-15', seniority_rank: null }, // John
        { id: 4, date_of_hire: '2023-06-10', seniority_rank: null }, // Michael
        { id: 5, date_of_hire: '2020-02-01', rehire_date: '2024-02-01', seniority_rank: 3 }, // David (rehired)
        { id: 6, date_of_hire: '2024-03-15', seniority_rank: null }, // Lisa
      ];

      const sorted = sortBySeniority(employees);

      // Expected order by effective hire date:
      // 1. Emily (2021-11-05)
      // 2. Sarah (2022-03-20)
      // 3. John (2023-01-15)
      // 4. Michael (2023-06-10)
      // 5. David (2024-02-01 rehire)
      // 6. Lisa (2024-03-15)

      expect(sorted[0].id).toBe(1); // Emily - most senior
      expect(sorted[1].id).toBe(2); // Sarah
      expect(sorted[2].id).toBe(3); // John
      expect(sorted[3].id).toBe(4); // Michael
      expect(sorted[4].id).toBe(5); // David (rehired employee uses rehire date)
      expect(sorted[5].id).toBe(6); // Lisa - least senior
    });

    it('should handle seniority_rank tiebreaker for same-day hires', () => {
      // Scenario: Two employees hired on the same day
      const employees = [
        { id: 1, date_of_hire: '2023-01-15', seniority_rank: null },
        { id: 2, date_of_hire: '2023-01-15', seniority_rank: 5 }, // Designated as more senior
        { id: 3, date_of_hire: '2023-01-15', seniority_rank: 3 },
      ];

      const sorted = sortBySeniority(employees);

      expect(sorted[0].id).toBe(2); // Rank 5 - most senior
      expect(sorted[1].id).toBe(3); // Rank 3
      expect(sorted[2].id).toBe(1); // No rank - least senior
    });
  });
});
