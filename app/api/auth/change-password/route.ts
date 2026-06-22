import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, verifyPassword, hashPassword, getClientIP, getUserAgent } from '@/lib/middleware/auth';
import { logAudit } from '@/lib/queries-auth';
import { authDb } from '@/lib/db-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { currentPassword, newPassword } = await request.json();

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: 'Current password and new password are required' }, { status: 400 });
  }

  if (newPassword.length < 6) {
    return NextResponse.json({ error: 'New password must be at least 6 characters' }, { status: 400 });
  }

  // Get the user's current password hash and must_change_password flag
  const userResult = await authDb.execute({
    sql: 'SELECT password_hash, must_change_password FROM users WHERE id = ?',
    args: [authUser.id],
  });

  const user = userResult.rows[0] as any;
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  // Verify current password
  const isValid = await verifyPassword(currentPassword, user.password_hash);
  if (!isValid) {
    return NextResponse.json({ error: 'Current password is incorrect' }, { status: 403 });
  }

  // Hash and update the new password, clearing the forced-change flag
  const newHash = await hashPassword(newPassword);
  await authDb.execute({
    sql: 'UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    args: [newHash, authUser.id],
  });

  await logAudit({
    user_id: authUser.id,
    action: 'CHANGE_PASSWORD',
    table_name: 'users',
    record_id: authUser.id,
    old_values: undefined,
    new_values: undefined,
    ip_address: getClientIP(request),
    user_agent: getUserAgent(request),
  });

  return NextResponse.json({ message: 'Password changed successfully' });
}
