/**
 * Backup API Endpoints
 *
 * Handles backup operations: list, create, status
 * All operations require master group membership or can_manage_users role permission.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, getClientIP, getUserAgent } from '@/lib/middleware/auth';
import { logAudit } from '@/lib/queries-auth';
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

/**
 * GET /api/backup
 * List all backups or get backup status
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check permissions
    if (!canManageBackups(authUser)) {
      return NextResponse.json(
        { error: 'Forbidden: Only administrators can manage backups' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    // Get storage usage/status
    if (action === 'status') {
      const usage = await backupManager.getStorageUsage();
      const backups = await backupManager.listBackups();
      const newestBackup = backups.length > 0 ? backups[0] : null;

      return NextResponse.json({
        enabled: true,
        lastBackup: newestBackup?.timestamp || null,
        storage: usage,
      });
    }

    // Default: list all backups
    const backups = await backupManager.listBackups();
    return NextResponse.json({ backups });

  } catch (error: any) {
    console.error('Error fetching backups:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch backups' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/backup
 * Create a new backup
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check permissions
    if (!canManageBackups(authUser)) {
      return NextResponse.json(
        { error: 'Forbidden: Only administrators can create backups' },
        { status: 403 }
      );
    }

    // Create backup
    const result = await backupManager.createBackup('manual', authUser.username);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to create backup' },
        { status: 500 }
      );
    }

    // Log audit entry
    await logAudit({
      user_id: authUser.id,
      action: 'CREATE',
      table_name: 'backups',
      record_id: undefined,
      new_values: JSON.stringify({
        backup_id: result.backup?.id,
        type: result.backup?.type,
        timestamp: result.backup?.timestamp,
      }),
      ip_address: getClientIP(request),
      user_agent: getUserAgent(request),
    });

    return NextResponse.json({
      success: true,
      backup: result.backup,
    });

  } catch (error: any) {
    console.error('Error creating backup:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create backup' },
      { status: 500 }
    );
  }
}
