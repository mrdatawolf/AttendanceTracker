import { NextRequest, NextResponse } from 'next/server';
import { getAllRoles } from '@/lib/queries-auth';
import { getAuthUser } from '@/lib/middleware/auth';

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

    // Only administrators and users who can manage users can view roles
    if (!authUser.group?.is_master && !authUser.role?.can_manage_users) {
      return NextResponse.json(
        { error: 'Forbidden: You do not have permission to view roles' },
        { status: 403 }
      );
    }

    const roles = await getAllRoles();
    return NextResponse.json(roles);
  } catch (error) {
    console.error('Error fetching roles:', error);
    return NextResponse.json({ error: 'Failed to fetch roles' }, { status: 500 });
  }
}
