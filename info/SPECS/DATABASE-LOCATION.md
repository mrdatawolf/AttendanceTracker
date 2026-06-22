# Database Location Configuration

## Important: Database Path Resolution

**ALL databases MUST be stored in the `databases/` folder at the project root.**

## Current Configuration

The application is configured to **always** create and access databases in:
```
<project-root>/databases/attendance.db
```

This path is **absolute** and **independent** of where the process is started from.

## How It Works

### Main Database Module ([lib/db-sqlite.ts](lib/db-sqlite.ts))

The database path is resolved using:

```typescript
import { fileURLToPath } from 'url';
import path from 'path';

// Get the project root directory (one level up from lib/)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Database path is always relative to project root
const dbPath = path.join(projectRoot, 'databases', 'attendance.db');
```

**Why this approach?**
- ✅ Works regardless of current working directory
- ✅ Consistent path across all execution contexts
- ✅ Portable across different operating systems
- ✅ Prevents databases from being created in random locations

### Database Reset Script ([scripts/reset-database.ts](scripts/reset-database.ts))

Uses the same pattern:

```typescript
// Get the project root directory (one level up from scripts/)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Database path is always in the project's databases/ folder
const dbPath = path.join(projectRoot, 'databases', 'attendance.db');
```

## ⚠️ IMPORTANT: Do NOT Use `process.cwd()`

**❌ WRONG:**
```typescript
const dbPath = path.join(process.cwd(), 'databases', 'attendance.db');
```

**Why it's wrong:**
- `process.cwd()` returns the directory where the process was **started**
- This can change based on how the user runs the command
- Can result in databases being created in unexpected locations

**✅ CORRECT:**
```typescript
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..'); // Adjust based on file location
const dbPath = path.join(projectRoot, 'databases', 'attendance.db');
```

## Database Files

The application creates the following files in `databases/`:

1. **`attendance.db`** - Main SQLite database file
2. **`attendance.db-shm`** - Shared memory file (SQLite WAL mode)
3. **`attendance.db-wal`** - Write-Ahead Log file (SQLite WAL mode)

All three files should remain in the `databases/` folder.

## Verification

To verify the database location is correct, you can:

1. **Check the server logs** when it starts - it should show the full path
2. **List the databases folder:**
   ```bash
   ls databases/
   ```

3. **Run the database check script:**
   ```bash
   npx tsx scripts/check-db.ts
   ```

## Deployment Notes

### Development
- Database location: `<project-root>/databases/attendance.db`
- Run from any directory: `npm run dev` (from project root recommended)

### Production (Standalone Build)
- Database location: `<build-directory>/databases/attendance.db`
- The `.next/standalone` build includes its own copy
- Always run the server from the standalone directory:
  ```bash
  cd .next/standalone
  node server.js
  ```

### Electron App
- Database location: Determined by Electron's app path
- For development: Same as development server
- For packaged app: In the app's resources folder

## Troubleshooting

### Issue: Database created in wrong location

**Symptoms:**
- Login returns "user not found"
- Empty database on startup
- Multiple database files in different locations

**Solution:**
1. Search for all `attendance.db` files:
   ```bash
   # Windows
   dir attendance.db /s

   # Unix/Mac
   find . -name "attendance.db"
   ```

2. Delete all database files except the one in `<project-root>/databases/`

3. Run database reset:
   ```bash
   npm run db:reset
   ```

4. Verify the code doesn't use `process.cwd()` for database paths

### Issue: Database locked errors

**Symptoms:**
- `EBUSY: resource busy or locked`
- Cannot reset database

**Solution:**
1. Stop all running Node processes
2. Close any SQLite browser tools
3. Run reset again

The reset script now handles locked files by dropping and recreating tables instead of deleting the file.

## Code Guidelines

When adding new database-related features:

1. ✅ **Always import the database from `lib/db-sqlite.ts`:**
   ```typescript
   import { db } from '@/lib/db-sqlite';
   ```

2. ✅ **Never create new database connections with hardcoded paths**

3. ✅ **Use the existing `db` export for all queries**

4. ✅ **If you need the database path for scripts, use the same resolution pattern as shown above**

## Summary

- 📁 **All databases**: `<project-root>/databases/`
- 🔧 **Path resolution**: Use `fileURLToPath` + `import.meta.url` + relative path
- ❌ **Never use**: `process.cwd()` for database paths
- ✅ **Always use**: Project root relative paths
- 📝 **Import from**: `lib/db-sqlite.ts` for consistent access
