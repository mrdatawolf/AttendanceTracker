import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, getClientIP, getUserAgent } from '@/lib/middleware/auth';
import { logAudit } from '@/lib/queries-auth';

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user (if any)
    const user = await getAuthUser(request);

    // Log audit entry if user was authenticated
    if (user) {
      await logAudit({
        user_id: user.id,
        action: 'LOGOUT',
        table_name: 'users',
        record_id: user.id,
        ip_address: getClientIP(request),
        user_agent: getUserAgent(request),
      });
    }

    // Clear the auth cookie
    const response = NextResponse.json({ success: true });
    response.cookies.delete('auth_token');

    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
