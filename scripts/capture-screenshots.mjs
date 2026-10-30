/**
 * Capture documentation screenshots from a running demo server.
 *
 * Start the server first with fresh demo data (Default brand recommended so
 * no client branding appears in the docs):
 *   npm run dev:demo
 * Then run:
 *   npm run docs:screenshots
 *
 * Env overrides: BASE_URL (default http://localhost:6029),
 * CHROMIUM_PATH (default /usr/bin/chromium), OUT_DIR (default info/screenshots).
 */

import { chromium } from 'playwright-core';
import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.BASE_URL || 'http://localhost:6029';
const CHROMIUM_PATH = process.env.CHROMIUM_PATH || '/usr/bin/chromium';
const OUT_DIR = process.env.OUT_DIR || 'info/screenshots';
const VIEWPORT = { width: 1440, height: 900 };

// Hide the Next.js dev-mode indicator so it doesn't appear in screenshots
const HIDE_DEV_OVERLAY = 'nextjs-portal { display: none !important; }';

async function login(page, username, password) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  // Retry until React has hydrated and the form submits via the API
  for (let attempt = 0; attempt < 5; attempt++) {
    await page.fill('#username', username);
    await page.fill('#password', password);
    const response = page
      .waitForResponse((res) => res.url().includes('/api/auth/login'), { timeout: 5000 })
      .catch(() => null);
    await page.press('#password', 'Enter');
    if (await response) break;
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  }
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
  await page.waitForLoadState('networkidle');
}

async function shot(page, name, { fullPage = false } = {}) {
  await page.waitForLoadState('networkidle');
  await page.addStyleTag({ content: HIDE_DEV_OVERLAY });
  // Drop focus rings left behind by clicks
  await page.evaluate(() => document.activeElement?.blur());
  await page.waitForTimeout(800); // let charts and transitions settle
  const file = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage });
  console.log(`Saved ${file}`);
}

async function visit(page, route, name, opts) {
  await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle' });
  await shot(page, name, opts);
}

async function selectReport(page, reportName) {
  await page.click('#report-select');
  await page.getByRole('option', { name: reportName }).click();
  await page.waitForLoadState('networkidle');
}

async function pickFromSelect(page, currentText, optionName) {
  await page.getByRole('combobox').filter({ hasText: currentText }).click();
  await page.getByRole('option', { name: optionName }).first().click();
  await page.waitForLoadState('networkidle');
}

async function newSession(browser, username, password, colorScheme = 'light') {
  const context = await browser.newContext({ viewport: VIEWPORT, colorScheme });
  const page = await context.newPage();
  await login(page, username, password);
  return { context, page };
}

async function captureAdmin(browser) {
  const { context, page } = await newSession(browser, 'admin', 'admin123');

  await visit(page, '/dashboard', 'dashboard');

  await visit(page, '/attendance', 'attendance-year');
  await page.getByRole('button', { name: 'Month', exact: true }).click();
  await shot(page, 'attendance-month');
  await page.getByRole('button', { name: 'Week', exact: true }).click();
  // Step to next week, where the seeded scheduled leave lands
  const nextMonday = new Date();
  nextMonday.setDate(nextMonday.getDate() + ((8 - nextMonday.getDay()) % 7 || 7));
  const monthName = nextMonday.toLocaleString('en-US', { month: 'long' });
  const weekLabel = `${nextMonday.toLocaleString('en-US', { month: 'short' })} ${nextMonday.getDate()} –`;
  await page.getByRole('combobox').filter({ hasText: new Date().toLocaleString('en-US', { month: 'long' }) }).click();
  await page.getByRole('option', { name: monthName, exact: true }).click();
  await page.getByRole('combobox').filter({ hasText: '–' }).click();
  await page.getByRole('option', { name: weekLabel }).click();
  await page.waitForLoadState('networkidle');
  await shot(page, 'attendance-week');

  // Entry dialog for a single employee (editable), opened from a vacation cell
  await page.getByRole('button', { name: 'Year', exact: true }).click();
  await pickFromSelect(page, 'All Employees', 'Anderson, Robert');
  await page.locator('td button', { hasText: 'V (8)' }).first().click();
  await page.getByRole('dialog').waitFor();
  await shot(page, 'attendance-entry-dialog');
  await page.keyboard.press('Escape');

  await visit(page, '/reports', 'report-attendance-summary');
  await selectReport(page, 'Leave Balance Summary');
  await shot(page, 'report-leave-balance');
  await selectReport(page, 'Attendance Management Report');
  await pickFromSelect(page, 'Pick an Employee', 'Anderson, Robert');
  await page.getByRole('button', { name: 'YTD', exact: true }).click();
  await page.getByRole('button', { name: 'Generate Report' }).click();
  await page.waitForLoadState('networkidle');
  await shot(page, 'report-attendance-management');

  await visit(page, '/employees', 'employees');
  await visit(page, '/users', 'users');
  await visit(page, '/settings', 'settings');

  await context.close();
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ executablePath: CHROMIUM_PATH });

  try {
    const loginPage = await browser.newPage({ viewport: VIEWPORT });
    await visit(loginPage, '/login', 'login');
    await loginPage.close();

    await captureAdmin(browser);

    const dark = await newSession(browser, 'admin', 'admin123', 'dark');
    await visit(dark.page, '/attendance', 'attendance-year-dark');
    await dark.context.close();

    // First login for a self-service user prompts for an office abbreviation
    // (the redirect happens client-side once the app loads)
    const employee = await newSession(browser, 'employee', 'demo123');
    await employee.page.goto(`${BASE_URL}/attendance`, { waitUntil: 'networkidle' });
    await employee.page.waitForTimeout(1500);
    if (employee.page.url().includes('/set-abbreviation')) {
      await shot(employee.page, 'first-login-abbreviation');
      await employee.page.fill('#abbreviation', 'SM');
      await employee.page.getByRole('button', { name: 'Save Abbreviation' }).click();
      await employee.page.waitForURL((url) => !url.pathname.startsWith('/set-abbreviation'));
      // Saving triggers a full page reload; let it settle before navigating
      await employee.page.waitForLoadState('networkidle');
      await employee.page.waitForTimeout(2000);
    }
    await visit(employee.page, '/attendance', 'employee-self-service');
    await employee.context.close();
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
