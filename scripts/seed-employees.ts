/**
 * Seed Script - Add Test Employees
 *
 * This script adds sample employees to the database for testing
 */

import { createClient } from '@libsql/client';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const dbPath = path.join(projectRoot, 'databases', 'attendance.db');

const db = createClient({
  url: `file:${dbPath}`,
});

async function seedEmployees() {
  console.log('🌱 Seeding database with test employees...');
  console.log('Database path:', dbPath);
  console.log('');

  try {
    // Sample employees with new fields (rehire_date, employment_type, seniority_rank)
    const employees = [
      {
        number: 'EMP001',
        first: 'John',
        last: 'Smith',
        email: 'john.smith@company.com',
        role: 'employee',
        group_id: 4, // Employees group
        date_of_hire: '2023-01-15',
        rehire_date: null,
        employment_type: 'full_time',
        seniority_rank: null
      },
      {
        number: 'EMP002',
        first: 'Sarah',
        last: 'Johnson',
        email: 'sarah.johnson@company.com',
        role: 'manager',
        group_id: 2, // Managers group
        date_of_hire: '2022-03-20',
        rehire_date: null,
        employment_type: 'full_time',
        seniority_rank: null
      },
      {
        number: 'EMP003',
        first: 'Michael',
        last: 'Williams',
        email: 'michael.williams@company.com',
        role: 'employee',
        group_id: 4, // Employees group
        date_of_hire: '2023-06-10',
        rehire_date: null,
        employment_type: 'full_time',
        seniority_rank: null
      },
      {
        number: 'EMP004',
        first: 'Emily',
        last: 'Brown',
        email: 'emily.brown@company.com',
        role: 'hr_specialist',
        group_id: 3, // HR group
        date_of_hire: '2021-11-05',
        rehire_date: null,
        employment_type: 'full_time',
        seniority_rank: null
      },
      {
        number: 'EMP005',
        first: 'David',
        last: 'Martinez',
        email: 'david.martinez@company.com',
        role: 'employee',
        group_id: 4, // Employees group
        date_of_hire: '2020-02-01',
        rehire_date: '2024-02-01', // Example rehire
        employment_type: 'full_time',
        seniority_rank: 3
      },
      {
        number: 'EMP006',
        first: 'Lisa',
        last: 'Garcia',
        email: 'lisa.garcia@company.com',
        role: 'employee',
        group_id: 4, // Employees group
        date_of_hire: '2024-03-15',
        rehire_date: null,
        employment_type: 'part_time', // Part-time employee
        seniority_rank: null
      },
    ];

    console.log('Creating employees...');
    let created = 0;
    let skipped = 0;

    for (const emp of employees) {
      try {
        await db.execute({
          sql: `INSERT INTO employees (
            employee_number,
            first_name,
            last_name,
            email,
            role,
            group_id,
            date_of_hire,
            rehire_date,
            employment_type,
            seniority_rank,
            created_by,
            is_active
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
            1, // Created by admin (user ID 1)
            1  // Active
          ],
        });
        console.log(`  ✓ Created: ${emp.first} ${emp.last} (${emp.number})`);
        created++;
      } catch (error: any) {
        if (error.message?.includes('UNIQUE constraint failed')) {
          console.log(`  ⊘ Skipped: ${emp.first} ${emp.last} (already exists)`);
          skipped++;
        } else {
          throw error;
        }
      }
    }

    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✓ Seeding complete!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`  Created: ${created} employees`);
    console.log(`  Skipped: ${skipped} employees (already existed)`);
    console.log('');

    // Show total employee count
    const result = await db.execute('SELECT COUNT(*) as count FROM employees WHERE is_active = 1');
    const totalCount = result.rows[0]?.count || 0;
    console.log(`  Total active employees in database: ${totalCount}`);
    console.log('');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

seedEmployees()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
