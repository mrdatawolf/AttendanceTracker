import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';

const dbPath = path.join(process.cwd(), 'attendance.db');

let dbInstance: Database | null = null;

export async function getDatabase(): Promise<Database> {
  if (dbInstance) {
    return dbInstance;
  }

  const SQL = await initSqlJs({
    locateFile: (file) => `https://sql.js.org/dist/${file}`
  });

  let db: Database;

  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  dbInstance = db;
  return db;
}

export async function saveDatabase(db: Database): Promise<void> {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

export async function closeDatabase(): Promise<void> {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
