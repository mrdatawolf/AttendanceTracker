import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, getClientIP, getUserAgent } from '@/lib/middleware/auth';
import { getBrandFeatures, isOfficePresenceTrackingEnabled, getOfficePresenceConfig } from '@/lib/brand-features';
import { getEffectiveDateForPresence } from '@/lib/date-helpers';
import { db } from '@/lib/db-sqlite';
import { logAudit } from '@/lib/queries-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/office-presence
 *
 * Returns today's office presence status for all active employees.
 * Each employee is either "in" (default) or "out".
 * Auto-resets daily: no row for today = in office.
 */
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const brandFeatures = await getBrandFeatures();
    if (!isOfficePresenceTrackingEnabled(brandFeatures)) {
      return NextResponse.json({ error: 'Office presence tracking is not enabled' }, { status: 403 });
    }

    const presenceConfig = getOfficePresenceConfig(brandFeatures);
    const today = getEffectiveDateForPresence(presenceConfig?.resetTime);

    const result = await db.execute({
      sql: `SELECT
              e.id,
              e.first_name,
              e.last_name,
              e.abbreviation,
              COALESCE(op.is_out, 0) AS is_out
            FROM employees e
            LEFT JOIN office_presence op
              ON e.id = op.employee_id AND op.date = ?
            WHERE e.is_active = 1
              AND COALESCE(e.show_in_office_presence, 1) = 1
            ORDER BY e.first_name, e.last_name`,
      args: [today],
    });

    const employees = (result.rows as unknown as Array<{
      id: number;
      first_name: string;
      last_name: string;
      abbreviation: string | null;
      is_out: number;
    }>).map(row => ({
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      abbreviation: row.abbreviation || `${row.first_name[0] || ''}${row.last_name[0] || ''}`.toUpperCase(),
      isOut: row.is_out === 1,
    }));

    return NextResponse.json({ employees });
  } catch (error) {
    console.error('Error fetching office presence:', error);
    return NextResponse.json({ error: 'Failed to fetch office presence' }, { status: 500 });
  }
}

/**
 * POST /api/office-presence
 *
 * Toggle an employee's office presence status for today.
 * Permission: user can toggle themselves (employee_id match) or admins can toggle anyone.
 */
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const brandFeatures = await getBrandFeatures();
    if (!isOfficePresenceTrackingEnabled(brandFeatures)) {
      return NextResponse.json({ error: 'Office presence tracking is not enabled' }, { status: 403 });
    }

    const body = await request.json();
    const { employeeId } = body;

    if (!employeeId) {
      return NextResponse.json({ error: 'employeeId is required' }, { status: 400 });
    }

    // Permission check: self or admin
    const isSelf = authUser.employee_id === employeeId;
    const isAdmin = authUser.group?.is_master === 1 || authUser.role_id === 1;

    if (!isSelf && !isAdmin) {
      return NextResponse.json({ error: 'You can only toggle your own status' }, { status: 403 });
    }

    const presenceConfig = getOfficePresenceConfig(brandFeatures);
    const today = getEffectiveDateForPresence(presenceConfig?.resetTime);

    // Get current status
    const existing = await db.execute({
      sql: 'SELECT is_out FROM office_presence WHERE employee_id = ? AND date = ?',
      args: [employeeId, today],
    });

    const currentlyOut = existing.rows.length > 0
      ? (existing.rows[0] as unknown as { is_out: number }).is_out === 1
      : false;

    const newIsOut = currentlyOut ? 0 : 1;

    // Upsert
    await db.execute({
      sql: `INSERT INTO office_presence (employee_id, date, is_out, toggled_by, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(employee_id, date) DO UPDATE SET
              is_out = ?,
              toggled_by = ?,
              updated_at = CURRENT_TIMESTAMP`,
      args: [employeeId, today, newIsOut, authUser.id, newIsOut, authUser.id],
    });

    // Audit log (non-fatal)
    try {
      await logAudit({
        user_id: authUser.id,
        action: newIsOut ? 'TOGGLE_OUT' : 'TOGGLE_IN',
        table_name: 'office_presence',
        record_id: employeeId,
        old_values: JSON.stringify({ is_out: currentlyOut ? 1 : 0 }),
        new_values: JSON.stringify({ is_out: newIsOut }),
        ip_address: getClientIP(request),
        user_agent: getUserAgent(request),
      });
    } catch (auditError) {
      console.error('Failed to log audit (non-critical):', auditError);
    }

    return NextResponse.json({
      employeeId,
      isOut: newIsOut === 1,
      toggledBy: authUser.id,
    });
  } catch (error) {
    console.error('Error toggling office presence:', error);
    return NextResponse.json({ error: 'Failed to toggle office presence' }, { status: 500 });
  }
}
