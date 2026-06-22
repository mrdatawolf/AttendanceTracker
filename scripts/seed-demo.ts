/**
 * Demo Seed Script
 *
 * Thin CLI wrapper around lib/seed-demo-data.ts, which is the single
 * source of truth for demo data (also used by db-sqlite.ts when
 * DemoMode is enabled).
 *
 * Run with: npx tsx scripts/seed-demo.ts
 */

import { seedDemoData } from '../lib/seed-demo-data';

seedDemoData()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
