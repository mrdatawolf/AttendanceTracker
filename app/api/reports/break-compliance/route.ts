import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import { getUserReadableGroups, isSuperuser } from '@/lib/queries-auth';
import { db, ensureInitialized } from '@/lib/db-sqlite';
import { getBrandFeatures, isGlobalReadAccessEnabled, getBreakTrackingConfig } from '@/lib/brand-features';
import { checkBreakCompliance, type BreakEntry } from '@/lib/break-tracking';

export const dynamic = 'force-dynamic';

const BREAK_LABELS: Record<string, string> = {
  break_1: 'Break 1',
  lunch: 'Lunch',
  break_2: 'Break 2',
};

export async function GET(request: NextRequest) {
  try {
    // Ensure DB migrations (including compliance_override column) have run
    await ensureInitialized();

    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if break tracking is enabled
    const brandFeatures = await getBrandFeatures();
    const breakConfig = getBreakTrackingConfig(brandFeatures);
    if (!breakConfig) {
      return NextResponse.json(
        { error: 'Break tracking is not enabled' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId') || 'all';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Start date and end date are required' },
        { status: 400 }
      );
    }

    // Permission filtering (same pattern as /api/reports)
    const userIsSuperuser = await isSuperuser(authUser.id);
    const globalRead = isGlobalReadAccessEnabled(brandFeatures);

    let sql = `
      SELECT
        e.first_name || ' ' || e.last_name AS employee_name,
        b.employee_id,
        b.entry_date,
        b.break_type,
        b.start_time,
        b.end_time,
        b.duration_minutes,
        b.notes,
        b.compliance_override
      FROM break_entries b
      JOIN employees e ON b.employee_id = e.id
      WHERE b.entry_date >= ? AND b.entry_date <= ?
        AND e.is_active = 1
    `;

    const args: any[] = [startDate, endDate];

    // Filter by user's readable groups if not superuser and global read not enabled
    if (!userIsSuperuser && !globalRead) {
      const readableGroupIds = await getUserReadableGroups(authUser.id);
      // Always include user's own group
      if (authUser.group_id && !readableGroupIds.includes(authUser.group_id)) {
        readableGroupIds.push(authUser.group_id);
      }

      if (readableGroupIds.length > 0) {
        const placeholders = readableGroupIds.map(() => '?').join(', ');
        sql += ` AND (e.group_id IS NULL OR e.group_id IN (${placeholders}))`;
        args.push(...readableGroupIds);
      } else {
        sql += ' AND e.group_id IS NULL';
      }
    }

    if (employeeId !== 'all') {
      sql += ' AND b.employee_id = ?';
      args.push(parseInt(employeeId));
    }

    sql += ' ORDER BY b.entry_date, employee_name, b.break_type';

    const result = await db.execute({ sql, args });

    // Compute compliance for each row
    const graceMinutes = breakConfig.graceMinutes ?? 0;

    const rows = result.rows.map((row: any) => {
      const breakType = String(row.break_type);
      const breakWindow = breakConfig.breaks[breakType as keyof typeof breakConfig.breaks];

      const hasOverride = Number(row.compliance_override || 0) === 1;

      // Build a BreakEntry object for compliance check
      const entry: BreakEntry = {
        id: 0,
        employee_id: Number(row.employee_id),
        entry_date: String(row.entry_date),
        break_type: breakType,
        start_time: row.start_time ? String(row.start_time) : null,
        end_time: row.end_time ? String(row.end_time) : null,
        duration_minutes: Number(row.duration_minutes),
        notes: row.notes ? String(row.notes) : null,
        compliance_override: hasOverride ? 1 : 0,
        created_at: '',
        updated_at: '',
      };

      let compliant = 'N/A';
      let reason = 'No window configured';
      let requiredDuration = '-';

      if (hasOverride) {
        compliant = 'Yes (Override)';
        reason = 'Employee confirmed compliance';
        requiredDuration = breakWindow ? String(breakWindow.duration) : '-';
      } else if (breakWindow) {
        const compliance = checkBreakCompliance(entry, breakWindow, graceMinutes);
        compliant = compliance.compliant ? 'Yes' : 'No';
        reason = compliance.reason;
        requiredDuration = String(breakWindow.duration);
      }

      return {
        employee_name: String(row.employee_name),
        entry_date: String(row.entry_date),
        break_type_label: BREAK_LABELS[breakType] || breakType,
        start_time: row.start_time ? String(row.start_time) : '-',
        duration_minutes: Number(row.duration_minutes),
        required_duration: requiredDuration,
        compliant,
        reason,
      };
    });

    return NextResponse.json(rows);
  } catch (error) {
    console.error('Error fetching break compliance report:', error);
    return NextResponse.json(
      { error: 'Failed to fetch break compliance report' },
      { status: 500 }
    );
  }
}
