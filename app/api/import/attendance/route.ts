import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, getClientIP, getUserAgent } from '@/lib/middleware/auth';
import { logAudit } from '@/lib/queries-auth';
import { db } from '@/lib/db-sqlite';
import type { ImportRecord } from '@/lib/import-mappings';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const isAdmin = authUser.group?.is_master === 1 || authUser.role?.name === 'Administrator';
  if (!isAdmin) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const { records } = (await request.json()) as { records: ImportRecord[] };

  if (!Array.isArray(records) || records.length === 0) {
    return NextResponse.json({ error: 'No records to import' }, { status: 400 });
  }

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const record of records) {
    try {
      // Validate employee exists
      const empResult = await db.execute({
        sql: 'SELECT id FROM employees WHERE id = ?',
        args: [record.employee_id],
      });
      if (empResult.rows.length === 0) {
        errors.push(`Employee ID ${record.employee_id} not found for date ${record.entry_date}`);
        continue;
      }

      // Validate time code exists
      const tcResult = await db.execute({
        sql: 'SELECT id FROM time_codes WHERE code = ?',
        args: [record.time_code],
      });
      if (tcResult.rows.length === 0) {
        errors.push(`Time code "${record.time_code}" not found for date ${record.entry_date}`);
        continue;
      }
      const timeCodeId = (tcResult.rows[0] as any).id;

      // Check for existing entry
      const existing = await db.execute({
        sql: 'SELECT id FROM attendance_entries WHERE employee_id = ? AND entry_date = ?',
        args: [record.employee_id, record.entry_date],
      });

      if (existing.rows.length > 0) {
        if (record.overwrite) {
          await db.execute({
            sql: `UPDATE attendance_entries
                  SET time_code = ?, time_code_id = ?, hours = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
                  WHERE employee_id = ? AND entry_date = ?`,
            args: [record.time_code, timeCodeId, record.hours, record.notes || null, record.employee_id, record.entry_date],
          });
          imported++;
        } else {
          skipped++;
        }
      } else {
        await db.execute({
          sql: `INSERT INTO attendance_entries (employee_id, entry_date, time_code, time_code_id, hours, notes)
                VALUES (?, ?, ?, ?, ?, ?)`,
          args: [record.employee_id, record.entry_date, record.time_code, timeCodeId, record.hours, record.notes || null],
        });
        imported++;
      }
    } catch (err: any) {
      errors.push(`Error for employee ${record.employee_id} on ${record.entry_date}: ${err.message}`);
    }
  }

  await logAudit({
    user_id: authUser.id,
    action: 'BULK_IMPORT_ATTENDANCE',
    table_name: 'attendance_entries',
    old_values: undefined,
    new_values: JSON.stringify({ total: records.length, imported, skipped, errors: errors.length }),
    ip_address: getClientIP(request),
    user_agent: getUserAgent(request),
  });

  return NextResponse.json({ imported, skipped, errors });
}
