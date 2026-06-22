"use client";

import { useState, useEffect } from 'react';
import { BalanceBreakdownModal } from './balance-breakdown-modal';
import { getBrandFeatures, getLeaveBalanceSummaryConfig, type LeaveTypeConfig } from '@/lib/brand-features';
import { useAuth } from '@/lib/auth-context';
import { formatDateStr } from '@/lib/date-helpers';

interface AttendanceEntry {
  entry_date: string;
  time_code: string;
  hours: number;
  notes?: string;
}

interface AccrualDetails {
  isEligible: boolean;
  eligibilityDate: string | null;
  accruedHours: number;
  maxHours: number;
  quartersEarned: number;
  quarterDetails: Array<{
    quarter: string;
    startDate: string;
    hours: number;
    earned: boolean;
  }>;
  nextAccrualDate: string | null;
  message: string;
  accrualType?: 'quarterly' | 'hoursWorked' | 'tieredSeniority' | 'annualGrant';
  hoursWorkedDetails?: {
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
    accruedRegardlessOfUsageGate: number;
    isUsable: boolean;
    usableFromDate: string | null;
  };
  tieredSeniorityDetails?: {
    baseYears: number;
    currentTier: {
      minBaseYears: number;
      maxBaseYears: number | null;
      fullTime: { weeks: number; hours: number };
      partTime: { earnHours: number; perHoursWorked: number; maxHours: number };
    };
    employeeType: 'fullTime' | 'partTime' | 'exempt' | 'pendingEligibility';
    periodStart: string;
    periodEnd: string;
    hoursThreshold: number;
    estimatedHoursWorked?: number;
    isFullTimeQualified: boolean;
    notes?: {
      baseYearDefinition?: string;
      payoutRule?: string;
      terminationRule?: string;
    };
  };
  annualGrantDetails?: {
    grantDate: string;
    isFirstEligibleYear: boolean;
    prorationBracket: string | null;
    unitsGranted: number;
    hoursPerUnit: number;
    benefitYearStart: string;
    benefitYearEnd: string;
  };
}

interface TimeAllocation {
  time_code: string;
  description: string;
  default_allocation: number | null;
  allocated_hours: number | null;
  is_override: boolean;
  is_accrual?: boolean;
  accrual_details?: AccrualDetails | null;
}

interface BalanceCardsProps {
  entries: AttendanceEntry[];
  allocations: TimeAllocation[];
  employeeId?: number;
}

interface ModalState {
  isOpen: boolean;
  timeCode: string;
  matchCodes?: string[];
  title: string;
  availableBalanceText?: string;
  annualUsageLimit?: number;
}

interface LeaveTypes {
  vacation?: LeaveTypeConfig;
  sickLeave?: LeaveTypeConfig;
  floatingHoliday?: LeaveTypeConfig;
  paidHoliday?: LeaveTypeConfig;
}

// Default leave types for backwards compatibility
const DEFAULT_LEAVE_TYPES: LeaveTypes = {
  vacation: { enabled: true, timeCode: 'V', label: 'Vacation Remaining' },
  sickLeave: { enabled: true, timeCode: 'PS', label: 'Personal Sick Day' },
  floatingHoliday: { enabled: true, timeCode: 'FH', label: 'Floating Holiday' },
  paidHoliday: { enabled: true, timeCode: 'H', label: 'Holiday' }
};

// Mapping of semantic colors to Tailwind classes
const COLOR_CLASS_MAP: Record<string, { card: string; progress: string }> = {
  blue: { card: 'bg-blue-50 border-blue-200', progress: 'bg-blue-500' },
  amber: { card: 'bg-amber-50 border-amber-200', progress: 'bg-amber-500' },
  red: { card: 'bg-red-50 border-red-200', progress: 'bg-red-500' },
  teal: { card: 'bg-teal-50 border-teal-200', progress: 'bg-teal-500' },
  purple: { card: 'bg-purple-50 border-purple-200', progress: 'bg-purple-500' },
  green: { card: 'bg-green-50 border-green-200', progress: 'bg-green-500' },
  gray: { card: 'bg-gray-50 border-gray-200', progress: 'bg-gray-500' },
};

interface StatusColors {
  warning: string;
  critical: string;
}

export function BalanceCards({ entries, allocations, employeeId }: BalanceCardsProps) {
  const { authFetch } = useAuth();
  const [modalState, setModalState] = useState<ModalState>({
    isOpen: false,
    timeCode: '',
    title: '',
  });
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypes>(DEFAULT_LEAVE_TYPES);
  const [benefitYearEntriesMap, setBenefitYearEntriesMap] = useState<Map<string, AttendanceEntry[]>>(new Map());
  const [leaveManagementEnabled, setLeaveManagementEnabled] = useState(true);
  const [activeTimeCodes, setActiveTimeCodes] = useState<Set<string>>(new Set());
  const [warningThreshold, setWarningThreshold] = useState(0.9);
  const [criticalThreshold, setCriticalThreshold] = useState(1.0);
  const [statusColors, setStatusColors] = useState<StatusColors>({ warning: 'amber', critical: 'red' });
  const [rawFeatureRules, setRawFeatureRules] = useState<Record<string, any>>({});
  // Maps primary time code → [primary, ...aliases] for counting legacy entries
  const [timeCodeAliases, setTimeCodeAliases] = useState<Map<string, string[]>>(new Map());

  // Load brand features and active time codes
  useEffect(() => {
    const loadFeatures = async () => {
      try {
        const features = await getBrandFeatures();

        if (features?.features?.leaveManagement) {
          setLeaveManagementEnabled(features.features.leaveManagement.enabled);
          const loadedLeaveTypes = features.features.leaveManagement.leaveTypes as LeaveTypes | undefined;
          if (loadedLeaveTypes) {
            setLeaveTypes(loadedLeaveTypes);
            const aliasMap = new Map<string, string[]>();
            for (const config of Object.values(loadedLeaveTypes)) {
              const tc = (config as LeaveTypeConfig).timeCode;
              const aliases = (config as LeaveTypeConfig).aliases;
              if (tc && aliases?.length) {
                aliasMap.set(tc, [tc, ...aliases]);
              }
            }
            setTimeCodeAliases(aliasMap);
          }
        }

        setRawFeatureRules((features?.features?.accrualCalculations?.rules as Record<string, any>) || {});

        // Load usage alert thresholds
        const reportConfig = getLeaveBalanceSummaryConfig(features);
        setWarningThreshold(reportConfig.warningThreshold);
        setCriticalThreshold(reportConfig.criticalThreshold);
      } catch (error) {
        console.error('Failed to load brand features:', error);
      }
    };

    const loadTimeCodes = async () => {
      try {
        const response = await authFetch('/api/time-codes');
        if (response.ok) {
          const timeCodes = await response.json();
          // Create a set of active time code strings
          const activeCodes = new Set<string>(
            timeCodes
              .filter((tc: { is_active: number }) => tc.is_active === 1)
              .map((tc: { code: string }) => tc.code)
          );
          setActiveTimeCodes(activeCodes);
        }
      } catch (error) {
        console.error('Failed to load time codes:', error);
      }
    };

    const loadColorConfig = async () => {
      try {
        const response = await authFetch('/api/color-config');
        if (response.ok) {
          const data = await response.json();
          // Extract status colors from color configs
          const warningConfig = data.colorConfigs?.find(
            (c: { config_type: string; config_key: string }) => c.config_type === 'status' && c.config_key === 'warning'
          );
          const criticalConfig = data.colorConfigs?.find(
            (c: { config_type: string; config_key: string }) => c.config_type === 'status' && c.config_key === 'critical'
          );
          setStatusColors({
            warning: warningConfig?.color_name || 'amber',
            critical: criticalConfig?.color_name || 'red',
          });
        }
      } catch (error) {
        console.error('Failed to load color config:', error);
      }
    };

    loadFeatures();
    loadTimeCodes();
    loadColorConfig();
  }, [authFetch]);

  // Fetch benefit-year-scoped entries for time codes whose benefit year crosses calendar year
  // boundaries (e.g. NFL VAC/FLH: June 1 – May 31). Reads the window from brand-features.json
  // accrual rules directly so it works even when accrual_details are absent (null hire date).
  useEffect(() => {
    if (!employeeId || Object.keys(rawFeatureRules).length === 0) return;

    const today = new Date();

    const computeWindow = (rule: Record<string, any>): { start: string; end: string } | null => {
      let sm: number, sd: number, em: number, ed: number;
      if (rule.type === 'tieredSeniority' && rule.period && typeof rule.period === 'object') {
        sm = rule.period.startMonth || 6; sd = rule.period.startDay || 1;
        em = rule.period.endMonth || 5; ed = rule.period.endDay || 31;
      } else if (rule.type === 'annualGrant' && rule.benefitYear) {
        sm = rule.benefitYear.startMonth || 6; sd = rule.benefitYear.startDay || 1;
        em = rule.benefitYear.endMonth || 5; ed = rule.benefitYear.endDay || 31;
      } else {
        return null;
      }
      const thisYearStart = new Date(today.getFullYear(), sm - 1, sd);
      const byStart = today >= thisYearStart
        ? thisYearStart
        : new Date(today.getFullYear() - 1, sm - 1, sd);
      const byEnd = today >= thisYearStart
        ? new Date(today.getFullYear() + 1, em - 1, ed)
        : new Date(today.getFullYear(), em - 1, ed);
      if (byStart.getFullYear() === byEnd.getFullYear()) return null;
      return { start: formatDateStr(byStart), end: formatDateStr(byEnd) };
    };

    const fetchBenefitYearEntries = async () => {
      const map = new Map<string, AttendanceEntry[]>();
      for (const leaveConfig of Object.values(leaveTypes)) {
        const config = leaveConfig as LeaveTypeConfig;
        if (!config?.timeCode) continue;
        const timeCode = config.timeCode;
        const rule = rawFeatureRules[timeCode];
        if (!rule) continue;
        const window = computeWindow(rule);
        if (!window) continue;
        try {
          const res = await authFetch(
            `/api/attendance?employeeId=${employeeId}&startDate=${window.start}&endDate=${window.end}`
          );
          if (res.ok) {
            const data = await res.json();
            map.set(timeCode, Array.isArray(data) ? data : []);
          }
        } catch (error) {
          console.error('Failed to fetch benefit year entries for', timeCode, error);
        }
      }
      if (map.size > 0) {
        setBenefitYearEntriesMap(map);
      }
    };

    fetchBenefitYearEntries();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId, authFetch, leaveTypes, rawFeatureRules, entries.length]);

  const openModal = (timeCode: string, title: string, availableBalanceText?: string, annualUsageLimit?: number) => {
    const matchCodes = timeCodeAliases.get(timeCode);
    setModalState({ isOpen: true, timeCode, matchCodes, title, availableBalanceText, annualUsageLimit });
  };

  const closeModal = () => {
    setModalState({ isOpen: false, timeCode: '', title: '' });
  };

  const calculateUsage = (code: string): number => {
    const sourceEntries = benefitYearEntriesMap.get(code) ?? entries;
    const matchCodes = timeCodeAliases.get(code) ?? [code];
    return sourceEntries
      .filter(e => matchCodes.includes(e.time_code))
      .reduce((sum, e) => sum + (e.hours || 0), 0);
  };

  const getAllocatedHours = (code: string): number => {
    const allocation = allocations.find(a => a.time_code === code);
    const hours = allocation?.allocated_hours ?? 0;
    return hours;
  };

  const getSelectedAllocation = () => {
    return allocations.find(a => a.time_code === modalState.timeCode) || null;
  };

  // Don't render if leave management is disabled
  if (!leaveManagementEnabled) {
    return null;
  }

  // Get color classes based on usage percentage
  const getUsageColorClasses = (used: number, limit: number): { card: string; progress: string } => {
    if (limit <= 0) return { card: '', progress: 'bg-primary' };

    const usagePercent = used / limit;

    if (usagePercent >= criticalThreshold) {
      const colors = COLOR_CLASS_MAP[statusColors.critical] || COLOR_CLASS_MAP.red;
      return colors;
    }
    if (usagePercent >= warningThreshold) {
      const colors = COLOR_CLASS_MAP[statusColors.warning] || COLOR_CLASS_MAP.amber;
      return colors;
    }
    return { card: '', progress: 'bg-primary' };
  };

  // Helper to render a balance card with usage tracking (shows remaining)
  const renderBalanceCard = (config: LeaveTypeConfig | undefined, key: string, defaultLabel: string) => {
    if (!config?.enabled || !config.timeCode) return null;
    // Also check if the time code is active in time-codes.json
    if (activeTimeCodes.size > 0 && !activeTimeCodes.has(config.timeCode)) return null;

    const timeCode = config.timeCode;
    const label = config.label || defaultLabel;
    const used = calculateUsage(timeCode);
    const limit = config.annualUsageLimit ?? getAllocatedHours(timeCode);
    const hasCustomBalanceText = !!config.availableBalanceText;
    const remaining = Math.max(0, limit - used);
    const colorClasses = getUsageColorClasses(used, limit);

    return (
      <div
        key={key}
        className={`flex-1 min-w-[150px] border rounded-lg p-2 cursor-pointer hover:opacity-80 transition-all ${colorClasses.card || 'bg-card'}`}
        onClick={() => openModal(timeCode, label, config.availableBalanceText, config.annualUsageLimit)}
        title="Click to see breakdown"
      >
        <div className="text-xs font-medium text-muted-foreground mb-0.5">
          Current {label}
        </div>
        <div className="text-lg font-bold">
          {hasCustomBalanceText ? config.availableBalanceText : `${remaining}h`}
        </div>
        {!hasCustomBalanceText && (
          <>
            <div className="text-xs text-muted-foreground mt-0.5">
              {used}h used / {limit}h total
            </div>
            <div className="mt-1 h-1 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${colorClasses.progress}`}
                style={{
                  width: `${limit > 0 ? Math.min((used / limit) * 100, 100) : 0}%`,
                }}
              />
            </div>
          </>
        )}
      </div>
    );
  };

  // Helper to render a usage-only card (no allocation tracking)
  const renderUsageCard = (config: LeaveTypeConfig | undefined, key: string, defaultLabel: string, subtitle: string) => {
    if (!config?.enabled || !config.timeCode) return null;
    // Also check if the time code is active in time-codes.json
    if (activeTimeCodes.size > 0 && !activeTimeCodes.has(config.timeCode)) return null;

    const timeCode = config.timeCode;
    const label = config.label || defaultLabel;
    const used = calculateUsage(timeCode);

    return (
      <div
        key={key}
        className="flex-1 min-w-[150px] border rounded-lg p-2 bg-card cursor-pointer hover:bg-accent/50 transition-colors"
        onClick={() => openModal(timeCode, label)}
        title="Click to see breakdown"
      >
        <div className="text-xs font-medium text-muted-foreground mb-0.5">
          Current {label} Used
        </div>
        <div className="text-lg font-bold">
          {used}h
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {subtitle}
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {renderBalanceCard(leaveTypes.floatingHoliday, 'floatingHoliday', 'Floating Holiday')}
        {renderBalanceCard(leaveTypes.sickLeave, 'sickLeave', 'Paid Sick Leave')}
        {renderBalanceCard(leaveTypes.vacation, 'vacation', 'Vacation Remaining')}
        {renderUsageCard(leaveTypes.paidHoliday, 'paidHoliday', 'Holiday', 'Total holiday hours this year')}
      </div>

      <BalanceBreakdownModal
        isOpen={modalState.isOpen}
        onClose={closeModal}
        timeCode={modalState.timeCode}
        matchCodes={modalState.matchCodes}
        title={modalState.title}
        entries={benefitYearEntriesMap.get(modalState.timeCode) ?? entries}
        allocation={getSelectedAllocation()}
        availableBalanceText={modalState.availableBalanceText}
        annualUsageLimit={modalState.annualUsageLimit}
      />
    </>
  );
}
