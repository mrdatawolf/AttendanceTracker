/**
 * Employee-specific accrual rule overrides.
 *
 * Some employees (e.g. salaried staff with a vacation schedule negotiated
 * at hire) accrue time off under a rule that differs from the brand-wide
 * default for that time code. This stores a structured AccrualRule per
 * employee/time-code so it can be evaluated the same way as the brand rule
 * — and keeps producing correct numbers in future years — instead of
 * freezing a single year's balance as a static override would.
 *
 * Precedence at every call site: employee_time_allocations (flat manual
 * override) > employee_accrual_rules (this) > brand accrualCalculations
 * rule > time_codes.default_allocation.
 */
import { db } from './db-sqlite';
import type { AccrualRule } from './accrual-calculations';

export interface EmployeeAccrualRuleRow {
  id: number;
  employee_id: number;
  time_code: string;
  rule: AccrualRule;
  notes: string | null;
}

function parseRow(row: any): EmployeeAccrualRuleRow {
  return {
    id: row.id,
    employee_id: row.employee_id,
    time_code: row.time_code,
    rule: JSON.parse(row.rule_json),
    notes: row.notes ?? null,
  };
}

export async function getEmployeeAccrualRule(
  employeeId: number,
  timeCode: string
): Promise<EmployeeAccrualRuleRow | null> {
  const result = await db.execute({
    sql: `SELECT id, employee_id, time_code, rule_json, notes
          FROM employee_accrual_rules
          WHERE employee_id = ? AND time_code = ?`,
    args: [employeeId, timeCode],
  });
  return result.rows.length > 0 ? parseRow(result.rows[0]) : null;
}

export async function getEmployeeAccrualRules(employeeId: number): Promise<EmployeeAccrualRuleRow[]> {
  const result = await db.execute({
    sql: `SELECT id, employee_id, time_code, rule_json, notes
          FROM employee_accrual_rules
          WHERE employee_id = ?`,
    args: [employeeId],
  });
  return result.rows.map(parseRow);
}

/**
 * Bulk lookup for report endpoints that resolve balances for many
 * employees at once. Returns Map<employeeId, Map<timeCode, AccrualRule>>.
 */
export async function getEmployeeAccrualRulesForEmployees(
  employeeIds: number[]
): Promise<Map<number, Map<string, AccrualRule>>> {
  const map = new Map<number, Map<string, AccrualRule>>();
  if (employeeIds.length === 0) return map;

  const placeholders = employeeIds.map(() => '?').join(', ');
  const result = await db.execute({
    sql: `SELECT employee_id, time_code, rule_json
          FROM employee_accrual_rules
          WHERE employee_id IN (${placeholders})`,
    args: employeeIds,
  });

  for (const row of result.rows as unknown as Array<{ employee_id: number; time_code: string; rule_json: string }>) {
    if (!map.has(row.employee_id)) {
      map.set(row.employee_id, new Map());
    }
    map.get(row.employee_id)!.set(row.time_code, JSON.parse(row.rule_json));
  }

  return map;
}

export async function setEmployeeAccrualRule(
  employeeId: number,
  timeCode: string,
  rule: AccrualRule,
  notes?: string | null
): Promise<void> {
  const ruleJson = JSON.stringify(rule);
  await db.execute({
    sql: `INSERT INTO employee_accrual_rules (employee_id, time_code, rule_json, notes)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(employee_id, time_code)
          DO UPDATE SET rule_json = ?, notes = ?, updated_at = CURRENT_TIMESTAMP`,
    args: [employeeId, timeCode, ruleJson, notes ?? null, ruleJson, notes ?? null],
  });
}

export async function deleteEmployeeAccrualRule(employeeId: number, timeCode: string): Promise<void> {
  await db.execute({
    sql: `DELETE FROM employee_accrual_rules WHERE employee_id = ? AND time_code = ?`,
    args: [employeeId, timeCode],
  });
}
