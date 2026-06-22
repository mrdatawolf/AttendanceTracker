import { Database } from 'sql.js';

export interface Employee {
  id: number;
  employee_number?: string;
  first_name: string;
  last_name: string;
  email?: string;
  role: string;
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
  time_code: string;
  hours: number;
  notes?: string;
}

// Employee queries
export function getAllEmployees(db: Database): Employee[] {
  const result = db.exec('SELECT * FROM employees WHERE is_active = 1 ORDER BY last_name, first_name');
  if (!result.length) return [];

  const columns = result[0].columns;
  return result[0].values.map(row => {
    const employee: any = {};
    columns.forEach((col, i) => {
      employee[col] = row[i];
    });
    return employee as Employee;
  });
}

export function getEmployeeById(db: Database, id: number): Employee | null {
  const result = db.exec('SELECT * FROM employees WHERE id = ?', [id]);
  if (!result.length || !result[0].values.length) return null;

  const columns = result[0].columns;
  const row = result[0].values[0];
  const employee: any = {};
  columns.forEach((col, i) => {
    employee[col] = row[i];
  });
  return employee as Employee;
}

export function createEmployee(db: Database, employee: Omit<Employee, 'id'>): number {
  db.run(
    `INSERT INTO employees (employee_number, first_name, last_name, email, role, is_active)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      employee.employee_number || null,
      employee.first_name,
      employee.last_name,
      employee.email || null,
      employee.role,
      employee.is_active
    ]
  );

  const result = db.exec('SELECT last_insert_rowid() as id');
  return result[0].values[0][0] as number;
}

// Time code queries
export function getAllTimeCodes(db: Database): TimeCode[] {
  const result = db.exec('SELECT * FROM time_codes WHERE is_active = 1 ORDER BY code');
  if (!result.length) return [];

  const columns = result[0].columns;
  return result[0].values.map(row => {
    const timeCode: any = {};
    columns.forEach((col, i) => {
      timeCode[col] = row[i];
    });
    return timeCode as TimeCode;
  });
}

// Attendance entry queries
export function getEntriesForMonth(
  db: Database,
  employeeId: number,
  year: number,
  month: number
): AttendanceEntry[] {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = `${year}-${String(month).padStart(2, '0')}-31`;

  const result = db.exec(
    `SELECT * FROM attendance_entries
     WHERE employee_id = ? AND entry_date >= ? AND entry_date <= ?
     ORDER BY entry_date`,
    [employeeId, startDate, endDate]
  );

  if (!result.length) return [];

  const columns = result[0].columns;
  return result[0].values.map(row => {
    const entry: any = {};
    columns.forEach((col, i) => {
      entry[col] = row[i];
    });
    return entry as AttendanceEntry;
  });
}

export function upsertEntry(
  db: Database,
  entry: Omit<AttendanceEntry, 'id' | 'created_at' | 'updated_at'>
): void {
  // Check if entry exists
  const existing = db.exec(
    `SELECT id FROM attendance_entries
     WHERE employee_id = ? AND entry_date = ?`,
    [entry.employee_id, entry.entry_date]
  );

  if (existing.length && existing[0].values.length) {
    // Update existing entry
    db.run(
      `UPDATE attendance_entries
       SET time_code = ?, hours = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
       WHERE employee_id = ? AND entry_date = ?`,
      [entry.time_code, entry.hours, entry.notes || null, entry.employee_id, entry.entry_date]
    );
  } else {
    // Insert new entry
    db.run(
      `INSERT INTO attendance_entries (employee_id, entry_date, time_code, hours, notes)
       VALUES (?, ?, ?, ?, ?)`,
      [entry.employee_id, entry.entry_date, entry.time_code, entry.hours, entry.notes || null]
    );
  }
}

export function deleteEntry(db: Database, employeeId: number, entryDate: string): void {
  db.run(
    'DELETE FROM attendance_entries WHERE employee_id = ? AND entry_date = ?',
    [employeeId, entryDate]
  );
}

// Get all entries for employee in a year (for the full attendance view)
export function getEntriesForYear(
  db: Database,
  employeeId: number,
  year: number
): AttendanceEntry[] {
  const startDate = `${year}-01-01`;
  const endDate = `${year}-12-31`;

  const result = db.exec(
    `SELECT * FROM attendance_entries
     WHERE employee_id = ? AND entry_date >= ? AND entry_date <= ?
     ORDER BY entry_date`,
    [employeeId, startDate, endDate]
  );

  if (!result.length) return [];

  const columns = result[0].columns;
  return result[0].values.map(row => {
    const entry: any = {};
    columns.forEach((col, i) => {
      entry[col] = row[i];
    });
    return entry as AttendanceEntry;
  });
}
