/**
 * Table Extractor — Promotional Store Asset & Tile Generator
 * Generates:
 * 1. Processed Store Presentation Screenshots (1280x800) in processed_screenshots/
 * 2. Marquee Promotional Banner (1400x560) -> marquee_promo.png
 * 3. Small Promotional Tile (440x280) -> small_promo.png
 */

import puppeteer from 'puppeteer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const processedScreenshotsDir = path.join(rootDir, 'processed_screenshots');
const screenshotsDir = path.join(rootDir, 'assets', 'screenshots');
const iconsDir = path.join(rootDir, 'assets', 'icons');

if (!fs.existsSync(processedScreenshotsDir)) {
  fs.mkdirSync(processedScreenshotsDir, { recursive: true });
}

// 1. Prepare raw screenshot aliases
const raw01Path = path.join(screenshotsDir, '01-static-detection.png');
const raw02Path = path.join(screenshotsDir, '02-virtualized-detection.png');
const raw04Path = path.join(screenshotsDir, '04-export-options.png');

const detectRaw = path.join(screenshotsDir, '01-detect.png');
const previewRaw = path.join(screenshotsDir, '02-preview.png');
const exportRaw = path.join(screenshotsDir, '03-export.png');

if (fs.existsSync(raw01Path)) fs.copyFileSync(raw01Path, detectRaw);
if (fs.existsSync(raw02Path)) fs.copyFileSync(raw02Path, previewRaw);
if (fs.existsSync(raw04Path)) fs.copyFileSync(raw04Path, exportRaw);

// Helper to get Base64 data URL
function toBase64Url(filePath, mimeType = 'image/png') {
  const data = fs.readFileSync(filePath);
  return `data:${mimeType};base64,${data.toString('base64')}`;
}

const icon128Url = toBase64Url(path.join(iconsDir, 'icon-128.png'));
const icon48Url = toBase64Url(path.join(iconsDir, 'icon-48.png'));
const raw01Url = toBase64Url(detectRaw);
const raw02Url = toBase64Url(previewRaw);
const raw03Url = toBase64Url(exportRaw);

async function main() {
  console.log('====================================================');
  console.log('   Table Extractor — Store Asset & Tile Generator   ');
  console.log('====================================================\n');

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: '/home/sid/.cache/puppeteer/chrome/linux-153.0.8010.36/chrome-linux64/chrome',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--font-render-hinting=medium'
    ]
  });

  const page = await browser.newPage();

  // --------------------------------------------------------------------------
  // PART 1: Processed Presentation Screenshots (1280x800)
  // --------------------------------------------------------------------------
  const screenshotConfigs = [
    {
      filename: '01-detect.png',
      badge: 'TABLE AUTO-DETECTION',
      badgeColor: '#38bdf8',
      badgeBg: 'rgba(56, 189, 248, 0.12)',
      title: 'Instantly Detect Any Web Table',
      subtitle: 'Auto-identifies standard tables, AG Grid, and complex virtualized feeds without page reload',
      imgUrl: raw01Url,
      displayUrl: 'portal.enterprise-analytics.com/quarterly-metrics'
    },
    {
      filename: '02-preview.png',
      badge: 'VIRTUALIZED SCROLL CAPTURE',
      badgeColor: '#34d399',
      badgeBg: 'rgba(52, 211, 153, 0.12)',
      title: 'Preview & Clean Data',
      subtitle: 'Inspect dimensions, filter row ranges, and un-merge complex multi-line headers cleanly',
      imgUrl: raw02Url,
      displayUrl: 'tables.enterprise-data.com/virtualized-grid'
    },
    {
      filename: '03-export.png',
      badge: 'SPREADSHEET EXPORT',
      badgeColor: '#a78bfa',
      badgeBg: 'rgba(167, 139, 250, 0.12)',
      title: 'Export to CSV or Excel in 1-Click',
      subtitle: 'Download clean spreadsheet-ready files or copy formatted rows directly to clipboard',
      imgUrl: raw03Url,
      displayUrl: 'workspace.cloud-analytics.com/data/export'
    }
  ];

  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });

  for (const config of screenshotConfigs) {
    console.log(`Generating presentation screenshot: ${config.filename} (1280x800)...`);

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 1280px;
    height: 800px;
    overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    background: #080d1a;
    background-image: 
      radial-gradient(circle at 50% 0%, rgba(2, 132, 199, 0.22) 0%, transparent 60%),
      radial-gradient(circle at 85% 90%, rgba(16, 185, 129, 0.1) 0%, transparent 45%),
      linear-gradient(180deg, #090e1b 0%, #050811 100%);
    display: flex;
    flex-direction: column;
    align-items: center;
    position: relative;
  }

  /* Decorative Ambient Grid */
  .grid-pattern {
    position: absolute;
    inset: 0;
    background-image: 
      linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
    background-size: 40px 40px;
    pointer-events: none;
    mask-image: linear-gradient(180deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.1) 80%);
    -webkit-mask-image: linear-gradient(180deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.1) 80%);
  }

  /* Header Caption Banner */
  .caption-header {
    width: 100%;
    padding: 34px 48px 24px;
    text-align: center;
    position: relative;
    z-index: 10;
  }

  .badge-tag {
    display: inline-block;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: ${config.badgeColor};
    background: ${config.badgeBg};
    border: 1px solid ${config.badgeColor}33;
    padding: 5px 14px;
    border-radius: 999px;
    margin-bottom: 12px;
  }

  .main-title {
    font-size: 34px;
    font-weight: 800;
    letter-spacing: -0.025em;
    color: #ffffff;
    line-height: 1.2;
    margin-bottom: 8px;
    text-shadow: 0 2px 10px rgba(0,0,0,0.5);
  }

  .main-title span {
    background: linear-gradient(135deg, #38bdf8 0%, #6ee7b7 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .subtitle {
    font-size: 16px;
    font-weight: 400;
    color: #94a3b8;
    max-width: 820px;
    margin: 0 auto;
    line-height: 1.45;
  }

  /* Mock Browser Window Container */
  .browser-container {
    width: 1140px;
    height: 620px;
    background: #0f172a;
    border-radius: 14px 14px 0 0;
    border: 1px solid rgba(255, 255, 255, 0.16);
    border-bottom: none;
    box-shadow: 
      0 25px 60px -15px rgba(0, 0, 0, 0.8),
      0 0 35px rgba(2, 132, 199, 0.2);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
    z-index: 10;
    margin-top: 4px;
  }

  /* Viewport Image */
  .viewport-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: top center;
    display: block;
  }
</style>
</head>
<body>
  <div class="grid-pattern"></div>

  <div class="caption-header">
    <div class="badge-tag">${config.badge}</div>
    <h1 class="main-title">${config.title}</h1>
    <p class="subtitle">${config.subtitle}</p>
  </div>

  <div class="browser-container">
    <img src="${config.imgUrl}" class="viewport-img" alt="screenshot">
  </div>
</body>
</html>`;

    await page.setContent(html, { waitUntil: 'load' });
    await new Promise(r => setTimeout(r, 200));

    const outPath = path.join(processedScreenshotsDir, config.filename);
    await page.screenshot({ path: outPath, type: 'png' });
    console.log(`  ✓ Saved: ${outPath}`);
  }

  // --------------------------------------------------------------------------
  // PART 2: Marquee Promotional Tile (1400x560)
  // --------------------------------------------------------------------------
  console.log('\nGenerating Marquee Promotional Banner: marquee_promo.png (1400x560)...');
  await page.setViewport({ width: 1400, height: 560, deviceScaleFactor: 1 });

  const marqueeHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 1400px;
    height: 560px;
    overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    background: #070b14;
    background-image:
      radial-gradient(circle at 20% 40%, rgba(2, 132, 199, 0.28) 0%, transparent 60%),
      radial-gradient(circle at 80% 60%, rgba(16, 185, 129, 0.18) 0%, transparent 55%),
      linear-gradient(135deg, #080d1a 0%, #04060c 100%);
    display: flex;
    align-items: center;
    position: relative;
    padding: 0 70px;
  }

  .grid-pattern {
    position: absolute;
    inset: 0;
    background-image: 
      linear-gradient(rgba(255, 255, 255, 0.035) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.035) 1px, transparent 1px);
    background-size: 35px 35px;
    pointer-events: none;
  }

  /* Left Hero Content */
  .left-col {
    flex: 1.1;
    z-index: 10;
    padding-right: 40px;
  }

  .brand-chip {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: rgba(2, 132, 199, 0.15);
    border: 1px solid rgba(2, 132, 199, 0.35);
    padding: 6px 14px;
    border-radius: 999px;
    margin-bottom: 20px;
  }

  .brand-chip-text {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: #38bdf8;
    text-transform: uppercase;
  }

  .headline {
    font-size: 46px;
    font-weight: 800;
    letter-spacing: -0.03em;
    line-height: 1.12;
    color: #ffffff;
    margin-bottom: 14px;
  }

  .headline-gradient {
    background: linear-gradient(135deg, #38bdf8 0%, #6ee7b7 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .tagline {
    font-size: 19px;
    font-weight: 400;
    color: #94a3b8;
    line-height: 1.45;
    margin-bottom: 28px;
    max-width: 580px;
  }

  .feature-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .pill {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    padding: 7px 14px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    color: #e2e8f0;
  }

  .pill svg {
    color: #10b981;
  }

  /* Right Visual Graphic Card */
  .right-col {
    flex: 0.95;
    z-index: 10;
    display: flex;
    justify-content: center;
  }

  .promo-card {
    width: 520px;
    background: #0f172a;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 18px;
    box-shadow: 
      0 30px 60px -15px rgba(0, 0, 0, 0.8),
      0 0 40px rgba(2, 132, 199, 0.25);
    overflow: hidden;
    transform: perspective(1000px) rotateY(-4deg) rotateX(2deg);
  }

  .card-top {
    background: #1e293b;
    padding: 14px 18px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .card-top-title {
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: 700;
    font-size: 14px;
    color: #f8fafc;
  }

  .badge-1click {
    font-size: 11px;
    font-weight: 700;
    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
    color: #fff;
    padding: 3px 10px;
    border-radius: 999px;
  }

  .card-grid-body {
    padding: 18px;
    background: #0b1120;
  }

  .table-mock {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }

  .table-mock th {
    background: rgba(255, 255, 255, 0.04);
    padding: 8px 10px;
    color: #94a3b8;
    text-align: left;
    font-weight: 600;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .table-mock td {
    padding: 8px 10px;
    color: #e2e8f0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.03);
  }

  .table-mock tr:first-child td {
    background: rgba(2, 132, 199, 0.08);
  }

  .card-footer-action {
    padding: 14px 18px;
    background: #0f172a;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .formats-cluster {
    display: flex;
    gap: 6px;
  }

  .format-tag {
    font-size: 11px;
    font-weight: 700;
    background: rgba(255, 255, 255, 0.06);
    color: #38bdf8;
    border: 1px solid rgba(56, 189, 248, 0.3);
    padding: 3px 8px;
    border-radius: 4px;
  }

  .btn-export-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
    color: #fff;
    font-size: 12px;
    font-weight: 700;
    padding: 7px 14px;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(2, 132, 199, 0.4);
  }
</style>
</head>
<body>
  <div class="grid-pattern"></div>

  <div class="left-col">
    <div class="brand-chip">
      <img src="${icon48Url}" width="16" height="16" alt="Icon">
      <span class="brand-chip-text">Chrome Extension · Free</span>
    </div>

    <h1 class="headline">
      Table Extractor<br>
      <span class="headline-gradient">Tables to Spreadsheets</span>
    </h1>

    <p class="tagline">
      Web Scraping · Table to Excel · 1-Click Export. Auto-detects standard HTML tables, AG Grid, and virtualized feeds with 100% client-side privacy.
    </p>

    <div class="feature-pills">
      <div class="pill">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        <span>Instant Auto-Detection</span>
      </div>
      <div class="pill">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        <span>Excel (.xlsx) & CSV</span>
      </div>
      <div class="pill">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        <span>100% Private (No Cloud)</span>
      </div>
    </div>
  </div>

  <div class="right-col">
    <div class="promo-card">
      <div class="card-top">
        <div class="card-top-title">
          <img src="${icon48Url}" width="20" height="20" alt="Icon">
          <span>Enterprise Performance Matrix</span>
        </div>
        <span class="badge-1click">1-Click Ready</span>
      </div>

      <div class="card-grid-body">
        <table class="table-mock">
          <thead>
            <tr>
              <th>Row</th>
              <th>Account</th>
              <th>Region</th>
              <th>Status</th>
              <th>Revenue</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>1</td>
              <td>Apex Global Systems</td>
              <td>North America</td>
              <td>Active</td>
              <td>$452,190</td>
            </tr>
            <tr>
              <td>2</td>
              <td>Vanguard Logic Ltd</td>
              <td>EMEA</td>
              <td>Active</td>
              <td>$318,440</td>
            </tr>
            <tr>
              <td>3</td>
              <td>BluePeak Data Corp</td>
              <td>APAC</td>
              <td>Pending</td>
              <td>$184,920</td>
            </tr>
            <tr>
              <td>4</td>
              <td>Crestline Analytics</td>
              <td>North America</td>
              <td>Active</td>
              <td>$629,000</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="card-footer-action">
        <div class="formats-cluster">
          <span class="format-tag">.CSV</span>
          <span class="format-tag">.XLSX</span>
          <span class="format-tag">.JSON</span>
        </div>
        <div class="btn-export-badge">
          <span>⬇ Export Spreadsheet</span>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;

  await page.setContent(marqueeHtml, { waitUntil: 'load' });
  await new Promise(r => setTimeout(r, 200));

  const marqueePath = path.join(rootDir, 'marquee_promo.png');
  await page.screenshot({ path: marqueePath, type: 'png' });
  console.log(`  ✓ Saved: ${marqueePath}`);

  // --------------------------------------------------------------------------
  // PART 3: Small Promotional Tile (440x280)
  // --------------------------------------------------------------------------
  console.log('\nGenerating Small Promotional Tile: small_promo.png (440x280)...');
  await page.setViewport({ width: 440, height: 280, deviceScaleFactor: 1 });

  const smallPromoHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 440px;
    height: 280px;
    overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    background: #080d1a;
    background-image:
      radial-gradient(circle at 50% 25%, rgba(2, 132, 199, 0.32) 0%, transparent 65%),
      linear-gradient(180deg, #0a0f1d 0%, #04060c 100%);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 24px 20px;
    position: relative;
  }

  .grid-pattern {
    position: absolute;
    inset: 0;
    background-image: 
      linear-gradient(rgba(255, 255, 255, 0.035) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.035) 1px, transparent 1px);
    background-size: 24px 24px;
    pointer-events: none;
  }

  .logo-wrapper {
    width: 68px;
    height: 68px;
    border-radius: 16px;
    background: rgba(2, 132, 199, 0.15);
    border: 1px solid rgba(2, 132, 199, 0.4);
    box-shadow: 0 8px 24px rgba(2, 132, 199, 0.35);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 14px;
    z-index: 10;
  }

  .logo-img {
    width: 52px;
    height: 52px;
    border-radius: 10px;
  }

  .app-name {
    font-size: 24px;
    font-weight: 800;
    letter-spacing: -0.025em;
    color: #ffffff;
    margin-bottom: 6px;
    line-height: 1.15;
    z-index: 10;
  }

  .app-name span {
    background: linear-gradient(135deg, #38bdf8 0%, #6ee7b7 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .app-tagline {
    font-size: 13.5px;
    font-weight: 500;
    color: #94a3b8;
    line-height: 1.35;
    margin-bottom: 14px;
    max-width: 380px;
    z-index: 10;
  }

  .badges-row {
    display: flex;
    gap: 8px;
    z-index: 10;
  }

  .badge-tag {
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.04em;
    padding: 4px 10px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.07);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: #e2e8f0;
  }

  .badge-accent {
    background: rgba(2, 132, 199, 0.2);
    border-color: rgba(2, 132, 199, 0.45);
    color: #38bdf8;
  }
</style>
</head>
<body>
  <div class="grid-pattern"></div>

  <div class="logo-wrapper">
    <img src="${icon128Url}" class="logo-img" alt="Logo">
  </div>

  <h1 class="app-name">Table <span>Extractor</span></h1>
  <p class="app-tagline">Web Scraping · Table to Excel · 1-Click Export</p>

  <div class="badges-row">
    <span class="badge-tag badge-accent">CSV & Excel (.xlsx)</span>
    <span class="badge-tag">AG Grid Ready</span>
    <span class="badge-tag">100% Private</span>
  </div>
</body>
</html>`;

  await page.setContent(smallPromoHtml, { waitUntil: 'load' });
  await new Promise(r => setTimeout(r, 200));

  const smallPromoPath = path.join(rootDir, 'small_promo.png');
  await page.screenshot({ path: smallPromoPath, type: 'png' });
  console.log(`  ✓ Saved: ${smallPromoPath}`);

  await browser.close();

  console.log('\n====================================================');
  console.log('🎉 ALL PROMOTIONAL ASSETS GENERATED SUCCESSFULLY! 🎉');
  console.log('====================================================\n');
}

main().catch(err => {
  console.error('Fatal error generating promotional assets:', err);
  process.exit(1);
});
