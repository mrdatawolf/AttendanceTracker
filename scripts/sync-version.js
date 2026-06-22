const fs = require('fs');
const path = require('path');

console.log('Syncing version and brand...');

// Read root package.json
const rootPackagePath = path.join(__dirname, '..', 'package.json');
const rootPackage = JSON.parse(fs.readFileSync(rootPackagePath, 'utf8'));
const version = rootPackage.version;

console.log(`Root version: ${version}`);

// Read brand selection
const brandSelectionPath = path.join(__dirname, '..', 'lib', 'brand-selection.json');
let brandId = 'Default';
try {
  const brandSelection = JSON.parse(fs.readFileSync(brandSelectionPath, 'utf8'));
  brandId = brandSelection.brand || 'Default';
} catch (e) {
  console.log('No brand selection found, using Default');
}
console.log(`Brand: ${brandId}`);

// Update electron-app/package.json version
const electronPackagePath = path.join(__dirname, '..', 'electron-app', 'package.json');
const electronPackage = JSON.parse(fs.readFileSync(electronPackagePath, 'utf8'));

if (electronPackage.version !== version) {
  console.log(`Updating electron-app version from ${electronPackage.version} to ${version}`);
  electronPackage.version = version;
  fs.writeFileSync(electronPackagePath, JSON.stringify(electronPackage, null, 2) + '\n');
  console.log('✓ Version synced successfully');
} else {
  console.log('✓ Versions already in sync');
}

// Update electron-builder.json with brand name (generate from template if missing)
const electronBuilderPath = path.join(__dirname, '..', 'electron-builder.json');
const electronBuilderTemplatePath = path.join(__dirname, '..', 'electron-builder.template.json');
const electronBuilderSource = fs.existsSync(electronBuilderPath) ? electronBuilderPath : electronBuilderTemplatePath;
const electronBuilder = JSON.parse(fs.readFileSync(electronBuilderSource, 'utf8'));

// Create product name with brand prefix
const productName = brandId === 'Default'
  ? 'Attendance Management'
  : `${brandId} Attendance`;

if (electronBuilder.productName !== productName) {
  console.log(`Updating productName from "${electronBuilder.productName}" to "${productName}"`);
  electronBuilder.productName = productName;
  fs.writeFileSync(electronBuilderPath, JSON.stringify(electronBuilder, null, 2) + '\n');
  console.log('✓ Product name updated successfully');
} else {
  console.log('✓ Product name already correct');
}
