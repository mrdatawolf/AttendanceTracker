/**
 * Backup Download API Endpoint
 *
 * Handles downloading backup files.
 * Requires master group membership or can_manage_users role permission.
 */

import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { getAuthUser } from '@/lib/middleware/auth';
import { backupManager } from '@/lib/backup';

/**
 * Check if user has permission to manage backups
 */
function canManageBackups(authUser: any): boolean {
  // Master group always has access
  if (authUser.group?.is_master) return true;

  // Users with can_manage_users role permission can manage backups
  if (authUser.role?.can_manage_users) return true;

  return false;
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/backup/[id]/download
 * Download backup files
 * Query params:
 *   - db: 'attendance' | 'auth' | 'both' (default: 'both')
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: backupId } = await params;

    // Check authentication
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check permissions
    if (!canManageBackups(authUser)) {
      return NextResponse.json(
        { error: 'Forbidden: Only administrators can download backups' },
        { status: 403 }
      );
    }

    // Get backup paths
    const paths = await backupManager.getBackupPaths(backupId);
    if (!paths) {
      return NextResponse.json({ error: 'Backup not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const dbParam = searchParams.get('db') || 'attendance';

    // Determine which file to download
    let filePath: string;
    let filename: string;

    if (dbParam === 'auth') {
      filePath = paths.auth;
      filename = `${backupId}-auth.db`;
    } else {
      filePath = paths.attendance;
      filename = `${backupId}-attendance.db`;
    }

    // Read the file
    try {
      const fileBuffer = await readFile(filePath);

      // Return as downloadable file
      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': fileBuffer.length.toString(),
        },
      });
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return NextResponse.json(
          { error: 'Backup file not found on disk' },
          { status: 404 }
        );
      }
      throw error;
    }

  } catch (error: any) {
    console.error('Error downloading backup:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to download backup' },
      { status: 500 }
    );
  }
}
