import fs from 'fs';
import path from 'path';

export interface BrandTimeCode {
  id: number;
  code: string;
  description: string;
  hours_limit: number | null;
  default_allocation: number | null;
  is_active: number;
  color?: string;
  spacer?: boolean;
}

interface TimeCodesFile {
  brandId: string;
  version: string;
  description: string;
  timeCodes: BrandTimeCode[];
}

/**
 * Get the current brand from lib/brand-selection.json
 */
export function getCurrentBrand(): string {
  try {
    const brandSelectionPath = path.join(process.cwd(), 'lib', 'brand-selection.json');
    if (fs.existsSync(brandSelectionPath)) {
      const data = JSON.parse(fs.readFileSync(brandSelectionPath, 'utf8'));
      return data.brand || 'Default';
    }
  } catch (error) {
    console.error('Error reading brand selection:', error);
  }
  return 'Default';
}

/**
 * Load time codes from brand-specific JSON file
 * Returns null if no JSON file exists for the brand
 * @param brand - Optional brand override
 * @param includeInactive - If true, returns all time codes including inactive ones (for syncing)
 */
export function getBrandTimeCodes(brand?: string, includeInactive?: boolean): BrandTimeCode[] | null {
  const targetBrand = brand || getCurrentBrand();
  try {
    const timeCodesPath = path.join(process.cwd(), 'public', targetBrand, 'time-codes.json');
    if (fs.existsSync(timeCodesPath)) {
      const data: TimeCodesFile = JSON.parse(fs.readFileSync(timeCodesPath, 'utf8'));
      // Return all codes for syncing, or only active codes for display
      if (includeInactive) {
        return data.timeCodes;
      }
      return data.timeCodes.filter(tc => tc.is_active === 1);
    }
  } catch (error) {
    console.error(`Error reading time codes for brand ${targetBrand}:`, error);
  }
  return null;
}

/**
 * Get a specific time code by code string from brand JSON
 */
export function getBrandTimeCodeByCode(code: string, brand?: string): BrandTimeCode | null {
  const timeCodes = getBrandTimeCodes(brand);
  if (timeCodes) {
    return timeCodes.find(tc => tc.code === code) || null;
  }
  return null;
}

/**
 * Brand features structure
 */
export interface BrandFeatures {
  brandId: string;
  brandURI?: string;
  features: {
    leaveManagement?: {
      enabled: boolean;
      leaveTypes?: Record<string, { enabled: boolean }>;
    };
    approvalWorkflows?: { enabled: boolean };
    policyEnforcement?: { enabled: boolean };
    accrualCalculations?: {
      enabled: boolean;
      rules?: Record<string, AccrualRuleConfig>;
    };
  };
}

export interface AccrualRuleConfig {
  type: 'quarterly' | 'monthly' | 'annual' | 'hoursWorked' | 'tieredSeniority';
  hoursPerPeriod?: number;
  maxAnnual?: number;
  maxAccrual?: number;
  maxUsage?: {
    hours: number;
    days: number;
    rule: 'whicheverGreater' | 'whicheverLesser' | 'fixed';
  };
  period?: '12month' | 'calendarYear' | {
    type: string;
    startMonth?: number;
    startDay?: number;
    endMonth?: number;
    endDay?: number;
  };
  accrualRate?: {
    earnHours: number;
    perHoursWorked: number;
  };
  eligibility?: {
    waitPeriod?: {
      years?: number;
      months?: number;
      days?: number;
    };
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
  resetOnRehire?: boolean;
  accrualExclusions?: string[];
  hoursCountedBy?: {
    nonexempt: string[];
    exemptFullTime: { assumedWeeklyHours: number; condition: string };
    exemptPartTime: string;
  };
  quarters?: {
    Q1: { startMonth: number; startDay: number; endMonth: number; endDay: number };
    Q2: { startMonth: number; startDay: number; endMonth: number; endDay: number };
    Q3: { startMonth: number; startDay: number; endMonth: number; endDay: number };
    Q4: { startMonth: number; startDay: number; endMonth: number; endDay: number };
  };
  tiers?: Array<{
    minBaseYears: number;
    maxBaseYears: number | null;
    fullTime: { weeks: number; hours: number };
    partTime: { earnHours: number; perHoursWorked: number; maxHours: number };
  }>;
  notes?: {
    baseYearDefinition?: string;
    payoutRule?: string;
    terminationRule?: string;
  };
}

/**
 * Load brand features from brand-specific JSON file
 */
export function getBrandFeatures(brand?: string): BrandFeatures | null {
  const targetBrand = brand || getCurrentBrand();
  try {
    const featuresPath = path.join(process.cwd(), 'public', targetBrand, 'brand-features.json');
    if (fs.existsSync(featuresPath)) {
      const data: BrandFeatures = JSON.parse(fs.readFileSync(featuresPath, 'utf8'));
      return data;
    }
  } catch (error) {
    console.error(`Error reading brand features for ${targetBrand}:`, error);
  }
  return null;
}

/**
 * Get accrual rules for a specific time code
 */
export function getAccrualRuleForTimeCode(timeCode: string, brand?: string): AccrualRuleConfig | null {
  const features = getBrandFeatures(brand);
  if (features?.features?.accrualCalculations?.enabled && features?.features?.accrualCalculations?.rules) {
    return features.features.accrualCalculations.rules[timeCode] || null;
  }
  return null;
}
