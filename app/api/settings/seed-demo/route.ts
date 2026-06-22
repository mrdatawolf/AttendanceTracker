import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, getClientIP, getUserAgent } from '@/lib/middleware/auth';
import { logAudit } from '@/lib/queries-auth';
import { clearDatabaseForDemo } from '@/lib/db-sqlite';
import { seedDemoData } from '@/lib/seed-demo-data';

/**
 * POST /api/settings/seed-demo
 *
 * Wipes employee, attendance, allocation, presence, and break data, then
 * repopulates the database with the standard demo dataset (sample
 * employees, attendance history, and manager/HR/employee demo logins).
 *
 * Super admin (master group) only. This is a one-way operation intended
 * for turning a freshly installed server into a demo/presentation server.
 */
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!authUser.group?.is_master) {
      return NextResponse.json(
        { error: 'Forbidden - Super admin access required' },
        { status: 403 }
      );
    }

    await clearDatabaseForDemo();
    await seedDemoData();

    await logAudit({
      user_id: authUser.id,
      action: 'SEED_DEMO_DATA',
      table_name: 'database',
      ip_address: getClientIP(request),
      user_agent: getUserAgent(request),
    });

    return NextResponse.json({
      success: true,
      message: 'Demo data has been loaded. Reload the app to see the changes.',
    });
  } catch (error) {
    console.error('Error seeding demo data:', error);
    return NextResponse.json({ error: 'Failed to seed demo data' }, { status: 500 });
  }
}
