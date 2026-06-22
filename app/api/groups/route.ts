import { NextRequest, NextResponse } from 'next/server';
import {
  getAllGroups,
  getGroupById,
  createGroup,
} from '@/lib/queries-auth';
import { getAuthUser, getClientIP, getUserAgent } from '@/lib/middleware/auth';
import { logAudit } from '@/lib/queries-auth';

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
    const groupId = searchParams.get('id');

    if (groupId) {
      const group = await getGroupById(parseInt(groupId));
      if (group) {
        return NextResponse.json(group);
      } else {
        return NextResponse.json({ error: 'Group not found' }, { status: 404 });
      }
    } else {
      const groups = await getAllGroups();
      return NextResponse.json(groups);
    }
  } catch (error) {
    console.error('Error fetching groups:', error);
    return NextResponse.json({ error: 'Failed to fetch groups' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Only master group can create new groups
    if (!authUser.group?.is_master) {
      return NextResponse.json(
        { error: 'Forbidden: Only master administrators can create groups' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Validate required fields
    if (!body.name) {
      return NextResponse.json(
        { error: 'Group name is required' },
        { status: 400 }
      );
    }

    const newGroup = await createGroup({
      name: body.name,
      description: body.description,
      is_master: body.is_master || 0,
      can_view_all: body.can_view_all || 0,
      can_edit_all: body.can_edit_all || 0,
    });

    // Log audit entry
    await logAudit({
      user_id: authUser.id,
      action: 'CREATE',
      table_name: 'groups',
      record_id: newGroup.id,
      new_values: JSON.stringify({
        name: newGroup.name,
        description: newGroup.description,
        is_master: newGroup.is_master,
        can_view_all: newGroup.can_view_all,
        can_edit_all: newGroup.can_edit_all,
      }),
      ip_address: getClientIP(request),
      user_agent: getUserAgent(request),
    });

    return NextResponse.json(newGroup);
  } catch (error) {
    console.error('Error creating group:', error);
    return NextResponse.json({ error: 'Failed to create group' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Check authentication
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Only master group can edit groups
    if (!authUser.group?.is_master) {
      return NextResponse.json(
        { error: 'Forbidden: Only master administrators can edit groups' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const groupId = body.id;

    if (!groupId) {
      return NextResponse.json(
        { error: 'Group ID is required' },
        { status: 400 }
      );
    }

    // Get old values for audit log
    const oldGroup = await getGroupById(groupId);
    if (!oldGroup) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    // Build update query
    const updates: string[] = [];
    const args: any[] = [];

    if (body.name !== undefined) {
      updates.push('name = ?');
      args.push(body.name);
    }

    if (body.description !== undefined) {
      updates.push('description = ?');
      args.push(body.description);
    }

    if (body.can_view_all !== undefined) {
      updates.push('can_view_all = ?');
      args.push(body.can_view_all);
    }

    if (body.can_edit_all !== undefined) {
      updates.push('can_edit_all = ?');
      args.push(body.can_edit_all);
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    args.push(groupId);

    const { authDb } = await import('@/lib/db-auth');
    await authDb.execute({
      sql: `UPDATE groups SET ${updates.join(', ')} WHERE id = ?`,
      args,
    });

    // Get updated group
    const updatedGroup = await getGroupById(groupId);

    // Log audit entry
    await logAudit({
      user_id: authUser.id,
      action: 'UPDATE',
      table_name: 'groups',
      record_id: groupId,
      old_values: JSON.stringify({
        name: oldGroup.name,
        description: oldGroup.description,
        can_view_all: oldGroup.can_view_all,
        can_edit_all: oldGroup.can_edit_all,
      }),
      new_values: JSON.stringify({
        name: updatedGroup?.name,
        description: updatedGroup?.description,
        can_view_all: updatedGroup?.can_view_all,
        can_edit_all: updatedGroup?.can_edit_all,
      }),
      ip_address: getClientIP(request),
      user_agent: getUserAgent(request),
    });

    return NextResponse.json(updatedGroup);
  } catch (error) {
    console.error('Error updating group:', error);
    return NextResponse.json({ error: 'Failed to update group' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Check authentication
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Only master group can delete groups
    if (!authUser.group?.is_master) {
      return NextResponse.json(
        { error: 'Forbidden: Only master administrators can delete groups' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('id');

    if (!groupId) {
      return NextResponse.json(
        { error: 'Group ID is required' },
        { status: 400 }
      );
    }

    const id = parseInt(groupId);

    // Get group for audit log
    const group = await getGroupById(id);
    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    // Prevent deletion of master groups
    if (group.is_master === 1) {
      return NextResponse.json(
        { error: 'Cannot delete master groups' },
        { status: 400 }
      );
    }

    // Check if group has users assigned
    const { authDb } = await import('@/lib/db-auth');
    const usersResult = await authDb.execute({
      sql: 'SELECT COUNT(*) as count FROM users WHERE group_id = ?',
      args: [id],
    });
    const userCount = (usersResult.rows[0] as any)?.count || 0;

    if (userCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete group with ${userCount} user(s) assigned. Reassign users first.` },
        { status: 400 }
      );
    }

    // Check if group has employees assigned (in attendance db)
    const { db } = await import('@/lib/db-sqlite');
    const employeesResult = await db.execute({
      sql: 'SELECT COUNT(*) as count FROM employees WHERE group_id = ?',
      args: [id],
    });
    const employeeCount = (employeesResult.rows[0] as any)?.count || 0;

    if (employeeCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete group with ${employeeCount} employee(s) assigned. Reassign employees first.` },
        { status: 400 }
      );
    }

    // Delete the group
    await authDb.execute({
      sql: 'DELETE FROM groups WHERE id = ?',
      args: [id],
    });

    // Log audit entry
    await logAudit({
      user_id: authUser.id,
      action: 'DELETE',
      table_name: 'groups',
      record_id: id,
      old_values: JSON.stringify({
        name: group.name,
        description: group.description,
        is_master: group.is_master,
        can_view_all: group.can_view_all,
        can_edit_all: group.can_edit_all,
      }),
      ip_address: getClientIP(request),
      user_agent: getUserAgent(request),
    });

    return NextResponse.json({ success: true, message: 'Group deleted successfully' });
  } catch (error) {
    console.error('Error deleting group:', error);
    return NextResponse.json({ error: 'Failed to delete group' }, { status: 500 });
  }
}
