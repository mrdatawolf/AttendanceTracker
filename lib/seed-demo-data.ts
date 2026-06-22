/**
 * Demo Data Seeding Module
 *
 * This module is bundled with the standalone build and can be imported
 * from db-sqlite.ts for demo mode initialization. It is also the single
 * source of truth used by scripts/seed-demo.ts.
 *
 * Seeds the database with demo data for presentations:
 * - Employees with varied hire dates, employment types, and roles
 * - A year's worth of attendance entries that exercise every leave
 *   balance state (normal / warning / critical) plus usage-only codes
 * - A manual leave allocation override (HR granting extra sick time)
 * - Office presence so the "who's out" widget has data on first launch
 * - Break entries (compliant + override) for the break compliance report
 * - Demo logins for the manager, HR, and employee roles in addition to admin
 */

import { db, initializeDatabase } from './db-sqlite';
import { authDb, ensureAuthInitialized } from './db-auth';
import bcrypt from 'bcryptjs';

// Helper to get dates relative to today
function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
}

function monthsAgo(months: number): string {
  const date = new Date();
  date.setMonth(date.getMonth() - months);
  return date.toISOString().split('T')[0];
}

function yearsAgo(years: number, monthOffset = 0): string {
  const date = new Date();
  date.setFullYear(date.getFullYear() - years);
  date.setMonth(date.getMonth() + monthOffset);
  return date.toISOString().split('T')[0];
}

/**
 * Walk backwards from `startDaysAgo` days ago, collecting `count` weekday
 * (Mon-Fri) dates. Used to build realistic multi-day leave blocks.
 */
function weekdayDatesAgo(startDaysAgo: number, count: number): string[] {
  const dates: string[] = [];
  let offset = startDaysAgo;
  while (dates.length < count) {
    const date = new Date();
    date.setDate(date.getDate() - offset);
    const dayOfWeek = date.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      dates.push(date.toISOString().split('T')[0]);
    }
    offset++;
  }
  return dates;
}

interface AttendanceSeedEntry {
  empNum: string;
  date: string;
  code: string;
  hours: number;
  notes: string;
}

function range(empNum: string, code: string, startDaysAgo: number, count: number, hoursPerDay: number, notes: string): AttendanceSeedEntry[] {
  return weekdayDatesAgo(startDaysAgo, count).map(date => ({ empNum, date, code, hours: hoursPerDay, notes }));
}

function single(empNum: string, code: string, daysBack: number, hours: number, notes: string): AttendanceSeedEntry {
  return { empNum, date: daysAgo(daysBack), code, hours, notes };
}

export async function seedDemoData() {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                   SEEDING DEMO DATA                        ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');

  try {
    // Make sure the schema (and default time codes) exist before we seed.
    await initializeDatabase();

    // Demo employees with varied profiles
    const employees = [
      // Long-tenured employees (for seniority demo)
      {
        number: 'DEMO001',
        first: 'Robert',
        last: 'Anderson',
        email: 'robert.anderson@demo.com',
        role: 'employee',
        group_id: 4, // Employees
        date_of_hire: yearsAgo(8, 3), // 8+ years - most senior
        rehire_date: null,
        employment_type: 'full_time',
        seniority_rank: null,
      },
      {
        number: 'DEMO002',
        first: 'Patricia',
        last: 'Williams',
        email: 'patricia.williams@demo.com',
        role: 'manager',
        group_id: 2, // Managers
        date_of_hire: yearsAgo(6), // 6 years
        rehire_date: null,
        employment_type: 'full_time',
        seniority_rank: null,
      },
      // Same hire date with seniority tiebreaker demo
      {
        number: 'DEMO003',
        first: 'James',
        last: 'Miller',
        email: 'james.miller@demo.com',
        role: 'employee',
        group_id: 4,
        date_of_hire: yearsAgo(3), // Same as DEMO004
        rehire_date: null,
        employment_type: 'full_time',
        seniority_rank: 5, // More senior due to rank
      },
      {
        number: 'DEMO004',
        first: 'Jennifer',
        last: 'Davis',
        email: 'jennifer.davis@demo.com',
        role: 'employee',
        group_id: 4,
        date_of_hire: yearsAgo(3), // Same as DEMO003
        rehire_date: null,
        employment_type: 'full_time',
        seniority_rank: 2, // Less senior due to rank
      },
      // Rehired employee demo
      {
        number: 'DEMO005',
        first: 'Michael',
        last: 'Johnson',
        email: 'michael.johnson@demo.com',
        role: 'employee',
        group_id: 4,
        date_of_hire: yearsAgo(7), // Originally hired 7 years ago
        rehire_date: yearsAgo(1), // But rehired 1 year ago
        employment_type: 'full_time',
        seniority_rank: 3,
      },
      // Part-time employees
      {
        number: 'DEMO006',
        first: 'Sarah',
        last: 'Martinez',
        email: 'sarah.martinez@demo.com',
        role: 'employee',
        group_id: 4,
        date_of_hire: yearsAgo(2),
        rehire_date: null,
        employment_type: 'part_time',
        seniority_rank: null,
      },
      {
        number: 'DEMO007',
        first: 'David',
        last: 'Garcia',
        email: 'david.garcia@demo.com',
        role: 'employee',
        group_id: 4,
        date_of_hire: monthsAgo(8),
        rehire_date: null,
        employment_type: 'part_time',
        seniority_rank: null,
      },
      // HR specialist
      {
        number: 'DEMO008',
        first: 'Lisa',
        last: 'Thompson',
        email: 'lisa.thompson@demo.com',
        role: 'hr_specialist',
        group_id: 3, // HR
        date_of_hire: yearsAgo(4),
        rehire_date: null,
        employment_type: 'full_time',
        seniority_rank: null,
      },
      // Recent hires
      {
        number: 'DEMO009',
        first: 'Christopher',
        last: 'Brown',
        email: 'christopher.brown@demo.com',
        role: 'employee',
        group_id: 4,
        date_of_hire: monthsAgo(3),
        rehire_date: null,
        employment_type: 'full_time',
        seniority_rank: null,
      },
      {
        number: 'DEMO010',
        first: 'Amanda',
        last: 'Wilson',
        email: 'amanda.wilson@demo.com',
        role: 'employee',
        group_id: 4,
        date_of_hire: monthsAgo(1),
        rehire_date: null,
        employment_type: 'full_time',
        seniority_rank: null,
      },
    ];

    console.log('Creating demo employees...');
    const employeeIds: { [key: string]: number } = {};

    for (const emp of employees) {
      try {
        const result = await db.execute({
          sql: `INSERT INTO employees (
            employee_number, first_name, last_name, email, role, group_id,
            date_of_hire, rehire_date, employment_type, seniority_rank,
            created_by, is_active
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            emp.number,
            emp.first,
            emp.last,
            emp.email,
            emp.role,
            emp.group_id,
            emp.date_of_hire,
            emp.rehire_date,
            emp.employment_type,
            emp.seniority_rank,
            1, // Created by admin
            1, // Active
          ],
        });
        employeeIds[emp.number] = Number(result.lastInsertRowid);
        console.log(`  ✓ ${emp.first} ${emp.last} (${emp.number}) - ${emp.employment_type}`);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        if (errorMessage.includes('UNIQUE constraint failed')) {
          console.log(`  ⊘ ${emp.first} ${emp.last} already exists`);
          // Get existing employee ID
          const existing = await db.execute({
            sql: 'SELECT id FROM employees WHERE employee_number = ?',
            args: [emp.number],
          });
          if (existing.rows.length > 0) {
            employeeIds[emp.number] = Number((existing.rows[0] as unknown as { id: number }).id);
          }
        } else {
          throw error;
        }
      }
    }

    // Get time code IDs
    const timeCodesResult = await db.execute('SELECT id, code FROM time_codes');
    const timeCodes: { [key: string]: number } = {};
    for (const row of timeCodesResult.rows as unknown as { id: number; code: string }[]) {
      timeCodes[row.code] = row.id;
    }

    // Attendance entries spanning the last several months. Hours are tuned so
    // the Leave Balance Summary report shows a mix of normal, warning (>=90%)
    // and critical (>=100%) states against the brand's default allocations
    // (V: 80h, FH: 24h, PS: 40h, B: 24h).
    console.log('');
    console.log('Creating demo attendance entries...');

    const attendanceEntries: AttendanceSeedEntry[] = [
      // Robert Anderson (most senior, full-time) - Vacation near limit (90% of 80h -> warning)
      ...range('DEMO001', 'V', 70, 5, 8, 'Summer vacation'),
      ...range('DEMO001', 'V', 21, 4, 8, 'Long weekend getaway'),
      single('DEMO001', 'H', 14, 8, 'Memorial Day'),

      // Patricia Williams (manager) - moderate usage across several leave types
      ...range('DEMO002', 'V', 42, 4, 8, 'Family trip'),
      single('DEMO002', 'H', 35, 8, 'Worked Memorial Day - covered for team'),
      single('DEMO002', 'FH', 10, 8, 'Floating holiday - personal day'),
      single('DEMO002', 'P', 5, 8, "Doctor's appointment"),

      // James Miller - Personal Sick Day fully used (100% of 40h -> critical)
      ...range('DEMO003', 'PS', 60, 3, 8, 'Out sick with the flu'),
      ...range('DEMO003', 'PS', 15, 2, 8, 'Follow-up sick day'),
      ...range('DEMO003', 'V', 90, 3, 8, 'Spring break'),

      // Jennifer Davis - Floating holidays fully used (100% of 24h -> critical)
      ...range('DEMO004', 'FH', 7, 3, 8, 'Used remaining floating holidays'),
      ...range('DEMO004', 'V', 45, 2, 8, 'Long weekend'),
      single('DEMO004', 'PS', 21, 8, 'Sick day'),

      // Michael Johnson (rehired) - Bereavement (67% of 24h), vacation, FMLA
      single('DEMO005', 'B', 30, 8, 'Family bereavement'),
      single('DEMO005', 'B', 29, 8, 'Family bereavement'),
      ...range('DEMO005', 'V', 75, 5, 8, 'Vacation - visiting family'),
      ...range('DEMO005', 'FM', 100, 2, 8, 'FMLA - medical leave'),

      // Sarah Martinez (part-time) - shorter days reflect reduced schedule
      ...range('DEMO006', 'P', 20, 4, 4, 'Personal appointments - reduced schedule'),
      ...range('DEMO006', 'V', 60, 2, 4, 'Long weekend'),
      single('DEMO006', 'T', 3, 1, 'Traffic delay'),

      // David Garcia (part-time) - light usage
      ...range('DEMO007', 'V', 40, 2, 4, 'Time off'),
      single('DEMO007', 'LOW', 25, 4, 'Reduced hours - slow week'),
      single('DEMO007', 'T', 2, 1, 'Traffic delay'),

      // Lisa Thompson (HR) - Personal Sick Day usage against an HR-approved override (see allocation below)
      ...range('DEMO008', 'PS', 35, 3, 8, 'Recovering from a minor procedure'),
      single('DEMO008', 'JD', 45, 8, 'Jury selection'),
      single('DEMO008', 'JD', 44, 8, 'Jury duty day 2'),
      ...range('DEMO008', 'V', 80, 4, 8, 'Vacation'),

      // Christopher Brown (recent hire) - light usage across a few codes
      single('DEMO009', 'FM', 60, 8, 'FMLA - new child bonding'),
      single('DEMO009', 'V', 15, 8, 'First vacation day'),
      single('DEMO009', 'PS', 8, 8, 'Sick day'),

      // Amanda Wilson (newest hire) - no entries yet, just started
    ];

    let entriesCreated = 0;
    for (const entry of attendanceEntries) {
      const empId = employeeIds[entry.empNum];
      const timeCodeId = timeCodes[entry.code];

      if (!empId || !timeCodeId) {
        console.log(`  ⚠ Skipping entry - missing employee or time code: ${entry.empNum}, ${entry.code}`);
        continue;
      }

      try {
        // Check if entry exists
        const existing = await db.execute({
          sql: 'SELECT id FROM attendance_entries WHERE employee_id = ? AND entry_date = ?',
          args: [empId, entry.date],
        });

        if (existing.rows.length > 0) {
          // Update existing
          await db.execute({
            sql: `UPDATE attendance_entries SET time_code = ?, time_code_id = ?, hours = ?, notes = ?
                  WHERE employee_id = ? AND entry_date = ?`,
            args: [entry.code, timeCodeId, entry.hours, entry.notes, empId, entry.date],
          });
        } else {
          // Insert new
          await db.execute({
            sql: `INSERT INTO attendance_entries (employee_id, entry_date, time_code, time_code_id, hours, notes)
                  VALUES (?, ?, ?, ?, ?, ?)`,
            args: [empId, entry.date, entry.code, timeCodeId, entry.hours, entry.notes],
          });
        }
        entriesCreated++;
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.log(`  ⚠ Error creating entry: ${errorMessage}`);
      }
    }

    console.log(`  ✓ Created ${entriesCreated} attendance entries`);

    // Leave allocation override - demonstrates HR granting extra hours
    // beyond the brand's default allocation for a specific employee.
    console.log('');
    console.log('Creating demo leave allocation override...');
    const lisaId = employeeIds['DEMO008'];
    if (lisaId && timeCodes['PS']) {
      const currentYear = new Date().getFullYear();
      await db.execute({
        sql: `INSERT INTO employee_time_allocations (employee_id, time_code, time_code_id, allocated_hours, year, notes)
              VALUES (?, ?, ?, ?, ?, ?)
              ON CONFLICT(employee_id, time_code, year) DO UPDATE SET
                time_code_id = excluded.time_code_id,
                allocated_hours = excluded.allocated_hours,
                notes = excluded.notes,
                updated_at = CURRENT_TIMESTAMP`,
        args: [lisaId, 'PS', timeCodes['PS'], 48, currentYear, 'Extra sick time approved by HR director - medical accommodation'],
      });
      console.log('  ✓ Lisa Thompson: Personal Sick Day allocation increased to 48h (HR override)');
    }

    // Office presence - mark a couple of employees "out" so the office
    // presence widget has data to show on first launch.
    console.log('');
    console.log('Setting demo office presence...');
    const today = daysAgo(0);
    const outToday = ['DEMO006', 'DEMO009'];
    let presenceSet = 0;
    for (const empNum of outToday) {
      const empId = employeeIds[empNum];
      if (!empId) continue;
      await db.execute({
        sql: `INSERT INTO office_presence (employee_id, date, is_out, toggled_by, updated_at)
              VALUES (?, ?, 1, 1, CURRENT_TIMESTAMP)
              ON CONFLICT(employee_id, date) DO UPDATE SET
                is_out = 1, toggled_by = 1, updated_at = CURRENT_TIMESTAMP`,
        args: [empId, today],
      });
      presenceSet++;
    }
    console.log(`  ✓ Marked ${presenceSet} employees as out of the office today`);

    // Break entries - one compliant pair and one override example for the
    // break compliance report (only visible if the brand enables breakTracking).
    console.log('');
    console.log('Creating demo break entries...');
    const yesterday = daysAgo(1);
    const breakEntries: Array<{ empNum: string; breakType: string; start: string; end: string; duration: number; override: number; notes: string | null }> = [
      { empNum: 'DEMO001', breakType: 'break_1', start: '09:05', end: '09:20', duration: 15, override: 0, notes: null },
      { empNum: 'DEMO001', breakType: 'lunch', start: '12:00', end: '12:30', duration: 30, override: 0, notes: null },
      { empNum: 'DEMO002', breakType: 'lunch', start: '11:45', end: '12:35', duration: 50, override: 1, notes: 'Extended lunch approved - client meeting ran long' },
    ];
    let breaksCreated = 0;
    for (const b of breakEntries) {
      const empId = employeeIds[b.empNum];
      if (!empId) continue;
      await db.execute({
        sql: `INSERT INTO break_entries (employee_id, entry_date, break_type, start_time, end_time, duration_minutes, notes, compliance_override, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
              ON CONFLICT(employee_id, entry_date, break_type) DO UPDATE SET
                start_time = excluded.start_time,
                end_time = excluded.end_time,
                duration_minutes = excluded.duration_minutes,
                notes = excluded.notes,
                compliance_override = excluded.compliance_override,
                updated_at = CURRENT_TIMESTAMP`,
        args: [empId, yesterday, b.breakType, b.start, b.end, b.duration, b.notes, b.override],
      });
      breaksCreated++;
    }
    console.log(`  ✓ Created ${breaksCreated} break entries`);

    // Demo logins - one per role, linked to a demo employee so the
    // attendance grid and "self-service" views default correctly.
    console.log('');
    console.log('Creating demo user logins...');
    await ensureAuthInitialized();

    const demoUsers = [
      { username: 'manager', fullName: 'Patricia Williams', email: 'patricia.williams@demo.com', groupId: 2, roleId: 2, empNum: 'DEMO002' },
      { username: 'hr', fullName: 'Lisa Thompson', email: 'lisa.thompson@demo.com', groupId: 3, roleId: 3, empNum: 'DEMO008' },
      { username: 'employee', fullName: 'Sarah Martinez', email: 'sarah.martinez@demo.com', groupId: 4, roleId: 6, empNum: 'DEMO006' },
    ];
    const demoPasswordHash = await bcrypt.hash('demo123', 10);

    for (const u of demoUsers) {
      const empId = employeeIds[u.empNum] ?? null;
      const existing = await authDb.execute({
        sql: 'SELECT id FROM users WHERE username = ?',
        args: [u.username],
      });

      if (existing.rows.length > 0) {
        await authDb.execute({
          sql: `UPDATE users SET password_hash = ?, full_name = ?, email = ?, group_id = ?, role_id = ?,
                  employee_id = ?, is_active = 1, must_change_password = 0, updated_at = CURRENT_TIMESTAMP
                WHERE username = ?`,
          args: [demoPasswordHash, u.fullName, u.email, u.groupId, u.roleId, empId, u.username],
        });
        console.log(`  ⊘ ${u.username} already exists - refreshed link to ${u.fullName}`);
      } else {
        await authDb.execute({
          sql: `INSERT INTO users (username, password_hash, full_name, email, group_id, role_id, employee_id, is_active, is_superuser, color_mode, must_change_password)
                VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, 'system', 0)`,
          args: [u.username, demoPasswordHash, u.fullName, u.email, u.groupId, u.roleId, empId],
        });
        console.log(`  ✓ Created login: ${u.username} / demo123 (${u.fullName})`);
      }
    }

    console.log('');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║                  DEMO DATA SEEDING COMPLETE                ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log('║  Employees: 10 (8 full-time, 2 part-time)                  ║');
    console.log('║  - Various hire dates for seniority demo                   ║');
    console.log('║  - 1 rehired employee, same-day hires with seniority ranks ║');
    console.log('║                                                            ║');
    console.log(`║  Attendance entries: ${entriesCreated} across the last several months${' '.repeat(Math.max(0, 9 - String(entriesCreated).length))}║`);
    console.log('║  - Leave Balance Summary shows normal/warning/critical     ║');
    console.log('║  - One HR-approved allocation override                     ║');
    console.log('║  - Office presence and break compliance sample data        ║');
    console.log('║                                                            ║');
    console.log('║  Logins:                                                   ║');
    console.log('║    admin    / admin123  (Administrator)                    ║');
    console.log('║    manager  / demo123   (Manager - Patricia Williams)      ║');
    console.log('║    hr       / demo123   (HR - Lisa Thompson)               ║');
    console.log('║    employee / demo123   (Self-Service - Sarah Martinez)    ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('');

  } catch (error) {
    console.error('Error seeding demo data:', error);
    throw error;
  }
}
