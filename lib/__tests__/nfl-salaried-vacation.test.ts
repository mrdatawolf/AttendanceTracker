import { describe, it, expect } from 'vitest';
import {
  calculateTenureTiersAccrual,
  calculateTieredSeniorityAccrual,
  explainAccrualResult,
  calculateFractionalYearsOfService,
  renderFormulaBreakdown,
  type AccrualRule,
} from '../accrual-calculations';
import nflFeatures from '../../public/NFL/brand-features.json';

const HOURLY_VAC_RULE = nflFeatures.features.accrualCalculations.rules.VAC as unknown as AccrualRule;

// ─────────────────────────────────────────────────────────────────────────────
// NFL salaried vacation — individually negotiated-at-hire schedules
//
// These employees' schedules do NOT come from the brand-wide NFL `VAC` rule
// (that rule is for hourly staff: weeks-based tiers locked to the Jun 1
// benefit-year boundary). Instead each was decoded from a spreadsheet of
// per-employee Excel IF-formulas keyed on years of service, which reduced
// to 5 distinct shapes shared across the 16 employees.
//
// ASSUMPTION, not confirmed by the customer: years of service for these
// rules is measured on a ROLLING basis off the employee's own hire-date
// anniversary (as of "today"), not pinned to a fixed benefit-year start.
// This was inferred by testing the spreadsheet's formulas against real
// hire dates: anchoring to Jun 1 (like hourly) put McCaslin one tier low
// versus the spreadsheet's stated balance; anchoring to "today" matched
// every one of the 16 employees exactly. See conversation history / the
// `notes` field on each employee's employee_accrual_rules row for detail.
// This should be confirmed with the customer and revisited if wrong.
// ─────────────────────────────────────────────────────────────────────────────

function d(year: number, month: number, day: number) {
  return new Date(year, month - 1, day);
}

const GROUP_A: AccrualRule = {
  type: 'tenureTiers',
  tenureTiers: [
    { minYears: 0, maxYears: 4, hours: 80 },
    { minYears: 5, maxYears: 8, hours: 120 },
    { minYears: 9, maxYears: 15, hours: 160 },
    { minYears: 16, maxYears: null, hours: 200 },
  ],
  formulaTemplate: 'IF({C}<5,10,IF({C}>15,25,IF({C}>8,20,IF({C}>5,15))))',
};

// Same tiers, differently-written source formula — see the migration file
// for why these are kept as two separate rule objects.
const GROUP_B: AccrualRule = {
  type: 'tenureTiers',
  tenureTiers: [
    { minYears: 0, maxYears: 7, hours: 120 },
    { minYears: 8, maxYears: 15, hours: 160 },
    { minYears: 16, maxYears: null, hours: 200 },
  ],
  formulaTemplate: 'IF({C}>15,25,IF({C}>8,20,15))',
};

const GROUP_B_HARPER: AccrualRule = {
  ...GROUP_B,
  formulaTemplate: 'IF({C}<8,15,IF({C}>15,25,IF({C}>8,20)))',
};

const GROUP_C: AccrualRule = {
  type: 'tenureTiers',
  tenureTiers: [
    { minYears: 0, maxYears: 15, hours: 160 },
    { minYears: 16, maxYears: null, hours: 200 },
  ],
  formulaTemplate: 'IF({C}>15,25,20)',
};

// Dorval's original formula used a non-round 10.167-year threshold
// (=IF(C>10.167,25,20)) — most likely a fractional/decimal years-of-service
// column rather than the whole-year granularity used everywhere else in
// this engine. Approximated here as the whole-year threshold that
// reproduces the same true/false decision for any integer year count
// (11 is the smallest whole number > 10.167). This is a guess: if the
// original intent was closer to "10 years + ~2 months" measured precisely,
// his bump to 200h could land up to ~10 months earlier than this models —
// confirm with the customer before he approaches 10 years of service.
const GROUP_D_DORVAL: AccrualRule = {
  type: 'tenureTiers',
  tenureTiers: [
    { minYears: 0, maxYears: 10, hours: 160 },
    { minYears: 11, maxYears: null, hours: 200 },
  ],
  formulaTemplate: 'IF({C}>10.167,25,20)',
};

const GROUP_E: AccrualRule = {
  type: 'tenureTiers',
  tenureTiers: [
    { minYears: 0, maxYears: null, hours: 200 },
  ],
  formulaTemplate: '25',
};

describe('NFL salaried vacation — tenureTiers accrual', () => {
  // asOfDate matches the date this data was verified against the customer's
  // spreadsheet (see notes above) — do not change without re-verifying.
  const asOf = d(2026, 8, 26);

  describe('reproduces the customer-supplied 2026/2027 balances exactly', () => {
    const cases: Array<[string, Date, AccrualRule, number]> = [
      ['Bartley, Jason', d(2024, 12, 26), GROUP_A, 80],
      ['Dorval, Russell', d(2018, 4, 2), GROUP_D_DORVAL, 160],
      ['Dunn, Kenneth', d(2002, 11, 3), GROUP_E, 200],
      ['Gann, Jordan', d(2018, 10, 19), GROUP_A, 120],
      ['Gregorio, Jamie', d(2015, 4, 15), GROUP_C, 160],
      ['Hall, Joseph', d(1998, 5, 26), GROUP_E, 200],
      ['Harper, Dale', d(2022, 6, 6), GROUP_B_HARPER, 120],
      ['Hollister, Victor', d(2023, 3, 1), GROUP_A, 80],
      ['Kates-McConnell, Logan', d(2025, 7, 21), GROUP_A, 80],
      ['Landen, Ry', d(2018, 9, 24), GROUP_A, 120],
      ['Maciel, Michael', d(2016, 12, 30), GROUP_C, 160],
      ['McCaslin, Zachary', d(2017, 7, 10), GROUP_B, 160],
      ['Nissen, Brian', d(2019, 2, 4), GROUP_B, 120],
      ['Tejeda, Salvador', d(1998, 3, 5), GROUP_A, 200],
      ['Tostie, Shane', d(2015, 6, 23), GROUP_C, 160],
      ['Young, Leandra', d(2024, 6, 1), GROUP_A, 80],
    ];

    it.each(cases)('%s', (_name, hire, rule, expectedHours) => {
      const result = calculateTenureTiersAccrual(hire, asOf, rule);
      expect(result.isEligible).toBe(true);
      expect(result.accruedHours).toBe(expectedHours);
    });
  });

  describe('tier advances mid-year on the hire anniversary, not on a fixed benefit-year date', () => {
    it('Group A: jumps from 80h to 120h the day the 5-year anniversary hits', () => {
      const hire = d(2021, 3, 15);
      const justBefore = calculateTenureTiersAccrual(hire, d(2026, 3, 14), GROUP_A);
      const onAnniversary = calculateTenureTiersAccrual(hire, d(2026, 3, 15), GROUP_A);
      expect(justBefore.accruedHours).toBe(80);
      expect(onAnniversary.accruedHours).toBe(120);
    });
  });

  describe('flat schedule (Group E) ignores tenure entirely', () => {
    it('gives 200h whether hired yesterday or decades ago', () => {
      const newHire = calculateTenureTiersAccrual(d(2026, 8, 1), asOf, GROUP_E);
      const veteran = calculateTenureTiersAccrual(d(1990, 1, 1), asOf, GROUP_E);
      expect(newHire.accruedHours).toBe(200);
      expect(veteran.accruedHours).toBe(200);
    });
  });

  it('reports years of service and the matched tier in tenureTiersDetails', () => {
    const result = calculateTenureTiersAccrual(d(2018, 10, 19), asOf, GROUP_A);
    expect(result.tenureTiersDetails?.years).toBe(7);
    expect(result.tenureTiersDetails?.currentTier).toEqual({ minYears: 5, maxYears: 8, hours: 120 });
  });
});

describe('explainAccrualResult', () => {
  it('tenureTiers: lists the full tier ladder and where this employee currently sits', () => {
    const result = calculateTenureTiersAccrual(d(2018, 10, 19), d(2026, 8, 26), GROUP_A);
    const explanation = explainAccrualResult(GROUP_A, result);
    expect(explanation).toContain('rolling basis from the hire-date anniversary');
    expect(explanation).toContain('0–4 yr = 80h');
    expect(explanation).toContain('16+ yr = 200h');
    expect(explanation).toContain(result.message);
  });

  it('tieredSeniority: lists the benefit-year tiers and notes they lock in at benefit-year start', () => {
    const hire = d(2022, 6, 1); // 3 base years at Jun 1 2025
    const accrualResult = calculateTieredSeniorityAccrual(hire, 2025, d(2025, 10, 1), HOURLY_VAC_RULE, 1300);
    const explanation = explainAccrualResult(HOURLY_VAC_RULE, accrualResult);
    expect(explanation).toContain('Jun 1 – May 31');
    expect(explanation).toContain('3–7 yr = 80h');
    expect(explanation).toContain(accrualResult.message);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Formula breakdown display (renderFormulaBreakdown / calculateFractionalYearsOfService)
//
// This is purely a display feature — it reproduces the customer's original
// spreadsheet formula, with real values substituted in, for the report's
// expanded sub-row. It never drives the actual accrued balance (that's
// still tenureTiers above); the tail of the rendered string reuses the
// already-computed accruedHours so it can never drift from the real number.
// ─────────────────────────────────────────────────────────────────────────────
describe('formula breakdown display', () => {
  it('calculateFractionalYearsOfService matches Bartley\'s real numbers exactly (609 days -> 1.7 years)', () => {
    const hire = d(2024, 12, 26);
    const asOf = d(2026, 8, 27);
    expect(calculateFractionalYearsOfService(hire, asOf)).toBe(1.7);
  });

  it('renderFormulaBreakdown substitutes the fractional year and reuses the real computed result', () => {
    const hire = d(2024, 12, 26);
    const asOf = d(2026, 8, 26); // matches this file's `asOf` used elsewhere
    const result = calculateTenureTiersAccrual(hire, asOf, GROUP_A);
    expect(result.accruedHours).toBe(80);

    const breakdown = renderFormulaBreakdown(GROUP_A, hire, asOf, result.accruedHours);
    expect(breakdown).toContain('608 days');
    expect(breakdown).toContain('1.7 years');
    expect(breakdown).toContain('IF(1.7<5,10,IF(1.7>15,25,IF(1.7>8,20,IF(1.7>5,15))))');
    expect(breakdown).toContain('= 10 days = 80h');
  });

  it('returns null for rules without a formulaTemplate', () => {
    const noTemplateRule: AccrualRule = { type: 'tenureTiers', tenureTiers: GROUP_A.tenureTiers };
    const breakdown = renderFormulaBreakdown(noTemplateRule, d(2024, 12, 26), d(2026, 8, 26), 80);
    expect(breakdown).toBeNull();
  });
});
