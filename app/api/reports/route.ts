import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import { getUserReadableGroups, isSuperuser } from '@/lib/queries-auth';
import { db } from '@/lib/db-sqlite';
import { getBrandFeatures, isGlobalReadAccessEnabled } from '@/lib/brand-features';

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId') || 'all';
    const timeCode = searchParams.get('timeCode') || 'all';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'Start date and end date are required' }, { status: 400 });
    }

    // Check if user is superuser or has global read access
    const userIsSuperuser = await isSuperuser(authUser.id);
    const brandFeatures = await getBrandFeatures();
    const globalRead = isGlobalReadAccessEnabled(brandFeatures);

    // Build query with permission filtering
    let sql = `
      SELECT
        e.first_name || ' ' || e.last_name AS employee_name,
        te.entry_date,
        te.time_code,
        te.hours,
        te.notes
      FROM attendance_entries te
      JOIN employees e ON te.employee_id = e.id
      WHERE te.entry_date >= ? AND te.entry_date <= ?
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
        // User has no readable groups - only show employees without a group
        sql += ' AND e.group_id IS NULL';
      }
    }

    if (employeeId !== 'all') {
      sql += ' AND te.employee_id = ?';
      args.push(parseInt(employeeId));
    }

    if (timeCode !== 'all') {
      sql += ' AND te.time_code = ?';
      args.push(timeCode);
    }

    sql += ' ORDER BY te.entry_date, employee_name';

    const result = await db.execute({ sql, args });

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Error fetching report data:', error);
    return NextResponse.json({ error: 'Failed to fetch report data' }, { status: 500 });
  }
}
