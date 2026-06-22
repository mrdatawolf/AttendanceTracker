/**
 * Build All Brands
 *
 * Automatically builds distributions for all available brands.
 * This script:
 * 1. Discovers all brand folders in public/
 * 2. For each brand:
 *    - Cleans build directories
 *    - Selects the brand (non-interactive)
 *    - Runs the full build pipeline
 *    - Copies the exe to distribute/ folder
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const BRAND_SELECTION_FILE = path.join(ROOT_DIR, 'lib', 'brand-selection.json');
const DISTRIBUTE_DIR = path.join(ROOT_DIR, 'distribute');

// Directories to clean between builds
const BUILD_DIRS = ['dist-electron', 'dist-server', 'temp-server-build', '.next'];

// Get available brands from public/ subfolders
function getAvailableBrands() {
  const entries = fs.readdirSync(PUBLIC_DIR, { withFileTypes: true });
  return entries
    .filter(entry => entry.isDirectory())
    .filter(entry => {
      // Check if the folder contains a brand-features.json
      const brandFeaturesPath = path.join(PUBLIC_DIR, entry.name, 'brand-features.json');
      return fs.existsSync(brandFeaturesPath);
    })
    .map(entry => entry.name);
}

// Select a brand programmatically (no prompt)
function selectBrand(brandName) {
  const data = {
    brand: brandName,
    selectedAt: new Date().toISOString(),
  };
  fs.writeFileSync(BRAND_SELECTION_FILE, JSON.stringify(data, null, 2) + '\n');
}

// Clean build directories
function cleanBuildDirs() {
  BUILD_DIRS.forEach(dir => {
    const dirPath = path.join(ROOT_DIR, dir);
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
      console.log(`  Cleaned: ${dir}`);
    }
  });
}

// Get package version for exe naming
function getPackageVersion() {
  const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf8'));
  return packageJson.version;
}

// Find and copy the exe to distribute folder with brand name
function copyExeToDistribute(brandName) {
  const distElectronDir = path.join(ROOT_DIR, 'dist-electron');

  if (!fs.existsSync(distElectronDir)) {
    console.log(`  ⚠ dist-electron not found, skipping exe copy`);
    return false;
  }

  // Find the Setup exe file
  const files = fs.readdirSync(distElectronDir);
  const setupExe = files.find(f => f.endsWith('.exe') && f.includes('Setup'));

  if (!setupExe) {
    console.log(`  ⚠ No Setup exe found in dist-electron`);
    return false;
  }

  // Create distribute directory if needed
  if (!fs.existsSync(DISTRIBUTE_DIR)) {
    fs.mkdirSync(DISTRIBUTE_DIR, { recursive: true });
  }

  const version = getPackageVersion();
  const srcPath = path.join(distElectronDir, setupExe);
  const destFileName = `Attendance-Management-${brandName}-${version}-Setup.exe`;
  const destPath = path.join(DISTRIBUTE_DIR, destFileName);

  fs.copyFileSync(srcPath, destPath);
  console.log(`  ✓ Copied: ${destFileName}`);
  return true;
}

// Run the build pipeline for a brand (without select-brand prompt)
function runBuildForBrand() {
  // Run each step individually since build:all includes select-brand which prompts
  execSync('npm run build', { stdio: 'inherit', cwd: ROOT_DIR });
  execSync('node scripts/package-standalone.js', { stdio: 'inherit', cwd: ROOT_DIR });
  execSync('npm run electron:build', { stdio: 'inherit', cwd: ROOT_DIR });
  execSync('npm run server:installer', { stdio: 'inherit', cwd: ROOT_DIR });
}

// Main function
async function main() {
  const brands = getAvailableBrands();

  console.log('');
  console.log('========================================');
  console.log('  Build All Brands');
  console.log('========================================');
  console.log('');
  console.log(`Found ${brands.length} brands: ${brands.join(', ')}`);
  console.log('');

  let successCount = 0;
  let failureCount = 0;
  const failures = [];
  const built = [];

  // Build each brand
  for (let i = 0; i < brands.length; i++) {
    const brand = brands[i];

    console.log('');
    console.log('========================================');
    console.log(`  Building ${brand} (${i + 1}/${brands.length})`);
    console.log('========================================');
    console.log('');

    try {
      // Step 1: Clean build directories
      console.log('Cleaning build directories...');
      cleanBuildDirs();

      // Step 2: Select the brand (no prompt)
      console.log(`\nSelecting brand: ${brand}...`);
      selectBrand(brand);

      // Step 3: Run build pipeline
      console.log('\nRunning build pipeline...\n');
      runBuildForBrand();

      // Step 4: Copy exe to distribute folder
      console.log('\nCopying exe to distribute/...');
      copyExeToDistribute(brand);

      successCount++;
      built.push(brand);
      console.log('');
      console.log(`✓ ${brand} built successfully!`);

    } catch (error) {
      failureCount++;
      failures.push(brand);
      console.error('');
      console.error(`✗ ${brand} build failed:`, error.message);
    }
  }

  // Final cleanup
  console.log('\nFinal cleanup...');
  cleanBuildDirs();

  // Summary
  console.log('');
  console.log('========================================');
  console.log('  Build Summary');
  console.log('========================================');
  console.log(`  Total brands: ${brands.length}`);
  console.log(`  Successful: ${successCount}`);
  console.log(`  Failed: ${failureCount}`);
  if (failures.length > 0) {
    console.log(`  Failed brands: ${failures.join(', ')}`);
  }
  console.log('========================================');
  console.log('');

  if (built.length > 0) {
    console.log(`Distributions saved to: ${DISTRIBUTE_DIR}`);
    console.log('');
    const files = fs.existsSync(DISTRIBUTE_DIR) ? fs.readdirSync(DISTRIBUTE_DIR) : [];
    files.forEach(f => console.log(`  - ${f}`));
    console.log('');
  }

  if (failureCount > 0) {
    process.exit(1);
  }
}

main().catch(error => {
  console.error('');
  console.error('Fatal error:', error);
  process.exit(1);
});
