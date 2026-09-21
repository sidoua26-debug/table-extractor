import puppeteer from 'puppeteer';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const screenshotsDir = path.join(rootDir, 'assets', 'screenshots');

if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

// Read fixture files
const staticTableHtml = fs.readFileSync(path.join(rootDir, 'test', 'static-table-fixture.html'), 'utf8');
const agGridHtml = fs.readFileSync(path.join(rootDir, 'test', 'ag-grid-fixture.html'), 'utf8');
const icon48Base64 = fs.readFileSync(path.join(rootDir, 'assets', 'icons', 'icon-48.png')).toString('base64');

// Gold star SVG for ratings
const starSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14"><path fill="#f59e0b" d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>`;

async function run() {
  console.log('====================================================');
  console.log('    Table Extractor - Store Screenshot Generator    ');
  console.log('====================================================\n');

  // 1. Start local server
  const server = http.createServer((req, res) => {
    if (req.url === '/static-table') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(staticTableHtml);
    } else if (req.url === '/ag-grid') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(agGridHtml);
    } else if (req.url.includes('star.svg')) {
      res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
      res.end(starSvg);
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  }).listen(9876);

  console.log('Local test fixture server running at http://127.0.0.1:9876');

  // 2. Launch Puppeteer with extension
  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: '/home/sid/.cache/puppeteer/chrome/linux-153.0.8010.36/chrome-linux64/chrome',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      `--disable-extensions-except=${rootDir}`,
      `--load-extension=${rootDir}`
    ]
  });

  const workerTarget = await browser.waitForTarget(t => t.type() === 'service_worker', { timeout: 10000 });
  const extId = new URL(workerTarget.url()).host;
  console.log(`Extension loaded with ID: ${extId}`);

  // Helper to set Pro or Free tier in storage
  async function setProTier(isPro) {
    const worker = await workerTarget.worker();
    await worker.evaluate(async (pro) => {
      if (pro) {
        await chrome.storage.local.set({
          tableExtractor_licenseStatus: 'pro',
          tableExtractor_licenseKey: 'TE-GIFT-TEST',
          tableExtractor_paymentId: 'TE-GIFT-TEST',
          tableExtractor_activatedAt: new Date().toISOString()
        });
      } else {
        await chrome.storage.local.remove([
          'tableExtractor_licenseStatus',
          'tableExtractor_licenseKey',
          'tableExtractor_paymentId',
          'tableExtractor_activatedAt'
        ]);
      }
    }, isPro);
  }

  // Composite generator function
  async function generateScreenshot({
    filename,
    pageUrl,
    displayUrl,
    urlDomain,
    urlPath,
    isPro = false,
    pageSetup = null,
    popupSetup = null
  }) {
    console.log(`\nGenerating: ${filename} (isPro: ${isPro})...`);
    await setProTier(isPro);

    // 1. Load target web page
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 746 });
    await page.goto(pageUrl, { waitUntil: 'networkidle0' });

    if (pageSetup) {
      await page.evaluate(pageSetup);
    }
    await new Promise(r => setTimeout(r, 600));
    const pageBuf = await page.screenshot({ encoding: 'base64' });

    // 2. Determine target tab ID from worker
    const worker = await workerTarget.worker();
    const tabs = await worker.evaluate(async () => chrome.tabs.query({}));
    const targetTab = tabs[tabs.length - 1];
    targetTab.url = displayUrl;

    // 3. Load popup
    const popupPage = await browser.newPage();
    await popupPage.setViewport({ width: 380, height: 700 });
    await popupPage.evaluateOnNewDocument((target) => {
      const origQuery = chrome.tabs.query.bind(chrome.tabs);
      chrome.tabs.query = async (queryInfo) => {
        if (queryInfo.active && queryInfo.currentWindow) {
          return [target];
        }
        return origQuery(queryInfo);
      };
    }, targetTab);

    await popupPage.goto(`chrome-extension://${extId}/popup/popup.html`);
    await popupPage.waitForSelector('#table-view', { visible: true, timeout: 10000 });

    if (popupSetup) {
      await popupPage.evaluate(popupSetup);
      await new Promise(r => setTimeout(r, 300));
    }

    const popupEl = await popupPage.$('.app-container');
    const popupBuf = await popupEl.screenshot({ encoding: 'base64' });

    await page.close();
    await popupPage.close();

    // 4. Composite into 1280x800 page
    const compPage = await browser.newPage();
    await compPage.setViewport({ width: 1280, height: 800 });

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
    background: #0f172a;
  }
  .browser-window {
    width: 1280px;
    height: 800px;
    display: flex;
    flex-direction: column;
    position: relative;
    background: #ffffff;
  }
  .browser-toolbar {
    height: 54px;
    background: #1e293b;
    border-bottom: 1px solid #334155;
    display: flex;
    align-items: center;
    padding: 0 16px;
    gap: 16px;
    user-select: none;
    z-index: 10;
  }
  .window-controls {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
  }
  .dot-red { background: #ef4444; }
  .dot-yellow { background: #f59e0b; }
  .dot-green { background: #10b981; }

  .nav-buttons {
    display: flex;
    gap: 12px;
    color: #94a3b8;
    font-size: 15px;
  }
  .nav-btn {
    cursor: default;
    opacity: 0.7;
  }
  .address-bar {
    flex: 1;
    height: 36px;
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 8px;
    display: flex;
    align-items: center;
    padding: 0 12px;
    gap: 8px;
    font-size: 13px;
  }
  .lock-icon {
    font-size: 12px;
    color: #10b981;
  }
  .url-protocol {
    color: #64748b;
  }
  .url-domain {
    color: #f8fafc;
    font-weight: 600;
  }
  .url-path {
    color: #94a3b8;
  }
  .toolbar-extensions {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .ext-icon-wrapper {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: #0284c7;
    box-shadow: 0 0 0 2px rgba(2, 132, 199, 0.5), 0 2px 8px rgba(0, 0, 0, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  }
  .ext-icon-wrapper img {
    width: 24px;
    height: 24px;
    border-radius: 4px;
  }
  .viewport-area {
    flex: 1;
    position: relative;
    overflow: hidden;
    background: #0f172a;
  }
  .webpage-screenshot {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: top left;
    display: block;
  }
  .popup-overlay {
    position: absolute;
    top: 6px;
    right: 18px;
    width: 380px;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 24px 60px -12px rgba(0, 0, 0, 0.75), 0 0 0 1px #475569;
    background: #0f172a;
    z-index: 1000;
  }
  .popup-screenshot {
    width: 100%;
    display: block;
  }
</style>
</head>
<body>
  <div class="browser-window">
    <div class="browser-toolbar">
      <div class="window-controls">
        <div class="dot dot-red"></div>
        <div class="dot dot-yellow"></div>
        <div class="dot dot-green"></div>
      </div>
      <div class="nav-buttons">
        <span class="nav-btn">&larr;</span>
        <span class="nav-btn">&rarr;</span>
        <span class="nav-btn">&#x21bb;</span>
      </div>
      <div class="address-bar">
        <span class="lock-icon">🔒</span>
        <span><span class="url-protocol">https://</span><span class="url-domain">${urlDomain}</span><span class="url-path">${urlPath}</span></span>
      </div>
      <div class="toolbar-extensions">
        <div class="ext-icon-wrapper">
          <img src="data:image/png;base64,${icon48Base64}" alt="Table Extractor">
        </div>
      </div>
    </div>
    <div class="viewport-area">
      <img class="webpage-screenshot" src="data:image/png;base64,${pageBuf}">
      <div class="popup-overlay">
        <img class="popup-screenshot" src="data:image/png;base64,${popupBuf}">
      </div>
    </div>
  </div>
</body>
</html>`;

    await compPage.setContent(html);
    await new Promise(r => setTimeout(r, 400));
    const destPath = path.join(screenshotsDir, filename);
    await compPage.screenshot({ path: destPath, type: 'png' });
    console.log(`  -> Saved ${destPath} (1280x800)`);
    await compPage.close();
  }

  // --- SCENARIO 1: Simple static table detected ---
  await generateScreenshot({
    filename: '01-static-detection.png',
    pageUrl: 'http://127.0.0.1:9876/static-table',
    displayUrl: 'https://en.wikipedia.org/wiki/List_of_highest-grossing_films',
    urlDomain: 'en.wikipedia.org',
    urlPath: '/wiki/List_of_highest-grossing_films',
    isPro: false,
    popupSetup: () => {
      const csv = document.getElementById('fmt-csv');
      if (csv) csv.checked = true;
    }
  });

  // --- SCENARIO 2: Virtualized grid detected with "Capture all rows" prompt ---
  await generateScreenshot({
    filename: '02-virtualized-detection.png',
    pageUrl: 'http://127.0.0.1:9876/ag-grid',
    displayUrl: 'https://www.ag-grid.com/example/performance-grid',
    urlDomain: 'ag-grid.com',
    urlPath: '/example/performance-grid',
    isPro: false,
    popupSetup: () => {
      const csv = document.getElementById('fmt-csv');
      if (csv) csv.checked = true;
    }
  });

  // --- SCENARIO 3: Pro-unlocked state ---
  await generateScreenshot({
    filename: '03-pro-unlocked.png',
    pageUrl: 'http://127.0.0.1:9876/ag-grid',
    displayUrl: 'https://app.datacloud.io/workspaces/financial-reporting',
    urlDomain: 'app.datacloud.io',
    urlPath: '/workspaces/financial-reporting',
    isPro: true,
    popupSetup: () => {
      const csv = document.getElementById('fmt-csv');
      const xlsx = document.getElementById('fmt-xlsx');
      if (csv) csv.checked = true;
      if (xlsx) xlsx.checked = true;
    }
  });

  // --- SCENARIO 4: Detailed export options ---
  await generateScreenshot({
    filename: '04-export-options.png',
    pageUrl: 'http://127.0.0.1:9876/ag-grid',
    displayUrl: 'https://portal.enterprise-analytics.com/data/export',
    urlDomain: 'portal.enterprise-analytics.com',
    urlPath: '/data/export',
    isPro: true,
    popupSetup: () => {
      // Multi-format selection
      const csv = document.getElementById('fmt-csv');
      const xlsx = document.getElementById('fmt-xlsx');
      const json = document.getElementById('fmt-json');
      if (csv) csv.checked = true;
      if (xlsx) xlsx.checked = true;
      if (json) json.checked = true;

      // Row range selection
      const rStart = document.getElementById('opt-range-start');
      const rEnd = document.getElementById('opt-range-end');
      if (rStart) rStart.value = '100';
      if (rEnd) rEnd.value = '500';

      // Include hidden columns
      const hidden = document.getElementById('opt-hidden-cols');
      if (hidden) hidden.checked = true;

      // Max rows limit
      const maxRows = document.getElementById('opt-max-rows');
      if (maxRows) maxRows.value = '5000';
    }
  });

  // Clean up
  await browser.close();
  server.close();
  console.log('\nAll 4 screenshots generated successfully in assets/screenshots/');
}

run().catch((err) => {
  console.error('Error generating screenshots:', err);
  process.exit(1);
});
