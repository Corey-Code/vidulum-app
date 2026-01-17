import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

console.log('Copying static files...');

// Copy manifest
copyFileSync(resolve(rootDir, 'public/manifest.json'), resolve(rootDir, 'dist/manifest.json'));
console.log('✓ Copied manifest.json');

// Rename popup HTML from src/popup/index.html to popup.html
const builtPopupDir = resolve(rootDir, 'dist/src/popup');
const builtPopupHTML = resolve(builtPopupDir, 'index.html');
const targetPopupHTML = resolve(rootDir, 'dist/popup.html');

if (existsSync(builtPopupHTML)) {
  // Read the HTML and fix the asset path (from ../../assets to ./assets)
  let htmlContent = readFileSync(builtPopupHTML, 'utf-8');
  htmlContent = htmlContent.replace(/src="\.\.\/\.\.\/assets\//g, 'src="./assets/');
  writeFileSync(targetPopupHTML, htmlContent);
  console.log('✓ Copied popup.html to root (with fixed asset paths)');
} else {
  console.log('⚠ Popup HTML not found at expected location');
}

// Copy icons
const iconsDir = resolve(rootDir, 'public/icons');
const distIconsDir = resolve(rootDir, 'dist/icons');

if (!existsSync(distIconsDir)) {
  mkdirSync(distIconsDir, { recursive: true });
}

if (existsSync(iconsDir)) {
  const icons = readdirSync(iconsDir);
  icons.forEach((icon) => {
    copyFileSync(resolve(iconsDir, icon), resolve(distIconsDir, icon));
  });
  console.log(`✓ Copied ${icons.length} icon(s)`);
} else {
  console.log('⚠ No icons directory found');
}

console.log('✅ Static files copied successfully!');
