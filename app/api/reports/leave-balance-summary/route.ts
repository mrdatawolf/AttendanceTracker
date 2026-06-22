import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import { getUserReadableGroups, isSuperuser } from '@/lib/queries-auth';
import { db } from '@/lib/db-sqlite';
import { getBrandFeatures, getLeaveBalanceSummaryConfig, isGlobalReadAccessEnabled } from '@/lib/brand-features';
import { getBrandTimeCodes } from '@/lib/brand-time-codes';
import { calculateAccrual, type AccrualResult, type AccrualRule } from '@/lib/accrual-calculations';

// Force dynamic to prevent caching
export const dynamic = 'force-dynamic';

interface EmployeeBalance {
  timeCode: string;
  label: string;
  used: number;
  allocated: number | null;
  hasAllocation: boolean;
}

interface EmployeeRow {
  id: number;
  name: string;
  balances: EmployeeBalance[];
}

interface ColumnDef {
  timeCode: string;
  label: string;
  hasAllocation: boolean;
}

interface EnabledLeaveType {
  key: string;
  timeCode: string;
  label: string;
}

interface BalanceWindow {
  startDate: string;
  endDate: string;
  allocated: number | null;
  hasAllocation: boolean;
}

function toDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getReportAsOfDate(year: number): Date {
  const now = new Date();
  return year === now.getFullYear() ? now : new Date(year, 11, 31);
}

function getAccrualWindow(result: AccrualResult): { startDate: string; endDate: string } | null {
  const tiered = result.tieredSeniorityDetails;
  if (tiered) {
    return {
      startDate: toDateString(tiered.periodStart),
      endDate: toDateString(tiered.periodEnd),
    };
  }

  const annualGrant = result.annualGrantDetails;
  if (annualGrant) {
    return {
      startDate: toDateString(annualGrant.benefitYearStart),
      endDate: toDateString(annualGrant.benefitYearEnd),
    };
  }

  return null;
}

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get('year');
    const year = yearParam ? parseInt(yearParam) : new Date().getFullYear();

    // Get brand features for leave types and report config
    const brandFeatures = await getBrandFeatures();
    const reportConfig = getLeaveBalanceSummaryConfig(brandFeatures);

    if (!reportConfig.enabled) {
      return NextResponse.json(
        { error: 'Leave Balance Summary report is not enabled for this brand' },
        { status: 403 }
      );
    }

    // Get enabled leave types from brand features
    const leaveTypes = brandFeatures.features.leaveManagement.leaveTypes || {};
    const enabledLeaveTypes: EnabledLeaveType[] = Object.entries(leaveTypes)
      .filter(([, config]) => config.enabled && config.timeCode)
      .map(([key, config]) => ({
        key,
        timeCode: config.timeCode!,
        label: config.label || config.timeCode!,
      }));

    // Sort columns to match the attendance tab's timeCodeOrder
    const timeCodeOrder: string[] = brandFeatures.features.attendanceManagement?.timeCodeOrder ?? [];
    if (timeCodeOrder.length > 0) {
      enabledLeaveTypes.sort((a, b) => {
        const aIdx = timeCodeOrder.indexOf(a.timeCode);
        const bIdx = timeCodeOrder.indexOf(b.timeCode);
        const aOrder = aIdx === -1 ? timeCodeOrder.length : aIdx;
        const bOrder = bIdx === -1 ? timeCodeOrder.length : bIdx;
        return aOrder - bOrder;
      });
    }

    if (enabledLeaveTypes.length === 0) {
      return NextResponse.json({
        employees: [],
        columns: [],
        config: reportConfig,
      });
    }

    // Get brand time codes for default allocations
    const brandTimeCodes = getBrandTimeCodes() || [];
    const timeCodeDefaults = new Map(
      brandTimeCodes.map(tc => [tc.code, tc.default_allocation])
    );

    // Check if user is superuser or has global read access for permission filtering
    const userIsSuperuser = await isSuperuser(authUser.id)
      || authUser.group?.is_master === 1
      || authUser.group?.can_view_all === 1
      || authUser.role?.can_access_all_groups === 1;
    const globalRead = isGlobalReadAccessEnabled(brandFeatures);

    // Build employee query with permission filtering
    let employeeSql = `
      SELECT id, first_name, last_name, date_of_hire, rehire_date, employment_type
      FROM employees
      WHERE is_active = 1
    `;
    const employeeArgs: any[] = [];

    if (!userIsSuperuser && !globalRead) {
      const readableGroupIds = await getUserReadableGroups(authUser.id);
      if (authUser.group_id && !readableGroupIds.includes(authUser.group_id)) {
        readableGroupIds.push(authUser.group_id);
      }

      if (readableGroupIds.length > 0) {
        const placeholders = readableGroupIds.map(() => '?').join(', ');
        employeeSql += ` AND (group_id IS NULL OR group_id IN (${placeholders}))`;
        employeeArgs.push(...readableGroupIds);
      } else {
        employeeSql += ' AND group_id IS NULL';
      }
    }

    employeeSql += ' ORDER BY last_name, first_name';

    const employeesResult = await db.execute({
      sql: employeeSql,
      args: employeeArgs,
    });

    const employees = employeesResult.rows as unknown as Array<{
      id: number;
      first_name: string;
      last_name: string;
      date_of_hire: string | null;
      rehire_date: string | null;
      employment_type: 'full_time' | 'part_time' | null;
    }>;

    if (employees.length === 0) {
      return NextResponse.json({
        employees: [],
        columns: [],
        config: reportConfig,
      });
    }

    // Get all employee IDs for batch queries
    const employeeIds = employees.map(e => e.id);

    // Get allocations for all employees
    const allocPlaceholders = employeeIds.map(() => '?').join(', ');
    const allocationsResult = await db.execute({
      sql: `SELECT employee_id, time_code, allocated_hours
            FROM employee_time_allocations
            WHERE employee_id IN (${allocPlaceholders}) AND year = ?`,
      args: [...employeeIds, year],
    });

    // Build allocation lookup: Map<employeeId, Map<timeCode, hours>>
    const allocationsMap = new Map<number, Map<string, number>>();
    for (const row of allocationsResult.rows as unknown as Array<{
      employee_id: number;
      time_code: string;
      allocated_hours: number;
    }>) {
      if (!allocationsMap.has(row.employee_id)) {
        allocationsMap.set(row.employee_id, new Map());
      }
      allocationsMap.get(row.employee_id)!.set(row.time_code, row.allocated_hours);
    }

    const accrualConfig = brandFeatures.features.accrualCalculations as unknown as {
      enabled?: boolean;
      rules?: Record<string, AccrualRule>;
    };
    const accrualRules = accrualConfig?.enabled ? (accrualConfig.rules || {}) : {};
    const asOfDate = getReportAsOfDate(year);
    const calendarWindow = { startDate: `${year}-01-01`, endDate: `${year}-12-31` };

    const resolveBalanceWindow = (
      emp: { id: number; date_of_hire: string | null; rehire_date: string | null; employment_type: 'full_time' | 'part_time' | null },
      lt: EnabledLeaveType
    ): BalanceWindow => {
      const empAllocations = allocationsMap.get(emp.id) || new Map();
      const defaultAlloc = timeCodeDefaults.get(lt.timeCode);
      const accrualRule = accrualRules[lt.timeCode];

      if (accrualRule && emp.date_of_hire) {
        // Rules that reset on rehire (e.g. floating holiday) anchor to the
        // rehire date instead of the original hire date.
        const anchorDate = accrualRule.resetOnRehire && emp.rehire_date ? emp.rehire_date : emp.date_of_hire;
        const result = calculateAccrual(anchorDate, year, asOfDate, accrualRule, emp.employment_type ?? undefined);
        const accrualWindow = getAccrualWindow(result) || calendarWindow;
        return {
          ...accrualWindow,
          allocated: result.accruedHours,
          hasAllocation: true,
        };
      }

      const hasAllocation = defaultAlloc !== null && defaultAlloc !== undefined;
      return {
        ...calendarWindow,
        allocated: hasAllocation
          ? (empAllocations.has(lt.timeCode) ? empAllocations.get(lt.timeCode)! : (defaultAlloc ?? 0))
          : null,
        hasAllocation,
      };
    };

    // Determine which leave types have allocations (for column ordering)
    const leaveTypesWithAllocation = enabledLeaveTypes.filter(lt => {
      const defaultAlloc = timeCodeDefaults.get(lt.timeCode);
      return !!accrualRules[lt.timeCode] || (defaultAlloc !== null && defaultAlloc !== undefined);
    });
    const leaveTypesUsageOnly = enabledLeaveTypes.filter(lt => {
      const defaultAlloc = timeCodeDefaults.get(lt.timeCode);
      return !accrualRules[lt.timeCode] && (defaultAlloc === null || defaultAlloc === undefined);
    });

    // Order: allocation-based first, then usage-only
    const orderedLeaveTypes = [...leaveTypesWithAllocation, ...leaveTypesUsageOnly];

    // Build columns
    const columns: ColumnDef[] = orderedLeaveTypes.map(lt => ({
      timeCode: lt.timeCode,
      label: lt.label,
      hasAllocation: leaveTypesWithAllocation.some(a => a.timeCode === lt.timeCode),
    }));

    // Build employee rows with balances. Each employee/code resolves its own
    // usage window so June-May benefit-year policies are not forced into a
    // calendar-year report bucket.
    const employeeRows: EmployeeRow[] = await Promise.all(employees.map(async emp => {
      const balances: EmployeeBalance[] = await Promise.all(orderedLeaveTypes.map(async lt => {
        const window = resolveBalanceWindow(emp, lt);
        const usageResult = await db.execute({
          sql: `SELECT SUM(hours) AS total_hours
                FROM attendance_entries
                WHERE employee_id = ?
                  AND time_code = ?
                  AND entry_date >= ? AND entry_date <= ?`,
          args: [emp.id, lt.timeCode, window.startDate, window.endDate],
        });

        const used = Number((usageResult.rows[0] as any)?.total_hours || 0);

        return {
          timeCode: lt.timeCode,
          label: lt.label,
          used,
          allocated: window.allocated,
          hasAllocation: window.hasAllocation,
        };
      }));

      return {
        id: emp.id,
        name: `${emp.last_name}, ${emp.first_name}`,
        balances,
      };
    }));

    return NextResponse.json({
      employees: employeeRows,
      columns,
      config: {
        warningThreshold: reportConfig.warningThreshold,
        criticalThreshold: reportConfig.criticalThreshold,
      },
      year,
    });
  } catch (error) {
    console.error('Error fetching leave balance summary:', error);
    return NextResponse.json(
      { error: 'Failed to fetch leave balance summary' },
      { status: 500 }
    );
  }
}
