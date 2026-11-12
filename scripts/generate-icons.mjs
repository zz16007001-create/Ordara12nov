import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const iconSvgPath = path.join(rootDir, 'public', 'icon.svg');
const iconMaskableSvgPath = path.join(rootDir, 'scripts', 'icon-maskable.svg');
const publicDir = path.join(rootDir, 'public');

async function generate() {
  console.log('Generating PNG icons with sharp...');

  const iconSvg = fs.readFileSync(iconSvgPath);
  const iconMaskableSvg = fs.readFileSync(iconMaskableSvgPath);

  // 1. icon-192.png (any)
  await sharp(iconSvg)
    .resize(192, 192)
    .png({ quality: 95 })
    .toFile(path.join(publicDir, 'icon-192.png'));
  console.log('✓ Created public/icon-192.png');

  // 2. icon-512.png (any)
  await sharp(iconSvg)
    .resize(512, 512)
    .png({ quality: 95 })
    .toFile(path.join(publicDir, 'icon-512.png'));
  console.log('✓ Created public/icon-512.png');

  // 3. icon-512-maskable.png (maskable)
  await sharp(iconMaskableSvg)
    .resize(512, 512)
    .png({ quality: 95 })
    .toFile(path.join(publicDir, 'icon-512-maskable.png'));
  console.log('✓ Created public/icon-512-maskable.png');

  // 4. apple-touch-icon.png (180x180)
  await sharp(iconSvg)
    .resize(180, 180)
    .png({ quality: 95 })
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));
  console.log('✓ Created public/apple-touch-icon.png');

  console.log('All icons generated successfully!');
}

generate().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
