/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable Turbopack due to Windows compatibility issues
  // turbopack: {},
  // Standalone output for packaging
  output: 'standalone',
  // Note: instrumentation.ts is available by default in Next.js 16+

  // Exclude large directories from standalone build to prevent size bloat
  // These folders contain build artifacts that shouldn't be copied to .next/standalone
  outputFileTracingExcludes: {
    '*': [
      './distribute/**',
      './dist-electron/**',
      './dist-server/**',
      './temp-server-build/**',
      './.node-portable/**',
      './electron-app/node_modules/**',
      // Sample/example data and live runtime databases must never ship in build output
      './Examples/**',
      './examples/**',
      './databases/**',
    ],
  },

  // Disable image optimization to avoid Sharp dependency issues
  // We only use a small logo, so optimization isn't needed
  images: {
    unoptimized: true,
  },

  // This is a demo/dev server reached over LAN by IP addresses that vary
  // per deployment (DHCP), so allow any origin rather than hardcoding one.
  // Next.js rejects a bare '*' as a footgun, but these multi-segment
  // wildcards match any IPv4 address or dotted hostname. No effect on
  // `next start` (production) - allowedDevOrigins only guards the dev server.
  allowedDevOrigins: ['*.*.*.*', '*.*.*', '*.*'],
};

module.exports = nextConfig;
