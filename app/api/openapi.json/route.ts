import { NextResponse } from 'next/server';
import { openApiSpec } from '@/lib/openapi';

export const dynamic = 'force-static';

/**
 * GET /api/openapi.json
 *
 * The machine-readable OpenAPI 3.1 spec for this API. Unauthenticated:
 * it contains endpoint metadata only, no data, and internal consumers
 * (client generators, Power BI, /api-docs) need to fetch it directly.
 */
export async function GET() {
  return NextResponse.json(openApiSpec);
}
