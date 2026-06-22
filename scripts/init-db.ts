import { initializeDatabase } from '../lib/db-sqlite';
import { createEmployee } from '../lib/queries-sqlite';
import { db } from '../lib/db-sqlite';

async function main() {
  console.log('Initializing database...');

  // Initialize tables and time codes
  await initializeDatabase();
  console.log('✓ Tables created and time codes inserted');

  // Create sample employees
  const employees = [
    { number: 'EMP001', first: 'John', last: 'Smith', email: 'john.smith@company.com' },
    { number: 'EMP002', first: 'Sarah', last: 'Johnson', email: 'sarah.johnson@company.com' },
    { number: 'EMP003', first: 'Michael', last: 'Williams', email: 'michael.williams@company.com' },
    { number: 'EMP004', first: 'Emily', last: 'Brown', email: 'emily.brown@company.com' },
  ];

  console.log('\nCreating employees...');
  for (const emp of employees) {
    await createEmployee({
      employee_number: emp.number,
      first_name: emp.first,
      last_name: emp.last,
      email: emp.email,
      role: 'employee',
      is_active: 1,
    });
    console.log(`  ✓ ${emp.first} ${emp.last}`);
  }

  // Create sample attendance entries
  console.log('\nCreating sample attendance entries...');
  const year = new Date().getFullYear();
  const entries = [
    // Vacation days
    { emp_id: 1, month: 1, day: 15, code: 'V' },
    { emp_id: 1, month: 1, day: 16, code: 'V' },
    { emp_id: 1, month: 1, day: 17, code: 'V' },

    // Holidays
    { emp_id: 1, month: 1, day: 1, code: 'H' },
    { emp_id: 1, month: 5, day: 26, code: 'H' },
    { emp_id: 1, month: 7, day: 4, code: 'H' },
    { emp_id: 1, month: 9, day: 1, code: 'H' },
    { emp_id: 1, month: 11, day: 27, code: 'H' },
    { emp_id: 1, month: 12, day: 25, code: 'H' },
    { emp_id: 1, month: 12, day: 26, code: 'H' },

    // Floating holidays
    { emp_id: 1, month: 3, day: 14, code: 'FH' },
    { emp_id: 1, month: 8, day: 23, code: 'FH' },
    { emp_id: 1, month: 11, day: 29, code: 'FH' },

    // Personal days
    { emp_id: 1, month: 2, day: 10, code: 'P' },
    { emp_id: 1, month: 4, day: 5, code: 'P' },
    { emp_id: 1, month: 6, day: 18, code: 'P' },

    // Personal sick days
    { emp_id: 1, month: 2, day: 20, code: 'PS' },
    { emp_id: 1, month: 5, day: 15, code: 'PS' },
    { emp_id: 1, month: 9, day: 12, code: 'PS' },
    { emp_id: 1, month: 10, day: 8, code: 'PS' },
    { emp_id: 1, month: 11, day: 3, code: 'PS' },

    // Lack of work
    { emp_id: 1, month: 7, day: 15, code: 'LOW' },
    { emp_id: 1, month: 7, day: 16, code: 'LOW' },

    // Summer vacation
    { emp_id: 1, month: 8, day: 5, code: 'V' },
    { emp_id: 1, month: 8, day: 6, code: 'V' },
    { emp_id: 1, month: 8, day: 7, code: 'V' },
    { emp_id: 1, month: 8, day: 8, code: 'V' },
    { emp_id: 1, month: 8, day: 9, code: 'V' },
  ];

  for (const entry of entries) {
    const date = `${year}-${String(entry.month).padStart(2, '0')}-${String(entry.day).padStart(2, '0')}`;
    await db.execute({
      sql: 'INSERT INTO attendance_entries (employee_id, entry_date, time_code, hours) VALUES (?, ?, ?, ?)',
      args: [entry.emp_id, date, entry.code, 8],
    });
  }

  console.log(`✓ Created ${entries.length} attendance entries`);
  console.log('\n✓ Database initialization complete!\n');
}

main().catch(console.error);
