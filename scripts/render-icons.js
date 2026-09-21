import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const iconDir = path.join(rootDir, 'assets', 'icons');

if (!fs.existsSync(iconDir)) {
  fs.mkdirSync(iconDir, { recursive: true });
}

// Master SVG for Table Extractor icon: Modern squircle + clean table header/cells + high-contrast download arrow & tray
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <!-- Background Gradient: Brand Sky Blue to Deep Ocean -->
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0284C7"/>
      <stop offset="50%" stop-color="#0369A1"/>
      <stop offset="100%" stop-color="#075985"/>
    </linearGradient>

    <!-- Top subtle lighting sheen for app-icon depth -->
    <linearGradient id="topSheen" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.25"/>
      <stop offset="50%" stop-color="#FFFFFF" stop-opacity="0.03"/>
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
    </linearGradient>

    <!-- Arrow Gradient: White to Vibrant Mint/Emerald tip -->
    <linearGradient id="arrowGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="60%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#6EE7B7"/>
    </linearGradient>
  </defs>

  <!-- App Icon Squircle Container -->
  <rect x="32" y="32" width="448" height="448" rx="104" ry="104" fill="url(#bgGrad)"/>
  <rect x="32" y="32" width="448" height="448" rx="104" ry="104" fill="url(#topSheen)"/>

  <!-- Table Header Bar: Clean Solid White with Rounded Ends -->
  <rect x="76" y="80" width="360" height="64" rx="20" fill="#FFFFFF"/>

  <!-- Table Flanking Cells: 2 rows of structured data blocks -->
  <!-- Left column cells -->
  <rect x="76" y="168" width="108" height="68" rx="18" fill="#FFFFFF" fill-opacity="0.85"/>
  <rect x="76" y="254" width="108" height="68" rx="18" fill="#FFFFFF" fill-opacity="0.45"/>

  <!-- Right column cells -->
  <rect x="328" y="168" width="108" height="68" rx="18" fill="#FFFFFF" fill-opacity="0.85"/>
  <rect x="328" y="254" width="108" height="68" rx="18" fill="#FFFFFF" fill-opacity="0.45"/>

  <!-- Center Extraction Action: Solid White Download Arrow with Mint Tip -->
  <path d="M 226 156
           C 226 145 235 136 246 136
           L 266 136
           C 277 136 286 145 286 156
           L 286 256
           L 342 256
           C 356 256 364 274 353 285
           L 267 368
           C 261 374 251 374 245 368
           L 159 285
           C 148 274 156 256 170 256
           L 226 256
           Z"
        fill="url(#arrowGrad)"/>

  <!-- Download Tray Cradle -->
  <path d="M 124 352
           L 124 396
           C 124 418 142 436 164 436
           L 348 436
           C 370 436 388 418 388 396
           L 388 352"
        fill="none"
        stroke="#FFFFFF"
        stroke-width="44"
        stroke-linecap="round"
        stroke-linejoin="round"/>
</svg>`;

const masterSvgPath = path.join(iconDir, 'icon-master.svg');
fs.writeFileSync(masterSvgPath, svgContent, 'utf8');

const sizes = [16, 48, 128];
for (const size of sizes) {
  const destPath = path.join(iconDir, `icon-${size}.png`);
  execSync(`rsvg-convert -w ${size} -h ${size} "${masterSvgPath}" -o "${destPath}"`);
  console.log(`Rendered ${size}x${size} icon -> ${destPath}`);
}
console.log('All icons generated successfully!');
