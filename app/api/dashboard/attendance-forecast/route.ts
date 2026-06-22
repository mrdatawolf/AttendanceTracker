import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import { generateAttendanceForecast, isAttendanceForecastEnabled } from '@/lib/attendance-forecast';
import { serializeBigInt } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/**
 * GET /api/dashboard/attendance-forecast
 *
 * Returns office attendance forecast for upcoming days.
 * Shows expected in-office headcount based on time-off entries.
 *
 * Available to all authenticated users.
 *
 * Query params:
 * - days: Number of days to forecast (default from config, max 14)
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

    // Check if feature is enabled
    const isEnabled = await isAttendanceForecastEnabled();
    if (!isEnabled) {
      return NextResponse.json(
        { error: 'Office attendance forecast feature is not enabled' },
        { status: 403 }
      );
    }

    // Parse days parameter
    const { searchParams } = new URL(request.url);
    const daysParam = searchParams.get('days');
    let days: number | undefined;

    if (daysParam) {
      days = parseInt(daysParam, 10);
      if (isNaN(days) || days < 1) {
        days = undefined;
      } else if (days > 14) {
        days = 14; // Cap at 14 days
      }
    }

    // Generate forecast
    const forecast = await generateAttendanceForecast(days);

    if (!forecast) {
      return NextResponse.json(
        { error: 'Failed to generate forecast' },
        { status: 500 }
      );
    }

    return NextResponse.json(serializeBigInt(forecast));
  } catch (error) {
    console.error('Error generating attendance forecast:', error);
    return NextResponse.json(
      { error: 'Failed to generate attendance forecast' },
      { status: 500 }
    );
  }
}
