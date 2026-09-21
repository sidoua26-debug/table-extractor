/**
 * Table Extractor - Automated Test Suite
 * Tests detection, virtualized capture, deduplication, cancellation,
 * snap-back detection, horizontal virtualization, converters, and licensing.
 */

import puppeteer from 'puppeteer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

// Exporters and license tests in Node environment
import { tableDataToCSV } from '../lib/csv.js';
import { tableDataToXLSX } from '../lib/xlsx.js';
import { tableDataToJSON } from '../lib/json.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const testPagePath = path.resolve(__dirname, 'virtualized-table.html');
const slowTestPagePath = path.resolve(__dirname, 'virtualized-table-slow.html');
const agGridTestPagePath = path.resolve(__dirname, 'ag-grid-fixture.html');
const contentScriptPath = path.resolve(__dirname, '..', 'content.js');
const contentScriptCode = fs.readFileSync(contentScriptPath, 'utf8');

async function run() {
  console.log('====================================================');
  console.log('      Table Extractor Automated Test Suite          ');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName} ${details ? `(${details})` : ''}`);
      failed++;
    }
  }

  // --- UNIT TESTS: Converters & Licensing ---
  console.log('--- 1. Testing Converters ---');
  const sampleData = {
    title: 'Test Table',
    headers: ['Name', 'Role, Position', 'Notes'],
    rows: [
      ['Alice "The Boss"', 'CEO', 'Line 1\nLine 2'],
      ['Bob', 'Engineer', 'Standard text']
    ]
  };

  const csv = tableDataToCSV(sampleData);
  assert(csv.startsWith('\uFEFF'), 'CSV starts with UTF-8 BOM');
  assert(csv.includes('"Role, Position"'), 'CSV escapes comma in headers');
  assert(csv.includes('"Alice ""The Boss"""'), 'CSV escapes quotes by doubling');
  assert(csv.includes('"Line 1\nLine 2"'), 'CSV escapes multiline cells');

  const xlsx = tableDataToXLSX(sampleData);
  assert(xlsx.includes('<?mso-application progid="Excel.Sheet"?>'), 'XLSX includes Excel SpreadsheetML header');
  assert(xlsx.includes('<Worksheet ss:Name="Test Table">'), 'XLSX includes Worksheet with table title');
  assert(xlsx.includes('<Cell><Data ss:Type="String">Alice &quot;The Boss&quot;</Data></Cell>'), 'XLSX escapes XML characters');

  const json = tableDataToJSON(sampleData, { format: 'objects' });
  const parsedJson = JSON.parse(json);
  assert(Array.isArray(parsedJson) && parsedJson.length === 2, 'JSON objects format contains 2 items');
  assert(parsedJson[0]['Name'] === 'Alice "The Boss"', 'JSON object fields map correctly');

  // --- UNIT TESTS: License Management & Feature Gating ---
  console.log('\n--- 2. Testing License Management & Pro Gating ---');
  // Mock chrome.storage.local for Node environment
  const mockStorage = { __testMockVerification__: true };
  globalThis.chrome = {
    storage: {
      local: {
        get: async (key) => {
          if (typeof key === 'string') return { [key]: mockStorage[key] };
          if (Array.isArray(key)) {
            const res = {};
            key.forEach(k => { res[k] = mockStorage[k]; });
            return res;
          }
          return { ...mockStorage };
        },
        set: async (obj) => {
          Object.assign(mockStorage, obj);
        },
        remove: async (key) => {
          if (Array.isArray(key)) key.forEach(k => delete mockStorage[k]);
          else delete mockStorage[key];
        }
      }
    }
  };

  const { isProUser, getLicenseStatus, activateLicense, resetLicense, canUseVirtualizedCapture, canUseZipExport, canUseMultiFormatExport } = await import('../lib/license.js');
  const { SUPPORT_EMAIL: emailFromConstants } = await import('../lib/constants.js');
  const { SUPPORT_EMAIL: emailFromLicense } = await import('../lib/license.js');
  assert(emailFromConstants === 'sidoua26@gmail.com', 'SUPPORT_EMAIL in constants.js is sidoua26@gmail.com');
  assert(emailFromLicense === 'sidoua26@gmail.com', 'SUPPORT_EMAIL in license.js matches constants.js');

  const popupHtml = fs.readFileSync(path.resolve(__dirname, '..', 'popup', 'popup.html'), 'utf8');
  assert(popupHtml.includes('href="mailto:sidoua26@gmail.com"'), 'Popup HTML footer contains mailto:sidoua26@gmail.com');
  assert(popupHtml.includes('Support:'), 'Popup HTML footer contains Support: label');

  const initialStatus = await getLicenseStatus();
  assert(initialStatus === 'free', 'Initial license status is "free"');
  assert((await isProUser()) === false, 'isProUser() returns false initially');
  assert((await canUseVirtualizedCapture()) === false, 'canUseVirtualizedCapture() blocked for Free tier');
  assert((await canUseZipExport()) === false, 'canUseZipExport() blocked for Free tier');
  assert((await canUseMultiFormatExport()) === false, 'canUseMultiFormatExport() blocked for Free tier');

  // Hardcoded test backdoor PRO-TEST-PASS is removed and must be rejected!
  const proTestPass = await activateLicense('PRO-TEST-PASS');
  assert(proTestPass.success === false, 'PRO-TEST-PASS backdoor key is completely removed and rejected');

  // Friendly guard against accidentally pasting Invoice ID or URL
  const invoiceIdAct = await activateLicense('4743404425');
  assert(invoiceIdAct.success === false && invoiceIdAct.isInvoiceId === true, 'Pasting 10-digit invoice ID is rejected with guidance');

  const invoiceUrlAct = await activateLicense('https://nowpayments.io/payment/?iid=4743404425');
  assert(invoiceUrlAct.success === false && invoiceUrlAct.isInvoiceId === true, 'Pasting invoice URL is rejected with guidance');

  // Invalid key activation
  const invalidAct = await activateLicense('INVALID_KEY');
  assert(invalidAct.success === false, 'Invalid license key rejected');

  // Gift code activation (TE-GIFT-...)
  const giftAct = await activateLicense('TE-GIFT-TEST');
  assert(giftAct.success === true, 'Gift code TE-GIFT-TEST accepted');
  assert((await isProUser()) === true, 'isProUser() returns true after gift activation');
  assert((await getLicenseStatus()) === 'pro', 'getLicenseStatus() returns "pro"');
  assert((await canUseVirtualizedCapture()) === true, 'canUseVirtualizedCapture() unlocked for Pro tier');
  assert((await canUseZipExport()) === true, 'canUseZipExport() unlocked for Pro tier');
  assert((await canUseMultiFormatExport()) === true, 'canUseMultiFormatExport() unlocked for Pro tier');

  // Reset to Free
  await resetLicense();
  assert((await isProUser()) === false, 'resetLicense() restores Free tier');
  assert((await getLicenseStatus()) === 'free', 'getLicenseStatus() restored to "free"');

  // Payment mock activation (mock_finished_payment)
  const mockSuccessAct = await activateLicense('mock_finished_payment');
  assert(mockSuccessAct.success === true, 'Mock finished payment accepted');
  assert((await isProUser()) === true, 'isProUser() returns true after payment activation');

  // Reset to Free again
  await resetLicense();

  // Test Cloudflare Worker product separation directly
  console.log('\n--- 2b. Testing Cloudflare Worker Multi-Product Isolation ---');
  const { default: worker } = await import('../../bulkgrab/cloudflare-worker/worker.js');
  const mockEnv = {
    NOWPAYMENTS_API_KEY: 'test_nowpayments_key',
    GIFT_CODES: 'bg-gift-1,te-gift-2,standard-gift',
    TE_GIFT_CODES: 'te-exclusive-gift'
  };

  // 1. Worker verify-payment with product=table-extractor and TE_PRO_ order
  {
    const origFetch = globalThis.fetch;
    globalThis.fetch = async (url) => {
      if (url.includes('/payment/')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            payment_id: '999111',
            payment_status: 'finished',
            order_id: 'TE_PRO_123456_test',
            price_amount: 9.99,
            price_currency: 'usd',
            pay_currency: 'usdtbsc'
          }),
          text: async () => ''
        };
      }
      return origFetch(url);
    };

    try {
      const req = new Request('https://worker.local/api/verify-payment?payment_id=999111&product=table-extractor');
      const res = await worker.fetch(req, mockEnv);
      const data = await res.json();
      assert(data.valid === true, 'Worker accepts TE_PRO_ payment for Table Extractor');
      assert(data.status === 'pro', 'Worker sets status: pro for TE_PRO_ payment');
      assert(data.message.includes('Table Extractor Pro tier activated'), 'Worker returns Table Extractor confirmation message');
    } finally {
      globalThis.fetch = origFetch;
    }
  }

  // 2. Cross-product rejection: BG_PRO_ payment attempted on Table Extractor
  {
    const origFetch = globalThis.fetch;
    globalThis.fetch = async (url) => {
      if (url.includes('/payment/')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            payment_id: '999222',
            payment_status: 'finished',
            order_id: 'BG_PRO_123456_bulkgrab_order',
            price_amount: 9.99,
            price_currency: 'usd',
            pay_currency: 'usdtbsc'
          }),
          text: async () => ''
        };
      }
      return origFetch(url);
    };

    try {
      const req = new Request('https://worker.local/api/verify-payment?payment_id=999222&product=table-extractor');
      const res = await worker.fetch(req, mockEnv);
      const data = await res.json();
      assert(data.valid === false, 'Worker rejects BulkGrab BG_PRO_ payment when verifying Table Extractor');
      assert(data.message.includes('This payment is not a Table Extractor Pro purchase'), 'Worker returns descriptive cross-product rejection error');
    } finally {
      globalThis.fetch = origFetch;
    }
  }

  // 3. Worker gift code isolation: TE gift code accepted for Table Extractor
  {
    const req = new Request('https://worker.local/api/verify-payment?payment_id=te-gift-2&product=table-extractor');
    const res = await worker.fetch(req, mockEnv);
    const data = await res.json();
    assert(data.valid === true && data.source === 'gift', 'Worker accepts te- prefixed gift code for Table Extractor');
  }

  // 4. Worker gift code isolation: BulkGrab gift code rejected for Table Extractor
  {
    const req = new Request('https://worker.local/api/verify-payment?payment_id=bg-gift-1&product=table-extractor');
    const res = await worker.fetch(req, mockEnv);
    const data = await res.json();
    assert(data.valid === false, 'Worker rejects BulkGrab gift code for Table Extractor');
  }

  // 5. Worker create-payment creates TE_PRO_ order for Table Extractor
  {
    const origFetch = globalThis.fetch;
    let createdPayload = null;
    globalThis.fetch = async (url, opts) => {
      if (url.includes('/invoice')) {
        createdPayload = JSON.parse(opts.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: '555444333',
            invoice_url: 'https://nowpayments.io/payment/?iid=555444333',
            order_id: createdPayload.order_id,
            price_amount: 9.99,
            pay_currency: 'usdtbsc'
          }),
          text: async () => ''
        };
      }
      return origFetch(url, opts);
    };

    try {
      const req = new Request('https://worker.local/api/create-payment?product=table-extractor', { method: 'POST' });
      const res = await worker.fetch(req, mockEnv);
      const data = await res.json();
      assert(data.ok === true, 'Worker /api/create-payment succeeds for Table Extractor');
      assert(createdPayload.order_id.startsWith('TE_PRO_'), 'Generated order_id starts with TE_PRO_');
      assert(createdPayload.order_description === 'Table Extractor Pro Lifetime License', 'Generated order description specifies Table Extractor');
    } finally {
      globalThis.fetch = origFetch;
    }
  }

  // --- BROWSER TESTS: Puppeteer ---
  console.log('\n--- 2. Testing Browser Virtualized Table Capture ---');
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: '/home/sid/.cache/puppeteer/chrome/linux-153.0.8010.36/chrome-linux64/chrome',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--allow-file-access-from-files'
    ]
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 900 });
    await page.goto(`file://${testPagePath}`, { waitUntil: 'domcontentloaded' });

    // Inject content script into the page
    await page.evaluate(contentScriptCode);

    // TEST 1: Table Detection
    console.log('\n[Browser Test] 1. Table Detection on Page');
    const scanResult = await page.evaluate(() => {
      return window.TableExtractor.scanPageTables();
    });

    assert(scanResult.length >= 3, 'Discovered at least 3 tables/grids on test page', `found ${scanResult.length}`);

    const virtGrid = scanResult.find(t => t.id === 'te-table-1');
    assert(virtGrid && virtGrid.isVirtualized === true, 'Virtualized employee grid detected with isVirtualized: true');
    assert(virtGrid && virtGrid.visibleRowCount <= 45, 'Virtualized grid reports only visible DOM rows (~30-45)', `reported ${virtGrid?.visibleRowCount}`);
    assert(virtGrid && virtGrid.hasHorizontalVirtualization === false, 'Standard vertical grid reports hasHorizontalVirtualization: false');

    const hGrid = scanResult.find(t => t.id === 'te-table-2');
    assert(hGrid && hGrid.hasHorizontalVirtualization === true, 'Horizontal grid detected with hasHorizontalVirtualization: true');

    const staticTable = scanResult.find(t => t.id === 'te-table-3');
    assert(staticTable && staticTable.isVirtualized === false, 'Static HTML table detected with isVirtualized: false');

    // TEST 2: Static Table Capture
    console.log('\n[Browser Test] 2. Static Table Capture');
    const staticResult = await page.evaluate(() => {
      return window.TableExtractor.captureStaticTable('te-table-3');
    });
    assert(staticResult.rows.length === 10, 'Static table extracted exactly 10 rows', `got ${staticResult.rows.length}`);
    assert(staticResult.headers.length === 5, 'Static table extracted 5 headers');
    assert(staticResult.rows[0][0] === 'PRJ-101', 'First static row matches PRJ-101');
    assert(staticResult.rows.every(r => r.length === staticResult.headers.length), 'Static table all rows have exact cell count equal to header count (5)');

    // TEST 3: Full Virtualized Capture with Stable IDs (2,000 Rows)
    console.log('\n[Browser Test] 3. Virtualized Capture with Stable IDs (2,000 rows)');
    const virtCaptureResult = await page.evaluate(async () => {
      const el = document.getElementById('virtual-grid-container');
      const progressSteps = [];
      const res = await window.TableExtractor.runVirtualizedCapture('te-table-1', {
        scrollIncrement: 600,
        settleDelayMs: 25,
        maxSettleTimeoutMs: 500
      });
      return {
        ...res,
        finalScrollTop: el.scrollTop
      };
    });

    assert(virtCaptureResult.totalRows === 2000, 'Captured all 2,000 rows in dataset!', `got ${virtCaptureResult.totalRows}`);
    assert(virtCaptureResult.rows.length === 2000, 'Rows array length equals 2,000');
    assert(virtCaptureResult.finalScrollTop === 0, 'Scroll position restored to original 0px', `was ${virtCaptureResult.finalScrollTop}`);
    assert(!virtCaptureResult.warning, 'No unexpected warnings on normal virtual capture');
    assert(virtCaptureResult.rows.every(r => r.length === virtCaptureResult.headers.length), 'All 2,000 virtual rows have exact cell count equal to header count (7)');

    // Verify first and last rows
    assert(virtCaptureResult.rows[0][0] === 'EMP-00001', 'First captured row is EMP-00001', `got ${virtCaptureResult.rows[0]?.[0]}`);
    assert(virtCaptureResult.rows[1999][0] === 'EMP-02000', 'Last captured row is EMP-02000', `got ${virtCaptureResult.rows[1999]?.[0]}`);

    // TEST 3b: Row-Range Capture [500..600] on virtualized-table.html
    console.log('\n[Browser Test] 3b. Row-Range Selection [500..600] on 2,000-Row Virtual Table');
    const rangeResult = await page.evaluate(async () => {
      return await window.TableExtractor.runVirtualizedCapture('te-table-1', {
        rowRange: { from: 500, to: 600 },
        scrollIncrement: 600,
        settleDelayMs: 25,
        maxSettleTimeoutMs: 500
      });
    });

    assert(rangeResult.totalRows === 101, 'Row range [500..600] extracted exactly 101 rows', `got ${rangeResult.totalRows}`);
    assert(rangeResult.rows.length === 101, 'Rows array length equals 101');
    assert(rangeResult.rows.every(r => r.length === rangeResult.headers.length), 'All ranged rows have exact cell count equal to header count (7)');
    assert(rangeResult.rows[0][0] === 'EMP-00500', 'First row is EMP-00500', `got ${rangeResult.rows[0]?.[0]}`);
    assert(rangeResult.rows[100][0] === 'EMP-00600', 'Last row is EMP-00600', `got ${rangeResult.rows[100]?.[0]}`);

    // Verify all 101 rows are sequential with 0 duplicates
    const rowIds = rangeResult.rows.map(r => r[0]);
    const uniqueRowIds = new Set(rowIds);
    assert(uniqueRowIds.size === 101, 'All 101 extracted rows are unique (0 duplicates)', `unique count: ${uniqueRowIds.size}`);

    let isStrictlySequential = true;
    for (let i = 0; i < 101; i++) {
      const expectedId = `EMP-${String(500 + i).padStart(5, '0')}`;
      if (rowIds[i] !== expectedId) {
        isStrictlySequential = false;
        break;
      }
    }
    assert(isStrictlySequential, 'All 101 rows EMP-00500 through EMP-00600 are strictly sequential in order');

    // TEST 4: Fallback Deduplication (Content Hash when data-row-id is missing)
    console.log('\n[Browser Test] 4. Fallback Deduplication via Cell Content Hash (without stable IDs)');
    // Toggle off stable IDs on test page
    await page.click('#toggle-ids');
    // Scroll down 150px to test scroll restoration from non-zero initial position
    await page.evaluate(() => {
      document.getElementById('virtual-grid-container').scrollTop = 150;
    });

    const hashCaptureResult = await page.evaluate(async () => {
      const el = document.getElementById('virtual-grid-container');
      const initialScroll = el.scrollTop;
      const res = await window.TableExtractor.runVirtualizedCapture('te-table-1', {
        scrollIncrement: 600,
        settleDelayMs: 25,
        maxSettleTimeoutMs: 500
      });
      return {
        ...res,
        initialScroll,
        finalScrollTop: el.scrollTop
      };
    });

    assert(hashCaptureResult.totalRows === 2000, 'Content hash deduplication captured all 2,000 rows without IDs!', `got ${hashCaptureResult.totalRows}`);
    assert(hashCaptureResult.finalScrollTop === 150, 'Non-zero initial scroll position restored correctly (150px)', `was ${hashCaptureResult.finalScrollTop}`);
    assert(hashCaptureResult.rows.every(r => r.length === hashCaptureResult.headers.length), 'All hash-captured rows have exact cell count equal to header count (7)');

    // Re-enable IDs for subsequent tests
    await page.click('#toggle-ids');

    // TEST 5: Cancellation Mid-Capture
    console.log('\n[Browser Test] 5. Cancellation Mid-Capture');
    const cancelResult = await page.evaluate(async () => {
      // Start capture and cancel after 100ms
      const promise = window.TableExtractor.runVirtualizedCapture('te-table-1', {
        scrollIncrement: 100,
        settleDelayMs: 60,
        maxSettleTimeoutMs: 1000
      });

      await new Promise(r => setTimeout(r, 120));
      // Trigger cancellation
      window.TableExtractor.cancelActiveCapture();

      const res = await promise;
      return res;
    });

    assert(cancelResult.aborted === true, 'Capture successfully aborted upon cancellation');
    assert(cancelResult.totalRows > 0 && cancelResult.totalRows < 2000, 'Returned partial rows collected prior to abort', `got ${cancelResult.totalRows}`);

    // TEST 6: Horizontal Virtualization Warning
    console.log('\n[Browser Test] 6. Horizontal Virtualization Warning');
    const hVirtResult = await page.evaluate(async () => {
      return await window.TableExtractor.runVirtualizedCapture('te-table-2', {
        scrollIncrement: 200,
        settleDelayMs: 30
      });
    });

    assert(hVirtResult.warning && hVirtResult.warning.includes('Horizontal virtualization not yet supported'), 'Warning emitted for horizontally virtualized grid');

    // TEST 7: Snap-back Container Detection
    console.log('\n[Browser Test] 7. Snap-back Container Detection & Error Handling');
    // Enable snap-back failure simulation
    await page.click('#toggle-snapback');

    let snapBackCaught = false;
    let snapBackErrorMsg = '';

    try {
      await page.evaluate(async () => {
        return await window.TableExtractor.runVirtualizedCapture('te-table-1', {
          scrollIncrement: 200,
          settleDelayMs: 30
        });
      });
    } catch (err) {
      snapBackCaught = true;
      snapBackErrorMsg = err.message;
    }

    assert(snapBackCaught && snapBackErrorMsg.includes("This table's scrolling behavior isn't compatible with capture. Try 'Just visible rows' instead."), 'Snap-back behavior detected and aborted with descriptive error', snapBackErrorMsg);

    // Turn off snap-back
    await page.click('#toggle-snapback');

    // TEST FIXTURE 2: Slow network / infinite scroll tests
    console.log('\n--- 3. Testing Slow Network & Capture Options on Fixture 2 ---');
    const slowPage = await browser.newPage();
    await slowPage.setViewport({ width: 1200, height: 900 });
    await slowPage.goto(`file://${slowTestPagePath}`, { waitUntil: 'domcontentloaded' });
    await slowPage.evaluate(contentScriptCode);

    // TEST 8: Virtualized Grid Detection & Slow Site Capture (Network Latency Support)
    console.log('\n[Browser Test] 8. Slow Site Capture with Simulated Network Latency');
    const slowScanResult = await slowPage.evaluate(() => {
      return window.TableExtractor.scanPageTables();
    });
    const slowGrid = slowScanResult.find(t => t.id === 'te-table-1');
    assert(slowGrid && slowGrid.isVirtualized === true, 'Slow grid correctly detected as virtualized');

    // Simulate network latency (60ms per scroll for fast execution)
    await slowPage.evaluate(() => {
      window.SIMULATED_LATENCY_MS = 60;
    });

    const slowCaptureResult = await slowPage.evaluate(async () => {
      return await window.TableExtractor.runVirtualizedCapture('te-table-1', {
        slowSite: true,
        scrollIncrement: 900,
        settleDelayMs: 100,
        maxSettleTimeoutMs: 6000
      });
    });

    assert(slowCaptureResult.totalRows === 2000, 'Captured all 2,000 rows on slow network fixture', `got ${slowCaptureResult.totalRows}`);
    assert(slowCaptureResult.rows[0][0] === 'EMP-00001', 'First slow row is EMP-00001');
    assert(slowCaptureResult.rows[1999][0] === 'EMP-02000', 'Last slow row is EMP-02000');
    assert(slowCaptureResult.rows.every(r => r.length === slowCaptureResult.headers.length), 'All slow-captured rows have exact cell count equal to header count (7)');

    // Reset simulated latency to 0 so tests 9-11 execute fast without waiting
    await slowPage.evaluate(() => {
      window.SIMULATED_LATENCY_MS = 0;
    });

    // TEST 9: Max Rows Limit Option
    console.log('\n[Browser Test] 9. User-configured Max Rows Limit');
    const maxRowsResult = await slowPage.evaluate(async () => {
      return await window.TableExtractor.runVirtualizedCapture('te-table-1', {
        maxRows: 250,
        scrollIncrement: 400,
        settleDelayMs: 50,
        maxSettleTimeoutMs: 1500
      });
    });

    assert(maxRowsResult.totalRows === 250, 'Capture stopped after reaching maxRows limit of 250', `got ${maxRowsResult.totalRows}`);
    assert(maxRowsResult.warning && maxRowsResult.warning.includes('max rows limit of 250'), 'Warning contains max rows limit notification', maxRowsResult.warning);
    assert(maxRowsResult.rows.every(r => r.length === maxRowsResult.headers.length), 'All maxRows rows have exact cell count equal to header count (7)');

    // TEST 10: Row Range Selection Option [from..to]
    console.log('\n[Browser Test] 10. Row Range Selection Option [50..150]');
    const rowRangeResult = await slowPage.evaluate(async () => {
      return await window.TableExtractor.runVirtualizedCapture('te-table-1', {
        rowRange: { from: 50, to: 150 },
        scrollIncrement: 400,
        settleDelayMs: 50,
        maxSettleTimeoutMs: 1500
      });
    });

    assert(rowRangeResult.totalRows === 101, 'Row range [50..150] extracted exactly 101 rows', `got ${rowRangeResult.totalRows}`);
    assert(rowRangeResult.rows[0][0] === 'EMP-00050', 'First ranged row is EMP-00050', `got ${rowRangeResult.rows[0]?.[0]}`);
    assert(rowRangeResult.rows[100][0] === 'EMP-00150', 'Last ranged row is EMP-00150', `got ${rowRangeResult.rows[100]?.[0]}`);
    assert(rowRangeResult.rows.every(r => r.length === rowRangeResult.headers.length), 'All row-range rows on slow fixture have exact cell count equal to header count (7)');

    // TEST 11: Include Hidden Columns Option
    console.log('\n[Browser Test] 11. Include Hidden Columns Option');
    const withoutHidden = await slowPage.evaluate(async () => {
      return await window.TableExtractor.runVirtualizedCapture('te-table-1', {
        maxRows: 10,
        includeHiddenCols: false,
        settleDelayMs: 50
      });
    });

    const withHidden = await slowPage.evaluate(async () => {
      return await window.TableExtractor.runVirtualizedCapture('te-table-1', {
        maxRows: 10,
        includeHiddenCols: true,
        settleDelayMs: 50
      });
    });

    assert(!withoutHidden.headers.includes('Internal Code'), 'Default capture excludes hidden "Internal Code" header');
    assert(withoutHidden.rows[0].length === 7, 'Default capture row has 7 cells');
    assert(withoutHidden.rows.every(r => r.length === withoutHidden.headers.length), 'All rows without hidden cols match header count (7)');
    assert(withHidden.headers.includes('Internal Code'), 'includeHiddenCols: true includes "Internal Code" header');
    assert(withHidden.rows[0].length === 8, 'includeHiddenCols: true row has 8 cells');
    assert(withHidden.rows.every(r => r.length === withHidden.headers.length), 'All rows with hidden cols match header count (8)');
    assert(withHidden.rows[0][7].startsWith('SEC-KEY-'), 'Hidden column value extracted successfully');

    await slowPage.close();

    // --- 4. Testing AG Grid Layout Fixture ---
    console.log('\n--- 4. Testing AG Grid Layout Fixture (ag-grid-fixture.html) ---');
    const agGridPage = await browser.newPage();
    await agGridPage.setViewport({ width: 1400, height: 900 });
    await agGridPage.goto(`file://${agGridTestPagePath}`, { waitUntil: 'domcontentloaded' });
    await agGridPage.evaluate(contentScriptCode);

    // TEST 12: AG Grid Table Detection & Leaf Header Schema
    console.log('\n[Browser Test] 12. AG Grid Table Detection & Leaf Header Schema');
    const agScanResult = await agGridPage.evaluate(() => {
      return window.TableExtractor.scanPageTables();
    });

    assert(agScanResult.length >= 1, 'Discovered AG Grid table on fixture page');
    const agTable = agScanResult[0];
    assert(agTable.isVirtualized === true, 'AG Grid fixture detected as isVirtualized: true');
    assert(agTable.headers.length === 9, 'AG Grid extracted exactly 9 leaf headers (excluded group & selection)', `got ${agTable.headers.length}`);

    const expectedAgHeaders = [
      'Row Number',
      'Name',
      'Language',
      'Country',
      'Game Name',
      'Bought',
      'Bank Balance',
      'Rating',
      'Total Winnings'
    ];
    assert(JSON.stringify(agTable.headers) === JSON.stringify(expectedAgHeaders), 'Header names strictly match expected leaf columns without group headers or empty columns');
    assert(!agTable.headers.includes('Participant') && !agTable.headers.includes('Game of Choice') && !agTable.headers.includes('Performance'), 'Group headers correctly excluded from schema');
    assert(!agTable.headers.includes(''), 'No empty string column in headers');

    // TEST 13: AG Grid Virtualized Capture & 1:1 Column Alignment
    console.log('\n[Browser Test] 13. AG Grid Virtualized Capture & 1:1 Column Alignment (100 Rows)');
    const agCaptureResult = await agGridPage.evaluate(async () => {
      return await window.TableExtractor.runVirtualizedCapture('te-table-1', {
        scrollIncrement: 400,
        settleDelayMs: 25,
        maxSettleTimeoutMs: 500
      });
    });

    assert(agCaptureResult.totalRows === 100, 'Captured all 100 rows in AG Grid dataset', `got ${agCaptureResult.totalRows}`);
    assert(agCaptureResult.rows.every(r => r.length === agCaptureResult.headers.length), 'Every single extracted row has cell count strictly equal to header count (9)');

    // Verify row 0: values match headers 1:1
    const row0 = agCaptureResult.rows[0];
    assert(row0[0] === '1', 'Row 0 cell 0 (Row Number) is "1"', `got ${row0[0]}`);
    assert(row0[1] === 'Tony Smith', 'Row 0 cell 1 (Name) is "Tony Smith"', `got ${row0[1]}`);
    assert(row0[2] === 'English', 'Row 0 cell 2 (Language) is "English"', `got ${row0[2]}`);
    assert(row0[3] === 'Ireland', 'Row 0 cell 3 (Country) is "Ireland"', `got ${row0[3]}`);
    assert(row0[4] === 'Chess', 'Row 0 cell 4 (Game Name) is "Chess"', `got ${row0[4]}`);
    assert(row0[5] === 'true', 'Row 0 cell 5 (Bought) boolean checkbox is "true"', `got ${row0[5]}`);
    assert(row0[6] === '$2,123', 'Row 0 cell 6 (Bank Balance) is "$2,123"', `got ${row0[6]}`);
    assert(row0[7] === '2 stars', 'Row 0 cell 7 (Rating) image alt is "2 stars"', `got ${row0[7]}`);
    assert(row0[8] === '$403,541', 'Row 0 cell 8 (Total Winnings) is "$403,541"', `got ${row0[8]}`);

    // Verify row 1:
    const row1 = agCaptureResult.rows[1];
    assert(row1[0] === '2', 'Row 1 cell 0 (Row Number) is "2"', `got ${row1[0]}`);
    assert(row1[1] === 'Andrew Connell', 'Row 1 cell 1 (Name) is "Andrew Connell"', `got ${row1[1]}`);
    assert(row1[5] === 'false', 'Row 1 cell 5 (Bought) boolean checkbox is "false"', `got ${row1[5]}`);

    // Verify strict sequential ascending order for all 100 rows
    const isAllInOrder = agCaptureResult.rows.every((r, idx) => r[0] === String(idx + 1));
    assert(isAllInOrder, 'All 100 rows strictly in sequential ascending order 1..100');

    // TEST 13b: Pre-scrolled AG Grid Virtualized Capture & Sequential Ordering
    console.log('\n[Browser Test] 13b. Pre-scrolled AG Grid Virtualized Capture & Sequential Ordering');
    // Pre-scroll viewport to 360px (rendering rows 6-27 initially in DOM)
    await agGridPage.evaluate(() => {
      const vp = document.getElementById('ag-scroll-viewport');
      vp.scrollTop = 360;
      vp.dispatchEvent(new Event('scroll'));
    });

    const prescrolledVisible = await agGridPage.evaluate(() => {
      return Array.from(document.querySelectorAll('.ag-row')).map(r => r.getAttribute('data-row-id'));
    });
    assert(prescrolledVisible[0] === 'row-6', 'Pre-scrolled fixture begins at row-6 in DOM');

    const prescrolledCapture = await agGridPage.evaluate(async () => {
      return await window.TableExtractor.runVirtualizedCapture('te-table-1', {
        scrollIncrement: 250,
        settleDelayMs: 25,
        maxSettleTimeoutMs: 500
      });
    });

    assert(prescrolledCapture.totalRows === 100, 'Captured all 100 rows despite starting pre-scrolled at row 6');
    assert(prescrolledCapture.rows.every((r, idx) => r[0] === String(idx + 1)), 'All 100 rows in pre-scrolled capture strictly in sequential ascending order 1..100');
    assert(prescrolledCapture.rows[0][0] === '1', 'Pre-scrolled capture row 0 is 1 (rows 1-4 NOT inserted after row 14)');
    assert(prescrolledCapture.rows[1][0] === '2', 'Pre-scrolled capture row 1 is 2');
    assert(prescrolledCapture.rows[2][0] === '3', 'Pre-scrolled capture row 2 is 3');
    assert(prescrolledCapture.rows[3][0] === '4', 'Pre-scrolled capture row 3 is 4');
    assert(prescrolledCapture.rows[4][0] === '5', 'Pre-scrolled capture row 4 is 5');
    assert(prescrolledCapture.rows[14][0] === '15', 'Pre-scrolled capture row 14 is 15');

    // TEST 13c: Row Range Selection [10..25] on Pre-scrolled AG Grid
    console.log('\n[Browser Test] 13c. Row Range Selection [10..25] on Pre-scrolled AG Grid');
    await agGridPage.evaluate(() => {
      const vp = document.getElementById('ag-scroll-viewport');
      vp.scrollTop = 360;
      vp.dispatchEvent(new Event('scroll'));
    });

    const rangedAgResult = await agGridPage.evaluate(async () => {
      return await window.TableExtractor.runVirtualizedCapture('te-table-1', {
        rowRange: { from: 10, to: 25 },
        scrollIncrement: 250,
        settleDelayMs: 25,
        maxSettleTimeoutMs: 500
      });
    });

    assert(rangedAgResult.totalRows === 16, 'Row range [10..25] extracted exactly 16 rows', `got ${rangedAgResult.totalRows}`);
    assert(rangedAgResult.rows[0][0] === '10', 'First ranged row is 10', `got ${rangedAgResult.rows[0]?.[0]}`);
    assert(rangedAgResult.rows[15][0] === '25', 'Last ranged row is 25', `got ${rangedAgResult.rows[15]?.[0]}`);
    assert(rangedAgResult.rows.every((r, idx) => r[0] === String(10 + idx)), 'All ranged rows strictly sequential 10..25');

    // TEST 14: CSV Export from AG Grid Capture (No blank column A, no double commas)
    console.log('\n[Browser Test] 14. CSV Export Format & Column Alignment Verification');
    const agCsv = tableDataToCSV(agCaptureResult);
    const csvLines = agCsv.replace(/^\uFEFF/, '').trim().split(/\r?\n/);
    assert(csvLines[0] === 'Row Number,Name,Language,Country,Game Name,Bought,Bank Balance,Rating,Total Winnings', 'CSV header line has clean columns with no extra commas');
    assert(!csvLines[0].includes(',,'), 'CSV header line contains no double commas / empty headers');
    assert(csvLines[1].startsWith('1,Tony Smith,English,Ireland,Chess,true,'), 'CSV row 1 starts with "1,Tony Smith" - no empty leading column A');

    await agGridPage.close();

    // --- 5. Testing Live AG Grid Demo ---
    console.log('\n--- 5. Testing Live AG Grid Demo (https://www.ag-grid.com/example/) ---');
    try {
      const livePage = await browser.newPage();
      await livePage.setViewport({ width: 1400, height: 900 });
      await livePage.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

      await livePage.goto('https://www.ag-grid.com/example/', { waitUntil: 'domcontentloaded', timeout: 15000 });
      await livePage.waitForSelector('.ag-header-row-column', { timeout: 15000 });
      await livePage.waitForSelector('.ag-row', { timeout: 15000 });
      await livePage.evaluate(contentScriptCode);

      const liveScanResult = await livePage.evaluate(() => {
        return window.TableExtractor.scanPageTables();
      });

      assert(liveScanResult.length >= 1, 'Discovered live AG Grid on ag-grid.com/example/');
      const liveTable = liveScanResult[0];
      assert(liveTable.headers.length === 9, 'Live AG Grid has exactly 9 columns', `got ${liveTable.headers.length}`);
      assert(liveTable.headers[0] === 'Row Number', 'Live AG Grid first column is "Row Number"');
      assert(liveTable.headers[1] === 'Name', 'Live AG Grid second column is "Name"');
      assert(!liveTable.headers.includes('Participant'), 'Live AG Grid excludes group headers');

      // Capture a sample of 25 rows
      const liveCaptureResult = await livePage.evaluate(async () => {
        return await window.TableExtractor.runVirtualizedCapture('te-table-1', {
          maxRows: 25,
          scrollIncrement: 400,
          settleDelayMs: 80
        });
      });

      assert(liveCaptureResult.rows.length >= 15, 'Captured sample rows from live AG Grid', `got ${liveCaptureResult.rows.length}`);
      assert(liveCaptureResult.rows.every(r => r.length === liveCaptureResult.headers.length), 'Every live row has exact cell count equal to header count (9)');

      // Extract Row Number column values
      const liveRowNums = liveCaptureResult.rows.map(r => r[0]);
      console.log('  Live AG Grid Row Numbers sequence:', liveRowNums.join(', '));

      // Strict ascending sequence check
      assert(liveRowNums[0] === '1', 'Live Row 0 is "1"');
      assert(liveRowNums[1] === '2', 'Live Row 1 is "2"');
      assert(liveRowNums[2] === '3', 'Live Row 2 is "3"');
      assert(liveRowNums[3] === '4', 'Live Row 3 is "4"');
      assert(liveRowNums[4] === '5', 'Live Row 4 is "5"');

      const isStrictAscending = liveRowNums.every((val, idx) => {
        const num = parseInt(val, 10);
        return !isNaN(num) && num === idx + 1;
      });
      assert(isStrictAscending, `Live AG Grid row numbers are in strict ascending order 1..${liveRowNums.length} (got: ${liveRowNums.slice(0, 10).join(', ')}...)`);

      const liveCsv = tableDataToCSV(liveCaptureResult);
      const liveCsvLines = liveCsv.replace(/^\uFEFF/, '').trim().split(/\r?\n/);
      assert(!liveCsvLines[0].includes(',,'), 'Live CSV header contains no double commas');
      assert(liveCsvLines[1].startsWith('1,Tony Smith,'), 'Live CSV row 1 starts with "1,Tony Smith," (no empty column A)');

      await livePage.close();
    } catch (liveErr) {
      console.warn('  ⚠️ Note: Live ag-grid.com test failed or timed out:', liveErr.message);
    }

  } finally {
    await browser.close();
  }

  console.log('\n====================================================');
  console.log(`Results: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
