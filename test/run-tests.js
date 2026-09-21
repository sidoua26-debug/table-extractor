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
  const mockStorage = {};
  globalThis.chrome = {
    storage: {
      local: {
        get: async (key) => {
          if (typeof key === 'string') return { [key]: mockStorage[key] };
          return { ...mockStorage };
        },
        set: async (obj) => {
          Object.assign(mockStorage, obj);
        }
      }
    }
  };

  const { isProUser, getLicenseStatus, activateLicense, resetLicense, canUseVirtualizedCapture, canUseZipExport, canUseMultiFormatExport } = await import('../lib/license.js');

  const initialStatus = await getLicenseStatus();
  assert(initialStatus === 'free', 'Initial license status is "free"');
  assert((await isProUser()) === false, 'isProUser() returns false initially');
  assert((await canUseVirtualizedCapture()) === false, 'canUseVirtualizedCapture() blocked for Free tier');
  assert((await canUseZipExport()) === false, 'canUseZipExport() blocked for Free tier');
  assert((await canUseMultiFormatExport()) === false, 'canUseMultiFormatExport() blocked for Free tier');

  // Invalid key activation
  const invalidAct = await activateLicense('INVALID');
  assert(invalidAct.success === false, 'Invalid license key rejected');

  // Valid key activation
  const validAct = await activateLicense('PRO-TEST-PASS');
  assert(validAct.success === true, 'Test license key PRO-TEST-PASS accepted');
  assert((await isProUser()) === true, 'isProUser() returns true after activation');
  assert((await getLicenseStatus()) === 'pro', 'getLicenseStatus() returns "pro"');
  assert((await canUseVirtualizedCapture()) === true, 'canUseVirtualizedCapture() unlocked for Pro tier');
  assert((await canUseZipExport()) === true, 'canUseZipExport() unlocked for Pro tier');
  assert((await canUseMultiFormatExport()) === true, 'canUseMultiFormatExport() unlocked for Pro tier');

  // Reset to Free
  await resetLicense();
  assert((await isProUser()) === false, 'resetLicense() restores Free tier');

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

    // Verify first and last rows
    assert(virtCaptureResult.rows[0][0] === 'EMP-00001', 'First captured row is EMP-00001', `got ${virtCaptureResult.rows[0]?.[0]}`);
    assert(virtCaptureResult.rows[1999][0] === 'EMP-02000', 'Last captured row is EMP-02000', `got ${virtCaptureResult.rows[1999]?.[0]}`);

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
    assert(withHidden.headers.includes('Internal Code'), 'includeHiddenCols: true includes "Internal Code" header');
    assert(withHidden.rows[0].length === 8, 'includeHiddenCols: true row has 8 cells');
    assert(withHidden.rows[0][7].startsWith('SEC-KEY-'), 'Hidden column value extracted successfully');

    await slowPage.close();

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
