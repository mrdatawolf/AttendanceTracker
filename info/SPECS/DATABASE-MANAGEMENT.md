# Database Management Guide

> ⚠️ **IMPORTANT:** All databases are stored in the `databases/` folder at the project root. See [DATABASE-LOCATION.md](DATABASE-LOCATION.md) for details on how paths are resolved.

## Resetting the Database

### Option 1: Using the Reset Script (Easiest)

**During Development:**
```bash
npm run db:reset
```

Or double-click: `scripts/reset-database.bat`

**For Standalone Server:**
1. Navigate to `.next/standalone/` folder
2. Double-click `reset-database.bat`
3. Restart the server with `start-server.bat`

---

### Option 2: Manual Reset

**Step 1 - Stop the server**
- Close the server window or press Ctrl+C
- Or run: `taskkill /F /IM node.exe`

**Step 2 - Delete database files**

For development:
```bash
del databases\attendance.db
del databases\attendance.db-shm
del databases\attendance.db-wal
```

For standalone server:
```bash
cd .next\standalone
del databases\attendance.db
del databases\attendance.db-shm
del databases\attendance.db-wal
```

**Step 3 - Restart**
The database will be automatically recreated with fresh schema and default time codes.

---

## Backing Up the Database

### Quick Backup

**Copy the database folder:**
```bash
# Development
xcopy databases databases-backup\ /E /I

# Standalone
cd .next\standalone
xcopy databases databases-backup\ /E /I
```

### Scheduled Backups

Create a backup script `backup-database.bat`:
```batch
@echo off
set BACKUP_DIR=database-backups
set DATE=%date:~-4,4%%date:~-10,2%%date:~-7,2%
set TIME=%time:~0,2%%time:~3,2%

mkdir %BACKUP_DIR%\%DATE%_%TIME% 2>nul
xcopy databases %BACKUP_DIR%\%DATE%_%TIME%\ /E /I

echo Database backed up to %BACKUP_DIR%\%DATE%_%TIME%
```

---

## Restoring from Backup

1. Stop the server
2. Delete current database files
3. Copy backup files to `databases/` folder
4. Restart the server

```bash
# Stop server
taskkill /F /IM node.exe

# Delete current
del databases\*.db*

# Restore from backup
xcopy databases-backup\* databases\ /E /I

# Restart server
start-server.bat
```

---

## Database Location

**Development:**
```
databases/attendance.db
```

**Standalone Server:**
```
.next/standalone/databases/attendance.db
```

**Electron App (Installed):**
```
C:\Program Files\Attendance Management\resources\server\databases\attendance.db
```

---

## What Gets Reset

When you reset the database:

✅ **Removed:**
- All employees
- All attendance entries
- All custom data

✅ **Kept:**
- Default time codes:
  - D - Discipline
  - B - Bereavement (24hr limit)
  - FE - Family Emergency
  - FM - FMLA
  - H - Holiday
  - JD - Jury Duty
  - FH - Floating Holiday (24hr limit)
  - DP - Designated Person
  - P - Personal
  - LOW - Lack of Work
  - PS - Personal Sick Day (40hr limit)
  - T - Tardy
  - V - Vacation
  - WC - Workers Comp

---

## Starting Fresh After Testing

**Recommended workflow:**

1. Test your application thoroughly
2. When ready to go live:
   ```bash
   # Stop the server
   npm run db:reset
   # Or use reset-database.bat
   ```
3. Rebuild the application:
   ```bash
   npm run build
   npm run electron:build
   ```
4. Distribute the fresh installer

The database will be clean with only default time codes.

---

## Migrating Data

If you need to keep some data when resetting:

1. Export data before reset (use Reports page to export CSV)
2. Reset the database
3. Re-import employees and data as needed

---

## Database Schema

The database includes these tables:

1. **employees**
   - id, employee_number, first_name, last_name
   - email, role, is_active, group_id, date_of_hire
   - created_at, updated_at

2. **time_codes**
   - id, code, description, hours_limit, default_allocation
   - is_active, created_at, updated_at

3. **attendance_entries**
   - id, employee_id, entry_date, time_code, time_code_id
   - hours, notes
   - created_at, updated_at

4. **employee_time_allocations**
   - id, employee_id, time_code, time_code_id
   - allocated_hours, year, notes
   - created_at, updated_at
   - Stores custom time off allocations per employee per year
