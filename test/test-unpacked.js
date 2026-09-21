import puppeteer from 'puppeteer';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const UNPACKED_DIR = '/tmp/table-extractor-unpacked';
const FIXTURE_PATH = '/home/sid/projects/table-extractor/test/virtualized-table.html';

async function main() {
  console.log('====================================================');
  console.log('  Testing Unpacked Extension in Real Puppeteer Chrome ');
  console.log('====================================================\n');

  // 1. Start a local HTTP server to serve the fixture page
  const server = http.createServer((req, res) => {
    if (req.url === '/' || req.url === '/table') {
      const html = fs.readFileSync(FIXTURE_PATH, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  await new Promise(r => server.listen(9888, '127.0.0.1', r));
  console.log('  ✓ Fixture server running at http://127.0.0.1:9888/table');

  // 2. Launch Puppeteer loading the unpacked extension
  console.log('  ✓ Launching Chrome with unpacked extension at:', UNPACKED_DIR);
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: '/home/sid/.cache/puppeteer/chrome/linux-153.0.8010.36/chrome-linux64/chrome',
    args: [
      `--disable-extensions-except=${UNPACKED_DIR}`,
      `--load-extension=${UNPACKED_DIR}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--headless=new'
    ]
  });

  try {
    // 3. Find service worker target to get extension ID
    const workerTarget = await browser.waitForTarget(
      t => t.type() === 'service_worker' && t.url().includes('chrome-extension://'),
      { timeout: 10000 }
    );
    const extUrl = new URL(workerTarget.url());
    const extId = extUrl.host;
    console.log(`  ✓ Extension Service Worker loaded! Extension ID: ${extId}`);

    // 4. Open web page
    const page = await browser.newPage();
    await page.goto('http://127.0.0.1:9888/table', { waitUntil: 'domcontentloaded' });
    console.log('  ✓ Navigated to test page');

    // Wait for content script
    await new Promise(r => setTimeout(r, 600));

    // Get the actual tab object from the service worker
    const worker = await workerTarget.worker();
    const tabs = await worker.evaluate(async () => chrome.tabs.query({}));
    const targetTab = tabs.find(t => t.url && t.url.includes('9888')) || tabs[tabs.length - 1];
    console.log(`  ✓ Found target tab: ID ${targetTab.id}, URL: ${targetTab.url}`);

    // 5. Open Extension Popup UI
    const popupPage = await browser.newPage();
    await popupPage.evaluateOnNewDocument((target) => {
      const orig = chrome.tabs.query.bind(chrome.tabs);
      chrome.tabs.query = async (q) => {
        if (q.active && q.currentWindow) {
          return [target];
        }
        return orig(q);
      };
    }, targetTab);

    await popupPage.goto(`chrome-extension://${extId}/popup/popup.html`, { waitUntil: 'domcontentloaded' });
    console.log('  ✓ Loaded popup.html successfully');

    // 6. Verify Popup UI Elements
    await popupPage.waitForSelector('.brand-title', { timeout: 5000 });
    const appTitle = await popupPage.$eval('.brand-title', el => el.textContent.trim());
    console.log(`  ✓ Popup header: "${appTitle}"`);

    const tierBadge = await popupPage.$eval('#tier-badge', el => el.textContent.trim());
    console.log(`  ✓ Initial Tier Badge: "${tierBadge}"`);
    if (tierBadge !== 'FREE') throw new Error(`Expected FREE tier, got ${tierBadge}`);

    // Check footer support email
    const footerEmail = await popupPage.$eval('#footer-support-link', el => ({ text: el.textContent.trim(), href: el.getAttribute('href') }));
    console.log(`  ✓ Footer Support Email: "${footerEmail.text}" (${footerEmail.href})`);
    if (footerEmail.text !== 'sidoua26@gmail.com' || footerEmail.href !== 'mailto:sidoua26@gmail.com') {
      throw new Error('Support email link incorrect!');
    }

    // Check detected tables dropdown
    await popupPage.waitForSelector('#table-select option', { timeout: 10000 });
    const options = await popupPage.$$eval('#table-select option', opts => opts.map(o => o.textContent));
    console.log(`  ✓ Popup detected tables dropdown options count: ${options.length}`);
    console.log(`    Options: ${options.map(o => o.trim()).join(' | ')}`);

    // 7. Select static table and test export
    await popupPage.select('#table-select', 'te-table-3');
    await new Promise(r => setTimeout(r, 200));

    const gridTypeBadge = await popupPage.$eval('#table-type-badge', el => el.textContent.trim());
    console.log(`  ✓ Selected table grid type: "${gridTypeBadge}"`);

    // Ensure CSV format is selected
    const isCsvChecked = await popupPage.$eval('#fmt-csv', el => el.checked);
    console.log(`  ✓ CSV format default checked: ${isCsvChecked}`);

    // Click Export Visible rows button
    console.log('  ✓ Clicking "Export Table" button for static table...');
    await popupPage.click('#btn-export-visible');
    await new Promise(r => setTimeout(r, 600));

    // 8. Open License Modal and Test Pro Activation
    console.log('  ✓ Opening License Modal via #btn-open-license...');
    await popupPage.click('#btn-open-license');
    await popupPage.waitForSelector('#pro-modal', { visible: true, timeout: 5000 });
    console.log('  ✓ Pro Upgrade Modal is now visible');

    // Test gift code activation in popup
    console.log('  ✓ Entering test gift code into #input-license-key...');
    await worker.evaluate(async () => {
      await chrome.storage.local.set({ __testMockVerification__: true });
    });

    await popupPage.type('#input-license-key', 'TE-GIFT-TEST');
    await popupPage.click('#btn-activate-pro');
    await new Promise(r => setTimeout(r, 600));

    const modalMsg = await popupPage.$eval('#activation-msg', el => el.textContent.trim());
    console.log(`  ✓ License activation response: "${modalMsg}"`);

    // Close modal
    await popupPage.click('#btn-close-modal');
    await new Promise(r => setTimeout(r, 300));

    // Verify Pro tier is now active in popup
    const newTierBadge = await popupPage.$eval('#tier-badge', el => el.textContent.trim());
    console.log(`  ✓ Updated Tier Badge: "${newTierBadge}"`);
    if (newTierBadge !== 'PRO') throw new Error(`Expected PRO tier, got ${newTierBadge}`);

    // Check that Pro formats (XLSX, JSON) are no longer disabled
    const xlsxDisabled = await popupPage.$eval('#fmt-xlsx', el => el.disabled);
    const jsonDisabled = await popupPage.$eval('#fmt-json', el => el.disabled);
    console.log(`  ✓ XLSX checkbox disabled: ${xlsxDisabled}, JSON checkbox disabled: ${jsonDisabled}`);
    if (xlsxDisabled || jsonDisabled) throw new Error('Expected Pro formats to be enabled for Pro user');

    console.log('\n====================================================');
    console.log('🎉 REAL UNPACKED EXTENSION PUPPETEER TEST PASSED! 🎉');
    console.log('====================================================\n');

    await page.close();
    await popupPage.close();
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch(err => {
  console.error('\n❌ Unpacked Extension Test Failed:', err);
  process.exit(1);
});
