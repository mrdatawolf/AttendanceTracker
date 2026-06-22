/**
 * Accrual Calculations Utility
 *
 * Calculates time-off accruals based on brand-specific rules.
 * Currently supports quarterly accrual with eligibility wait periods.
 */

export interface QuarterDefinition {
  startMonth: number; // 1-12
  startDay: number;
  endMonth: number;
  endDay: number;
}

// Tiered seniority vacation types
export interface VacationTier {
  minBaseYears: number;
  maxBaseYears: number | null;
  fullTime: { weeks: number; hours: number };
  partTime: { earnHours: number; perHoursWorked: number; maxHours: number };
}

export interface TieredSeniorityRule {
  type: 'tieredSeniority';
  period: {
    type: 'custom' | 'calendarYear';
    startMonth?: number;
    startDay?: number;
    endMonth?: number;
    endDay?: number;
  };
  eligibility: {
    fullTime: {
      hoursThreshold: number;
      includesHolidayPay?: boolean;
      includesJuryDuty?: boolean;
      includesFuneralLeave?: boolean;
    };
    exempt: {
      waitPeriod: { months?: number; years?: number; days?: number };
      expectedUsage: number;
    };
  };
  tiers: VacationTier[];
  notes?: {
    baseYearDefinition?: string;
    payoutRule?: string;
    terminationRule?: string;
  };
}

export interface AccrualRule {
  type: 'quarterly' | 'monthly' | 'annual' | 'hoursWorked' | 'tieredSeniority' | 'annualGrant';
  hoursPerPeriod?: number;
  maxAnnual?: number;
  maxAccrual?: number;  // For hoursWorked type
  maxUsage?: {          // For hoursWorked type
    hours: number;
    days: number;
    rule: 'whicheverGreater' | 'whicheverLesser' | 'fixed';
  };
  period?: '12month' | 'calendarYear' | { type: string; startMonth?: number; startDay?: number; endMonth?: number; endDay?: number };
  accrualRate?: {       // For hoursWorked type
    earnHours: number;
    perHoursWorked: number;
  };
  eligibility?: {
    waitPeriod?: {
      years?: number;
      months?: number;
      days?: number;
    };
    // Separate, later wait period before accrued hours become usable/
    // schedulable. Accrual itself still starts at `waitPeriod` (e.g. day 1);
    // this only gates when the accrued balance becomes available. Defaults
    // to the same as `waitPeriod` when omitted.
    usageWaitPeriod?: {
      years?: number;
      months?: number;
      days?: number;
    };
    fullTime?: {
      hoursThreshold?: number;
      includesHolidayPay?: boolean;
      includesJuryDuty?: boolean;
      includesFuneralLeave?: boolean;
    };
    exempt?: {
      waitPeriod?: { months?: number; years?: number; days?: number };
      expectedUsage?: number;
    };
  };
  // When true, eligibility/proration is anchored to the employee's
  // rehire_date (if set) instead of their original date_of_hire.
  resetOnRehire?: boolean;
  accrualExclusions?: string[];  // e.g., ["paidLeave", "unpaidLeave"]
  hoursCountedBy?: {
    nonexempt: string[];
    exemptFullTime: { assumedWeeklyHours: number; condition: string };
    exemptPartTime: string;
  };
  quarters?: {
    Q1: QuarterDefinition;
    Q2: QuarterDefinition;
    Q3: QuarterDefinition;
    Q4: QuarterDefinition;
  };
  // For tieredSeniority type
  tiers?: VacationTier[];
  notes?: {
    baseYearDefinition?: string;
    payoutRule?: string;
    terminationRule?: string;
  };
  // For annualGrant type
  grantDate?: { month: number; day: number };
  hoursPerUnit?: number;
  benefitYear?: { startMonth: number; startDay: number; endMonth: number; endDay: number };
  prorationBrackets?: Array<{
    startMonth: number;
    startDay: number;
    endMonth: number;
    endDay: number;
    units: number;
  }>;
}

export interface HoursWorkedAccrualDetails {
  totalHoursWorked: number;
  accrualRate: { earnHours: number; perHoursWorked: number };
  maxAccrual: number;
  maxUsage: { hours: number; days: number; rule: string };
  effectiveUsageLimit: number;
  accrualExclusions: string[];
  hoursCountedBy: {
    nonexempt: string[];
    exemptFullTime: { assumedWeeklyHours: number; condition: string };
    exemptPartTime: string;
  };
  // True running accrual regardless of usage eligibility (see isUsable below).
  accruedRegardlessOfUsageGate: number;
  // False while still serving the usageWaitPeriod — hours are accruing in
  // the background but not yet schedulable.
  isUsable: boolean;
  usableFromDate: string | null;
}

export interface TieredSeniorityAccrualDetails {
  baseYears: number;
  currentTier: VacationTier;
  employeeType: 'fullTime' | 'partTime' | 'exempt' | 'pendingEligibility';
  periodStart: Date;
  periodEnd: Date;
  hoursThreshold: number;
  estimatedHoursWorked?: number;
  isFullTimeQualified: boolean;
  notes?: {
    baseYearDefinition?: string;
    payoutRule?: string;
    terminationRule?: string;
  };
}

export interface AnnualGrantDetails {
  grantDate: Date;
  isFirstEligibleYear: boolean;
  prorationBracket: string | null;
  unitsGranted: number;
  hoursPerUnit: number;
  benefitYearStart: Date;
  benefitYearEnd: Date;
}

export interface AccrualResult {
  isEligible: boolean;
  eligibilityDate: Date | null;
  accruedHours: number;
  maxHours: number;
  quartersEarned: number;
  quarterDetails: QuarterAccrual[];
  nextAccrualDate: Date | null;
  message: string;
  // Type-specific fields
  accrualType?: 'quarterly' | 'hoursWorked' | 'tieredSeniority' | 'annualGrant';
  hoursWorkedDetails?: HoursWorkedAccrualDetails;
  tieredSeniorityDetails?: TieredSeniorityAccrualDetails;
  annualGrantDetails?: AnnualGrantDetails;
}

export interface QuarterAccrual {
  quarter: string;
  startDate: Date;
  hours: number;
  earned: boolean;
}

/**
 * Returns whole completed years between two dates using calendar math,
 * avoiding the floating-point drift of dividing by 365.25 ms/year.
 */
function calendarYearsBetween(from: Date, to: Date): number {
  let years = to.getFullYear() - from.getFullYear();
  const monthDiff = to.getMonth() - from.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && to.getDate() < from.getDate())) {
    years--;
  }
  return Math.max(0, years);
}

/**
 * Calculate the eligibility date based on hire date and wait period
 */
export function calculateEligibilityDate(
  hireDate: Date,
  waitPeriod: { years?: number; months?: number; days?: number }
): Date {
  const eligibilityDate = new Date(hireDate);

  if (waitPeriod.years) {
    eligibilityDate.setFullYear(eligibilityDate.getFullYear() + waitPeriod.years);
  }
  if (waitPeriod.months) {
    eligibilityDate.setMonth(eligibilityDate.getMonth() + waitPeriod.months);
  }
  if (waitPeriod.days) {
    eligibilityDate.setDate(eligibilityDate.getDate() + waitPeriod.days);
  }

  return eligibilityDate;
}

/**
 * Get all quarter start dates for a given year based on quarter definitions
 */
export function getQuarterStartDates(
  year: number,
  quarters: AccrualRule['quarters']
): { quarter: string; startDate: Date }[] {
  if (!quarters) return [];

  const results: { quarter: string; startDate: Date }[] = [];

  // Q1: Mar 1 - May 31
  results.push({
    quarter: 'Q1',
    startDate: new Date(year, quarters.Q1.startMonth - 1, quarters.Q1.startDay)
  });

  // Q2: Jun 1 - Aug 31
  results.push({
    quarter: 'Q2',
    startDate: new Date(year, quarters.Q2.startMonth - 1, quarters.Q2.startDay)
  });

  // Q3: Sep 1 - Nov 30
  results.push({
    quarter: 'Q3',
    startDate: new Date(year, quarters.Q3.startMonth - 1, quarters.Q3.startDay)
  });

  // Q4: Dec 1 - Feb 28/29 (spans year boundary)
  results.push({
    quarter: 'Q4',
    startDate: new Date(year, quarters.Q4.startMonth - 1, quarters.Q4.startDay)
  });

  return results;
}

/**
 * Calculate quarterly accrual for a specific year
 */
export function calculateQuarterlyAccrual(
  hireDate: Date,
  targetYear: number,
  asOfDate: Date,
  rule: AccrualRule
): AccrualResult {
  const waitPeriod = rule.eligibility?.waitPeriod || {};
  const eligibilityDate = calculateEligibilityDate(hireDate, waitPeriod);
  const isEligible = asOfDate >= eligibilityDate;

  const maxAnnual = rule.maxAnnual || 0;
  const hoursPerPeriod = rule.hoursPerPeriod || 0;

  if (!isEligible) {
    return {
      isEligible: false,
      eligibilityDate,
      accruedHours: 0,
      maxHours: maxAnnual,
      quartersEarned: 0,
      quarterDetails: [],
      nextAccrualDate: eligibilityDate,
      message: `Not yet eligible. Eligibility begins ${eligibilityDate.toLocaleDateString()}.`
    };
  }

  if (!rule.quarters) {
    return {
      isEligible: true,
      eligibilityDate,
      accruedHours: 0,
      maxHours: maxAnnual,
      quartersEarned: 0,
      quarterDetails: [],
      nextAccrualDate: null,
      message: 'No quarter definitions found.'
    };
  }

  // Get quarter start dates for the target year and previous year (for Q4 spanning)
  const quarterDates: { quarter: string; startDate: Date }[] = [];

  // Add Q4 from previous year (Dec of prev year)
  const prevYearQ4 = new Date(targetYear - 1, rule.quarters.Q4.startMonth - 1, rule.quarters.Q4.startDay);
  quarterDates.push({ quarter: 'Q4 (prev)', startDate: prevYearQ4 });

  // Add all quarters for target year
  quarterDates.push(...getQuarterStartDates(targetYear, rule.quarters));

  // Filter to quarters that:
  // 1. Have started (startDate <= asOfDate)
  // 2. Started after eligibility date
  // 3. Fall within the target year's benefit period
  const quarterDetails: QuarterAccrual[] = [];
  let quartersEarned = 0;
  let nextAccrualDate: Date | null = null;

  // Define the benefit year range (Mar 1 of target year to Feb 28/29 of next year)
  const benefitYearStart = new Date(targetYear, rule.quarters.Q1.startMonth - 1, rule.quarters.Q1.startDay);
  const benefitYearEnd = new Date(targetYear + 1, rule.quarters.Q4.endMonth - 1, rule.quarters.Q4.endDay);

  // Check each quarter
  for (const { quarter, startDate } of quarterDates) {
    // Skip Q4 from previous year if it's before the benefit year
    if (quarter === 'Q4 (prev)' && startDate < new Date(targetYear - 1, 11, 1)) {
      continue;
    }

    // For target year calculation, we want quarters that fall within our fiscal year
    // Fiscal year runs Mar 1 to Feb 28/29
    const isInBenefitYear = startDate >= benefitYearStart ||
      (quarter === 'Q4' && startDate.getMonth() === 11); // Dec of target year

    if (!isInBenefitYear && quarter !== 'Q4 (prev)') {
      continue;
    }

    const earned = startDate <= asOfDate && startDate >= eligibilityDate;

    if (earned && quartersEarned < Math.floor(maxAnnual / hoursPerPeriod)) {
      quartersEarned++;
      quarterDetails.push({
        quarter: quarter.replace(' (prev)', ''),
        startDate,
        hours: hoursPerPeriod,
        earned: true
      });
    } else if (!earned && startDate > asOfDate && !nextAccrualDate) {
      nextAccrualDate = startDate;
      quarterDetails.push({
        quarter: quarter.replace(' (prev)', ''),
        startDate,
        hours: hoursPerPeriod,
        earned: false
      });
    }
  }

  const accruedHours = Math.min(quartersEarned * hoursPerPeriod, maxAnnual);

  return {
    isEligible: true,
    eligibilityDate,
    accruedHours,
    maxHours: maxAnnual,
    quartersEarned,
    quarterDetails,
    nextAccrualDate,
    message: quartersEarned > 0
      ? `${quartersEarned} quarter(s) earned = ${accruedHours} hours`
      : 'Eligible but no quarters earned yet this year.',
    accrualType: 'quarterly'
  };
}

/**
 * Calculate hours-worked based accrual (e.g., PSL - Personal Sick Leave)
 *
 * This accrual type earns hours based on hours worked:
 * - 1 hour earned per X hours worked (e.g., 1 per 30)
 * - Max accrual cap per period (e.g., 80 hours)
 * - Max usage per period (e.g., 40 hours or 5 days, whichever greater)
 * - No accrual during paid/unpaid leave
 *
 * Since we don't have actual hours worked tracked in this system,
 * we estimate based on employee type (exempt vs non-exempt).
 */
export function calculateHoursWorkedAccrual(
  hireDate: Date,
  targetYear: number,
  asOfDate: Date,
  rule: AccrualRule,
  totalHoursWorked?: number // Optional - if provided, use actual hours; otherwise estimate
): AccrualResult {
  const waitPeriod = rule.eligibility?.waitPeriod || {};
  const eligibilityDate = calculateEligibilityDate(hireDate, waitPeriod);
  const isEligible = asOfDate >= eligibilityDate;

  // Accrual itself starts at eligibilityDate (often day 1), but the accrued
  // balance may not become usable/schedulable until later — e.g. PSL accrues
  // from day 1 but can't be used until day 90. Defaults to eligibilityDate
  // (immediately usable) when usageWaitPeriod isn't configured.
  const usageWaitPeriod = rule.eligibility?.usageWaitPeriod;
  const usageEligibilityDate = usageWaitPeriod
    ? calculateEligibilityDate(hireDate, usageWaitPeriod)
    : eligibilityDate;

  const maxAccrual = rule.maxAccrual || 80;
  const maxUsage = rule.maxUsage || { hours: 40, days: 5, rule: 'whicheverGreater' };
  const accrualRate = rule.accrualRate || { earnHours: 1, perHoursWorked: 30 };

  // Calculate effective usage limit based on rule
  // "5 days or 40 hours, whichever is greater" - assuming 8-hour days
  const daysAsHours = maxUsage.days * 8;
  let effectiveUsageLimit: number;
  switch (maxUsage.rule) {
    case 'whicheverGreater':
      effectiveUsageLimit = Math.max(maxUsage.hours, daysAsHours);
      break;
    case 'whicheverLesser':
      effectiveUsageLimit = Math.min(maxUsage.hours, daysAsHours);
      break;
    default:
      effectiveUsageLimit = maxUsage.hours;
  }

  if (!isEligible) {
    return {
      isEligible: false,
      eligibilityDate,
      accruedHours: 0,
      maxHours: effectiveUsageLimit,
      quartersEarned: 0,
      quarterDetails: [],
      nextAccrualDate: eligibilityDate,
      message: `Eligible from first day of employment.`,
      accrualType: 'hoursWorked',
      hoursWorkedDetails: {
        totalHoursWorked: 0,
        accrualRate,
        maxAccrual,
        maxUsage,
        effectiveUsageLimit,
        accrualExclusions: rule.accrualExclusions || [],
        hoursCountedBy: rule.hoursCountedBy || {
          nonexempt: ['straightTime', 'overtime'],
          exemptFullTime: { assumedWeeklyHours: 40, condition: 'anyWorkPerformed' },
          exemptPartTime: 'regularSchedule'
        },
        accruedRegardlessOfUsageGate: 0,
        isUsable: false,
        usableFromDate: usageEligibilityDate.toISOString()
      }
    };
  }

  // Calculate hours worked since eligibility or start of year (whichever is later)
  // For 12-month period, use hire date anniversary; for calendar year, use Jan 1
  let periodStart: Date;
  if (rule.period === 'calendarYear') {
    periodStart = new Date(targetYear, 0, 1);
  } else {
    // 12-month period based on hire date
    const hireAnniversary = new Date(targetYear, hireDate.getMonth(), hireDate.getDate());
    if (hireAnniversary > asOfDate) {
      // Use previous year's anniversary
      hireAnniversary.setFullYear(targetYear - 1);
    }
    periodStart = hireAnniversary;
  }

  // If employee not yet eligible at period start, use eligibility date
  if (periodStart < eligibilityDate) {
    periodStart = eligibilityDate;
  }

  // Estimate hours worked if not provided
  // Assume full-time exempt: 40 hours/week
  let estimatedHoursWorked: number;
  if (totalHoursWorked !== undefined) {
    estimatedHoursWorked = totalHoursWorked;
  } else {
    // Calculate weeks between period start and as-of date
    const msPerWeek = 7 * 24 * 60 * 60 * 1000;
    const weeksSincePeriodStart = Math.max(0, (asOfDate.getTime() - periodStart.getTime()) / msPerWeek);
    // Assume 40 hours per week (full-time exempt default)
    estimatedHoursWorked = Math.floor(weeksSincePeriodStart * 40);
  }

  // Calculate accrued hours: (hoursWorked / perHoursWorked) * earnHours
  const rawAccrued = Math.floor(estimatedHoursWorked / accrualRate.perHoursWorked) * accrualRate.earnHours;
  const accruedRegardlessOfUsageGate = Math.min(rawAccrued, maxAccrual);

  // Hours keep accruing from day 1 regardless, but aren't usable/schedulable
  // until usageEligibilityDate (e.g. day 90) — they don't reset once unlocked,
  // they simply become available all at once, including everything accrued
  // during the wait.
  const isUsable = asOfDate >= usageEligibilityDate;
  const accruedHours = isUsable ? accruedRegardlessOfUsageGate : 0;

  const message = isUsable
    ? `Accruing ${accrualRate.earnHours}h per ${accrualRate.perHoursWorked}h worked. ${accruedHours}h accrued based on ~${estimatedHoursWorked}h worked.`
    : `Accruing ${accrualRate.earnHours}h per ${accrualRate.perHoursWorked}h worked (~${accruedRegardlessOfUsageGate}h so far), but not usable until ${usageEligibilityDate.toLocaleDateString()}.`;

  return {
    isEligible: isUsable,
    eligibilityDate,
    accruedHours,
    maxHours: effectiveUsageLimit,
    quartersEarned: 0,
    quarterDetails: [],
    nextAccrualDate: isUsable ? null : usageEligibilityDate,
    message,
    accrualType: 'hoursWorked',
    hoursWorkedDetails: {
      totalHoursWorked: estimatedHoursWorked,
      accrualRate,
      maxAccrual,
      maxUsage,
      effectiveUsageLimit,
      accrualExclusions: rule.accrualExclusions || [],
      hoursCountedBy: rule.hoursCountedBy || {
        nonexempt: ['straightTime', 'overtime'],
        exemptFullTime: { assumedWeeklyHours: 40, condition: 'anyWorkPerformed' },
        exemptPartTime: 'regularSchedule'
      },
      accruedRegardlessOfUsageGate,
      isUsable,
      usableFromDate: isUsable ? null : usageEligibilityDate.toISOString()
    }
  };
}

/**
 * Calculate tiered seniority-based accrual (e.g., Vacation)
 *
 * This accrual type provides different vacation amounts based on:
 * - Years of service (base years)
 * - Full-time vs part-time status (1,200 hours threshold)
 * - Custom benefit year (June 1 - May 31)
 */
export function calculateTieredSeniorityAccrual(
  hireDate: Date,
  targetYear: number,
  asOfDate: Date,
  rule: AccrualRule,
  totalHoursWorked?: number,
  isExempt: boolean = false,
  employmentType?: 'full_time' | 'part_time'
): AccrualResult {
  // Get period configuration
  const periodConfig = typeof rule.period === 'object' ? rule.period : null;
  const periodStartMonth = periodConfig?.startMonth || 6; // Default June
  const periodStartDay = periodConfig?.startDay || 1;
  const periodEndMonth = periodConfig?.endMonth || 5; // Default May
  const periodEndDay = periodConfig?.endDay || 31;

  // Calculate period start and end for the target year
  // If we're before the period start in targetYear, use previous year's period
  let periodStart = new Date(targetYear, periodStartMonth - 1, periodStartDay);
  let periodEnd = new Date(targetYear + 1, periodEndMonth - 1, periodEndDay);

  // If as-of date is before this year's period start, use previous period
  if (asOfDate < periodStart) {
    periodStart = new Date(targetYear - 1, periodStartMonth - 1, periodStartDay);
    periodEnd = new Date(targetYear, periodEndMonth - 1, periodEndDay);
  }

  // Calculate base years (years of service as of period start)
  const baseYears = calendarYearsBetween(hireDate, periodStart);

  // Determine eligibility
  let isEligible = true;
  let eligibilityDate: Date | null = null;

  if (isExempt && rule.eligibility?.exempt?.waitPeriod) {
    // Exempt employees have a wait period (e.g., 6 months)
    eligibilityDate = calculateEligibilityDate(hireDate, rule.eligibility.exempt.waitPeriod);
    isEligible = asOfDate >= eligibilityDate;
  } else {
    // Non-exempt employees are eligible from hire date but need to accrue hours
    eligibilityDate = hireDate;
    isEligible = true;
  }

  // Find the appropriate tier based on base years
  const tiers = rule.tiers || [];
  let currentTier = tiers[0];
  for (const tier of tiers) {
    if (baseYears >= tier.minBaseYears &&
        (tier.maxBaseYears === null || baseYears <= tier.maxBaseYears)) {
      currentTier = tier;
      break;
    }
  }

  if (!currentTier) {
    return {
      isEligible: false,
      eligibilityDate,
      accruedHours: 0,
      maxHours: 0,
      quartersEarned: 0,
      quarterDetails: [],
      nextAccrualDate: null,
      message: 'No applicable vacation tier found.',
      accrualType: 'tieredSeniority'
    };
  }

  // Determine employee type and estimate hours worked toward the full-time
  // threshold. Eligibility under this rule is a one-time gate, not a ramp:
  // "vacations may be scheduled once eligibility has been met." A full-time
  // employee gets either the full tier amount or nothing — never a prorated
  // amount while still working toward their first established base year.
  const hoursThreshold = rule.eligibility?.fullTime?.hoursThreshold || 1200;
  let estimatedHoursWorked: number;
  let employeeType: 'fullTime' | 'partTime' | 'exempt' | 'pendingEligibility';

  if (totalHoursWorked !== undefined) {
    // Explicit hours-worked figure supplied by the caller — use it directly
    // against the threshold, same contract as before.
    estimatedHoursWorked = totalHoursWorked;
    if (isExempt) {
      employeeType = 'exempt';
    } else if (estimatedHoursWorked >= hoursThreshold) {
      employeeType = 'fullTime';
    } else {
      employeeType = 'partTime';
    }
  } else if (isExempt) {
    employeeType = 'exempt';
    estimatedHoursWorked = hoursThreshold;
  } else if (employmentType === 'full_time') {
    const msPerWeek = 7 * 24 * 60 * 60 * 1000;
    // Did the employee already have enough continuous full-time tenure
    // *before this period started* to have cleared the threshold in an
    // earlier (possibly partial) base year?
    const weeksBeforePeriodStart = Math.max(0, (periodStart.getTime() - hireDate.getTime()) / msPerWeek);
    const hoursBeforePeriodStart = Math.floor(weeksBeforePeriodStart * 40);

    if (hoursBeforePeriodStart >= hoursThreshold) {
      // Eligibility was already established in a prior base year. That's a
      // permanent status, not an annual requirement — don't reset them to
      // "not yet eligible" just because a new period started.
      employeeType = 'fullTime';
      estimatedHoursWorked = hoursBeforePeriodStart;
    } else {
      // Still working toward establishing their first base year. Count hours
      // worked within *this* base year only — from hire date or period
      // start, whichever is later — with no partial credit before the
      // threshold is crossed.
      const windowStart = hireDate > periodStart ? hireDate : periodStart;
      const weeksInBaseYear = Math.max(0, (asOfDate.getTime() - windowStart.getTime()) / msPerWeek);
      estimatedHoursWorked = Math.floor(weeksInBaseYear * 40);
      employeeType = estimatedHoursWorked >= hoursThreshold ? 'fullTime' : 'pendingEligibility';
    }
  } else {
    // Genuinely part-time (or unknown employment type): earn vacation
    // incrementally based on hours worked this benefit period.
    const msPerWeek = 7 * 24 * 60 * 60 * 1000;
    const weeksSincePeriodStart = Math.max(0, (asOfDate.getTime() - periodStart.getTime()) / msPerWeek);
    estimatedHoursWorked = Math.floor(weeksSincePeriodStart * 40);
    employeeType = 'partTime';
  }

  const isFullTimeQualified = employeeType === 'fullTime';

  // Calculate accrued hours based on employee type
  let accruedHours: number;
  let maxHours: number;

  if (employeeType === 'exempt' || employeeType === 'fullTime') {
    // Full-time or exempt: get full allocation
    accruedHours = currentTier.fullTime.hours;
    maxHours = currentTier.fullTime.hours;
  } else if (employeeType === 'pendingEligibility') {
    // Eligibility not yet established — no vacation can be scheduled yet.
    accruedHours = 0;
    maxHours = currentTier.fullTime.hours;
  } else {
    // Part-time: earn hours based on hours worked
    const earnRate = currentTier.partTime.earnHours;
    const perHoursWorked = currentTier.partTime.perHoursWorked;
    const tierMax = currentTier.partTime.maxHours;

    const rawAccrued = Math.floor(estimatedHoursWorked / perHoursWorked) * earnRate;
    accruedHours = Math.min(rawAccrued, tierMax);
    maxHours = tierMax;
  }

  // Build message
  let message: string;
  if (employeeType === 'fullTime') {
    message = `Full-time (${hoursThreshold}+ hours): ${currentTier.fullTime.weeks} week(s) = ${accruedHours}h vacation`;
  } else if (employeeType === 'exempt') {
    message = `Exempt employee: ${currentTier.fullTime.weeks} week(s) = ${accruedHours}h vacation`;
  } else if (employeeType === 'pendingEligibility') {
    message = `Not yet eligible: needs ${hoursThreshold}h worked in the current base year (~${estimatedHoursWorked}h so far) before vacation can be scheduled.`;
  } else {
    message = `Part-time: ${currentTier.partTime.earnHours}h per ${currentTier.partTime.perHoursWorked}h worked, up to ${maxHours}h. Currently ${accruedHours}h accrued.`;
  }

  return {
    isEligible: isEligible && employeeType !== 'pendingEligibility',
    eligibilityDate,
    accruedHours,
    maxHours,
    quartersEarned: 0,
    quarterDetails: [],
    nextAccrualDate: null,
    message,
    accrualType: 'tieredSeniority',
    tieredSeniorityDetails: {
      baseYears: Math.max(0, baseYears),
      currentTier,
      employeeType,
      periodStart,
      periodEnd,
      hoursThreshold,
      estimatedHoursWorked,
      isFullTimeQualified,
      notes: rule.notes
    }
  };
}

/**
 * Calculate annual grant accrual (e.g., Floating Holidays)
 *
 * This accrual type grants all hours on a specific date each year,
 * with a pro-rated first eligible year based on when the employee's
 * eligibility anniversary falls within the benefit year.
 */
export function calculateAnnualGrantAccrual(
  hireDate: Date,
  targetYear: number,
  asOfDate: Date,
  rule: AccrualRule
): AccrualResult {
  const waitPeriod = rule.eligibility?.waitPeriod || {};
  const eligibilityDate = calculateEligibilityDate(hireDate, waitPeriod);
  const maxAnnual = rule.maxAnnual || 0;
  const hoursPerUnit = rule.hoursPerUnit || 8;

  const grantMonth = rule.grantDate?.month || 6;
  const grantDay = rule.grantDate?.day || 1;
  const byStartMonth = rule.benefitYear?.startMonth || grantMonth;
  const byStartDay = rule.benefitYear?.startDay || grantDay;
  const byEndMonth = rule.benefitYear?.endMonth || 5;
  const byEndDay = rule.benefitYear?.endDay || 31;

  // Determine the benefit year that contains the target year's grant date
  // Benefit year runs e.g. Jun 1 of targetYear to May 31 of targetYear+1
  let benefitYearStart = new Date(targetYear, byStartMonth - 1, byStartDay);
  let benefitYearEnd = new Date(targetYear + 1, byEndMonth - 1, byEndDay);
  const grantDate = new Date(targetYear, grantMonth - 1, grantDay);

  // If asOfDate is before this benefit year's start, use the previous benefit year
  if (asOfDate < benefitYearStart) {
    benefitYearStart = new Date(targetYear - 1, byStartMonth - 1, byStartDay);
    benefitYearEnd = new Date(targetYear, byEndMonth - 1, byEndDay);
  }

  const isEligible = asOfDate >= eligibilityDate;

  if (!isEligible) {
    return {
      isEligible: false,
      eligibilityDate,
      accruedHours: 0,
      maxHours: maxAnnual,
      quartersEarned: 0,
      quarterDetails: [],
      nextAccrualDate: eligibilityDate,
      message: `Not yet eligible. Eligibility begins ${eligibilityDate.toLocaleDateString()}.`,
      accrualType: 'annualGrant',
      annualGrantDetails: {
        grantDate,
        isFirstEligibleYear: true,
        prorationBracket: null,
        unitsGranted: 0,
        hoursPerUnit,
        benefitYearStart,
        benefitYearEnd,
      }
    };
  }

  // Determine if this is the first eligible benefit year
  // The first eligible benefit year is the one that contains the eligibility date
  const eligBenefitYearStart = new Date(
    eligibilityDate.getFullYear(),
    byStartMonth - 1,
    byStartDay
  );
  // If eligibility date is before that year's benefit year start, step back
  let firstEligibleBYStart: Date;
  if (eligibilityDate < eligBenefitYearStart) {
    firstEligibleBYStart = new Date(
      eligibilityDate.getFullYear() - 1,
      byStartMonth - 1,
      byStartDay
    );
  } else {
    firstEligibleBYStart = eligBenefitYearStart;
  }

  const isFirstEligibleYear =
    benefitYearStart.getTime() === firstEligibleBYStart.getTime();

  if (isFirstEligibleYear && rule.prorationBrackets) {
    // Pro-rate based on which bracket the eligibility date falls into
    let unitsGranted = 0;
    let bracketLabel: string | null = null;

    for (const bracket of rule.prorationBrackets) {
      // Build bracket start/end dates within the benefit year
      let bracketStart: Date;
      let bracketEnd: Date;

      // Handle brackets that span the year boundary (e.g., Dec 1 - Feb 28)
      if (bracket.startMonth >= byStartMonth) {
        bracketStart = new Date(benefitYearStart.getFullYear(), bracket.startMonth - 1, bracket.startDay);
      } else {
        bracketStart = new Date(benefitYearStart.getFullYear() + 1, bracket.startMonth - 1, bracket.startDay);
      }

      if (bracket.endMonth >= byStartMonth) {
        bracketEnd = new Date(benefitYearStart.getFullYear(), bracket.endMonth - 1, bracket.endDay);
      } else {
        bracketEnd = new Date(benefitYearStart.getFullYear() + 1, bracket.endMonth - 1, bracket.endDay);
      }

      if (eligibilityDate >= bracketStart && eligibilityDate <= bracketEnd) {
        unitsGranted = bracket.units;
        const startLabel = bracketStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const endLabel = bracketEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        bracketLabel = `${startLabel} – ${endLabel}`;
        break;
      }
    }

    const accruedHours = unitsGranted * hoursPerUnit;

    return {
      isEligible: true,
      eligibilityDate,
      accruedHours,
      maxHours: maxAnnual,
      quartersEarned: 0,
      quarterDetails: [],
      nextAccrualDate: unitsGranted < (maxAnnual / hoursPerUnit)
        ? new Date(benefitYearEnd.getFullYear(), grantMonth - 1, grantDay)
        : null,
      message: `First eligible year (pro-rated): ${unitsGranted} × ${hoursPerUnit}h = ${accruedHours}h`,
      accrualType: 'annualGrant',
      annualGrantDetails: {
        grantDate,
        isFirstEligibleYear: true,
        prorationBracket: bracketLabel,
        unitsGranted,
        hoursPerUnit,
        benefitYearStart,
        benefitYearEnd,
      }
    };
  }

  // Subsequent years: full grant on grant date
  // Determine the grant date for the current benefit year
  const currentGrantDate = new Date(benefitYearStart.getFullYear(), grantMonth - 1, grantDay);
  const hasBeenGranted = asOfDate >= currentGrantDate;
  const accruedHours = hasBeenGranted ? maxAnnual : 0;

  return {
    isEligible: true,
    eligibilityDate,
    accruedHours,
    maxHours: maxAnnual,
    quartersEarned: 0,
    quarterDetails: [],
    nextAccrualDate: hasBeenGranted ? null : currentGrantDate,
    message: hasBeenGranted
      ? `Annual grant: ${maxAnnual}h (${maxAnnual / hoursPerUnit} floating holidays)`
      : `Granted on ${currentGrantDate.toLocaleDateString()}`,
    accrualType: 'annualGrant',
    annualGrantDetails: {
      grantDate: currentGrantDate,
      isFirstEligibleYear: false,
      prorationBracket: null,
      unitsGranted: hasBeenGranted ? maxAnnual / hoursPerUnit : 0,
      hoursPerUnit,
      benefitYearStart,
      benefitYearEnd,
    }
  };
}

/**
 * Main function to calculate accrual based on rule type
 *
 * `employmentType` comes from the employee record (full_time/part_time). For
 * tieredSeniority rules it's passed through so the full-time hours-worked
 * threshold is measured against the employee's actual hire date rather than
 * the start of the current benefit period — otherwise every full-time
 * employee looks part-time for months right after each period rollover,
 * while genuine new hires still correctly ramp up until they clear the
 * threshold.
 */
export function calculateAccrual(
  hireDate: Date | string,
  targetYear: number,
  asOfDate: Date | string,
  rule: AccrualRule,
  employmentType?: 'full_time' | 'part_time'
): AccrualResult {
  const hireDateObj = typeof hireDate === 'string' ? new Date(hireDate) : hireDate;
  const asOfDateObj = typeof asOfDate === 'string' ? new Date(asOfDate) : asOfDate;

  switch (rule.type) {
    case 'quarterly':
      return calculateQuarterlyAccrual(hireDateObj, targetYear, asOfDateObj, rule);
    case 'hoursWorked':
      return calculateHoursWorkedAccrual(hireDateObj, targetYear, asOfDateObj, rule);
    case 'tieredSeniority':
      return calculateTieredSeniorityAccrual(hireDateObj, targetYear, asOfDateObj, rule, undefined, false, employmentType);
    case 'annualGrant':
      return calculateAnnualGrantAccrual(hireDateObj, targetYear, asOfDateObj, rule);
    default:
      return {
        isEligible: false,
        eligibilityDate: null,
        accruedHours: 0,
        maxHours: rule.maxAnnual || 0,
        quartersEarned: 0,
        quarterDetails: [],
        nextAccrualDate: null,
        message: `Unsupported accrual type: ${rule.type}`
      };
  }
}

/**
 * Load brand features and check for accrual rules
 * Returns a record of time code -> accrual rule mappings
 */
export async function loadAccrualRules(brandId: string): Promise<Record<string, AccrualRule> | null> {
  try {
    const response = await fetch(`/${brandId}/brand-features.json`);
    if (!response.ok) return null;

    const features = await response.json();
    if (features?.features?.accrualCalculations?.enabled && features?.features?.accrualCalculations?.rules) {
      return features.features.accrualCalculations.rules;
    }
    return null;
  } catch {
    return null;
  }
}
