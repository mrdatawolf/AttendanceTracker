import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/middleware/auth';
import {
  getUserGroupPermissions,
  getUserGroupPermission,
  setUserGroupPermission,
  removeUserGroupPermission,
  isSuperuser,
  logAudit,
} from '@/lib/queries-auth';

/**
 * GET /api/user-group-permissions
 * Get permissions for a user
 * Query params:
 * - userId: Required - ID of user to get permissions for
 */
export async function GET(req: NextRequest) {
  try {
    // Verify authentication
    const token = req.headers.get('authorization')?.replace('Bearer ', '') ||
                  req.cookies.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Only superusers can view permissions
    const isSuper = await isSuperuser(decoded.userId);
    if (!isSuper) {
      return NextResponse.json({ error: 'Forbidden: Only superusers can manage permissions' }, { status: 403 });
    }

    // Get user ID from query params
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // Get permissions
    const permissions = await getUserGroupPermissions(Number(userId));

    return NextResponse.json({ permissions });
  } catch (error) {
    console.error('Error fetching user group permissions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch permissions' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/user-group-permissions
 * Set permissions for a user on a group
 * Body:
 * {
 *   userId: number,
 *   groupId: number,
 *   can_create: boolean,
 *   can_read: boolean,
 *   can_update: boolean,
 *   can_delete: boolean
 * }
 */
export async function POST(req: NextRequest) {
  try {
    // Verify authentication
    const token = req.headers.get('authorization')?.replace('Bearer ', '') ||
                  req.cookies.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Only superusers can modify permissions
    const isSuper = await isSuperuser(decoded.userId);
    if (!isSuper) {
      return NextResponse.json({ error: 'Forbidden: Only superusers can manage permissions' }, { status: 403 });
    }

    // Parse request body
    const body = await req.json();
    const { userId, groupId, can_create, can_read, can_update, can_delete } = body;

    if (!userId || !groupId) {
      return NextResponse.json({ error: 'userId and groupId are required' }, { status: 400 });
    }

    // Get old permissions for audit log
    const oldPermission = await getUserGroupPermission(Number(userId), Number(groupId));

    // Set new permissions
    await setUserGroupPermission(Number(userId), Number(groupId), {
      can_create: can_create ?? false,
      can_read: can_read ?? true, // Default to read access
      can_update: can_update ?? false,
      can_delete: can_delete ?? false,
    });

    // Get new permissions
    const newPermission = await getUserGroupPermission(Number(userId), Number(groupId));

    // Log the change
    await logAudit({
      user_id: decoded.userId,
      action: oldPermission ? 'UPDATE' : 'CREATE',
      table_name: 'user_group_permissions',
      record_id: newPermission?.id,
      old_values: oldPermission ? JSON.stringify(oldPermission) : undefined,
      new_values: newPermission ? JSON.stringify(newPermission) : undefined,
      ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
      user_agent: req.headers.get('user-agent') || 'unknown',
    });

    return NextResponse.json({
      success: true,
      permission: newPermission,
    });
  } catch (error) {
    console.error('Error setting user group permissions:', error);
    return NextResponse.json(
      { error: 'Failed to set permissions' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/user-group-permissions
 * Remove permissions for a user on a group
 * Query params:
 * - userId: Required
 * - groupId: Required
 */
export async function DELETE(req: NextRequest) {
  try {
    // Verify authentication
    const token = req.headers.get('authorization')?.replace('Bearer ', '') ||
                  req.cookies.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Only superusers can modify permissions
    const isSuper = await isSuperuser(decoded.userId);
    if (!isSuper) {
      return NextResponse.json({ error: 'Forbidden: Only superusers can manage permissions' }, { status: 403 });
    }

    // Get query params
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const groupId = searchParams.get('groupId');

    if (!userId || !groupId) {
      return NextResponse.json({ error: 'userId and groupId are required' }, { status: 400 });
    }

    // Get old permission for audit log
    const oldPermission = await getUserGroupPermission(Number(userId), Number(groupId));

    // Remove permission
    await removeUserGroupPermission(Number(userId), Number(groupId));

    // Log the change
    await logAudit({
      user_id: decoded.userId,
      action: 'DELETE',
      table_name: 'user_group_permissions',
      record_id: oldPermission?.id,
      old_values: oldPermission ? JSON.stringify(oldPermission) : undefined,
      new_values: undefined,
      ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown',
      user_agent: req.headers.get('user-agent') || 'unknown',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing user group permissions:', error);
    return NextResponse.json(
      { error: 'Failed to remove permissions' },
      { status: 500 }
    );
  }
}
