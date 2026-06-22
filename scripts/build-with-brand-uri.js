/**
 * Build with Brand URI
 *
 * This script reads the brandURI from the selected brand's brand-features.json
 * and sets it as NEXT_PUBLIC_API_URL for the Next.js build process.
 *
 * This runs automatically when you run: npm run build
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.join(__dirname, '..');
const BRAND_SELECTION_FILE = path.join(ROOT_DIR, 'lib', 'brand-selection.json');

// Get selected brand
function getSelectedBrand() {
  try {
    const data = JSON.parse(fs.readFileSync(BRAND_SELECTION_FILE, 'utf8'));
    if (!data.brand) {
      console.error('');
      console.error('Error: No brand selected!');
      console.error('Please run: npm run select-brand');
      console.error('');
      process.exit(1);
    }
    return data.brand;
  } catch (error) {
    console.error('');
    console.error('Error: Could not read brand selection file!');
    console.error('Please run: npm run select-brand');
    console.error('');
    process.exit(1);
  }
}

// Get brand features from brand-features.json
function getBrandFeatures(brandName) {
  const brandFeaturesPath = path.join(ROOT_DIR, 'public', brandName, 'brand-features.json');

  try {
    const brandFeatures = JSON.parse(fs.readFileSync(brandFeaturesPath, 'utf8'));

    if (!brandFeatures.brandURI) {
      console.error('');
      console.error(`Error: brandURI not found in ${brandName}/brand-features.json`);
      console.error('Please add a brandURI field to the brand-features.json file.');
      console.error('Example: "brandURI": "http://127.0.0.1:6029"');
      console.error('');
      process.exit(1);
    }

    return brandFeatures;
  } catch (error) {
    console.error('');
    console.error(`Error: Could not read brand-features.json for ${brandName}`);
    console.error(`Path: ${brandFeaturesPath}`);
    console.error('');
    process.exit(1);
  }
}

// Main function
function main() {
  const brandName = getSelectedBrand();
  const brandFeatures = getBrandFeatures(brandName);
  const brandURI = brandFeatures.brandURI;
  const demoMode = brandFeatures.DemoMode === true;

  console.log('');
  console.log('========================================');
  console.log('  Building with Brand Configuration');
  console.log('========================================');
  console.log(`  Brand: ${brandName}`);
  console.log(`  Brand URI: ${brandURI}`);
  console.log(`  Demo Mode: ${demoMode ? 'ENABLED' : 'disabled'}`);
  console.log('========================================');
  console.log('');

  // Set environment variable and run Next.js build
  const env = { ...process.env };
  env.NEXT_PUBLIC_API_URL = brandURI;

  console.log(`Setting NEXT_PUBLIC_API_URL=${brandURI}`);
  console.log('');
  console.log('Running Next.js build...');
  console.log('');

  try {
    execSync('next build', {
      env,
      stdio: 'inherit',
      cwd: ROOT_DIR
    });

    // Create symlink for static files in standalone folder (for electron:start dev mode)
    const standaloneStaticDir = path.join(ROOT_DIR, '.next', 'standalone', '.next', 'static');
    const sourceStaticDir = path.join(ROOT_DIR, '.next', 'static');

    if (fs.existsSync(sourceStaticDir) && !fs.existsSync(standaloneStaticDir)) {
      console.log('Creating symlink for static files in standalone folder...');
      try {
        // On Windows, use junction for directories (doesn't require admin)
        if (process.platform === 'win32') {
          execSync(`mklink /J "${standaloneStaticDir}" "${sourceStaticDir}"`, { shell: 'cmd.exe' });
        } else {
          fs.symlinkSync(sourceStaticDir, standaloneStaticDir, 'dir');
        }
        console.log('Static files symlink created successfully.');
      } catch (symlinkError) {
        console.warn('Warning: Could not create static files symlink:', symlinkError.message);
        console.warn('You may need to run: npm run electron:start with admin privileges');
      }
    }

    // Write demo mode flag file to standalone build for server to read
    const standaloneDir = path.join(ROOT_DIR, '.next', 'standalone');
    const demoModeFlagPath = path.join(standaloneDir, 'demo-mode.json');

    if (fs.existsSync(standaloneDir)) {
      const demoModeConfig = {
        demoMode: demoMode,
        brand: brandName,
        brandURI: brandURI,
        builtAt: new Date().toISOString()
      };
      fs.writeFileSync(demoModeFlagPath, JSON.stringify(demoModeConfig, null, 2));
      console.log(`Demo mode flag written to: ${demoModeFlagPath}`);
      console.log(`Demo mode: ${demoMode ? 'ENABLED' : 'disabled'}`);
    }

    // Seed demo data at build time if DemoMode is enabled (for development testing)
    if (demoMode) {
      console.log('');
      console.log('Demo Mode enabled - seeding demo data for build...');
      console.log('');
      try {
        execSync('npx tsx scripts/seed-demo.ts', {
          stdio: 'inherit',
          cwd: ROOT_DIR
        });
      } catch (seedError) {
        console.warn('Warning: Could not seed demo data:', seedError.message);
        console.warn('You can manually run: npm run db:seed-demo');
      }
    }

    console.log('');
    console.log('========================================');
    console.log('  Build completed successfully!');
    if (demoMode) {
      console.log('  Demo Mode: Database seeded with demo data');
    }
    console.log('========================================');
    console.log('');
  } catch (error) {
    console.error('');
    console.error('Build failed:', error.message);
    process.exit(1);
  }
}

main();
