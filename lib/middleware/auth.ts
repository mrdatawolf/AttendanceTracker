import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import fs from 'fs';
import { getUserById, getUserByUsername, type User, type Group, type Role, getGroupById, getUserRole, getActiveApiKeyByHash, touchApiKeyUsage } from '../queries-auth';
import { db } from '../db-sqlite';
import { getDatabasePath } from '../data-paths';

const JWT_EXPIRES_IN = '90d';

// JWT signing secret. The JWT_SECRET env var wins when set; otherwise a
// random per-install secret is generated on first use and persisted next
// to the databases, so tokens survive restarts but installs never share
// a guessable default.
let cachedJwtSecret: string | null = null;

function getJwtSecret(): string {
  if (cachedJwtSecret) return cachedJwtSecret;

  if (process.env.JWT_SECRET) {
    cachedJwtSecret = process.env.JWT_SECRET;
    return cachedJwtSecret;
  }

  const secretPath = getDatabasePath('.jwt-secret');
  try {
    const existing = fs.readFileSync(secretPath, 'utf-8').trim();
    if (existing) {
      cachedJwtSecret = existing;
      return existing;
    }
  } catch {
    // No secret file yet — generate one below
  }

  const secret = crypto.randomBytes(32).toString('hex');
  try {
    // 'wx' fails if the file appeared since we checked, so two processes
    // starting at once can't overwrite each other's secret
    fs.writeFileSync(secretPath, secret, { mode: 0o600, flag: 'wx' });
    console.log('Generated new JWT signing secret (existing sessions must log in again)');
    cachedJwtSecret = secret;
    return secret;
  } catch {
    const existing = fs.readFileSync(secretPath, 'utf-8').trim();
    cachedJwtSecret = existing;
    return existing;
  }
}

// API keys are bearer tokens with this prefix, e.g. "atk_h3k2..."; only a
// SHA-256 hash is stored, so keys cannot be recovered after creation.
export const API_KEY_PREFIX = 'atk_';

export interface AuthUser {
  id: number;
  username: string;
  full_name: string;
  email?: string;
  group_id: number;
  is_superuser?: number; // Deprecated, use role instead
  role_id?: number;
  employee_id?: number;
  employee_abbreviation?: string;
  group?: Group;
  role?: Role;
  auth_method?: 'jwt' | 'api_key';
}

export interface JWTPayload {
  userId: number;
  username: string;
  groupId: number;
}

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate a JWT token for a user
 */
export function generateToken(user: User): string {
  const payload: JWTPayload = {
    userId: user.id,
    username: user.username,
    groupId: user.group_id,
  };

  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: JWT_EXPIRES_IN,
  });
}

/**
 * Verify and decode a JWT token
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, getJwtSecret()) as JWTPayload;
  } catch (error) {
    return null;
  }
}

/**
 * Generate a new API key. Returns the plaintext key (shown to the admin once),
 * the hash to store, and a display prefix for identifying the key later.
 */
export function generateApiKey(): { key: string; hash: string; prefix: string } {
  const key = API_KEY_PREFIX + crypto.randomBytes(24).toString('base64url');
  return { key, hash: hashApiKey(key), prefix: key.substring(0, API_KEY_PREFIX.length + 8) };
}

/**
 * Hash an API key for storage/lookup (SHA-256; keys are high-entropy)
 */
export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

// Throttle last_used_at writes to once a minute per key
const apiKeyTouchTimes = new Map<number, number>();
const API_KEY_TOUCH_INTERVAL_MS = 60_000;

/**
 * Get the authenticated user from request.
 * Accepts either a JWT (login session) or an API key (Authorization: Bearer atk_...).
 */
export async function getAuthUser(request: NextRequest): Promise<AuthUser | null> {
  const token = getTokenFromRequest(request);
  if (!token) return null;

  if (token.startsWith(API_KEY_PREFIX)) {
    const apiKey = await getActiveApiKeyByHash(hashApiKey(token));
    if (!apiKey) return null;

    const lastTouch = apiKeyTouchTimes.get(apiKey.id) || 0;
    if (Date.now() - lastTouch > API_KEY_TOUCH_INTERVAL_MS) {
      apiKeyTouchTimes.set(apiKey.id, Date.now());
      await touchApiKeyUsage(apiKey.id);
    }

    return buildAuthUser(apiKey.user_id, 'api_key');
  }

  const payload = verifyToken(token);
  if (!payload) return null;

  return buildAuthUser(payload.userId, 'jwt');
}

/**
 * Load a user with group/role/employee details into an AuthUser
 */
async function buildAuthUser(userId: number, authMethod: 'jwt' | 'api_key'): Promise<AuthUser | null> {
  const user = await getUserById(userId);
  if (!user || !user.is_active) return null;

  const group = await getGroupById(user.group_id);
  const role = await getUserRole(user.id);

  // Look up employee abbreviation from attendance.db if user is linked
  let employee_abbreviation: string | undefined;
  if (user.employee_id) {
    try {
      const empResult = await db.execute({
        sql: 'SELECT abbreviation FROM employees WHERE id = ?',
        args: [user.employee_id],
      });
      employee_abbreviation = (empResult.rows[0] as any)?.abbreviation || undefined;
    } catch {
      // Non-fatal: attendance DB may not be available
    }
  }

  return {
    id: user.id,
    username: user.username,
    full_name: user.full_name,
    email: user.email,
    group_id: user.group_id,
    is_superuser: user.is_superuser,
    role_id: user.role_id,
    employee_id: user.employee_id,
    employee_abbreviation,
    group: group || undefined,
    role: role || undefined,
    auth_method: authMethod,
  };
}

/**
 * Extract token from request headers or cookies
 */
export function getTokenFromRequest(request: NextRequest): string | null {
  // Check Authorization header
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Check cookie
  const token = request.cookies.get('auth_token')?.value;
  return token || null;
}

/**
 * Authenticate user with username and password
 */
export async function authenticateUser(username: string, password: string): Promise<User | null> {
  const user = await getUserByUsername(username);
  if (!user) return null;

  const isValid = await verifyPassword(password, user.password_hash);
  if (!isValid) return null;

  return user;
}

/**
 * Get client IP address from request
 */
export function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const real = request.headers.get('x-real-ip');
  if (real) {
    return real;
  }

  return 'unknown';
}

/**
 * Get user agent from request
 */
export function getUserAgent(request: NextRequest): string {
  return request.headers.get('user-agent') || 'unknown';
}
