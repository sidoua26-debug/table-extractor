/**
 * Table Extractor — Professional Redesign Asset Generator
 * Generates:
 * - 5 Narrative Chrome Web Store Screenshots (1280x800, 16:10)
 * - 1 Marquee Promotional Banner (1400x560)
 * - 1 Small Promotional Tile (440x280)
 */

import puppeteer from 'puppeteer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const outScreenshotsDir = path.join(rootDir, 'redesign_assets', 'screenshots');
const outPromoDir = path.join(rootDir, 'redesign_assets', 'promotional');
const iconsDir = path.join(rootDir, 'redesign_assets', 'icons');

for (const dir of [outScreenshotsDir, outPromoDir]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function toBase64Url(filePath, mimeType = 'image/png') {
  const data = fs.readFileSync(filePath);
  return `data:${mimeType};base64,${data.toString('base64')}`;
}

const icon128Url = toBase64Url(path.join(iconsDir, 'icon-128.png'));
const icon48Url = toBase64Url(path.join(iconsDir, 'icon-48.png'));

// Shared CSS Styles for high-end SaaS presentation
const sharedStyles = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, 'Plus Jakarta Sans', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    background: #060913;
    background-image: 
      radial-gradient(circle at 50% 0%, rgba(2, 132, 199, 0.22) 0%, transparent 65%),
      radial-gradient(circle at 85% 90%, rgba(16, 185, 129, 0.12) 0%, transparent 50%),
      linear-gradient(180deg, #070B16 0%, #04060D 100%);
    color: #F8FAFC;
    position: relative;
  }

  .ambient-grid {
    position: absolute;
    inset: 0;
    background-image: 
      linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
    background-size: 40px 40px;
    pointer-events: none;
    mask-image: radial-gradient(ellipse at 50% 40%, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.1) 85%);
    -webkit-mask-image: radial-gradient(ellipse at 50% 40%, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.1) 85%);
  }

  /* Header Typography */
  .story-header {
    text-align: center;
    padding: 30px 40px 16px;
    position: relative;
    z-index: 10;
  }

  .category-pill {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #38BDF8;
    background: rgba(56, 189, 248, 0.12);
    border: 1px solid rgba(56, 189, 248, 0.28);
    padding: 5px 14px;
    border-radius: 999px;
    margin-bottom: 10px;
  }

  .pill-emerald {
    color: #34D399;
    background: rgba(52, 211, 153, 0.12);
    border-color: rgba(52, 211, 153, 0.3);
  }

  .pill-purple {
    color: #C084FC;
    background: rgba(192, 132, 252, 0.12);
    border-color: rgba(192, 132, 252, 0.3);
  }

  .pill-amber {
    color: #FBBF24;
    background: rgba(251, 191, 36, 0.12);
    border-color: rgba(251, 191, 36, 0.3);
  }

  .pill-rose {
    color: #FB7185;
    background: rgba(251, 113, 133, 0.12);
    border-color: rgba(251, 113, 133, 0.3);
  }

  .story-title {
    font-size: 34px;
    font-weight: 800;
    letter-spacing: -0.025em;
    color: #FFFFFF;
    line-height: 1.18;
    margin-bottom: 8px;
    text-shadow: 0 2px 10px rgba(0,0,0,0.6);
  }

  .text-gradient-cyan {
    background: linear-gradient(135deg, #38BDF8 0%, #6EE7B7 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .story-sub {
    font-size: 15.5px;
    font-weight: 400;
    color: #94A3B8;
    max-width: 820px;
    margin: 0 auto;
    line-height: 1.45;
  }

  /* Presentation Stage */
  .stage-viewport {
    width: 1140px;
    height: 614px;
    margin: 0 auto;
    position: relative;
    z-index: 10;
    display: flex;
    justify-content: center;
  }

  /* Window Mockup Frame */
  .mock-window {
    width: 100%;
    height: 100%;
    background: #0E1626;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 14px 14px 0 0;
    border-bottom: none;
    box-shadow: 
      0 25px 60px -15px rgba(0, 0, 0, 0.85),
      0 0 35px rgba(2, 132, 199, 0.18);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .window-topbar {
    height: 42px;
    background: #162034;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    align-items: center;
    padding: 0 16px;
    gap: 14px;
  }

  .dots { display: flex; gap: 7px; }
  .dot { width: 11px; height: 11px; border-radius: 50%; }
  .dot-r { background: #EF4444; }
  .dot-y { background: #F59E0B; }
  .dot-g { background: #10B981; }

  .url-pill {
    flex: 1;
    max-width: 440px;
    height: 26px;
    background: #090E1B;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    display: flex;
    align-items: center;
    padding: 0 10px;
    gap: 8px;
    font-size: 11.5px;
    font-family: ui-monospace, SFMono-Regular, monospace;
    color: #94A3B8;
  }

  .ext-status-tag {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 7px;
    background: rgba(2, 132, 199, 0.18);
    border: 1px solid rgba(2, 132, 199, 0.35);
    padding: 3px 10px;
    border-radius: 999px;
    font-size: 11.5px;
    font-weight: 700;
    color: #38BDF8;
  }

  /* Stage Content Split */
  .window-body {
    flex: 1;
    display: grid;
    grid-template-columns: 1fr 370px;
    background: #0A0F1D;
    overflow: hidden;
  }

  .body-full {
    display: block;
    grid-template-columns: none;
    padding: 24px;
  }

  .webpage-side {
    padding: 20px 24px;
    border-right: 1px solid rgba(255, 255, 255, 0.08);
    background: #0A0F1D;
    overflow: hidden;
    position: relative;
  }

  .table-hero-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 14px;
  }

  .table-title {
    font-size: 15px;
    font-weight: 700;
    color: #F8FAFC;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .table-meta-chip {
    font-size: 11px;
    font-weight: 600;
    padding: 3px 9px;
    border-radius: 4px;
    background: rgba(16, 185, 129, 0.15);
    color: #34D399;
    border: 1px solid rgba(16, 185, 129, 0.3);
  }

  /* Data Table Styling */
  .data-grid-mock {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }

  .data-grid-mock th {
    background: #141E33;
    padding: 9px 12px;
    text-align: left;
    font-weight: 700;
    color: #94A3B8;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .data-grid-mock td {
    padding: 9px 12px;
    color: #E2E8F0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  }

  .row-highlight {
    background: rgba(2, 132, 199, 0.08);
  }

  .cell-status-active {
    display: inline-block;
    padding: 2px 7px;
    border-radius: 999px;
    font-size: 10.5px;
    font-weight: 600;
    background: rgba(16, 185, 129, 0.18);
    color: #34D399;
  }

  .cell-status-pending {
    display: inline-block;
    padding: 2px 7px;
    border-radius: 999px;
    font-size: 10.5px;
    font-weight: 600;
    background: rgba(245, 158, 11, 0.18);
    color: #FBBF24;
  }

  /* Table Highlight Overlay Frame */
  .detected-table-glow {
    border: 2px solid #38BDF8;
    border-radius: 8px;
    box-shadow: 0 0 20px rgba(56, 189, 248, 0.25);
    overflow: hidden;
  }

  /* Extension Popup Mockup Card */
  .popup-side {
    background: #11192C;
    padding: 18px 20px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    border-left: 1px solid rgba(255, 255, 255, 0.08);
  }

  .popup-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    padding-bottom: 12px;
  }

  .popup-brand {
    display: flex;
    align-items: center;
    gap: 9px;
    font-size: 14px;
    font-weight: 800;
    color: #FFFFFF;
  }

  .popup-tier {
    font-size: 10.5px;
    font-weight: 800;
    letter-spacing: 0.04em;
    padding: 2px 8px;
    border-radius: 999px;
    background: linear-gradient(135deg, #10B981 0%, #059669 100%);
    color: #FFF;
  }

  .popup-stat-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .popup-stat-box {
    background: #0A0F1D;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    padding: 8px 6px;
    text-align: center;
  }

  .stat-val {
    display: block;
    font-size: 15px;
    font-weight: 800;
    color: #38BDF8;
  }

  .stat-emerald { color: #34D399; }

  .stat-lbl {
    font-size: 9.5px;
    font-weight: 600;
    color: #94A3B8;
    text-transform: uppercase;
  }

  .popup-action-btn {
    width: 100%;
    padding: 11px 14px;
    background: linear-gradient(135deg, #0284C7 0%, #0369A1 100%);
    border: none;
    border-radius: 8px;
    color: #FFFFFF;
    font-size: 13px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    box-shadow: 0 4px 16px rgba(2, 132, 199, 0.45);
  }

  .formats-selector {
    display: flex;
    gap: 6px;
  }

  .format-chip {
    flex: 1;
    text-align: center;
    padding: 6px 4px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 700;
    background: #090E1B;
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #94A3B8;
  }

  .chip-active {
    background: rgba(2, 132, 199, 0.18);
    border-color: rgba(56, 189, 248, 0.45);
    color: #38BDF8;
  }
`;

async function main() {
  console.log('====================================================');
  console.log(' Table Extractor — Professional Asset Redesign Suite');
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
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });

  // --------------------------------------------------------------------------
  // SCREENSHOT 1: Instant Table Auto-Detection
  // --------------------------------------------------------------------------
  console.log('Generating Screenshot 1: 01-table-detection.png (1280x800)...');
  const sc1Html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  ${sharedStyles}
</style>
</head>
<body>
  <div class="ambient-grid"></div>

  <div class="story-header">
    <div class="category-pill">⚡ Instant Auto-Detection</div>
    <h1 class="story-title">Extract Any Web Table in <span class="text-gradient-cyan">1-Click</span></h1>
    <p class="story-sub">Automatically identifies HTML tables, AG Grid, and data feeds across any website without coding or manual scraping.</p>
  </div>

  <div class="stage-viewport">
    <div class="mock-window">
      <div class="window-topbar">
        <div class="dots"><span class="dot dot-r"></span><span class="dot dot-y"></span><span class="dot dot-g"></span></div>
        <div class="url-pill"><span>portal.enterprise-analytics.com/quarterly-metrics</span></div>
        <div class="ext-status-tag">
          <img src="${icon48Url}" width="15" height="15" alt="icon">
          <span>Table Extractor Active</span>
        </div>
      </div>

      <div class="window-body">
        <div class="webpage-side">
          <div class="table-hero-banner">
            <div class="table-title">
              <span>Quarterly Performance Metrics</span>
            </div>
            <span class="table-meta-chip">100 Records Detected</span>
          </div>

          <div class="detected-table-glow">
            <table class="data-grid-mock">
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Account Name</th>
                  <th>Region</th>
                  <th>Quarter</th>
                  <th>Status</th>
                  <th>Gross Revenue</th>
                </tr>
              </thead>
              <tbody>
                <tr class="row-highlight">
                  <td>1</td>
                  <td>Apex Global Systems</td>
                  <td>North America</td>
                  <td>Q3 2026</td>
                  <td><span class="cell-status-active">Active</span></td>
                  <td>$452,190.00</td>
                </tr>
                <tr class="row-highlight">
                  <td>2</td>
                  <td>Vanguard Logic Ltd</td>
                  <td>EMEA</td>
                  <td>Q3 2026</td>
                  <td><span class="cell-status-active">Active</span></td>
                  <td>$318,440.00</td>
                </tr>
                <tr class="row-highlight">
                  <td>3</td>
                  <td>BluePeak Data Corp</td>
                  <td>APAC</td>
                  <td>Q3 2026</td>
                  <td><span class="cell-status-pending">Pending</span></td>
                  <td>$184,920.00</td>
                </tr>
                <tr class="row-highlight">
                  <td>4</td>
                  <td>Crestline Analytics</td>
                  <td>North America</td>
                  <td>Q3 2026</td>
                  <td><span class="cell-status-active">Active</span></td>
                  <td>$629,000.00</td>
                </tr>
                <tr class="row-highlight">
                  <td>5</td>
                  <td>Equinox Financial Group</td>
                  <td>LATAM</td>
                  <td>Q3 2026</td>
                  <td><span class="cell-status-active">Active</span></td>
                  <td>$275,800.00</td>
                </tr>
                <tr class="row-highlight">
                  <td>6</td>
                  <td>OmniCore Networks</td>
                  <td>EMEA</td>
                  <td>Q3 2026</td>
                  <td><span class="cell-status-active">Active</span></td>
                  <td>$512,300.00</td>
                </tr>
                <tr class="row-highlight">
                  <td>7</td>
                  <td>Stratos Cloud Systems</td>
                  <td>APAC</td>
                  <td>Q3 2026</td>
                  <td><span class="cell-status-active">Active</span></td>
                  <td>$394,150.00</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="popup-side">
          <div class="popup-head">
            <div class="popup-brand">
              <img src="${icon48Url}" width="22" height="22" alt="logo">
              <span>Table Extractor</span>
            </div>
            <span class="popup-tier">PRO ACTIVE</span>
          </div>

          <div style="font-size: 11.5px; color: #94A3B8;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
              <span>Detected Grid:</span>
              <strong style="color: #F8FAFC;">Performance Metrics</strong>
            </div>
          </div>

          <div class="popup-stat-grid">
            <div class="popup-stat-box">
              <span class="stat-val">100</span>
              <span class="stat-lbl">Rows</span>
            </div>
            <div class="popup-stat-box">
              <span class="stat-val">6</span>
              <span class="stat-lbl">Columns</span>
            </div>
            <div class="popup-stat-box">
              <span class="stat-val stat-emerald">Clean</span>
              <span class="stat-lbl">Aligned</span>
            </div>
          </div>

          <div style="margin-top: 4px;">
            <span style="font-size: 11px; font-weight: 700; color: #94A3B8; display: block; margin-bottom: 6px;">EXPORT FORMAT</span>
            <div class="formats-selector">
              <div class="format-chip chip-active">.CSV</div>
              <div class="format-chip chip-active">.XLSX</div>
              <div class="format-chip chip-active">.JSON</div>
            </div>
          </div>

          <div style="background: rgba(2, 132, 199, 0.1); border: 1px solid rgba(2, 132, 199, 0.25); border-radius: 8px; padding: 10px; font-size: 11px; color: #94A3B8;">
            ✓ <strong>Headers un-merged</strong> cleanly<br>
            ✓ <strong>Numeric currency</strong> preserved<br>
            ✓ <strong>No DOM garbage</strong> or stray tags
          </div>

          <div style="margin-top: auto;">
            <button class="popup-action-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              <span>Export Table (1-Click)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;

  await page.setContent(sc1Html, { waitUntil: 'load' });
  await page.screenshot({ path: path.join(outScreenshotsDir, '01-table-detection.png'), type: 'png' });
  console.log('  ✓ Generated: 01-table-detection.png');

  // --------------------------------------------------------------------------
  // SCREENSHOT 2: Infinite-Scroll Virtualized Capture (AG Grid / Salesforce)
  // --------------------------------------------------------------------------
  console.log('Generating Screenshot 2: 02-virtualized-capture.png (1280x800)...');
  const sc2Html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  ${sharedStyles}
  .progress-bar-container {
    background: #090E1B;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 999px;
    height: 10px;
    overflow: hidden;
    margin: 8px 0;
  }
  .progress-fill {
    height: 100%;
    width: 72%;
    background: linear-gradient(90deg, #0284C7 0%, #34D399 100%);
    box-shadow: 0 0 12px rgba(52, 211, 153, 0.5);
  }
</style>
</head>
<body>
  <div class="ambient-grid"></div>

  <div class="story-header">
    <div class="category-pill pill-emerald">🔄 Infinite Scroll Capture</div>
    <h1 class="story-title">Capture Thousands of <span class="text-gradient-cyan">Virtualized Rows</span></h1>
    <p class="story-sub">Automatically scrolls through DOM-recycling grids like AG Grid, Salesforce, and dynamic feeds to reconstruct complete datasets.</p>
  </div>

  <div class="stage-viewport">
    <div class="mock-window">
      <div class="window-topbar">
        <div class="dots"><span class="dot dot-r"></span><span class="dot dot-y"></span><span class="dot dot-g"></span></div>
        <div class="url-pill"><span>app.enterprise-cloud.io/ag-grid/employees-large</span></div>
        <div class="ext-status-tag" style="color: #34D399; background: rgba(16, 185, 129, 0.15); border-color: rgba(16, 185, 129, 0.3);">
          <span>Virtualized Scroll Active</span>
        </div>
      </div>

      <div class="window-body">
        <div class="webpage-side">
          <div class="table-hero-banner">
            <div class="table-title">
              <span>AG Grid Dynamic Enterprise Feed</span>
            </div>
            <span class="table-meta-chip" style="background: rgba(2, 132, 199, 0.18); color: #38BDF8; border-color: rgba(56, 189, 248, 0.35);">
              DOM Recycling · 2,000 Rows Total
            </span>
          </div>

          <div class="detected-table-glow" style="border-color: #34D399; box-shadow: 0 0 20px rgba(52, 211, 153, 0.2);">
            <table class="data-grid-mock">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Employee ID</th>
                  <th>Full Name</th>
                  <th>Department</th>
                  <th>Role Title</th>
                  <th>Annual Comp</th>
                </tr>
              </thead>
              <tbody>
                <tr class="row-highlight">
                  <td>1420</td>
                  <td>EMP-01420</td>
                  <td>Eleanor Vance</td>
                  <td>Engineering</td>
                  <td>Staff Distributed Architect</td>
                  <td>$245,000</td>
                </tr>
                <tr class="row-highlight">
                  <td>1421</td>
                  <td>EMP-01421</td>
                  <td>Marcus Sterling</td>
                  <td>Product Strategy</td>
                  <td>Principal Director</td>
                  <td>$215,000</td>
                </tr>
                <tr class="row-highlight">
                  <td>1422</td>
                  <td>EMP-01422</td>
                  <td>Seraphina Chen</td>
                  <td>Data Science</td>
                  <td>Lead ML Engineer</td>
                  <td>$220,000</td>
                </tr>
                <tr class="row-highlight">
                  <td>1423</td>
                  <td>EMP-01423</td>
                  <td>Julian Rossi</td>
                  <td>Operations</td>
                  <td>VP Global Infrastructure</td>
                  <td>$260,000</td>
                </tr>
                <tr class="row-highlight">
                  <td>1424</td>
                  <td>EMP-01424</td>
                  <td>Cassandra Hayes</td>
                  <td>Legal Compliance</td>
                  <td>Senior Counsel</td>
                  <td>$205,000</td>
                </tr>
                <tr class="row-highlight">
                  <td>1425</td>
                  <td>EMP-01425</td>
                  <td>Derrick Thorne</td>
                  <td>Security</td>
                  <td>Staff Incident Commander</td>
                  <td>$230,000</td>
                </tr>
                <tr class="row-highlight">
                  <td>1426</td>
                  <td>EMP-01426</td>
                  <td>Amara Nwosu</td>
                  <td>Finance</td>
                  <td>Head of Treasury</td>
                  <td>$210,000</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="popup-side">
          <div class="popup-head">
            <div class="popup-brand">
              <img src="${icon48Url}" width="22" height="22" alt="logo">
              <span>Table Extractor</span>
            </div>
            <span class="popup-tier">PRO ACTIVE</span>
          </div>

          <div style="background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(52, 211, 153, 0.3); border-radius: 8px; padding: 12px;">
            <div style="display: flex; justify-content: space-between; font-size: 11.5px; font-weight: 700; color: #34D399; margin-bottom: 4px;">
              <span>⚡ AUTO-SCROLLING IN PROGRESS</span>
              <span>72%</span>
            </div>
            <div class="progress-bar-container">
              <div class="progress-fill"></div>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 11px; color: #94A3B8;">
              <span>Batch 48 / 66</span>
              <span>1,426 of 2,000 rows</span>
            </div>
          </div>

          <div class="popup-stat-grid">
            <div class="popup-stat-box">
              <span class="stat-val stat-emerald">1,426</span>
              <span class="stat-lbl">Captured</span>
            </div>
            <div class="popup-stat-box">
              <span class="stat-val">2,000</span>
              <span class="stat-lbl">Dataset</span>
            </div>
            <div class="popup-stat-box">
              <span class="stat-val stat-emerald">0</span>
              <span class="stat-lbl">Duplicates</span>
            </div>
          </div>

          <div style="background: #090E1B; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; padding: 10px; font-size: 11px; color: #94A3B8;">
            <strong style="color: #F8FAFC;">Sequential Deduplication:</strong><br>
            Stitches batches seamlessly using row keys and cell content hashes. Restores scroll position when done.
          </div>

          <div style="margin-top: auto;">
            <button class="popup-action-btn" style="background: linear-gradient(135deg, #059669 0%, #047857 100%); box-shadow: 0 4px 16px rgba(16, 185, 129, 0.4);">
              <span>Capturing Full Dataset...</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;

  await page.setContent(sc2Html, { waitUntil: 'load' });
  await page.screenshot({ path: path.join(outScreenshotsDir, '02-virtualized-capture.png'), type: 'png' });
  console.log('  ✓ Generated: 02-virtualized-capture.png');

  // --------------------------------------------------------------------------
  // SCREENSHOT 3: Direct Excel & CSV Clean Export Showcase
  // --------------------------------------------------------------------------
  console.log('Generating Screenshot 3: 03-excel-export.png (1280x800)...');
  const sc3Html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  ${sharedStyles}
  .split-comparison {
    display: grid;
    grid-template-columns: 460px 1fr;
    gap: 20px;
    height: 100%;
    padding: 24px;
    background: #090E1B;
  }
  .excel-window {
    background: #0E1626;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 15px 40px rgba(0,0,0,0.6);
    display: flex;
    flex-direction: column;
  }
  .excel-topbar {
    background: #107C41; /* Microsoft Excel Green */
    padding: 10px 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    color: #FFF;
    font-size: 12px;
    font-weight: 700;
  }
  .excel-formula-bar {
    background: #141E33;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    padding: 6px 12px;
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 11px;
    font-family: ui-monospace, SFMono-Regular, monospace;
    color: #94A3B8;
  }
  .excel-grid {
    flex: 1;
    overflow: hidden;
    background: #0B1120;
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
  }
  .excel-grid th {
    background: #162038;
    color: #94A3B8;
    padding: 6px 10px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    font-weight: 600;
  }
  .excel-grid td {
    padding: 6px 10px;
    border: 1px solid rgba(255, 255, 255, 0.05);
    color: #E2E8F0;
  }
  .excel-grid td.col-num {
    text-align: right;
    color: #38BDF8;
    font-family: ui-monospace, monospace;
  }
</style>
</head>
<body>
  <div class="ambient-grid"></div>

  <div class="story-header">
    <div class="category-pill pill-purple">📊 Export Perfection</div>
    <h1 class="story-title">1-Click Direct Export to <span class="text-gradient-cyan">Excel & CSV</span></h1>
    <p class="story-sub">Exports structured workbooks with clean numeric alignment, un-merged multi-row headers, and zero scrambled columns.</p>
  </div>

  <div class="stage-viewport">
    <div class="mock-window">
      <div class="window-topbar">
        <div class="dots"><span class="dot dot-r"></span><span class="dot dot-y"></span><span class="dot dot-g"></span></div>
        <div class="url-pill"><span>table-extractor // export-pipeline</span></div>
        <div class="ext-status-tag" style="color: #C084FC; background: rgba(192, 132, 252, 0.15); border-color: rgba(192, 132, 252, 0.3);">
          <span>Ready for Spreadsheets</span>
        </div>
      </div>

      <div class="split-comparison">
        <!-- Left: Extension Export Card -->
        <div class="popup-side" style="border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
          <div class="popup-head">
            <div class="popup-brand">
              <img src="${icon48Url}" width="22" height="22" alt="logo">
              <span>Export Destination</span>
            </div>
            <span class="popup-tier">PRO UNLOCKED</span>
          </div>

          <div style="background: #090E1B; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; padding: 12px;">
            <div style="font-size: 13px; font-weight: 700; color: #FFF; margin-bottom: 4px;">financial-performance.xlsx</div>
            <div style="font-size: 11px; color: #34D399;">✓ Formatted Microsoft Excel Workbook ready</div>
          </div>

          <div class="popup-stat-grid">
            <div class="popup-stat-box">
              <span class="stat-val">100</span>
              <span class="stat-lbl">Records</span>
            </div>
            <div class="popup-stat-box">
              <span class="stat-val">6</span>
              <span class="stat-lbl">Columns</span>
            </div>
            <div class="popup-stat-box">
              <span class="stat-val stat-emerald">UTF-8</span>
              <span class="stat-lbl">Encoding</span>
            </div>
          </div>

          <div style="font-size: 11.5px; color: #94A3B8; line-height: 1.5;">
            • Preserves pure numbers, currency & dates<br>
            • Un-merges rowspans & colspans accurately<br>
            • Compatible with Excel, Google Sheets, Notion & Airtable
          </div>

          <div style="margin-top: auto;">
            <button class="popup-action-btn" style="background: linear-gradient(135deg, #107C41 0%, #0B582E 100%); box-shadow: 0 4px 16px rgba(16, 124, 65, 0.45);">
              <span>⬇ Download Excel Workbook (.xlsx)</span>
            </button>
          </div>
        </div>

        <!-- Right: Real Excel Interface Preview -->
        <div class="excel-window">
          <div class="excel-topbar">
            <span>Microsoft Excel — financial-performance.xlsx</span>
            <span style="background: rgba(255,255,255,0.2); padding: 2px 8px; border-radius: 4px; font-size: 10.5px;">AutoSave ON</span>
          </div>

          <div class="excel-formula-bar">
            <span style="color: #38BDF8; font-weight: 700;">A1</span>
            <span>= "Apex Global Systems"</span>
          </div>

          <table class="excel-grid">
            <thead>
              <tr>
                <th style="width: 32px;"></th>
                <th>A (Account Name)</th>
                <th>B (Region)</th>
                <th>C (Quarter)</th>
                <th>D (Status)</th>
                <th>E (Gross Revenue)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th style="background: #141E33;">1</th>
                <td style="font-weight: 600;">Apex Global Systems</td>
                <td>North America</td>
                <td>Q3 2026</td>
                <td>Active</td>
                <td class="col-num">$452,190.00</td>
              </tr>
              <tr>
                <th style="background: #141E33;">2</th>
                <td style="font-weight: 600;">Vanguard Logic Ltd</td>
                <td>EMEA</td>
                <td>Q3 2026</td>
                <td>Active</td>
                <td class="col-num">$318,440.00</td>
              </tr>
              <tr>
                <th style="background: #141E33;">3</th>
                <td style="font-weight: 600;">BluePeak Data Corp</td>
                <td>APAC</td>
                <td>Q3 2026</td>
                <td>Pending</td>
                <td class="col-num">$184,920.00</td>
              </tr>
              <tr>
                <th style="background: #141E33;">4</th>
                <td style="font-weight: 600;">Crestline Analytics</td>
                <td>North America</td>
                <td>Q3 2026</td>
                <td>Active</td>
                <td class="col-num">$629,000.00</td>
              </tr>
              <tr>
                <th style="background: #141E33;">5</th>
                <td style="font-weight: 600;">Equinox Financial Group</td>
                <td>LATAM</td>
                <td>Q3 2026</td>
                <td>Active</td>
                <td class="col-num">$275,800.00</td>
              </tr>
              <tr>
                <th style="background: #141E33;">6</th>
                <td style="font-weight: 600;">OmniCore Networks</td>
                <td>EMEA</td>
                <td>Q3 2026</td>
                <td>Active</td>
                <td class="col-num">$512,300.00</td>
              </tr>
              <tr>
                <th style="background: #141E33;">7</th>
                <td style="font-weight: 600;">Stratos Cloud Systems</td>
                <td>APAC</td>
                <td>Q3 2026</td>
                <td>Active</td>
                <td class="col-num">$394,150.00</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;

  await page.setContent(sc3Html, { waitUntil: 'load' });
  await page.screenshot({ path: path.join(outScreenshotsDir, '03-excel-export.png'), type: 'png' });
  console.log('  ✓ Generated: 03-excel-export.png');

  // --------------------------------------------------------------------------
  // SCREENSHOT 4: Precision Filtering & Data Cleansing
  // --------------------------------------------------------------------------
  console.log('Generating Screenshot 4: 04-data-cleansing.png (1280x800)...');
  const sc4Html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  ${sharedStyles}
  .options-pane {
    padding: 24px 32px;
    background: #090E1B;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    height: 100%;
  }
  .feature-panel {
    background: #0E1626;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 12px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
  }
  .panel-title {
    font-size: 14px;
    font-weight: 800;
    color: #F8FAFC;
    display: flex;
    align-items: center;
    gap: 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    padding-bottom: 10px;
  }
  .setting-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 12px;
    color: #94A3B8;
  }
  .input-chip {
    background: #060913;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 6px;
    padding: 6px 12px;
    font-family: ui-monospace, monospace;
    font-size: 12px;
    color: #38BDF8;
    font-weight: 700;
  }
</style>
</head>
<body>
  <div class="ambient-grid"></div>

  <div class="story-header">
    <div class="category-pill pill-amber">⚙️ Precision Controls</div>
    <h1 class="story-title">Filter Row Ranges & <span class="text-gradient-cyan">Custom Columns</span></h1>
    <p class="story-sub">Extract targeted row slices, reveal hidden developer fields, and copy clean Tab-Separated Values (TSV) directly to your clipboard.</p>
  </div>

  <div class="stage-viewport">
    <div class="mock-window">
      <div class="window-topbar">
        <div class="dots"><span class="dot dot-r"></span><span class="dot dot-y"></span><span class="dot dot-g"></span></div>
        <div class="url-pill"><span>table-extractor // power-settings</span></div>
        <div class="ext-status-tag" style="color: #FBBF24; background: rgba(251, 191, 36, 0.15); border-color: rgba(251, 191, 36, 0.3);">
          <span>Precision Options</span>
        </div>
      </div>

      <div class="options-pane">
        <!-- Panel 1: Row Range & Speed Tuning -->
        <div class="feature-panel">
          <div class="panel-title">
            <span style="color: #38BDF8;">⚡</span>
            <span>Row Range & Capture Limits</span>
          </div>

          <div class="setting-row">
            <span>Target Row Range:</span>
            <div style="display: flex; gap: 6px; align-items: center;">
              <span class="input-chip">Start: 100</span>
              <span style="color: #64748B;">to</span>
              <span class="input-chip">End: 500</span>
            </div>
          </div>

          <div class="setting-row">
            <span>Safety Max Rows Limit:</span>
            <span class="input-chip">5,000 max</span>
          </div>

          <div class="setting-row">
            <span>DOM Settle Delay:</span>
            <span class="input-chip" style="color: #34D399;">Normal (3s settle)</span>
          </div>

          <div style="background: rgba(56, 189, 248, 0.08); border: 1px solid rgba(56, 189, 248, 0.2); border-radius: 8px; padding: 12px; font-size: 11.5px; color: #94A3B8; margin-top: auto;">
            🎯 <strong>Targeted Extraction:</strong> Extract only the rows you care about without waiting to scroll through 50,000 records.
          </div>
        </div>

        <!-- Panel 2: Column Selection & Clipboard -->
        <div class="feature-panel">
          <div class="panel-title">
            <span style="color: #34D399;">📋</span>
            <span>Clean Data & Clipboard Normalization</span>
          </div>

          <div class="setting-row">
            <span>Include Hidden Columns:</span>
            <span class="input-chip" style="color: #34D399;">Enabled (8 cols)</span>
          </div>

          <div class="setting-row">
            <span>Whitespace Normalization:</span>
            <span class="input-chip" style="color: #34D399;">Auto-Trimmed</span>
          </div>

          <div class="setting-row">
            <span>Fast Clipboard Copy (TSV):</span>
            <span class="input-chip" style="color: #F8FAFC;">1-Click Ready</span>
          </div>

          <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 8px; padding: 12px; font-size: 11.5px; color: #94A3B8; margin-top: auto;">
            📋 <strong>Instant Paste:</strong> Tabular TSV format allows immediate pasting directly into Google Sheets, Notion, or Airtable cells without file download.
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;

  await page.setContent(sc4Html, { waitUntil: 'load' });
  await page.screenshot({ path: path.join(outScreenshotsDir, '04-data-cleansing.png'), type: 'png' });
  console.log('  ✓ Generated: 04-data-cleansing.png');

  // --------------------------------------------------------------------------
  // SCREENSHOT 5: 100% Client-Side Privacy & Security
  // --------------------------------------------------------------------------
  console.log('Generating Screenshot 5: 05-privacy-first.png (1280x800)...');
  const sc5Html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  ${sharedStyles}
  .privacy-stage {
    padding: 32px 40px;
    background: #090E1B;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-align: center;
  }
  .shield-icon-wrapper {
    width: 80px;
    height: 80px;
    border-radius: 20px;
    background: rgba(16, 185, 129, 0.15);
    border: 1px solid rgba(16, 185, 129, 0.35);
    box-shadow: 0 0 30px rgba(16, 185, 129, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 20px;
  }
  .privacy-pillars-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
    width: 100%;
    max-width: 960px;
    margin-top: 24px;
    text-align: left;
  }
  .pillar-card {
    background: #0E1626;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 20px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.5);
  }
  .pillar-card h3 {
    font-size: 13.5px;
    font-weight: 800;
    color: #F8FAFC;
    margin-bottom: 6px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .pillar-card p {
    font-size: 11.5px;
    color: #94A3B8;
    line-height: 1.5;
  }
</style>
</head>
<body>
  <div class="ambient-grid"></div>

  <div class="story-header">
    <div class="category-pill pill-rose">🔒 Security & Privacy</div>
    <h1 class="story-title">100% Client-Side. <span class="text-gradient-cyan">Zero Cloud Uploads</span></h1>
    <p class="story-sub">Your internal metrics, financial reports, and confidential data never leave your browser sandbox.</p>
  </div>

  <div class="stage-viewport">
    <div class="mock-window">
      <div class="window-topbar">
        <div class="dots"><span class="dot dot-r"></span><span class="dot dot-y"></span><span class="dot dot-g"></span></div>
        <div class="url-pill"><span>table-extractor // security-architecture</span></div>
        <div class="ext-status-tag" style="color: #34D399; background: rgba(16, 185, 129, 0.15); border-color: rgba(16, 185, 129, 0.3);">
          <span>Enterprise Secure</span>
        </div>
      </div>

      <div class="privacy-stage">
        <div class="shield-icon-wrapper">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#34D399" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        </div>

        <h2 style="font-size: 20px; font-weight: 800; color: #FFF; margin-bottom: 6px;">Zero External Network Requests</h2>
        <p style="font-size: 13px; color: #94A3B8; max-width: 600px;">Table Extractor does not operate a scraping backend. Every byte of HTML extraction and spreadsheet compilation executes strictly on your local CPU.</p>

        <div class="privacy-pillars-grid">
          <div class="pillar-card">
            <h3><span style="color: #34D399;">✓</span> Local Processing</h3>
            <p>Table parsing, CSV encoding, and XLSX binary compilation occur completely inside the browser window context.</p>
          </div>

          <div class="pillar-card">
            <h3><span style="color: #38BDF8;">✓</span> Least-Privilege</h3>
            <p>Uses Manifest V3 <code>activeTab</code> on-demand. Never injects code or tracks background tabs when inactive.</p>
          </div>

          <div class="pillar-card">
            <h3><span style="color: #C084FC;">✓</span> No Account Needed</h3>
            <p>Zero login walls, zero tracking telemetry, and zero third-party marketing cookies. Completely anonymous utility.</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;

  await page.setContent(sc5Html, { waitUntil: 'load' });
  await page.screenshot({ path: path.join(outScreenshotsDir, '05-privacy-first.png'), type: 'png' });
  console.log('  ✓ Generated: 05-privacy-first.png');

  // --------------------------------------------------------------------------
  // PROMOTIONAL TILE 1: Marquee Banner (1400x560)
  // --------------------------------------------------------------------------
  console.log('\nGenerating Marquee Promotional Banner: marquee-promo-1400x560.png (1400x560)...');
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
    font-family: -apple-system, BlinkMacSystemFont, 'Plus Jakarta Sans', sans-serif;
    background: #060913;
    background-image: 
      radial-gradient(circle at 18% 40%, rgba(2, 132, 199, 0.32) 0%, transparent 60%),
      radial-gradient(circle at 82% 60%, rgba(16, 185, 129, 0.2) 0%, transparent 55%),
      linear-gradient(135deg, #070B16 0%, #03050A 100%);
    display: flex;
    align-items: center;
    position: relative;
    padding: 0 80px;
  }

  .ambient-grid {
    position: absolute;
    inset: 0;
    background-image: 
      linear-gradient(rgba(255, 255, 255, 0.035) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.035) 1px, transparent 1px);
    background-size: 36px 36px;
    pointer-events: none;
  }

  .left-hero {
    flex: 1.15;
    z-index: 10;
    padding-right: 40px;
  }

  .brand-lockup {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 20px;
  }

  .brand-logo-img {
    width: 52px;
    height: 52px;
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(2, 132, 199, 0.4);
  }

  .brand-name {
    font-size: 26px;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: #FFFFFF;
  }

  .brand-tag-chip {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #38BDF8;
    background: rgba(56, 189, 248, 0.12);
    border: 1px solid rgba(56, 189, 248, 0.3);
    padding: 3px 8px;
    border-radius: 4px;
  }

  .hero-headline {
    font-size: 44px;
    font-weight: 800;
    letter-spacing: -0.03em;
    line-height: 1.12;
    color: #FFFFFF;
    margin-bottom: 14px;
  }

  .hero-gradient {
    background: linear-gradient(135deg, #38BDF8 0%, #6EE7B7 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .hero-desc {
    font-size: 17.5px;
    color: #94A3B8;
    line-height: 1.5;
    margin-bottom: 26px;
    max-width: 560px;
  }

  .pills-group {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .feature-tag {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    padding: 7px 14px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 700;
    color: #E2E8F0;
  }

  /* Right Side Glass Card */
  .right-preview {
    flex: 0.95;
    z-index: 10;
    display: flex;
    justify-content: center;
  }

  .glass-card {
    width: 500px;
    background: #0E1626;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 16px;
    box-shadow: 
      0 30px 60px -15px rgba(0, 0, 0, 0.85),
      0 0 35px rgba(2, 132, 199, 0.22);
    overflow: hidden;
  }

  .card-top {
    background: #162034;
    padding: 12px 18px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .card-top span {
    font-size: 13.5px;
    font-weight: 700;
    color: #F8FAFC;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .card-table-body {
    padding: 16px;
    background: #0A0F1D;
  }

  .card-mock-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11.5px;
  }

  .card-mock-table th {
    background: rgba(255, 255, 255, 0.04);
    padding: 7px 10px;
    color: #94A3B8;
    text-align: left;
    font-weight: 700;
  }

  .card-mock-table td {
    padding: 7px 10px;
    color: #E2E8F0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.03);
  }

  .card-mock-table tr:first-child td {
    background: rgba(2, 132, 199, 0.09);
  }

  .card-bottom-bar {
    padding: 14px 18px;
    background: #0E1626;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .format-tags-row {
    display: flex;
    gap: 6px;
  }

  .fmt-badge {
    font-size: 11px;
    font-weight: 800;
    background: rgba(56, 189, 248, 0.1);
    color: #38BDF8;
    border: 1px solid rgba(56, 189, 248, 0.28);
    padding: 3px 8px;
    border-radius: 4px;
  }

  .export-cta-pill {
    background: linear-gradient(135deg, #0284C7 0%, #0369A1 100%);
    color: #FFF;
    font-size: 12px;
    font-weight: 800;
    padding: 7px 14px;
    border-radius: 6px;
    box-shadow: 0 4px 14px rgba(2, 132, 199, 0.4);
  }
</style>
</head>
<body>
  <div class="ambient-grid"></div>

  <div class="left-hero">
    <div class="brand-lockup">
      <img src="${icon128Url}" class="brand-logo-img" alt="Logo">
      <div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span class="brand-name">Table Extractor</span>
          <span class="brand-tag-chip">PRO</span>
        </div>
        <span style="font-size: 12.5px; color: #94A3B8;">Web Scraping · Table to Excel · 1-Click Export</span>
      </div>
    </div>

    <h1 class="hero-headline">
      Turn Any Web Table into<br>
      <span class="hero-gradient">Clean Spreadsheets</span>
    </h1>

    <p class="hero-desc">
      Auto-detect standard HTML tables and capture thousands of virtualized infinite-scroll rows with 100% on-device privacy.
    </p>

    <div class="pills-group">
      <div class="feature-tag">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34D399" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        <span>Instant Auto-Detection</span>
      </div>
      <div class="feature-tag">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34D399" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        <span>Excel (.xlsx) & CSV</span>
      </div>
      <div class="feature-tag">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34D399" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        <span>100% Client-Side Privacy</span>
      </div>
    </div>
  </div>

  <div class="right-preview">
    <div class="glass-card">
      <div class="card-top">
        <span>
          <img src="${icon48Url}" width="18" height="18" alt="icon">
          <span>Enterprise Performance Matrix</span>
        </span>
        <span style="font-size: 11px; font-weight: 700; background: rgba(16, 185, 129, 0.18); color: #34D399; padding: 3px 9px; border-radius: 999px;">
          100 Records
        </span>
      </div>

      <div class="card-table-body">
        <table class="card-mock-table">
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

      <div class="card-bottom-bar">
        <div class="format-tags-row">
          <span class="fmt-badge">.XLSX</span>
          <span class="fmt-badge">.CSV</span>
          <span class="fmt-badge">.JSON</span>
        </div>
        <div class="export-cta-pill">
          <span>⬇ Export to Excel</span>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;

  await page.setContent(marqueeHtml, { waitUntil: 'load' });
  await page.screenshot({ path: path.join(outPromoDir, 'marquee-promo-1400x560.png'), type: 'png' });
  // Also copy to root marquee_promo.png
  fs.copyFileSync(path.join(outPromoDir, 'marquee-promo-1400x560.png'), path.join(rootDir, 'marquee_promo.png'));
  console.log('  ✓ Generated: marquee-promo-1400x560.png and mirrored to root marquee_promo.png');

  // --------------------------------------------------------------------------
  // PROMOTIONAL TILE 2: Small Promo Tile (440x280)
  // --------------------------------------------------------------------------
  console.log('\nGenerating Small Promotional Tile: small-promo-440x280.png (440x280)...');
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
    font-family: -apple-system, BlinkMacSystemFont, 'Plus Jakarta Sans', sans-serif;
    background: #060913;
    background-image: 
      radial-gradient(circle at 50% 25%, rgba(2, 132, 199, 0.35) 0%, transparent 65%),
      linear-gradient(180deg, #090E1B 0%, #030509 100%);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 22px 20px;
    position: relative;
    border: 1px solid rgba(255, 255, 255, 0.12);
  }

  .ambient-grid {
    position: absolute;
    inset: 0;
    background-image: 
      linear-gradient(rgba(255, 255, 255, 0.035) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.035) 1px, transparent 1px);
    background-size: 24px 24px;
    pointer-events: none;
  }

  .icon-pedestal {
    width: 68px;
    height: 68px;
    border-radius: 16px;
    background: rgba(2, 132, 199, 0.15);
    border: 1px solid rgba(2, 132, 199, 0.45);
    box-shadow: 0 10px 28px rgba(2, 132, 199, 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 12px;
    z-index: 10;
  }

  .pedestal-img {
    width: 54px;
    height: 54px;
    border-radius: 12px;
  }

  .tile-title {
    font-size: 24px;
    font-weight: 800;
    letter-spacing: -0.025em;
    color: #FFFFFF;
    margin-bottom: 5px;
    line-height: 1.15;
    z-index: 10;
  }

  .tile-title span {
    background: linear-gradient(135deg, #38BDF8 0%, #6EE7B7 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .tile-sub {
    font-size: 13px;
    font-weight: 500;
    color: #94A3B8;
    line-height: 1.35;
    margin-bottom: 14px;
    z-index: 10;
  }

  .badge-row {
    display: flex;
    gap: 7px;
    z-index: 10;
  }

  .pill-badge {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.04em;
    padding: 4px 9px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.14);
    color: #E2E8F0;
  }

  .badge-accent {
    background: rgba(2, 132, 199, 0.22);
    border-color: rgba(56, 189, 248, 0.5);
    color: #38BDF8;
  }
</style>
</head>
<body>
  <div class="ambient-grid"></div>

  <div class="icon-pedestal">
    <img src="${icon128Url}" class="pedestal-img" alt="Logo">
  </div>

  <h1 class="tile-title">Table <span>Extractor</span></h1>
  <p class="tile-sub">Web Scraping · Table to Excel · 1-Click Export</p>

  <div class="badge-row">
    <span class="pill-badge badge-accent">CSV & Excel (.xlsx)</span>
    <span class="pill-badge">AG Grid Ready</span>
    <span class="pill-badge">100% Private</span>
  </div>
</body>
</html>`;

  await page.setContent(smallPromoHtml, { waitUntil: 'load' });
  await page.screenshot({ path: path.join(outPromoDir, 'small-promo-440x280.png'), type: 'png' });
  // Also copy to root small_promo.png
  fs.copyFileSync(path.join(outPromoDir, 'small-promo-440x280.png'), path.join(rootDir, 'small_promo.png'));
  console.log('  ✓ Generated: small-promo-440x280.png and mirrored to root small_promo.png');

  await browser.close();

  console.log('\n====================================================');
  console.log('🎉 ALL 7 REDESIGNED ASSETS GENERATED SUCCESSFULLY! 🎉');
  console.log('====================================================\n');
}

main().catch(err => {
  console.error('Fatal error generating redesigned assets:', err);
  process.exit(1);
});
