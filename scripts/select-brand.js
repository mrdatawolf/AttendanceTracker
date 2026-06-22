/**
 * Brand Selection Script
 *
 * Interactive script to select which brand to use for the build.
 * Run with: npm run select-brand
 *
 * This script:
 * 1. Scans public/ folder for brand directories
 * 2. Prompts user to select a brand
 * 3. Updates lib/brand-selection.json with the selection
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const publicDir = path.join(__dirname, '..', 'public');
const brandSelectionFile = path.join(__dirname, '..', 'lib', 'brand-selection.json');

// Get available brands from public/ subfolders
function getAvailableBrands() {
  const entries = fs.readdirSync(publicDir, { withFileTypes: true });
  return entries
    .filter(entry => entry.isDirectory())
    .filter(entry => {
      // Check if the folder contains a logo.png
      const logoPath = path.join(publicDir, entry.name, 'logo.png');
      return fs.existsSync(logoPath);
    })
    .map(entry => entry.name);
}

// Get current brand selection
function getCurrentBrand() {
  try {
    const data = JSON.parse(fs.readFileSync(brandSelectionFile, 'utf8'));
    return data.brand || 'Default';
  } catch {
    return 'Default';
  }
}

// Save brand selection
function saveBrandSelection(brand) {
  const data = {
    brand: brand,
    selectedAt: new Date().toISOString(),
  };
  fs.writeFileSync(brandSelectionFile, JSON.stringify(data, null, 2) + '\n');
}

// Main function
async function main() {
  const brands = getAvailableBrands();
  const currentBrand = getCurrentBrand();

  console.log('');
  console.log('========================================');
  console.log('  Brand Selection for Build');
  console.log('========================================');
  console.log('');
  console.log('Available brands:');
  console.log('');

  brands.forEach((brand, index) => {
    const marker = brand === currentBrand ? ' (current)' : '';
    console.log(`  ${index + 1}. ${brand}${marker}`);
  });

  console.log('');

  // Check for command line argument
  const argBrand = process.argv[2];
  if (argBrand) {
    if (brands.includes(argBrand)) {
      saveBrandSelection(argBrand);
      console.log(`Brand set to: ${argBrand}`);
      console.log('');
      return;
    } else {
      console.log(`Error: Unknown brand "${argBrand}"`);
      console.log(`Available brands: ${brands.join(', ')}`);
      process.exit(1);
    }
  }

  // Interactive prompt
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (prompt) => new Promise((resolve) => rl.question(prompt, resolve));

  try {
    const answer = await question(`Select brand (1-${brands.length}) or press Enter for "${currentBrand}": `);

    let selectedBrand = currentBrand;

    if (answer.trim()) {
      const index = parseInt(answer, 10) - 1;
      if (index >= 0 && index < brands.length) {
        selectedBrand = brands[index];
      } else if (brands.includes(answer.trim())) {
        selectedBrand = answer.trim();
      } else {
        console.log('Invalid selection. Using current brand.');
      }
    }

    saveBrandSelection(selectedBrand);
    console.log('');
    console.log(`Brand set to: ${selectedBrand}`);
    console.log('Logo path: /${selectedBrand}/logo.png');
    console.log('');
    console.log('Run "npm run build" to build with this brand.');
    console.log('');
  } finally {
    rl.close();
  }
}

main().catch(console.error);
