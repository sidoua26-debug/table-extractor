import puppeteer from 'puppeteer';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import child_process from 'node:child_process';
import { buildPackage } from '../scripts/package.js';

const CLEAN_UNPACK_DIR = '/tmp/table-extractor-unpacked-clean';
const TEST_UNPACK_DIR = '/tmp/table-extractor-test-unpacked';
const FIXTURE_PATH = '/home/sid/projects/table-extractor/test/virtualized-table.html';

async function main() {
  console.log('====================================================');
  console.log('  Testing Unpacked Extension in Real Puppeteer Chrome ');
  console.log('====================================================\n');

  // 1. Build the official Store ZIP Package
  console.log('1. Building store package dist/table-extractor-store.zip...');
  const pkgRes = await buildPackage({ quiet: true });
  console.log(`  ✓ Store package generated: ${pkgRes.zipBytes} bytes`);

  // 2. Unpack to clean directory and verify store manifest has NO content_scripts or host_permissions
  console.log('\n2. Unpacking store ZIP and verifying least-privilege manifest...');
  if (fs.existsSync(CLEAN_UNPACK_DIR)) {
    fs.rmSync(CLEAN_UNPACK_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(CLEAN_UNPACK_DIR, { recursive: true });
  child_process.execSync(`unzip -q ${pkgRes.outputPath} -d ${CLEAN_UNPACK_DIR}`);

  const storeManifest = JSON.parse(fs.readFileSync(path.join(CLEAN_UNPACK_DIR, 'manifest.json'), 'utf8'));
  if (storeManifest.content_scripts) {
    throw new Error('Store ZIP manifest must NOT contain content_scripts!');
  }
  if (storeManifest.host_permissions && storeManifest.host_permissions.length > 0) {
    throw new Error('Store ZIP manifest must NOT contain host_permissions!');
  }
  if (storeManifest.web_accessible_resources) {
    throw new Error('Store ZIP manifest must NOT contain web_accessible_resources!');
  }
  console.log('  ✓ Verified: Store ZIP manifest has NO content_scripts');
  console.log('  ✓ Verified: Store ZIP manifest has NO host_permissions');
  console.log('  ✓ Verified: Store ZIP manifest has NO web_accessible_resources');

  // 3. Create test-only copy with temporary host_permissions for automated test runner
  // (In real use, clicking the toolbar icon grants activeTab. Automation via page.goto requires test host_permissions)
  console.log('\n3. Creating temporary test copy for Puppeteer automation...');
  if (fs.existsSync(TEST_UNPACK_DIR)) {
    fs.rmSync(TEST_UNPACK_DIR, { recursive: true, force: true });
  }
  fs.cpSync(CLEAN_UNPACK_DIR, TEST_UNPACK_DIR, { recursive: true });

  const testManifest = JSON.parse(fs.readFileSync(path.join(TEST_UNPACK_DIR, 'manifest.json'), 'utf8'));
  testManifest.host_permissions = ['http://127.0.0.1/*'];
  fs.writeFileSync(path.join(TEST_UNPACK_DIR, 'manifest.json'), JSON.stringify(testManifest, null, 2));
  console.log('  ✓ Created test manifest at /tmp/table-extractor-test-unpacked with test host_permissions');

  // 4. Start local fixture HTTP server
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

  // 5. Launch Puppeteer with the test unpacked extension
  console.log('\n4. Launching Chrome with unpacked test extension...');
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: '/home/sid/.cache/puppeteer/chrome/linux-153.0.8010.36/chrome-linux64/chrome',
    args: [
      `--disable-extensions-except=${TEST_UNPACK_DIR}`,
      `--load-extension=${TEST_UNPACK_DIR}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--headless=new'
    ]
  });

  try {
    const workerTarget = await browser.waitForTarget(
      t => t.type() === 'service_worker' && t.url().includes('chrome-extension://'),
      { timeout: 10000 }
    );
    const extUrl = new URL(workerTarget.url());
    const extId = extUrl.host;
    console.log(`  ✓ Service Worker initialized (Extension ID: ${extId})`);

    // 6. Open web page
    const page = await browser.newPage();
    await page.goto('http://127.0.0.1:9888/table', { waitUntil: 'domcontentloaded' });
    console.log('  ✓ Navigated to test page: http://127.0.0.1:9888/table');

    // VERIFY: Content script was NOT injected automatically on page load!
    const autoInjected = await page.evaluate(() => typeof window.TableExtractor !== 'undefined');
    console.log(`  ✓ Content script before popup open: ${autoInjected ? 'INJECTED (FAIL)' : 'NOT INJECTED (PASS - zero background injection)'}`);
    if (autoInjected) {
      throw new Error('Content script should NOT be auto-injected before user opens popup!');
    }

    // Determine target tab ID from worker
    const worker = await workerTarget.worker();
    const tabs = await worker.evaluate(async () => chrome.tabs.query({}));
    const targetTab = tabs.find(t => t.url && t.url.includes('9888')) || tabs[tabs.length - 1];
    targetTab.url = 'http://127.0.0.1:9888/table';

    // 7. Open Extension Popup UI
    console.log('\n5. Opening Extension Popup (User Action)...');
    const popupPage = await browser.newPage();
    popupPage.on('console', msg => console.log('  [Popup Console]', msg.type(), msg.text()));
    popupPage.on('pageerror', err => console.log('  [Popup Error]', err.message));
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
    console.log('  ✓ Loaded popup.html');

    // Wait for popup to perform on-demand injection and detect tables
    await popupPage.waitForSelector('#table-select option', { timeout: 10000 });
    console.log('  ✓ Popup executed ensureContentScriptInjected() on-demand!');

    // VERIFY: Content script is NOW present and listening on the tab
    const pingResult = await worker.evaluate(async (tabId) => {
      try {
        return await chrome.tabs.sendMessage(tabId, { action: 'TE_PING' });
      } catch (e) {
        return { error: e.message };
      }
    }, targetTab.id);

    const isListening = pingResult?.status === 'ok';
    console.log(`  ✓ Content script ping after popup open: ${isListening ? 'LISTENING ON-DEMAND (PASS)' : 'NOT RESPONDING (FAIL)'}`);
    if (!isListening) {
      throw new Error('Content script was not injected or did not respond to ping!');
    }

    // Verify UI items
    const appTitle = await popupPage.$eval('.brand-title', el => el.textContent.trim());
    const tierBadge = await popupPage.$eval('#tier-badge', el => el.textContent.trim());
    console.log(`  ✓ Header: "${appTitle}", Initial Tier: "${tierBadge}"`);
    if (tierBadge !== 'FREE') throw new Error(`Expected FREE tier, got ${tierBadge}`);

    const footerEmail = await popupPage.$eval('#footer-support-link', el => ({ text: el.textContent.trim(), href: el.getAttribute('href') }));
    console.log(`  ✓ Support email: "${footerEmail.text}" (${footerEmail.href})`);

    const options = await popupPage.$$eval('#table-select option', opts => opts.map(o => o.textContent));
    console.log(`  ✓ Detected tables count: ${options.length}`);
    if (options.length !== 3) throw new Error(`Expected 3 tables, got ${options.length}`);

    // 8. Test static table export
    await popupPage.select('#table-select', 'te-table-3');
    await new Promise(r => setTimeout(r, 200));

    const gridTypeBadge = await popupPage.$eval('#table-type-badge', el => el.textContent.trim());
    console.log(`  ✓ Selected static table: "${gridTypeBadge}"`);

    await popupPage.click('#btn-export-visible');
    await new Promise(r => setTimeout(r, 500));
    console.log('  ✓ Static table export triggered cleanly');

    // 9. Test Pro modal and gift code activation
    await popupPage.click('#btn-open-license');
    await popupPage.waitForSelector('#pro-modal', { visible: true, timeout: 5000 });
    console.log('  ✓ Pro Upgrade Modal opened');

    await worker.evaluate(async () => {
      await chrome.storage.local.set({ __testMockVerification__: true });
    });

    await popupPage.type('#input-license-key', 'TE-GIFT-TEST');
    await popupPage.click('#btn-activate-pro');
    await new Promise(r => setTimeout(r, 600));

    const modalMsg = await popupPage.$eval('#activation-msg', el => el.textContent.trim());
    console.log(`  ✓ Activation message: "${modalMsg}"`);

    await popupPage.click('#btn-close-modal');
    await new Promise(r => setTimeout(r, 200));

    const newTierBadge = await popupPage.$eval('#tier-badge', el => el.textContent.trim());
    console.log(`  ✓ Updated tier badge: "${newTierBadge}"`);
    if (newTierBadge !== 'PRO') throw new Error(`Expected PRO tier, got ${newTierBadge}`);

    await popupPage.close();

    // 10. Test Restricted Page Handling (chrome://, edge://, file://, etc.)
    console.log('\n6. Testing Restricted Page Protection...');
    const restrictedPopupPage = await browser.newPage();
    const restrictedMockTab = { id: 99999, url: 'chrome://version', title: 'About Version' };
    await restrictedPopupPage.evaluateOnNewDocument((mockTab) => {
      const orig = chrome.tabs.query.bind(chrome.tabs);
      chrome.tabs.query = async (q) => {
        if (q.active && q.currentWindow) {
          return [mockTab];
        }
        return orig(q);
      };
    }, restrictedMockTab);

    await restrictedPopupPage.goto(`chrome-extension://${extId}/popup/popup.html`, { waitUntil: 'domcontentloaded' });
    await restrictedPopupPage.waitForSelector('#empty-state', { visible: true, timeout: 5000 });

    const emptyIcon = await restrictedPopupPage.$eval('#empty-icon', el => el.textContent.trim());
    const emptyTitle = await restrictedPopupPage.$eval('#empty-title', el => el.textContent.trim());
    const emptyDesc = await restrictedPopupPage.$eval('#empty-desc', el => el.textContent.trim());

    console.log(`  ✓ Restricted page empty state icon: "${emptyIcon}"`);
    console.log(`  ✓ Restricted page empty state title: "${emptyTitle}"`);
    console.log(`  ✓ Restricted page empty state description: "${emptyDesc}"`);

    if (emptyIcon !== '🔒' || emptyTitle !== 'Page Protected') {
      throw new Error(`Expected Page Protected UI, got ${emptyTitle}`);
    }

    await restrictedPopupPage.close();
    await page.close();

    console.log('\n====================================================');
    console.log('🎉 UNPACKED EXTENSION VERIFICATION FULLY PASSED! 🎉');
    console.log('====================================================\n');

  } finally {
    await browser.close();
    server.close();
  }
}

main().catch(err => {
  console.error('\n❌ Unpacked Extension Test Failed:', err);
  process.exit(1);
});
