-- Time Entry Code Types
CREATE TABLE IF NOT EXISTS time_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  hours_limit INTEGER,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Employees
CREATE TABLE IF NOT EXISTS employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_number TEXT UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT UNIQUE,
  role TEXT DEFAULT 'employee',
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Attendance Entries
CREATE TABLE IF NOT EXISTS attendance_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  entry_date DATE NOT NULL,
  time_code TEXT NOT NULL,
  hours REAL NOT NULL DEFAULT 0,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (time_code) REFERENCES time_codes(code) ON UPDATE CASCADE
);

-- Monthly Attendances (for grouping and potential approval workflows)
CREATE TABLE IF NOT EXISTS attendances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  status TEXT DEFAULT 'draft',
  submitted_at DATETIME,
  approved_at DATETIME,
  approved_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (approved_by) REFERENCES employees(id),
  UNIQUE(employee_id, year, month)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_attendance_entries_employee_date
  ON attendance_entries(employee_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_attendance_entries_date
  ON attendance_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_attendances_employee_period
  ON attendances(employee_id, year, month);

-- Insert default time codes
INSERT OR IGNORE INTO time_codes (code, description, hours_limit) VALUES
  ('D', 'Discipline', NULL),
  ('B', 'Bereavement', 24),
  ('FE', 'Family Emergency', NULL),
  ('FM', 'FMLA', NULL),
  ('H', 'Holiday', NULL),
  ('JD', 'Jury Duty', NULL),
  ('FH', 'Floating Holiday', 24),
  ('DP', 'Designated Person', NULL),
  ('P', 'Personal', NULL),
  ('LOW', 'Lack of Work', NULL),
  ('PS', 'Personal Sick Day', 40),
  ('T', 'Tardy', NULL),
  ('V', 'Vacation', NULL),
  ('WC', 'Workers Comp', NULL);
