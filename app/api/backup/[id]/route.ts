/**
 * Individual Backup API Endpoints
 *
 * Handles operations on specific backups: get, verify, restore, delete
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

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/backup/[id]
 * Get details of a specific backup or verify its integrity
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
        { error: 'Forbidden: Only administrators can view backups' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    // Verify backup integrity
    if (action === 'verify') {
      try {
        const result = await backupManager.verifyBackup(backupId);
        return NextResponse.json(result);
      } catch (error: any) {
        return NextResponse.json(
          { error: error.message || 'Backup not found' },
          { status: 404 }
        );
      }
    }

    // Default: get backup details
    const backup = await backupManager.getBackup(backupId);
    if (!backup) {
      return NextResponse.json({ error: 'Backup not found' }, { status: 404 });
    }

    return NextResponse.json({ backup });

  } catch (error: any) {
    console.error('Error fetching backup:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch backup' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/backup/[id]
 * Restore from a specific backup
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: backupId } = await params;

    // Check authentication
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check permissions - only master group can restore
    if (!authUser.group?.is_master) {
      return NextResponse.json(
        { error: 'Forbidden: Only master administrators can restore backups' },
        { status: 403 }
      );
    }

    // Get the backup details first
    const backup = await backupManager.getBackup(backupId);
    if (!backup) {
      return NextResponse.json({ error: 'Backup not found' }, { status: 404 });
    }

    // Restore from backup
    const result = await backupManager.restoreBackup(backupId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to restore backup' },
        { status: 500 }
      );
    }

    // Log audit entry
    await logAudit({
      user_id: authUser.id,
      action: 'RESTORE',
      table_name: 'backups',
      record_id: undefined,
      old_values: JSON.stringify({ note: 'Database state before restore' }),
      new_values: JSON.stringify({
        restored_from: backupId,
        backup_timestamp: backup.timestamp,
      }),
      ip_address: getClientIP(request),
      user_agent: getUserAgent(request),
    });

    return NextResponse.json({
      success: true,
      restoredFrom: result.restoredFrom,
      message: 'Database restored successfully. You may need to restart the application.',
    });

  } catch (error: any) {
    console.error('Error restoring backup:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to restore backup' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/backup/[id]
 * Delete a specific backup
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
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
        { error: 'Forbidden: Only administrators can delete backups' },
        { status: 403 }
      );
    }

    // Get the backup details first
    const backup = await backupManager.getBackup(backupId);
    if (!backup) {
      return NextResponse.json({ error: 'Backup not found' }, { status: 404 });
    }

    // Delete the backup
    await backupManager.deleteBackup(backupId);

    // Log audit entry
    await logAudit({
      user_id: authUser.id,
      action: 'DELETE',
      table_name: 'backups',
      record_id: undefined,
      old_values: JSON.stringify({
        backup_id: backup.id,
        type: backup.type,
        timestamp: backup.timestamp,
      }),
      ip_address: getClientIP(request),
      user_agent: getUserAgent(request),
    });

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Error deleting backup:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete backup' },
      { status: 500 }
    );
  }
}
