import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, generateApiKey, getClientIP, getUserAgent, type AuthUser } from '@/lib/middleware/auth';
import {
  getAllApiKeys,
  getApiKeyById,
  createApiKey,
  revokeApiKey,
  getUserById,
  logAudit,
} from '@/lib/queries-auth';

// API keys grant the access of the user they belong to, so managing them is
// restricted to admins on an interactive login — a key cannot mint or revoke keys.
function canManageApiKeys(authUser: AuthUser | null): authUser is AuthUser {
  if (!authUser) return false;
  if (authUser.auth_method === 'api_key') return false;
  return authUser.group?.is_master === 1 || authUser.role?.can_manage_users === 1;
}

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!canManageApiKeys(authUser)) {
      return NextResponse.json(
        { error: 'Forbidden: You do not have permission to manage API keys' },
        { status: 403 }
      );
    }

    const keys = await getAllApiKeys();
    return NextResponse.json(keys);
  } catch (error) {
    console.error('Error fetching API keys:', error);
    return NextResponse.json({ error: 'Failed to fetch API keys' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!canManageApiKeys(authUser)) {
      return NextResponse.json(
        { error: 'Forbidden: You do not have permission to manage API keys' },
        { status: 403 }
      );
    }

    const body = await request.json();

    if (!body.name || !body.user_id) {
      return NextResponse.json(
        { error: 'Missing required fields: name, user_id' },
        { status: 400 }
      );
    }

    const user = await getUserById(Number(body.user_id));
    if (!user || !user.is_active) {
      return NextResponse.json(
        { error: 'user_id must reference an active user' },
        { status: 400 }
      );
    }

    let expires_at: string | undefined;
    if (body.expires_in_days) {
      const days = Number(body.expires_in_days);
      if (!Number.isFinite(days) || days <= 0) {
        return NextResponse.json(
          { error: 'expires_in_days must be a positive number' },
          { status: 400 }
        );
      }
      const expiry = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
      expires_at = expiry.toISOString().replace('T', ' ').substring(0, 19);
    }

    const { key, hash, prefix } = generateApiKey();

    const created = await createApiKey({
      name: String(body.name).trim(),
      key_prefix: prefix,
      key_hash: hash,
      user_id: user.id,
      expires_at,
      created_by: authUser.id,
    });

    await logAudit({
      user_id: authUser.id,
      action: 'CREATE',
      table_name: 'api_keys',
      record_id: created.id,
      new_values: JSON.stringify({
        name: created.name,
        key_prefix: created.key_prefix,
        user_id: created.user_id,
        expires_at: created.expires_at || null,
      }),
      ip_address: getClientIP(request),
      user_agent: getUserAgent(request),
    });

    // The plaintext key is returned exactly once and never stored
    return NextResponse.json({ ...created, key });
  } catch (error) {
    console.error('Error creating API key:', error);
    return NextResponse.json({ error: 'Failed to create API key' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!canManageApiKeys(authUser)) {
      return NextResponse.json(
        { error: 'Forbidden: You do not have permission to manage API keys' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const keyId = searchParams.get('id');

    if (!keyId) {
      return NextResponse.json({ error: 'API key ID is required' }, { status: 400 });
    }

    const apiKey = await getApiKeyById(parseInt(keyId));
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 });
    }

    await revokeApiKey(apiKey.id);

    await logAudit({
      user_id: authUser.id,
      action: 'DELETE',
      table_name: 'api_keys',
      record_id: apiKey.id,
      old_values: JSON.stringify({
        name: apiKey.name,
        key_prefix: apiKey.key_prefix,
        user_id: apiKey.user_id,
        is_active: apiKey.is_active,
      }),
      new_values: JSON.stringify({ is_active: 0 }),
      ip_address: getClientIP(request),
      user_agent: getUserAgent(request),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error revoking API key:', error);
    return NextResponse.json({ error: 'Failed to revoke API key' }, { status: 500 });
  }
}
