import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/middleware/auth';
import {
  getDataDirectory,
  getDefaultDataDirectory,
  getCustomDataPath,
  saveDataPathConfig,
} from '@/lib/data-paths';
import fs from 'fs';
import path from 'path';

/**
 * GET /api/settings/data-path
 * Get current data path configuration (super admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only super admins (master group) can access this
    if (!authUser.group?.is_master) {
      return NextResponse.json({ error: 'Forbidden - Super admin access required' }, { status: 403 });
    }

    const currentPath = getDataDirectory();
    const defaultPath = getDefaultDataDirectory();
    const customPath = getCustomDataPath();

    return NextResponse.json({
      currentPath,
      defaultPath,
      customPath,
      isCustom: customPath !== null,
    });
  } catch (error) {
    console.error('Error getting data path:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/settings/data-path
 * Set custom data path (super admin only)
 * Body: { customPath: string | null }
 */
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only super admins (master group) can access this
    if (!authUser.group?.is_master) {
      return NextResponse.json({ error: 'Forbidden - Super admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { customPath } = body;

    // If resetting to default
    if (customPath === null || customPath === '') {
      saveDataPathConfig(null, authUser.username);
      return NextResponse.json({
        success: true,
        message: 'Data path reset to default',
        currentPath: getDefaultDataDirectory(),
      });
    }

    // Validate the custom path
    const normalizedPath = path.normalize(customPath);

    // Check if path exists or can be created
    if (!fs.existsSync(normalizedPath)) {
      try {
        fs.mkdirSync(normalizedPath, { recursive: true });
      } catch (error) {
        return NextResponse.json(
          { error: `Cannot create directory: ${normalizedPath}` },
          { status: 400 }
        );
      }
    }

    // Check if path is writable
    const testFile = path.join(normalizedPath, '.write-test');
    try {
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
    } catch (error) {
      return NextResponse.json(
        { error: `Directory is not writable: ${normalizedPath}` },
        { status: 400 }
      );
    }

    // Save the custom path
    saveDataPathConfig(normalizedPath, authUser.username);

    return NextResponse.json({
      success: true,
      message: 'Custom data path saved. Restart the server for changes to take effect.',
      currentPath: normalizedPath,
      requiresRestart: true,
    });
  } catch (error) {
    console.error('Error setting data path:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
