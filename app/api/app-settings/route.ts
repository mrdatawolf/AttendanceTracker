import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, getClientIP, getUserAgent } from '@/lib/middleware/auth';
import { isSuperuser, logAudit } from '@/lib/queries-auth';
import { getAllAppSettings, getAppSetting, setAppSetting } from '@/lib/app-settings';

export const dynamic = 'force-dynamic';

/**
 * GET /api/app-settings
 * Returns all app settings. Admin only.
 */
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userIsSuperuser = await isSuperuser(authUser.id);
    if (!userIsSuperuser) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const settings = await getAllAppSettings();
    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error fetching app settings:', error);
    return NextResponse.json({ error: 'Failed to fetch app settings' }, { status: 500 });
  }
}

/**
 * PUT /api/app-settings
 * Upsert an app setting. Admin only.
 * Body: { key: string, value: string }
 */
export async function PUT(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userIsSuperuser = await isSuperuser(authUser.id);
    if (!userIsSuperuser) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { key, value } = body;

    if (!key || value === undefined || value === null) {
      return NextResponse.json({ error: 'key and value are required' }, { status: 400 });
    }

    const oldValue = await getAppSetting(key);
    await setAppSetting(key, String(value));

    await logAudit({
      user_id: authUser.id,
      action: 'UPDATE',
      table_name: 'app_settings',
      record_id: 0,
      old_values: oldValue !== null ? JSON.stringify({ [key]: oldValue }) : undefined,
      new_values: JSON.stringify({ [key]: String(value) }),
      ip_address: getClientIP(request),
      user_agent: getUserAgent(request),
    });

    return NextResponse.json({ success: true, key, value: String(value) });
  } catch (error) {
    console.error('Error saving app setting:', error);
    return NextResponse.json({ error: 'Failed to save app setting' }, { status: 500 });
  }
}
