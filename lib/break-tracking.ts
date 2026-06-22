/**
 * Break Tracking Utilities
 *
 * Handles break/lunch compliance tracking including:
 * - CRUD operations for break entries
 * - Compliance checking against configured time windows
 */

import { db, ensureInitialized } from './db-sqlite';
import { getBrandFeatures, getBreakTrackingConfig, BreakTrackingConfig, BreakWindow } from './brand-features';
import { getLocalToday } from './date-helpers';

export interface BreakEntry {
  id: number;
  employee_id: number;
  entry_date: string;
  break_type: string;
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number;
  notes: string | null;
  compliance_override: number;
  created_at: string;
  updated_at: string;
}

export interface BreakComplianceResult {
  compliant: boolean;
  reason: string;
}

export interface BreakEntryWithCompliance extends BreakEntry {
  compliance: BreakComplianceResult;
}

/**
 * Check if break tracking is enabled
 */
export async function isBreakTrackingEnabled(): Promise<BreakTrackingConfig | null> {
  const features = await getBrandFeatures();
  return getBreakTrackingConfig(features);
}

/**
 * Get break entries for an employee on a specific date
 */
export async function getBreakEntries(employeeId: number, date: string): Promise<BreakEntry[]> {
  await ensureInitialized();
  const result = await db.execute({
    sql: 'SELECT * FROM break_entries WHERE employee_id = ? AND entry_date = ? ORDER BY break_type',
    args: [employeeId, date],
  });

  return result.rows.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: Number(r.id),
      employee_id: Number(r.employee_id),
      entry_date: String(r.entry_date),
      break_type: String(r.break_type),
      start_time: r.start_time ? String(r.start_time) : null,
      end_time: r.end_time ? String(r.end_time) : null,
      duration_minutes: Number(r.duration_minutes),
      notes: r.notes ? String(r.notes) : null,
      compliance_override: Number(r.compliance_override || 0),
      created_at: String(r.created_at),
      updated_at: String(r.updated_at),
    };
  });
}

/**
 * Get a single break entry by ID
 */
export async function getBreakEntryById(id: number): Promise<BreakEntry | null> {
  const result = await db.execute({
    sql: 'SELECT * FROM break_entries WHERE id = ?',
    args: [id],
  });

  if (result.rows.length === 0) {
    return null;
  }

  const r = result.rows[0] as Record<string, unknown>;
  return {
    id: Number(r.id),
    employee_id: Number(r.employee_id),
    entry_date: String(r.entry_date),
    break_type: String(r.break_type),
    start_time: r.start_time ? String(r.start_time) : null,
    end_time: r.end_time ? String(r.end_time) : null,
    duration_minutes: Number(r.duration_minutes),
    notes: r.notes ? String(r.notes) : null,
    compliance_override: Number(r.compliance_override || 0),
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
  };
}

/**
 * Save a break entry (upsert - insert or update)
 */
export async function saveBreakEntry(entry: {
  employee_id: number;
  entry_date: string;
  break_type: string;
  start_time?: string | null;
  end_time?: string | null;
  duration_minutes: number;
  notes?: string | null;
  compliance_override?: number;
}): Promise<number> {
  const result = await db.execute({
    sql: `
      INSERT INTO break_entries (employee_id, entry_date, break_type, start_time, end_time, duration_minutes, notes, compliance_override, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(employee_id, entry_date, break_type) DO UPDATE SET
        start_time = excluded.start_time,
        end_time = excluded.end_time,
        duration_minutes = excluded.duration_minutes,
        notes = excluded.notes,
        compliance_override = excluded.compliance_override,
        updated_at = CURRENT_TIMESTAMP
    `,
    args: [
      entry.employee_id,
      entry.entry_date,
      entry.break_type,
      entry.start_time ?? null,
      entry.end_time ?? null,
      entry.duration_minutes,
      entry.notes ?? null,
      entry.compliance_override ?? 0,
    ],
  });

  return Number(result.lastInsertRowid);
}

/**
 * Set compliance override on an existing break entry
 */
export async function setComplianceOverride(
  employeeId: number,
  date: string,
  breakType: string,
  override: boolean
): Promise<void> {
  await db.execute({
    sql: `UPDATE break_entries SET compliance_override = ?, updated_at = CURRENT_TIMESTAMP
          WHERE employee_id = ? AND entry_date = ? AND break_type = ?`,
    args: [override ? 1 : 0, employeeId, date, breakType],
  });
}

/**
 * Delete a break entry
 */
export async function deleteBreakEntry(id: number): Promise<boolean> {
  const result = await db.execute({
    sql: 'DELETE FROM break_entries WHERE id = ?',
    args: [id],
  });

  return result.rowsAffected > 0;
}

/**
 * Parse time string (HH:MM) to minutes since midnight
 */
function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Check if a break entry is compliant with the configured window
 */
export function checkBreakCompliance(
  entry: BreakEntry,
  config: BreakWindow,
  graceMinutes: number = 0
): BreakComplianceResult {
  // Check duration first
  if (entry.duration_minutes < config.duration) {
    return {
      compliant: false,
      reason: `Duration too short (${entry.duration_minutes}/${config.duration} min)`,
    };
  }

  // If no start time recorded, only check duration
  if (!entry.start_time) {
    return {
      compliant: true,
      reason: 'Duration met',
    };
  }

  // Parse times and check window compliance
  const entryStart = parseTimeToMinutes(entry.start_time);
  const windowStart = parseTimeToMinutes(config.start);
  const windowEnd = parseTimeToMinutes(config.end);

  const withinWindow =
    entryStart >= windowStart - graceMinutes &&
    entryStart <= windowEnd + graceMinutes;

  if (withinWindow) {
    return {
      compliant: true,
      reason: 'Within window and duration met',
    };
  }

  return {
    compliant: false,
    reason: `Started outside window at ${entry.start_time} (window: ${config.start}-${config.end})`,
  };
}

/**
 * Get break entries with compliance status for an employee on a date
 */
export async function getBreakEntriesWithCompliance(
  employeeId: number,
  date: string
): Promise<BreakEntryWithCompliance[]> {
  const config = await isBreakTrackingEnabled();
  if (!config) {
    return [];
  }

  const entries = await getBreakEntries(employeeId, date);
  const graceMinutes = config.graceMinutes ?? 0;

  return entries.map((entry) => {
    const breakConfig = config.breaks[entry.break_type as keyof typeof config.breaks];

    let compliance: BreakComplianceResult;
    if (entry.compliance_override) {
      compliance = { compliant: true, reason: 'Employee confirmed compliance' };
    } else if (breakConfig) {
      compliance = checkBreakCompliance(entry, breakConfig, graceMinutes);
    } else {
      // No config for this break type, assume compliant if logged
      compliance = { compliant: true, reason: 'No window configured' };
    }

    return {
      ...entry,
      compliance,
    };
  });
}

/**
 * Get current time formatted as HH:MM
 */
export function getCurrentTimeFormatted(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Get today's date formatted as YYYY-MM-DD
 */
export function getTodayFormatted(): string {
  return getLocalToday();
}
