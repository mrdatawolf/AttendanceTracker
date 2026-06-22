import { db } from './db-sqlite';

export interface Employee {
  id: number;
  employee_number?: string;
  first_name: string;
  last_name: string;
  email?: string;
  role: string;
  group_id?: number;
  date_of_hire?: string;
  rehire_date?: string;
  employment_type?: string;  // 'full_time' | 'part_time'
  seniority_rank?: number;   // 1-5 (tiebreaker for same hire dates)
  abbreviation?: string;     // 1-3 char unique identifier for office presence
  show_in_office_presence?: number; // 1 = shown (default), 0 = hidden
  created_by?: number;
  is_active: number;
}

export interface TimeCode {
  id: number;
  code: string;
  description: string;
  hours_limit?: number;
  is_active: number;
}

export interface AttendanceEntry {
  id: number;
  employee_id: number;
  entry_date: string;
  time_code: string; // Keep for backward compatibility
  time_code_id: number; // New ID-based reference
  hours: number;
  notes?: string;
}

// Employee queries
export async function getAllEmployees(): Promise<Employee[]> {
  const result = await db.execute('SELECT * FROM employees ORDER BY last_name, first_name');
  return result.rows as unknown as Employee[];
}

export async function getEmployeeById(id: number): Promise<Employee | null> {
  const result = await db.execute({
    sql: 'SELECT * FROM employees WHERE id = ?',
    args: [id],
  });
  return (result.rows[0] as unknown as Employee) || null;
}

export async function createEmployee(employee: Omit<Employee, 'id'>): Promise<Employee> {
  const result = await db.execute({
    sql: `INSERT INTO employees (employee_number, first_name, last_name, email, role, group_id, date_of_hire, rehire_date, employment_type, seniority_rank, abbreviation, show_in_office_presence, created_by, is_active)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      employee.employee_number || null,
      employee.first_name,
      employee.last_name,
      employee.email || null,
      employee.role,
      employee.group_id || null,
      employee.date_of_hire || null,
      employee.rehire_date || null,
      employee.employment_type || 'full_time',
      employee.seniority_rank || null,
      employee.abbreviation || null,
      employee.show_in_office_presence ?? 1,
      employee.created_by || null,
      employee.is_active,
    ],
  });

  const id = Number(result.lastInsertRowid);
  return { id, ...employee };
}

// Time code queries
export async function getAllTimeCodes(): Promise<TimeCode[]> {
  const result = await db.execute('SELECT * FROM time_codes WHERE is_active = 1 ORDER BY code');
  return result.rows as unknown as TimeCode[];
}

/**
 * Sync time codes from brand JSON to database
 * JSON is source of truth - inserts missing codes, updates existing ones
 * Uses code as the unique identifier (not id)
 */
export async function syncTimeCodesFromJson(brandTimeCodes: {
  id: number;
  code: string;
  description: string;
  hours_limit: number | null;
  is_active: number;
}[]): Promise<{ inserted: number; updated: number }> {
  let inserted = 0;
  let updated = 0;

  for (const tc of brandTimeCodes) {
    if ((tc as { spacer?: boolean }).spacer) continue;

    // Use INSERT OR REPLACE with code as the key
    const existing = await db.execute({
      sql: 'SELECT id FROM time_codes WHERE code = ?',
      args: [tc.code],
    });

    if (existing.rows.length === 0) {
      // Insert new time code (let database auto-generate ID)
      await db.execute({
        sql: `INSERT INTO time_codes (code, description, hours_limit, is_active)
              VALUES (?, ?, ?, ?)`,
        args: [tc.code, tc.description, tc.hours_limit, tc.is_active],
      });
      inserted++;
    } else {
      // Update existing time code
      await db.execute({
        sql: `UPDATE time_codes SET description = ?, hours_limit = ?, is_active = ? WHERE code = ?`,
        args: [tc.description, tc.hours_limit, tc.is_active, tc.code],
      });
      updated++;
    }
  }

  return { inserted, updated };
}

// Attendance entry queries
export async function getAllEntries(startDate?: string, endDate?: string): Promise<AttendanceEntry[]> {
  if (startDate && endDate) {
    const result = await db.execute({
      sql: 'SELECT * FROM attendance_entries WHERE entry_date >= ? AND entry_date <= ? ORDER BY entry_date DESC',
      args: [startDate, endDate],
    });
    return result.rows as unknown as AttendanceEntry[];
  }
  const result = await db.execute('SELECT * FROM attendance_entries ORDER BY entry_date DESC');
  return result.rows as unknown as AttendanceEntry[];
}

export async function getEntriesForDateRange(employeeId: number, startDate: string, endDate: string): Promise<AttendanceEntry[]> {
  const result = await db.execute({
    sql: `SELECT * FROM attendance_entries
          WHERE employee_id = ? AND entry_date >= ? AND entry_date <= ?
          ORDER BY entry_date`,
    args: [employeeId, startDate, endDate],
  });

  return result.rows as unknown as AttendanceEntry[];
}

export async function upsertEntry(entry: Omit<AttendanceEntry, 'id'>): Promise<void> {
  // Look up time_code_id from time_code
  const timeCodeResult = await db.execute({
    sql: 'SELECT id FROM time_codes WHERE code = ?',
    args: [entry.time_code],
  });

  if (timeCodeResult.rows.length === 0) {
    throw new Error(`Invalid time code: ${entry.time_code}`);
  }

  const timeCodeId = (timeCodeResult.rows[0] as any).id;

  // Check if entry exists
  const existing = await db.execute({
    sql: 'SELECT id FROM attendance_entries WHERE employee_id = ? AND entry_date = ?',
    args: [entry.employee_id, entry.entry_date],
  });

  if (existing.rows.length > 0) {
    // Update
    await db.execute({
      sql: `UPDATE attendance_entries
            SET time_code = ?, time_code_id = ?, hours = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
            WHERE employee_id = ? AND entry_date = ?`,
      args: [entry.time_code, timeCodeId, entry.hours, entry.notes || null, entry.employee_id, entry.entry_date],
    });
  } else {
    // Insert
    await db.execute({
      sql: `INSERT INTO attendance_entries (employee_id, entry_date, time_code, time_code_id, hours, notes)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [entry.employee_id, entry.entry_date, entry.time_code, timeCodeId, entry.hours, entry.notes || null],
    });
  }
}

export async function deleteEntry(employeeId: number, entryDate: string): Promise<void> {
  await db.execute({
    sql: 'DELETE FROM attendance_entries WHERE employee_id = ? AND entry_date = ?',
    args: [employeeId, entryDate],
  });
}