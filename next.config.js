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
    ],
  },

  // Disable image optimization to avoid Sharp dependency issues
  // We only use a small logo, so optimization isn't needed
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;
