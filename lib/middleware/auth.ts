import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getUserById, getUserByUsername, type User, type Group, type Role, getGroupById, getUserRole } from '../queries-auth';
import { db } from '../db-sqlite';

// JWT secret - In production, use environment variable
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '90d';

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

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

/**
 * Verify and decode a JWT token
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error) {
    return null;
  }
}

/**
 * Get the authenticated user from request
 */
export async function getAuthUser(request: NextRequest): Promise<AuthUser | null> {
  const token = getTokenFromRequest(request);
  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload) return null;

  const user = await getUserById(payload.userId);
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
