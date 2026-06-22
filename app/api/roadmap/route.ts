import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/middleware/auth';
import fs from 'fs/promises';
import path from 'path';

export async function GET(req: NextRequest) {
  try {
    // Verify authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is in Master group
    const { authDb } = await import('@/lib/db-auth');
    const userResult = await authDb.execute({
      sql: `SELECT u.id, g.is_master
            FROM users u
            JOIN groups g ON u.group_id = g.id
            WHERE u.id = ?`,
      args: [decoded.userId],
    });

    const user = userResult.rows[0] as any;
    if (!user || user.is_master !== 1) {
      return NextResponse.json({ error: 'Forbidden: Master group access required' }, { status: 403 });
    }

    // Read the roadmap markdown file
    const roadmapPath = path.join(process.cwd(), 'info', 'ROADMAP.md');
    const content = await fs.readFile(roadmapPath, 'utf-8');

    return NextResponse.json({ content });
  } catch (error: any) {
    console.error('Error loading roadmap:', error);
    return NextResponse.json(
      { error: 'Failed to load roadmap', details: error.message },
      { status: 500 }
    );
  }
}
