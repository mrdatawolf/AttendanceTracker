const fs = require('fs');
const path = require('path');
const { default: pngToIco } = require('png-to-ico');
const { Jimp } = require('jimp');

const ROOT_DIR = path.join(__dirname, '..');

let brandId = 'Default';
try {
  const brandSelection = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'lib', 'brand-selection.json'), 'utf8'));
  brandId = brandSelection.brand || 'Default';
} catch {
  console.log('No brand selection found, using Default');
}

const logoPath = path.join(ROOT_DIR, 'public', brandId, 'logo.png');

if (!fs.existsSync(logoPath)) {
  console.error(`Logo not found: public/${brandId}/logo.png`);
  process.exit(1);
}

const buildDir = path.join(ROOT_DIR, 'build');
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

const ICON_SIZE = 256;

Jimp.read(logoPath)
  .then(img => {
    const size = Math.max(img.width, img.height);
    const padded = new Jimp({ width: size, height: size, color: 0x00000000 });
    padded.composite(img, Math.floor((size - img.width) / 2), Math.floor((size - img.height) / 2));
    padded.resize({ w: ICON_SIZE, h: ICON_SIZE });
    return padded.getBuffer('image/png');
  })
  .then(pngBuf => pngToIco(pngBuf))
  .then(icoBuf => {
    fs.writeFileSync(path.join(buildDir, 'icon.ico'), icoBuf);
    console.log(`✓ Icon generated from public/${brandId}/logo.png`);
  })
  .catch(err => {
    console.error('Failed to generate icon:', err.message);
    process.exit(1);
  });
