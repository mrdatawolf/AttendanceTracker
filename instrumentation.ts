/**
 * Next.js Instrumentation Hook
 * This file runs once when the server starts (both dev and production)
 * Perfect for database initialization and other startup tasks
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Only run on Node.js runtime (not Edge)
    const { ensureInitialized } = await import('./lib/db-sqlite');
    await ensureInitialized();
  }
}
