import { NextRequest, NextResponse } from 'next/server';
import {
  getAuditLog,
  getAuditLogForRecord,
  getAuditLogForUser,
} from '@/lib/queries-auth';
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

    // Only master and HR can view audit logs
    if (!authUser.group?.is_master && !authUser.group?.can_view_all) {
      return NextResponse.json(
        { error: 'Forbidden: You do not have permission to view audit logs' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const tableName = searchParams.get('table');
    const recordId = searchParams.get('recordId');
    const userId = searchParams.get('userId');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    let auditEntries;

    if (tableName && recordId) {
      // Get audit log for a specific record
      auditEntries = await getAuditLogForRecord(tableName, parseInt(recordId));
    } else if (userId) {
      // Get audit log for a specific user
      auditEntries = await getAuditLogForUser(parseInt(userId), limit);
    } else {
      // Get general audit log
      auditEntries = await getAuditLog(limit, offset);
    }

    return NextResponse.json(auditEntries);
  } catch (error) {
    console.error('Error fetching audit log:', error);
    return NextResponse.json({ error: 'Failed to fetch audit log' }, { status: 500 });
  }
}
