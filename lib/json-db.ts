import fs from 'fs';
import path from 'path';

const dbPath = path.join(process.cwd(), 'data.json');

interface Database {
  employees: Array<{
    id: number;
    employee_number?: string;
    first_name: string;
    last_name: string;
    email?: string;
    role: string;
    is_active: number;
  }>;
  time_codes: Array<{
    id: number;
    code: string;
    description: string;
    hours_limit?: number;
    is_active: number;
  }>;
  attendance_entries: Array<{
    id: number;
    employee_id: number;
    entry_date: string;
    time_code: string;
    hours: number;
    notes?: string;
  }>;
}

function getDefaultDb(): Database {
  return {
    employees: [],
    time_codes: [
      { id: 1, code: 'D', description: 'Discipline', is_active: 1 },
      { id: 2, code: 'B', description: 'Bereavement', hours_limit: 24, is_active: 1 },
      { id: 3, code: 'FE', description: 'Family Emergency', is_active: 1 },
      { id: 4, code: 'FM', description: 'FMLA', is_active: 1 },
      { id: 5, code: 'H', description: 'Holiday', is_active: 1 },
      { id: 6, code: 'JD', description: 'Jury Duty', is_active: 1 },
      { id: 7, code: 'FH', description: 'Floating Holiday', hours_limit: 24, is_active: 1 },
      { id: 8, code: 'DP', description: 'Designated Person', is_active: 1 },
      { id: 9, code: 'P', description: 'Personal', is_active: 1 },
      { id: 10, code: 'LOW', description: 'Lack of Work', is_active: 1 },
      { id: 11, code: 'PS', description: 'Personal Sick Day', hours_limit: 40, is_active: 1 },
      { id: 12, code: 'T', description: 'Tardy', is_active: 1 },
      { id: 13, code: 'V', description: 'Vacation', is_active: 1 },
      { id: 14, code: 'WC', description: 'Workers Comp', is_active: 1 },
    ],
    attendance_entries: [],
  };
}

export function readDb(): Database {
  try {
    if (!fs.existsSync(dbPath)) {
      const defaultDb = getDefaultDb();
      writeDb(defaultDb);
      return defaultDb;
    }
    const data = fs.readFileSync(dbPath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading database:', error);
    return getDefaultDb();
  }
}

export function writeDb(db: Database): void {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error writing database:', error);
  }
}
