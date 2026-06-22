const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(process.cwd(), 'timesheet.db');

console.log('Seeding database with mock data...');
console.log('Database path:', dbPath);

async function seed() {
  try {
    const SQL = await initSqlJs();

    let db;
    if (fs.existsSync(dbPath)) {
      const buffer = fs.readFileSync(dbPath);
      db = new SQL.Database(buffer);
    } else {
      console.error('Database not found. Please run "npm run db:migrate" first.');
      process.exit(1);
    }

    // Sample employees
    const employees = [
      { number: 'EMP001', first: 'John', last: 'Smith', email: 'john.smith@company.com' },
      { number: 'EMP002', first: 'Sarah', last: 'Johnson', email: 'sarah.johnson@company.com' },
      { number: 'EMP003', first: 'Michael', last: 'Williams', email: 'michael.williams@company.com' },
      { number: 'EMP004', first: 'Emily', last: 'Brown', email: 'emily.brown@company.com' },
    ];

    console.log('\nCreating employees...');
    employees.forEach(emp => {
      db.run(
        `INSERT OR IGNORE INTO employees (employee_number, first_name, last_name, email, role, is_active)
         VALUES (?, ?, ?, ?, 'employee', 1)`,
        [emp.number, emp.first, emp.last, emp.email]
      );
      console.log(`  ✓ ${emp.first} ${emp.last}`);
    });

    // Get employee IDs
    const employeeIds = db.exec('SELECT id FROM employees ORDER BY id');
    const ids = employeeIds[0]?.values.map(row => row[0]) || [];

    if (ids.length === 0) {
      console.error('No employees found after insertion');
      process.exit(1);
    }

    console.log('\nCreating timesheet entries...');
    const year = new Date().getFullYear();
    const timeCodes = ['V', 'H', 'P', 'FH', 'PS', 'LOW', 'D'];

    // Sample data for first employee - more comprehensive
    const employeeId = ids[0];
    let entryCount = 0;

    // Add some vacation days
    addEntry(db, employeeId, year, 1, 15, 'V', 8); // Jan 15 - Vacation
    addEntry(db, employeeId, year, 1, 16, 'V', 8); // Jan 16 - Vacation
    addEntry(db, employeeId, year, 1, 17, 'V', 8); // Jan 17 - Vacation

    // Add holidays
    addEntry(db, employeeId, year, 1, 1, 'H', 8);  // New Year's Day
    addEntry(db, employeeId, year, 5, 26, 'H', 8); // Memorial Day
    addEntry(db, employeeId, year, 7, 4, 'H', 8);  // July 4th
    addEntry(db, employeeId, year, 9, 1, 'H', 8);  // Labor Day
    addEntry(db, employeeId, year, 11, 27, 'H', 8); // Thanksgiving
    addEntry(db, employeeId, year, 12, 25, 'H', 8); // Christmas
    addEntry(db, employeeId, year, 12, 26, 'H', 8); // Day after Christmas

    // Add floating holiday
    addEntry(db, employeeId, year, 3, 14, 'FH', 8);
    addEntry(db, employeeId, year, 8, 23, 'FH', 8);
    addEntry(db, employeeId, year, 11, 29, 'FH', 8);

    // Add personal days
    addEntry(db, employeeId, year, 2, 10, 'P', 8);
    addEntry(db, employeeId, year, 4, 5, 'P', 8);
    addEntry(db, employeeId, year, 6, 18, 'P', 8);

    // Add personal sick days
    addEntry(db, employeeId, year, 2, 20, 'PS', 8);
    addEntry(db, employeeId, year, 5, 15, 'PS', 8);
    addEntry(db, employeeId, year, 9, 12, 'PS', 8);
    addEntry(db, employeeId, year, 10, 8, 'PS', 8);
    addEntry(db, employeeId, year, 11, 3, 'PS', 8);

    // Add some lack of work days
    addEntry(db, employeeId, year, 7, 15, 'LOW', 8);
    addEntry(db, employeeId, year, 7, 16, 'LOW', 8);

    // Add more vacation in summer
    addEntry(db, employeeId, year, 8, 5, 'V', 8);
    addEntry(db, employeeId, year, 8, 6, 'V', 8);
    addEntry(db, employeeId, year, 8, 7, 'V', 8);
    addEntry(db, employeeId, year, 8, 8, 'V', 8);
    addEntry(db, employeeId, year, 8, 9, 'V', 8);

    // Add scattered entries for other employees
    if (ids.length > 1) {
      const emp2 = ids[1];
      addEntry(db, emp2, year, 1, 1, 'H', 8);
      addEntry(db, emp2, year, 2, 14, 'P', 8);
      addEntry(db, emp2, year, 3, 10, 'V', 8);
      addEntry(db, emp2, year, 3, 11, 'V', 8);
      addEntry(db, emp2, year, 5, 26, 'H', 8);
      addEntry(db, emp2, year, 7, 4, 'H', 8);
      addEntry(db, emp2, year, 12, 25, 'H', 8);
    }

    if (ids.length > 2) {
      const emp3 = ids[2];
      addEntry(db, emp3, year, 1, 1, 'H', 8);
      addEntry(db, emp3, year, 4, 20, 'PS', 8);
      addEntry(db, emp3, year, 6, 10, 'V', 8);
      addEntry(db, emp3, year, 6, 11, 'V', 8);
      addEntry(db, emp3, year, 6, 12, 'V', 8);
      addEntry(db, emp3, year, 7, 4, 'H', 8);
      addEntry(db, emp3, year, 12, 25, 'H', 8);
    }

    function addEntry(db, empId, year, month, day, code, hours) {
      const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      db.run(
        `INSERT OR REPLACE INTO timesheet_entries (employee_id, entry_date, time_code, hours)
         VALUES (?, ?, ?, ?)`,
        [empId, date, code, hours]
      );
      entryCount++;
    }

    console.log(`  ✓ Created ${entryCount} timesheet entries`);

    // Count all entries
    const totalEntries = db.exec('SELECT COUNT(*) as count FROM timesheet_entries');
    const count = totalEntries[0]?.values[0]?.[0] || 0;

    console.log(`\n✓ Database seeded successfully!`);
    console.log(`  Total employees: ${ids.length}`);
    console.log(`  Total timesheet entries: ${count}`);

    // Save database to file
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);

    db.close();
    console.log('✓ Database saved\n');

  } catch (error) {
    console.error('✗ Seeding failed:', error.message);
    process.exit(1);
  }
}

seed();
