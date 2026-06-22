const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(process.cwd(), 'timesheet.db');
const schemaPath = path.join(process.cwd(), 'lib', 'schema.sql');

console.log('Running database migration...');
console.log('Database path:', dbPath);

async function migrate() {
  try {
    const SQL = await initSqlJs();

    let db;
    if (fs.existsSync(dbPath)) {
      const buffer = fs.readFileSync(dbPath);
      db = new SQL.Database(buffer);
    } else {
      db = new SQL.Database();
    }

    const schema = fs.readFileSync(schemaPath, 'utf-8');

    // Execute schema
    db.run(schema);
    console.log('✓ Database migration completed successfully');

    // Check if we have any time codes
    const countResult = db.exec('SELECT COUNT(*) as count FROM time_codes');
    const count = countResult[0]?.values[0]?.[0] || 0;
    console.log(`✓ Time codes in database: ${count}`);

    const employeeResult = db.exec('SELECT COUNT(*) as count FROM employees');
    const employeeCount = employeeResult[0]?.values[0]?.[0] || 0;
    console.log(`✓ Employees in database: ${employeeCount}`);

    // Save database to file
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);

    db.close();
    console.log('✓ Database saved successfully');

  } catch (error) {
    console.error('✗ Migration failed:', error.message);
    process.exit(1);
  }
}

migrate();
