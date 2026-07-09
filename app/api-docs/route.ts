import { NextResponse } from 'next/server';

export const dynamic = 'force-static';

/**
 * GET /api-docs
 *
 * Interactive API documentation rendered by Scalar (vendored at
 * public/vendor/scalar-api-reference.js so it works fully offline)
 * from the spec at /api/openapi.json.
 */
export async function GET() {
  const html = `<!doctype html>
<html>
  <head>
    <title>AttendanceTracker API Reference</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body>
    <script id="api-reference" data-url="/api/openapi.json"></script>
    <script src="/vendor/scalar-api-reference.js"></script>
  </body>
</html>`;

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
