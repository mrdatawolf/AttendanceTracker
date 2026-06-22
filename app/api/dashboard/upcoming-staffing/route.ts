import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import { db } from '@/lib/db-sqlite';
import { serializeBigInt } from '@/lib/utils';
import { formatDateStr } from '@/lib/date-helpers';

/**
 * GET /api/dashboard/upcoming-staffing
 *
 * Returns limited staffing data for the next N days (default 5).
 * Available to all authenticated users - only returns basic info:
 * - Employee name
 * - Date
 * - Time code
 * - Hours
 *
 * Does NOT expose sensitive balance or allocation data.
 */
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
    const days = parseInt(searchParams.get('days') || '5');

    // Calculate date range (today + next N days)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = formatDateStr(today);

    const endDate = new Date(today);
    endDate.setDate(today.getDate() + days - 1);
    const endDateStr = formatDateStr(endDate);

    // Fetch entries with employee names for the date range
    // Only return basic info needed for staffing view
    const result = await db.execute({
      sql: `
        SELECT
          ae.id,
          ae.employee_id,
          ae.entry_date,
          ae.time_code,
          ae.hours,
          e.first_name,
          e.last_name
        FROM attendance_entries ae
        JOIN employees e ON ae.employee_id = e.id
        WHERE ae.entry_date >= ? AND ae.entry_date <= ?
          AND e.is_active = 1
        ORDER BY ae.entry_date, e.last_name, e.first_name
      `,
      args: [startDate, endDateStr],
    });

    return NextResponse.json(serializeBigInt(result.rows));
  } catch (error) {
    console.error('Error fetching upcoming staffing:', error);
    return NextResponse.json({ error: 'Failed to fetch upcoming staffing' }, { status: 500 });
  }
}
