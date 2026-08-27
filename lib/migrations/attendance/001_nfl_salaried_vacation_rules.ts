import { Client } from '@libsql/client';
import type { AccrualRule } from '../../accrual-calculations';

/**
 * Seeds individually negotiated VAC accrual rules for 16 NFL salaried
 * employees, decoded from a customer-supplied spreadsheet of per-employee
 * Excel formulas (5 distinct formula shapes across the 16 people).
 *
 * ASSUMPTION, not confirmed by the customer: years of service is measured
 * on a rolling basis off each employee's own hire-date anniversary, not
 * pinned to the Jun 1 benefit-year boundary the brand's hourly VAC rule
 * uses. This was inferred by testing the spreadsheet's formulas against
 * real hire dates — anchoring to Jun 1 put McCaslin one tier low versus
 * his spreadsheet balance; anchoring to "today" matched all 16 exactly.
 * See lib/__tests__/nfl-salaried-vacation.test.ts for the verification.
 *
 * Runs once (tracked in the migrations table). Only included in the
 * migration list for the NFL brand — see lib/migrations/attendance/migrations.ts.
 * Employees are matched by id AND last_name together — if an id exists but
 * the name doesn't match what this migration expects, that row is skipped
 * and logged rather than silently assigning the wrong person's vacation
 * terms. Uses INSERT OR IGNORE so it never overwrites a rule an admin may
 * have already set by hand for one of these employees.
 */

const GENERAL_NOTE =
  'Individually negotiated at hire; years of service measured on a rolling basis ' +
  'off the hire-date anniversary (not the Jun 1 benefit-year boundary hourly VAC uses) ' +
  '— inferred from the customer\'s spreadsheet, not yet confirmed. See lib/__tests__/nfl-salaried-vacation.test.ts.';

const GROUP_A: AccrualRule = {
  type: 'tenureTiers',
  tenureTiers: [
    { minYears: 0, maxYears: 4, hours: 80 },
    { minYears: 5, maxYears: 8, hours: 120 },
    { minYears: 9, maxYears: 15, hours: 160 },
    { minYears: 16, maxYears: null, hours: 200 },
  ],
};

const GROUP_B: AccrualRule = {
  type: 'tenureTiers',
  tenureTiers: [
    { minYears: 0, maxYears: 7, hours: 120 },
    { minYears: 8, maxYears: 15, hours: 160 },
    { minYears: 16, maxYears: null, hours: 200 },
  ],
};

const GROUP_C: AccrualRule = {
  type: 'tenureTiers',
  tenureTiers: [
    { minYears: 0, maxYears: 15, hours: 160 },
    { minYears: 16, maxYears: null, hours: 200 },
  ],
};

const GROUP_D_DORVAL: AccrualRule = {
  type: 'tenureTiers',
  tenureTiers: [
    { minYears: 0, maxYears: 10, hours: 160 },
    { minYears: 11, maxYears: null, hours: 200 },
  ],
};

const GROUP_E: AccrualRule = {
  type: 'tenureTiers',
  tenureTiers: [
    { minYears: 0, maxYears: null, hours: 200 },
  ],
};

// IDs and spellings matched against the dev copy of the production
// database. Two names differ from the customer's original spreadsheet
// spelling: "Dorval" not "Dorvall", "McCaslin" not "McCasslin".
const ASSIGNMENTS: Array<{ id: number; lastName: string; firstName: string; rule: AccrualRule; extraNote?: string }> = [
  { id: 123, lastName: 'Bartley', firstName: 'Jason', rule: GROUP_A },
  { id: 142, lastName: 'Dorval', firstName: 'Russell', rule: GROUP_D_DORVAL, extraNote:
    'Original formula used a non-round 10.167-year threshold (likely a fractional years-of-service ' +
    'column, e.g. 10 years + ~2 months). Approximated here as 11 whole years — the smallest integer ' +
    'that reproduces the same >10.167 result under this system\'s whole-year granularity. If the true ' +
    'intent is closer to 10y2m, his bump to 200h could land up to ~10 months earlier than this models. ' +
    'Confirm with the customer before he approaches 10 years of service (~2028-04-02).' },
  { id: 125, lastName: 'Dunn', firstName: 'Kenneth', rule: GROUP_E },
  { id: 121, lastName: 'Gann', firstName: 'Jordan', rule: GROUP_A },
  { id: 120, lastName: 'Gregorio', firstName: 'Jamie', rule: GROUP_C },
  { id: 126, lastName: 'Hall', firstName: 'Joseph', rule: GROUP_E },
  { id: 115, lastName: 'Harper', firstName: 'Dale', rule: GROUP_B },
  { id: 128, lastName: 'Hollister', firstName: 'Victor', rule: GROUP_A },
  { id: 143, lastName: 'Kates-McConnell', firstName: 'Logan', rule: GROUP_A },
  { id: 124, lastName: 'Landen', firstName: 'Ry', rule: GROUP_A },
  { id: 117, lastName: 'Maciel', firstName: 'Michael', rule: GROUP_C },
  { id: 122, lastName: 'McCaslin', firstName: 'Zachary', rule: GROUP_B },
  { id: 119, lastName: 'Nissen', firstName: 'Brian', rule: GROUP_B },
  { id: 118, lastName: 'Tejeda', firstName: 'Salvador', rule: GROUP_A },
  { id: 116, lastName: 'Tostie', firstName: 'Shane', rule: GROUP_C },
  { id: 3, lastName: 'Young', firstName: 'Leandra', rule: GROUP_A },
];

export const migration = {
  name: 'nfl_salaried_vacation_rules',
  description: 'Seed individually negotiated VAC accrual rules for 16 NFL salaried employees',
  up: async (db: Client) => {
    let applied = 0;
    let skipped = 0;
    for (const a of ASSIGNMENTS) {
      const empResult = await db.execute({
        sql: 'SELECT last_name FROM employees WHERE id = ?',
        args: [a.id],
      });
      const row = empResult.rows[0] as unknown as { last_name: string } | undefined;

      if (!row) {
        console.warn(`  ⚠ employee id ${a.id} (expected ${a.lastName}, ${a.firstName}) not found — skipping`);
        skipped++;
        continue;
      }
      if (row.last_name !== a.lastName) {
        console.warn(
          `  ⚠ employee id ${a.id} last_name is "${row.last_name}", expected "${a.lastName}" — ` +
          `skipping to avoid assigning the wrong person's vacation rule`
        );
        skipped++;
        continue;
      }

      const notes = a.extraNote ? `${GENERAL_NOTE} ${a.extraNote}` : GENERAL_NOTE;
      await db.execute({
        sql: `INSERT OR IGNORE INTO employee_accrual_rules (employee_id, time_code, rule_json, notes)
              VALUES (?, 'VAC', ?, ?)`,
        args: [a.id, JSON.stringify(a.rule), notes],
      });
      applied++;
    }

    console.log(`  ✓ Applied ${applied} salaried VAC accrual rule(s)${skipped ? `, skipped ${skipped} (id/name mismatch — verify manually)` : ''}`);
  },
  down: async () => {
    console.log('Rollback: NFL salaried vacation rules will not be deleted automatically, to avoid discarding manual edits made since seeding.');
  },
};
