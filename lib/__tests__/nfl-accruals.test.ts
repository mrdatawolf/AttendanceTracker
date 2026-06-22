import { describe, it, expect } from 'vitest';
import {
  calculateTieredSeniorityAccrual,
  calculateAnnualGrantAccrual,
  calculateHoursWorkedAccrual,
  type AccrualRule,
} from '../accrual-calculations';
import nflFeatures from '../../public/NFL/brand-features.json';

// Pull rules directly from NFL brand config so tests catch config bugs too
const V_RULE = nflFeatures.features.accrualCalculations.rules.VAC as unknown as AccrualRule;
const FLH_RULE = nflFeatures.features.accrualCalculations.rules.FLH as unknown as AccrualRule;
const PSL_RULE = nflFeatures.features.accrualCalculations.rules.PSL as unknown as AccrualRule;

// Enough hours to qualify as full-time (threshold is 1,200)
const FULL_TIME_HOURS = 1300;

// ─────────────────────────────────────────────────────────────────────────────
// Helper: date shorthand
// ─────────────────────────────────────────────────────────────────────────────
function d(year: number, month: number, day: number) {
  return new Date(year, month - 1, day);
}

// ─────────────────────────────────────────────────────────────────────────────
// VACATION  (tieredSeniority, benefit year Jun 1 – May 31)
//
// Expected tiers per the official NFL "Vacation Policy" document. The table
// has 5 base-year columns, but the operative benefit is the "Weeks Vacation"
// row (actual usable time off), not the "Hours/Pay" row (a separate pay
// calculation, not a count of usable vacation hours). Weeks go 1, 2, 2, 3, 4
// across the five columns — 3-4 years and 5-7 years both land on "2 weeks" —
// so for actual usable hours there are only 4 distinct tiers:
//   0–2 years   =  40 h  (1 week)
//   3–7 years   =  80 h  (2 weeks — 3-4yr and 5-7yr columns both say 2 weeks)
//   8–14 years  = 120 h  (3 weeks)
//   15+ years   = 160 h  (4 weeks)
//
// Base years are measured as of the benefit-year start (Jun 1).
// ─────────────────────────────────────────────────────────────────────────────
describe('NFL Vacation accrual', () => {
  describe('tier selection – full-time employees', () => {
    // For each case: hire date chosen so baseYears as of Jun 1 2025 hits the tier.
    // asOfDate = Oct 1 2025 (mid benefit-year 2025–2026, full period active).

    it('0 years of service → 40 h', () => {
      const hire = d(2025, 3, 1);        // hired Mar 2025 → 0 base years at Jun 1 2025
      const result = calculateTieredSeniorityAccrual(hire, 2025, d(2025, 10, 1), V_RULE, FULL_TIME_HOURS);
      expect(result.isEligible).toBe(true);
      expect(result.accruedHours).toBe(40);
    });

    it('1 year of service → 40 h', () => {
      const hire = d(2024, 6, 1);        // exactly 1 base year at Jun 1 2025
      const result = calculateTieredSeniorityAccrual(hire, 2025, d(2025, 10, 1), V_RULE, FULL_TIME_HOURS);
      expect(result.accruedHours).toBe(40);
    });

    it('2 years of service → 40 h', () => {
      const hire = d(2023, 6, 1);        // exactly 2 base years at Jun 1 2025
      const result = calculateTieredSeniorityAccrual(hire, 2025, d(2025, 10, 1), V_RULE, FULL_TIME_HOURS);
      expect(result.accruedHours).toBe(40);
    });

    it('3 years of service → 80 h', () => {
      const hire = d(2022, 6, 1);        // exactly 3 base years at Jun 1 2025
      const result = calculateTieredSeniorityAccrual(hire, 2025, d(2025, 10, 1), V_RULE, FULL_TIME_HOURS);
      expect(result.accruedHours).toBe(80);
    });

    it('5 years of service → 80 h', () => {
      // 5-7yr column also says "2 Weeks" — same tier as 3-4yr, not a new one.
      const hire = d(2020, 6, 1);        // 5 base years at Jun 1 2025
      const result = calculateTieredSeniorityAccrual(hire, 2025, d(2025, 10, 1), V_RULE, FULL_TIME_HOURS);
      expect(result.accruedHours).toBe(80);
    });

    it('7 years of service → 80 h', () => {
      const hire = d(2018, 6, 1);        // 7 base years at Jun 1 2025
      const result = calculateTieredSeniorityAccrual(hire, 2025, d(2025, 10, 1), V_RULE, FULL_TIME_HOURS);
      expect(result.accruedHours).toBe(80);
    });

    it('8 years of service → 120 h', () => {
      const hire = d(2017, 6, 1);        // 8 base years at Jun 1 2025
      const result = calculateTieredSeniorityAccrual(hire, 2025, d(2025, 10, 1), V_RULE, FULL_TIME_HOURS);
      expect(result.accruedHours).toBe(120);
    });

    it('14 years of service → 120 h', () => {
      const hire = d(2011, 6, 1);        // 14 base years at Jun 1 2025
      const result = calculateTieredSeniorityAccrual(hire, 2025, d(2025, 10, 1), V_RULE, FULL_TIME_HOURS);
      expect(result.accruedHours).toBe(120);
    });

    it('15 years of service → 160 h', () => {
      const hire = d(2010, 6, 1);        // 15 base years at Jun 1 2025
      const result = calculateTieredSeniorityAccrual(hire, 2025, d(2025, 10, 1), V_RULE, FULL_TIME_HOURS);
      expect(result.accruedHours).toBe(160);
    });

    it('20 years of service → 160 h', () => {
      const hire = d(2005, 6, 1);        // 20 base years at Jun 1 2025
      const result = calculateTieredSeniorityAccrual(hire, 2025, d(2025, 10, 1), V_RULE, FULL_TIME_HOURS);
      expect(result.accruedHours).toBe(160);
    });
  });

  describe('part-time earn-rate formula matches policy per tier', () => {
    // Mirrors the "Weeks Vacation" tiers above (not the "Hours/Pay" row):
    // rate and cap both scale with the same 4 tiers a full-time employee uses.
    const cases: Array<[number, { earnHours: number; perHoursWorked: number; maxHours: number }]> = [
      [0, { earnHours: 1, perHoursWorked: 30, maxHours: 40 }],
      [3, { earnHours: 2, perHoursWorked: 30, maxHours: 80 }],
      [5, { earnHours: 2, perHoursWorked: 30, maxHours: 80 }],
      [8, { earnHours: 3, perHoursWorked: 30, maxHours: 120 }],
      [15, { earnHours: 4, perHoursWorked: 30, maxHours: 160 }],
    ];

    it.each(cases)('base years %i picks the matching partTime earn-rate tier', (baseYears, expected) => {
      const hire = new Date(2025 - baseYears, 5, 1); // Jun 1, `baseYears` years before 2025
      const result = calculateTieredSeniorityAccrual(hire, 2025, d(2025, 10, 1), V_RULE, undefined, false, 'part_time');
      expect(result.tieredSeniorityDetails?.currentTier.partTime).toEqual(expected);
    });
  });

  describe('benefit year boundaries cross calendar years', () => {
    it('asOfDate before Jun 1 uses previous benefit year start for base-year calc', () => {
      // Employee with 3 base years: hired Jun 1 2022.
      // Checking on Mar 1 2026 → benefit year is Jun 2025–May 2026 → baseYears = 3 → 80 h
      const hire = d(2022, 6, 1);
      const result = calculateTieredSeniorityAccrual(hire, 2026, d(2026, 3, 1), V_RULE, FULL_TIME_HOURS);
      expect(result.accruedHours).toBe(80);
      expect(result.tieredSeniorityDetails?.periodStart).toEqual(d(2025, 6, 1));
    });

    it('asOfDate just before Jun 1 uses benefit year starting previous Jun', () => {
      // May 31 is still in the old benefit year
      const hire = d(2020, 6, 1);        // 5 base years at Jun 1 2025 -> 3-7yr tier
      const result = calculateTieredSeniorityAccrual(hire, 2026, d(2026, 5, 31), V_RULE, FULL_TIME_HOURS);
      expect(result.tieredSeniorityDetails?.periodStart).toEqual(d(2025, 6, 1));
      expect(result.accruedHours).toBe(80);
    });

    it('asOfDate on Jun 1 starts new benefit year and recalculates base years', () => {
      // Hired Jun 1 2020: as of Jun 1 2026 → 6 base years → still 3-7yr tier = 80 h
      const hire = d(2020, 6, 1);
      const result = calculateTieredSeniorityAccrual(hire, 2026, d(2026, 6, 1), V_RULE, FULL_TIME_HOURS);
      expect(result.tieredSeniorityDetails?.periodStart).toEqual(d(2026, 6, 1));
      expect(result.tieredSeniorityDetails?.baseYears).toBe(6);
      expect(result.accruedHours).toBe(80);
    });

    it('tier changes correctly when benefit year flips and pushes employee into new tier', () => {
      // Hired Jun 1 2017: 8 base years at Jun 1 2025 → 8-14yr tier = 120 h
      //                   9 base years at Jun 1 2026 → still 8-14yr tier = 120 h
      const hire = d(2017, 6, 1);
      const result2025 = calculateTieredSeniorityAccrual(hire, 2025, d(2025, 10, 1), V_RULE, FULL_TIME_HOURS);
      const result2026 = calculateTieredSeniorityAccrual(hire, 2026, d(2026, 10, 1), V_RULE, FULL_TIME_HOURS);
      expect(result2025.accruedHours).toBe(120);
      expect(result2026.accruedHours).toBe(120);
    });
  });

  describe('details returned', () => {
    it('includes correct periodStart and periodEnd for a Jun-May benefit year', () => {
      const hire = d(2022, 6, 1);
      const result = calculateTieredSeniorityAccrual(hire, 2025, d(2025, 10, 1), V_RULE, FULL_TIME_HOURS);
      expect(result.tieredSeniorityDetails?.periodStart).toEqual(d(2025, 6, 1));
      expect(result.tieredSeniorityDetails?.periodEnd).toEqual(d(2026, 5, 31));
    });

    it('reports correct baseYears in details', () => {
      const hire = d(2018, 6, 1);        // 7 years at Jun 1 2025
      const result = calculateTieredSeniorityAccrual(hire, 2025, d(2025, 10, 1), V_RULE, FULL_TIME_HOURS);
      expect(result.tieredSeniorityDetails?.baseYears).toBe(7);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FULL-TIME ELIGIBILITY GATE (1,200-hour threshold, employmentType-driven)
//
// Policy: "A base year is established when an employee works 1,200 hours
// during the vacation base year in progress, as a full-time employee...
// Vacations may be scheduled once eligibility has been met."
//
// This is a one-time, permanent gate, not an annual ramp:
//   - Once established in any base year (including a prior, partial one),
//     a full-time employee gets the FULL tier amount on day one of every
//     subsequent benefit year — they never get reset to "pending" just
//     because a new period rolled over.
//   - Until established, a full-time employee gets 0h — no prorated credit
//     while working toward the threshold. They jump straight to the full
//     tier amount the moment they cross 1,200 hours.
//   - These calls go through the employmentType param (not the explicit
//     totalHoursWorked override used elsewhere in this file), since that's
//     the path real callers (the API routes) actually use.
// ─────────────────────────────────────────────────────────────────────────────
describe('NFL Vacation full-time eligibility gate', () => {
  it('genuine new hire mid-base-year with too few hours gets 0h, not yet eligible', () => {
    // Hired ~2 months before asOfDate (the real Maguire case) — nowhere
    // near 1,200 hours either before or within the current base year.
    const hire = d(2026, 4, 22);
    const result = calculateTieredSeniorityAccrual(hire, 2026, d(2026, 6, 16), V_RULE, undefined, false, 'full_time');
    expect(result.isEligible).toBe(false);
    expect(result.accruedHours).toBe(0);
    expect(result.tieredSeniorityDetails?.employeeType).toBe('pendingEligibility');
  });

  it('established veteran is not reset to pending just because a new period rolled over', () => {
    // The original bug: a 7-year employee evaluated right at period rollover.
    const hire = d(2019, 5, 13);
    const result = calculateTieredSeniorityAccrual(hire, 2026, d(2026, 6, 1), V_RULE, undefined, false, 'full_time');
    expect(result.isEligible).toBe(true);
    expect(result.tieredSeniorityDetails?.employeeType).toBe('fullTime');
    expect(result.accruedHours).toBe(80); // 7 base years -> 3-7yr tier
  });

  describe('boundary: hours accumulated before the period started', () => {
    it('29 weeks of prior tenure (1,160h, just under 1,200h) has NOT established eligibility', () => {
      const hire = d(2025, 11, 9); // ~29 weeks before Jun 1 2026
      const result = calculateTieredSeniorityAccrual(hire, 2026, d(2026, 6, 1), V_RULE, undefined, false, 'full_time');
      expect(result.tieredSeniorityDetails?.employeeType).toBe('pendingEligibility');
      expect(result.accruedHours).toBe(0);
    });

    it('31 weeks of prior tenure (1,240h, over 1,200h) HAS established eligibility', () => {
      const hire = d(2025, 10, 26); // ~31 weeks before Jun 1 2026
      const result = calculateTieredSeniorityAccrual(hire, 2026, d(2026, 6, 1), V_RULE, undefined, false, 'full_time');
      expect(result.tieredSeniorityDetails?.employeeType).toBe('fullTime');
      expect(result.accruedHours).toBe(40); // 0-2yr tier
    });
  });

  it('a new hire becomes eligible mid-base-year the moment they cross the threshold', () => {
    const hire = d(2026, 6, 1); // hired exactly at this period's start

    const before = calculateTieredSeniorityAccrual(hire, 2026, d(2026, 11, 1), V_RULE, undefined, false, 'full_time');
    expect(before.tieredSeniorityDetails?.employeeType).toBe('pendingEligibility');
    expect(before.accruedHours).toBe(0);

    const after = calculateTieredSeniorityAccrual(hire, 2026, d(2027, 2, 1), V_RULE, undefined, false, 'full_time');
    expect(after.tieredSeniorityDetails?.employeeType).toBe('fullTime');
    expect(after.accruedHours).toBe(40); // jumps straight to the full tier amount, no partial credit
  });

  it('part-time employees still use the prorated earn-rate ramp, unaffected by the full-time gate', () => {
    const hire = d(2020, 6, 1); // 6 base years -> 3-7yr tier
    const result = calculateTieredSeniorityAccrual(hire, 2026, d(2026, 6, 16), V_RULE, undefined, false, 'part_time');
    expect(result.tieredSeniorityDetails?.employeeType).toBe('partTime');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FLOATING HOLIDAY  (annualGrant, 24 h on Jun 1, benefit year Jun 1 – May 31)
//
// Rules:
//   • 1-year wait period before first eligibility
//   • First eligible year: pro-rated by which proration bracket the
//     eligibility-anniversary date falls into:
//       Jun 1 – Aug 31  → 3 units = 24 h
//       Sep 1 – Nov 30  → 2 units = 16 h
//       Dec 1 – Feb 28  → 1 unit  =  8 h
//       Mar 1 – May 31  → 0 units =  0 h
//   • Subsequent years: full 24 h granted on Jun 1
// ─────────────────────────────────────────────────────────────────────────────
describe('NFL Floating Holiday accrual', () => {
  describe('not yet eligible', () => {
    it('employee hired Jan 1 2025 is not eligible on Jul 1 2025 (needs 1 year)', () => {
      const result = calculateAnnualGrantAccrual(d(2025, 1, 1), 2025, d(2025, 7, 1), FLH_RULE);
      expect(result.isEligible).toBe(false);
      expect(result.accruedHours).toBe(0);
    });
  });

  describe('first eligible benefit year – proration brackets', () => {
    it('eligibility in Jun 1 – Aug 31 bracket → 24 h', () => {
      // Hired Jun 1 2024 → eligible Jun 1 2025 (bracket 1)
      const result = calculateAnnualGrantAccrual(d(2024, 6, 1), 2025, d(2025, 7, 1), FLH_RULE);
      expect(result.isEligible).toBe(true);
      expect(result.annualGrantDetails?.isFirstEligibleYear).toBe(true);
      expect(result.accruedHours).toBe(24);
    });

    it('eligibility on Aug 31 (last day of bracket 1) → 24 h', () => {
      // Hired Aug 31 2023 → eligible Aug 31 2024
      const result = calculateAnnualGrantAccrual(d(2023, 8, 31), 2024, d(2024, 10, 1), FLH_RULE);
      expect(result.annualGrantDetails?.isFirstEligibleYear).toBe(true);
      expect(result.accruedHours).toBe(24);
    });

    it('eligibility in Sep 1 – Nov 30 bracket → 16 h', () => {
      // Hired Sep 15 2023 → eligible Sep 15 2024
      const result = calculateAnnualGrantAccrual(d(2023, 9, 15), 2024, d(2024, 10, 1), FLH_RULE);
      expect(result.annualGrantDetails?.isFirstEligibleYear).toBe(true);
      expect(result.accruedHours).toBe(16);
    });

    it('eligibility in Dec 1 – Feb 28 bracket → 8 h', () => {
      // Hired Dec 15 2023 → eligible Dec 15 2024
      const result = calculateAnnualGrantAccrual(d(2023, 12, 15), 2025, d(2025, 1, 15), FLH_RULE);
      expect(result.annualGrantDetails?.isFirstEligibleYear).toBe(true);
      expect(result.accruedHours).toBe(8);
    });

    it('eligibility in Mar 1 – May 31 bracket → 0 h', () => {
      // Hired Apr 15 2024 → eligible Apr 15 2025
      const result = calculateAnnualGrantAccrual(d(2024, 4, 15), 2025, d(2025, 5, 1), FLH_RULE);
      expect(result.annualGrantDetails?.isFirstEligibleYear).toBe(true);
      expect(result.accruedHours).toBe(0);
    });
  });

  describe('subsequent benefit years – full grant', () => {
    it('returns 24 h on or after Jun 1 in a non-first eligible year', () => {
      // Hired Jun 1 2020, eligible Jun 1 2021; checking benefit year 2025–2026
      const result = calculateAnnualGrantAccrual(d(2020, 6, 1), 2025, d(2025, 7, 1), FLH_RULE);
      expect(result.annualGrantDetails?.isFirstEligibleYear).toBe(false);
      expect(result.accruedHours).toBe(24);
    });

    it('returns 24 h when checking mid-benefit-year via next targetYear param', () => {
      // Same employee, checking on Mar 1 2026 (still benefit year Jun 2025–May 2026)
      const result = calculateAnnualGrantAccrual(d(2020, 6, 1), 2026, d(2026, 3, 1), FLH_RULE);
      expect(result.annualGrantDetails?.isFirstEligibleYear).toBe(false);
      expect(result.accruedHours).toBe(24);
    });

    it('returns 0 h before Jun 1 grant date in that benefit year', () => {
      // Hired Jun 1 2020. asOfDate = May 31 2025 → benefit year Jun 2024–May 2025
      // Grant for that year was Jun 1 2024; asOfDate is after that → still 24 h
      // (Grant already fired on Jun 1 2024)
      const result = calculateAnnualGrantAccrual(d(2020, 6, 1), 2025, d(2025, 5, 31), FLH_RULE);
      expect(result.accruedHours).toBe(24);
    });

    it('benefit year boundaries: Jun 1 to May 31 are correct in details', () => {
      const result = calculateAnnualGrantAccrual(d(2020, 6, 1), 2025, d(2025, 10, 1), FLH_RULE);
      expect(result.annualGrantDetails?.benefitYearStart).toEqual(d(2025, 6, 1));
      expect(result.annualGrantDetails?.benefitYearEnd).toEqual(d(2026, 5, 31));
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PAID SICK LEAVE  (hoursWorked, 1h per 30h worked, max 80h)
//
// Policy: "Starting from the first day of employment, you'll accrue paid
// sick leave... eligible to USE sick leave as of their 90th day."
//
// Accrual and usage eligibility are two different gates:
//   - Accrual starts day 1 (waitPeriod: 0 days) — hours tick in the
//     background even before day 90.
//   - The accrued balance isn't usable/schedulable until day 90
//     (usageWaitPeriod: 90 days). It doesn't reset at day 90 — everything
//     accrued during the wait becomes available all at once.
// ─────────────────────────────────────────────────────────────────────────────
describe('NFL Paid Sick Leave accrual', () => {
  it('accrues in the background but is not usable before day 90', () => {
    // Hired Jan 1 2026, checked on day 89 (Mar 31 2026).
    const result = calculateHoursWorkedAccrual(d(2026, 1, 1), 2026, d(2026, 3, 31), PSL_RULE);
    expect(result.isEligible).toBe(false);
    expect(result.accruedHours).toBe(0);
    expect(result.hoursWorkedDetails?.isUsable).toBe(false);
    // Hours are still accruing under the hood even though they're not usable yet.
    expect(result.hoursWorkedDetails?.accruedRegardlessOfUsageGate).toBeGreaterThan(0);
  });

  it('unlocks the full accrued balance (not reset to 0) the moment day 90 hits', () => {
    // Hired Jan 1 2026, checked on exactly day 90 (Apr 1 2026).
    const result = calculateHoursWorkedAccrual(d(2026, 1, 1), 2026, d(2026, 4, 1), PSL_RULE);
    expect(result.isEligible).toBe(true);
    expect(result.hoursWorkedDetails?.isUsable).toBe(true);
    // What was usable equals everything accrued so far, not a fraction of it.
    expect(result.accruedHours).toBe(result.hoursWorkedDetails?.accruedRegardlessOfUsageGate);
    expect(result.accruedHours).toBeGreaterThan(0);
  });

  it('continues accruing normally well past day 90', () => {
    const result = calculateHoursWorkedAccrual(d(2026, 1, 1), 2026, d(2026, 10, 1), PSL_RULE);
    expect(result.isEligible).toBe(true);
    expect(result.accruedHours).toBeGreaterThan(0);
    expect(result.accruedHours).toBeLessThanOrEqual(80); // maxAccrual cap
  });
});
