import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import { getUserReadableGroups, isSuperuser, getAllGroups } from '@/lib/queries-auth';
import { db } from '@/lib/db-sqlite';
import { getBrandFeatures, isGlobalReadAccessEnabled } from '@/lib/brand-features';
import { getBrandTimeCodeByCode, getAccrualRuleForTimeCode } from '@/lib/brand-time-codes';
import { calculateAccrual, explainAccrualResult, renderFormulaBreakdown, type AccrualRule } from '@/lib/accrual-calculations';
import { getEmployeeAccrualRulesForEmployees } from '@/lib/employee-accrual-rules';

// Force dynamic to prevent caching — this depends on "today" (rolling
// tenure tiers advance on the day they're crossed, not on a fixed date).
export const dynamic = 'force-dynamic';

const VAC_TIME_CODE = 'VAC';

interface VacationRow {
  id: number;
  name: string;
  job_title: string | null;
  group_name: string | null;
  employment_type: string | null;
  date_of_hire: string | null;
  vacation_hours: number | null;
  vacation_days: number | null;
  basis: 'override' | 'employee_rule' | 'brand_rule' | 'default' | 'none';
  explanation: string;
  formula_breakdown: string | null;
}

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get('year');
    const year = yearParam ? parseInt(yearParam) : new Date().getFullYear();
    const asOfDate = new Date();

    const brandFeatures = await getBrandFeatures();

    // Permission filtering — same rule as the other employee-scoped reports.
    const userIsSuperuser = await isSuperuser(authUser.id)
      || authUser.group?.is_master === 1
      || authUser.group?.can_view_all === 1
      || authUser.role?.can_access_all_groups === 1;
    const globalRead = isGlobalReadAccessEnabled(brandFeatures);

    let employeeSql = `
      SELECT id, first_name, last_name, role, group_id,
             date_of_hire, rehire_date, employment_type
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

    const employeesResult = await db.execute({ sql: employeeSql, args: employeeArgs });
    const employees = employeesResult.rows as unknown as Array<{
      id: number;
      first_name: string;
      last_name: string;
      role: string | null;
      group_id: number | null;
      date_of_hire: string | null;
      rehire_date: string | null;
      employment_type: 'full_time' | 'part_time' | null;
    }>;

    if (employees.length === 0) {
      return NextResponse.json({ year, employees: [] as VacationRow[] });
    }

    const employeeIds = employees.map(e => e.id);
    const placeholders = employeeIds.map(() => '?').join(', ');

    const [groups, overridesResult, employeeAccrualRulesMap] = await Promise.all([
      getAllGroups(),
      db.execute({
        sql: `SELECT employee_id, allocated_hours, notes FROM employee_time_allocations
              WHERE employee_id IN (${placeholders}) AND time_code = ? AND year = ?`,
        args: [...employeeIds, VAC_TIME_CODE, year],
      }),
      getEmployeeAccrualRulesForEmployees(employeeIds),
    ]);

    const groupNameMap = new Map(groups.map(g => [g.id, g.name]));
    const overrideMap = new Map(
      (overridesResult.rows as unknown as Array<{ employee_id: number; allocated_hours: number; notes: string | null }>)
        .map(r => [r.employee_id, r])
    );

    const brandRule = getAccrualRuleForTimeCode(VAC_TIME_CODE) as AccrualRule | null;
    const defaultAllocation = getBrandTimeCodeByCode(VAC_TIME_CODE)?.default_allocation ?? null;

    const rows: VacationRow[] = employees.map(emp => {
      const name = `${emp.last_name}, ${emp.first_name}`;
      const jobTitle = emp.role || null;
      const groupName = emp.group_id ? groupNameMap.get(emp.group_id) || null : null;

      const base = {
        id: emp.id,
        name,
        job_title: jobTitle,
        group_name: groupName,
        employment_type: emp.employment_type,
        date_of_hire: emp.date_of_hire,
      };

      const override = overrideMap.get(emp.id);
      if (override) {
        return {
          ...base,
          vacation_hours: override.allocated_hours,
          vacation_days: override.allocated_hours / 8,
          basis: 'override',
          explanation: override.notes
            ? `Manually set to ${override.allocated_hours}h — not calculated from a formula. Notes: ${override.notes}`
            : `Manually set to ${override.allocated_hours}h — not calculated from a formula.`,
          formula_breakdown: null,
        };
      }

      const employeeRuleEntry = employeeAccrualRulesMap.get(emp.id)?.get(VAC_TIME_CODE);
      const employeeRule = employeeRuleEntry?.rule;
      const rule = employeeRule || brandRule;

      if (rule && emp.date_of_hire) {
        const anchorDate = rule.resetOnRehire && emp.rehire_date ? emp.rehire_date : emp.date_of_hire;
        const result = calculateAccrual(anchorDate, year, asOfDate, rule, emp.employment_type ?? undefined);
        // Note: employeeRuleEntry.notes (e.g. an assumption behind an
        // inferred tier boundary) is deliberately NOT included here — it's
        // an internal caveat for whoever maintains this rule, not something
        // to show end users. It's still visible in the DB row and in
        // lib/__tests__/nfl-salaried-vacation.test.ts.
        const explanation = explainAccrualResult(rule, result);
        // Formula breakdown is only ever populated for individually
        // negotiated rules — the brand-wide hourly tier was never
        // transcribed from a literal spreadsheet formula, so it has no
        // formulaTemplate and this will naturally be null for those rows.
        const formulaBreakdown = renderFormulaBreakdown(rule, new Date(anchorDate), asOfDate, result.accruedHours);
        return {
          ...base,
          vacation_hours: result.accruedHours,
          vacation_days: result.accruedHours / 8,
          basis: (employeeRule ? 'employee_rule' : 'brand_rule') as VacationRow['basis'],
          explanation,
          formula_breakdown: formulaBreakdown,
        };
      }

      if (rule && !emp.date_of_hire) {
        return {
          ...base,
          vacation_hours: null,
          vacation_days: null,
          basis: 'none',
          explanation: 'No hire date on file for this employee — vacation cannot be calculated until one is added.',
          formula_breakdown: null,
        };
      }

      if (defaultAllocation !== null && defaultAllocation !== undefined) {
        return {
          ...base,
          vacation_hours: defaultAllocation,
          vacation_days: defaultAllocation / 8,
          basis: 'default',
          explanation: `Flat ${defaultAllocation}h allocation applied to everyone — no formula, no accrual.`,
          formula_breakdown: null,
        };
      }

      return {
        ...base,
        vacation_hours: null,
        vacation_days: null,
        basis: 'none',
        explanation: 'No vacation allocation is configured for this brand.',
        formula_breakdown: null,
      };
    });

    return NextResponse.json({ year, employees: rows });
  } catch (error) {
    console.error('Error building vacation transparency report:', error);
    return NextResponse.json({ error: 'Failed to build vacation transparency report' }, { status: 500 });
  }
}
