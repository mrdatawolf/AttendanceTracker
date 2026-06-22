/**
 * Copy to Distribute
 *
 * Copies the built exe files to distribution folders with brand-specific names.
 * - Client setup → distribute/
 * - Server setup → distribute_server/
 *
 * Used as the final step of build:all to collect distribution artifacts.
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const DIST_ELECTRON_DIR = path.join(ROOT_DIR, 'dist-electron');
const DISTRIBUTE_DIR = path.join(ROOT_DIR, 'distribute');
const DISTRIBUTE_SERVER_DIR = path.join(ROOT_DIR, 'distribute_server');
const BRAND_SELECTION_FILE = path.join(ROOT_DIR, 'lib', 'brand-selection.json');

// Get current brand from selection file
function getCurrentBrand() {
  try {
    const data = JSON.parse(fs.readFileSync(BRAND_SELECTION_FILE, 'utf8'));
    return data.brand || 'Default';
  } catch {
    return 'Default';
  }
}

// Get package version
function getPackageVersion() {
  const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf8'));
  return packageJson.version;
}

// Main function
function main() {
  const brand = getCurrentBrand();
  const version = getPackageVersion();

  console.log('');
  console.log('========================================');
  console.log('  Copy to Distribute');
  console.log('========================================');
  console.log(`  Brand: ${brand}`);
  console.log(`  Version: ${version}`);
  console.log('');

  if (!fs.existsSync(DIST_ELECTRON_DIR)) {
    console.log('⚠ dist-electron not found, nothing to copy');
    return;
  }

  const files = fs.readdirSync(DIST_ELECTRON_DIR);

  // Find and copy client Setup exe (does NOT contain "Server")
  const clientSetupExe = files.find(f => f.endsWith('.exe') && f.includes('Setup') && !f.includes('Server'));

  if (clientSetupExe) {
    // Create distribute directory if needed
    if (!fs.existsSync(DISTRIBUTE_DIR)) {
      fs.mkdirSync(DISTRIBUTE_DIR, { recursive: true });
    }

    const srcPath = path.join(DIST_ELECTRON_DIR, clientSetupExe);
    const destFileName = `Attendance-Management-${brand}-${version}-Setup.exe`;
    const destPath = path.join(DISTRIBUTE_DIR, destFileName);

    fs.copyFileSync(srcPath, destPath);
    console.log(`✓ Client: ${destFileName}`);
    console.log(`  → ${DISTRIBUTE_DIR}`);
  } else {
    console.log('⚠ No client Setup exe found in dist-electron');
  }

  // Find and copy server Setup exe (contains "Server")
  const serverSetupExe = files.find(f => f.endsWith('.exe') && f.includes('Server') && f.includes('Setup'));

  if (serverSetupExe) {
    // Create distribute_server directory if needed
    if (!fs.existsSync(DISTRIBUTE_SERVER_DIR)) {
      fs.mkdirSync(DISTRIBUTE_SERVER_DIR, { recursive: true });
    }

    const srcPath = path.join(DIST_ELECTRON_DIR, serverSetupExe);
    const destFileName = `Attendance-Server-${brand}-${version}-Setup.exe`;
    const destPath = path.join(DISTRIBUTE_SERVER_DIR, destFileName);

    fs.copyFileSync(srcPath, destPath);
    console.log(`✓ Server: ${destFileName}`);
    console.log(`  → ${DISTRIBUTE_SERVER_DIR}`);
  } else {
    console.log('⚠ No server Setup exe found in dist-electron');
  }

  console.log('');
}

main();
