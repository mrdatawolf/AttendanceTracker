import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import { getUserReadableGroups, isSuperuser, getGroupById } from '@/lib/queries-auth';
import { db } from '@/lib/db-sqlite';
import { getBrandFeatures, isGlobalReadAccessEnabled } from '@/lib/brand-features';
import { getBrandTimeCodes } from '@/lib/brand-time-codes';
import { calculateAccrual, type AccrualRule } from '@/lib/accrual-calculations';

export const dynamic = 'force-dynamic';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Salaried employees get a calculated PSL balance instead of "Check ADP" — see
// is_salaried_psl on the employees table and Phase NFL-3.
function getSpecialAvailability(brandFeatures: any, isSalariedPsl: boolean): Record<string, { text: string; usageLimit: number | null }> {
  const result: Record<string, { text: string; usageLimit: number | null }> = {};
  const leaveTypes = brandFeatures?.features?.leaveManagement?.leaveTypes;
  if (!leaveTypes) return result;

  for (const [key, config] of Object.entries(leaveTypes) as [string, any][]) {
    if (key === 'sickLeave' && isSalariedPsl) continue;
    if (config?.enabled && config?.timeCode && config?.availableBalanceText) {
      result[config.timeCode] = {
        text: config.availableBalanceText,
        usageLimit: config.annualUsageLimit ?? null,
      };
    }
  }
  return result;
}

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!employeeId || employeeId === 'all') {
      return NextResponse.json({ error: 'A specific employee must be selected' }, { status: 400 });
    }
    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'Start date and end date are required' }, { status: 400 });
    }

    const empId = parseInt(employeeId);

    // Permission check
    const userIsSuperuser = await isSuperuser(authUser.id)
      || authUser.group?.is_master === 1
      || authUser.group?.can_view_all === 1
      || authUser.role?.can_access_all_groups === 1;
    const brandFeatures = await getBrandFeatures();
    const globalRead = isGlobalReadAccessEnabled(brandFeatures);

    // Get employee details
    const empResult = await db.execute({
      sql: 'SELECT id, first_name, last_name, group_id, date_of_hire, rehire_date, employment_type, is_salaried_psl FROM employees WHERE id = ? AND is_active = 1',
      args: [empId],
    });
    const employee = empResult.rows[0] as unknown as {
      id: number;
      first_name: string;
      last_name: string;
      group_id: number | null;
      date_of_hire: string | null;
      rehire_date: string | null;
      employment_type: 'full_time' | 'part_time' | null;
      is_salaried_psl: number | null;
    } | undefined;

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    // Check permission: user must be able to see this employee
    if (!userIsSuperuser && !globalRead) {
      const readableGroupIds = await getUserReadableGroups(authUser.id);
      if (authUser.group_id && !readableGroupIds.includes(authUser.group_id)) {
        readableGroupIds.push(authUser.group_id);
      }
      if (employee.group_id && !readableGroupIds.includes(employee.group_id)) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    const brandTimeCodes = getBrandTimeCodes() || [];
    const activeTimeCodes = brandTimeCodes.filter(tc => tc.is_active === 1);

    const timeCodeOrder = brandFeatures.features.attendanceManagement?.timeCodeOrder;
    if (timeCodeOrder && timeCodeOrder.length > 0) {
      activeTimeCodes.sort((a, b) => {
        const aIdx = timeCodeOrder.indexOf(a.code);
        const bIdx = timeCodeOrder.indexOf(b.code);
        const aOrder = aIdx === -1 ? timeCodeOrder.length : aIdx;
        const bOrder = bIdx === -1 ? timeCodeOrder.length : bIdx;
        return aOrder - bOrder;
      });
    }

    // Parallelize independent queries
    const year = new Date(startDate).getFullYear();
    const [groupResult, allocResult, entriesResult] = await Promise.all([
      employee.group_id ? getGroupById(employee.group_id) : Promise.resolve(null),
      db.execute({
        sql: 'SELECT time_code, allocated_hours FROM employee_time_allocations WHERE employee_id = ? AND year = ?',
        args: [empId, year],
      }),
      db.execute({
        sql: `
          SELECT te.entry_date, te.time_code, te.hours, te.notes
          FROM attendance_entries te
          WHERE te.employee_id = ? AND te.entry_date >= ? AND te.entry_date <= ?
          ORDER BY te.entry_date
        `,
        args: [empId, startDate, endDate],
      }),
    ]);

    const department = groupResult?.name || 'Unassigned';

    const allocOverrides = new Map<string, number>();
    for (const row of allocResult.rows as unknown as Array<{ time_code: string; allocated_hours: number }>) {
      allocOverrides.set(row.time_code, row.allocated_hours);
    }

    // Resolve allocations: overrides > accrual rules > default_allocation
    const accrualCalc = brandFeatures?.features?.accrualCalculations as any;
    const accrualRules = accrualCalc?.enabled ? (accrualCalc.rules || {}) : {};
    const allocations = new Map<string, number>();
    const asOfDate = new Date();
    for (const tc of activeTimeCodes) {
      if (allocOverrides.has(tc.code)) {
        allocations.set(tc.code, allocOverrides.get(tc.code)!);
        continue;
      }
      const accrualRule = accrualRules[tc.code];
      if (accrualRule && employee.date_of_hire) {
        // Rules that reset on rehire (e.g. floating holiday) anchor to the
        // rehire date instead of the original hire date.
        const anchorDate = (accrualRule as AccrualRule).resetOnRehire && employee.rehire_date
          ? employee.rehire_date
          : employee.date_of_hire;
        const result = calculateAccrual(anchorDate, year, asOfDate, accrualRule as AccrualRule, employee.employment_type ?? undefined);
        allocations.set(tc.code, result.accruedHours);
      }
    }
    const entries = entriesResult.rows as unknown as Array<{
      entry_date: string;
      time_code: string;
      hours: number;
      notes: string | null;
    }>;

    // Build summary: for each brand time code, count entries and sum hours
    const summaryMap = new Map<string, { days: number; hoursUsed: number }>();
    for (const tc of activeTimeCodes) {
      summaryMap.set(tc.code, { days: 0, hoursUsed: 0 });
    }
    for (const entry of entries) {
      const existing = summaryMap.get(entry.time_code);
      if (existing) {
        existing.days += 1;
        existing.hoursUsed += entry.hours;
      }
    }

    const specialAvailability = getSpecialAvailability(brandFeatures, !!employee.is_salaried_psl);

    const summary = activeTimeCodes.map(tc => {
      const stats = summaryMap.get(tc.code) || { days: 0, hoursUsed: 0 };

      // Determine hours available
      let hoursAvail: number | string | null = null;
      const special = specialAvailability[tc.code];
      if (special) {
        hoursAvail = special.text;
      } else if (allocations.has(tc.code)) {
        hoursAvail = allocations.get(tc.code)!;
      } else if (tc.default_allocation != null) {
        hoursAvail = tc.default_allocation;
      }

      return {
        timeCode: tc.code,
        description: tc.description,
        days: stats.days,
        hoursUsed: stats.hoursUsed,
        hoursAvail,
        usageLimit: special?.usageLimit ?? null,
      };
    });

    // Build day-of-week breakdown
    const dayOfWeekBreakdown: Record<string, number> = {
      Monday: 0,
      Tuesday: 0,
      Wednesday: 0,
      Thursday: 0,
      Friday: 0,
      Saturday: 0,
      Sunday: 0,
    };
    for (const entry of entries) {
      const date = new Date(entry.entry_date + 'T00:00:00');
      const dayName = DAY_NAMES[date.getDay()];
      dayOfWeekBreakdown[dayName] += 1;
    }

    const tcDescriptions = new Map<string, string>();
    for (const tc of activeTimeCodes) {
      tcDescriptions.set(tc.code, tc.description);
    }

    const details = entries.map(entry => {
      const date = new Date(entry.entry_date + 'T00:00:00');
      return {
        date: entry.entry_date,
        dayOfWeek: DAY_NAMES[date.getDay()],
        type: tcDescriptions.get(entry.time_code) || entry.time_code,
        time: entry.hours,
        reasonGiven: entry.notes || '',
      };
    });

    return NextResponse.json({
      header: {
        employeeName: `${employee.last_name}, ${employee.first_name}`,
        department,
        startDate,
        endDate,
      },
      summary,
      dayOfWeekBreakdown,
      details,
    });
  } catch (error) {
    console.error('Error fetching attendance management report:', error);
    return NextResponse.json({ error: 'Failed to fetch report data' }, { status: 500 });
  }
}
