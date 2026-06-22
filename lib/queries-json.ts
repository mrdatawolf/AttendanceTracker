import { readDb, writeDb } from './json-db';

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
export function getAllEmployees(): Employee[] {
  const db = readDb();
  return db.employees.filter(e => e.is_active === 1);
}

export function getEmployeeById(id: number): Employee | null {
  const db = readDb();
  return db.employees.find(e => e.id === id) || null;
}

export function createEmployee(employee: Omit<Employee, 'id'>): Employee {
  const db = readDb();
  const id = db.employees.length > 0
    ? Math.max(...db.employees.map(e => e.id)) + 1
    : 1;

  const newEmployee = { id, ...employee };
  db.employees.push(newEmployee);
  writeDb(db);

  return newEmployee;
}

// Time code queries
export function getAllTimeCodes(): TimeCode[] {
  const db = readDb();
  return db.time_codes.filter(tc => tc.is_active === 1);
}

// Attendance entry queries
export function getEntriesForYear(employeeId: number, year: number): AttendanceEntry[] {
  const db = readDb();
  return db.attendance_entries.filter(entry => {
    if (entry.employee_id !== employeeId) return false;
    const entryYear = new Date(entry.entry_date).getFullYear();
    return entryYear === year;
  });
}

export function upsertEntry(entry: Omit<AttendanceEntry, 'id'>): void {
  const db = readDb();

  const existingIndex = db.attendance_entries.findIndex(
    e => e.employee_id === entry.employee_id && e.entry_date === entry.entry_date
  );

  if (existingIndex >= 0) {
    // Update existing
    db.attendance_entries[existingIndex] = {
      ...db.attendance_entries[existingIndex],
      ...entry,
    };
  } else {
    // Insert new
    const id = db.attendance_entries.length > 0
      ? Math.max(...db.attendance_entries.map(e => e.id)) + 1
      : 1;
    db.attendance_entries.push({ id, ...entry });
  }

  writeDb(db);
}

export function deleteEntry(employeeId: number, entryDate: string): void {
  const db = readDb();
  db.attendance_entries = db.attendance_entries.filter(
    e => !(e.employee_id === employeeId && e.entry_date === entryDate)
  );
  writeDb(db);
}
