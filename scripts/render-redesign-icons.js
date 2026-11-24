/**
 * Table Extractor — Redesigned Icon Generator
 * Renders precision vector SVG and exports 16, 32, 48, 128, 300, 512 PNGs.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const iconDir = path.join(rootDir, 'redesign_assets', 'icons');

if (!fs.existsSync(iconDir)) {
  fs.mkdirSync(iconDir, { recursive: true });
}

const masterSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <!-- Background Gradient: High-Voltage Sky Blue to Midnight Navy -->
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0284C7"/>
      <stop offset="45%" stop-color="#0369A1"/>
      <stop offset="100%" stop-color="#073B61"/>
    </linearGradient>

    <!-- Top Rim Light Sheen -->
    <linearGradient id="rimLight" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.32"/>
      <stop offset="40%" stop-color="#FFFFFF" stop-opacity="0.04"/>
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
    </linearGradient>

    <!-- Arrow Gradient: Pure White into Electric Mint -->
    <linearGradient id="arrowGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="65%" stop-color="#FFFFFF"/>
      <stop offset="100%" stop-color="#6EE7B7"/>
    </linearGradient>

    <!-- Drop Shadow Filter for Floating Depth -->
    <filter id="elevatedShadow" x="-15%" y="-15%" width="130%" height="130%">
      <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#000000" flood-opacity="0.45"/>
    </filter>

    <!-- Subtle Grid Cell Shadow -->
    <filter id="cellShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="#02294A" flood-opacity="0.5"/>
    </filter>
  </defs>

  <!-- 1. Master Squircle Container -->
  <rect x="32" y="32" width="448" height="448" rx="108" ry="108" fill="url(#bgGrad)"/>
  <rect x="32" y="32" width="448" height="448" rx="108" ry="108" fill="url(#rimLight)"/>
  <rect x="32" y="32" width="448" height="448" rx="108" ry="108" fill="none" stroke="#FFFFFF" stroke-opacity="0.18" stroke-width="3"/>

  <!-- 2. Table Header Row (3 distinct columns) -->
  <rect x="80" y="88" width="108" height="52" rx="14" fill="#FFFFFF" fill-opacity="0.95" filter="url(#cellShadow)"/>
  <rect x="202" y="88" width="108" height="52" rx="14" fill="#FFFFFF" fill-opacity="0.95" filter="url(#cellShadow)"/>
  <rect x="324" y="88" width="108" height="52" rx="14" fill="#FFFFFF" fill-opacity="0.95" filter="url(#cellShadow)"/>

  <!-- 3. Flanking Table Cells (Left & Right Columns) -->
  <!-- Row 1 Cells -->
  <rect x="80" y="156" width="108" height="64" rx="14" fill="#FFFFFF" fill-opacity="0.65" filter="url(#cellShadow)"/>
  <rect x="324" y="156" width="108" height="64" rx="14" fill="#FFFFFF" fill-opacity="0.65" filter="url(#cellShadow)"/>

  <!-- Row 2 Cells -->
  <rect x="80" y="234" width="108" height="64" rx="14" fill="#FFFFFF" fill-opacity="0.32" filter="url(#cellShadow)"/>
  <rect x="324" y="234" width="108" height="64" rx="14" fill="#FFFFFF" fill-opacity="0.32" filter="url(#cellShadow)"/>

  <!-- 4. Elevated Extraction Arrow (Clean Precision Geometry) -->
  <g filter="url(#elevatedShadow)">
    <path d="M 230 148
             C 230 140 236 134 244 134
             L 268 134
             C 276 134 282 140 282 148
             L 282 250
             L 334 250
             C 346 250 353 265 344 274
             L 264 354
             C 259 359 253 359 248 354
             L 168 274
             C 159 265 166 250 178 250
             L 230 250
             Z"
          fill="url(#arrowGrad)"/>
  </g>

  <!-- 5. Extraction Base Cradle / Tray -->
  <path d="M 132 344
           L 132 394
           C 132 414 148 430 168 430
           L 344 430
           C 364 430 380 414 380 394
           L 380 344"
        fill="none"
        stroke="#FFFFFF"
        stroke-width="36"
        stroke-linecap="round"
        stroke-linejoin="round"
        filter="url(#elevatedShadow)"/>
</svg>`;

const masterSvgPath = path.join(iconDir, 'icon-master.svg');
fs.writeFileSync(masterSvgPath, masterSvg, 'utf8');
console.log(`Saved redesigned master SVG: ${masterSvgPath}`);

const sizes = [16, 32, 48, 128, 300, 512];
for (const size of sizes) {
  const dest = path.join(iconDir, `icon-${size}.png`);
  execSync(`rsvg-convert -w ${size} -h ${size} "${masterSvgPath}" -o "${dest}"`);
  console.log(`  ✓ Rendered: icon-${size}.png (${size}x${size})`);
}

console.log('\nAll redesigned icons rendered successfully!');
