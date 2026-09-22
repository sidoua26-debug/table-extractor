/**
 * Table Extractor - Popup Controller
 */

import { isProUser, getLicenseStatus, activateLicense, createPaymentInvoice, SUPPORT_EMAIL } from '../lib/license.js';
import { tableDataToCSV } from '../lib/csv.js';
import { tableDataToXLSX } from '../lib/xlsx.js';
import { tableDataToJSON } from '../lib/json.js';

document.addEventListener('DOMContentLoaded', async () => {
  // DOM Elements
  const activeDomainEl = document.getElementById('active-domain');
  const tierBadgeEl = document.getElementById('tier-badge');
  const loadingStateEl = document.getElementById('loading-state');
  const emptyStateEl = document.getElementById('empty-state');
  const emptyIconEl = document.getElementById('empty-icon');
  const emptyTitleEl = document.getElementById('empty-title');
  const emptyDescEl = document.getElementById('empty-desc');
  const tableViewEl = document.getElementById('table-view');
  const tableSelectEl = document.getElementById('table-select');
  const infoDimensionsEl = document.getElementById('info-dimensions');
  const tableTypeBadgeEl = document.getElementById('table-type-badge');
  const virtBannerEl = document.getElementById('virt-banner');
  const hVirtWarningEl = document.getElementById('h-virt-warning');

  const fmtCsvEl = document.getElementById('fmt-csv');
  const fmtXlsxEl = document.getElementById('fmt-xlsx');
  const fmtJsonEl = document.getElementById('fmt-json');

  const optMaxRowsEl = document.getElementById('opt-max-rows');
  const btnSpeedNormal = document.getElementById('btn-speed-normal');
  const btnSpeedSlow = document.getElementById('btn-speed-slow');
  const optHiddenColsEl = document.getElementById('opt-hidden-cols');
  const optRangeStartEl = document.getElementById('opt-range-start');
  const optRangeEndEl = document.getElementById('opt-range-end');
  const tableErrorBanner = document.getElementById('table-error-banner');
  const tableErrorText = document.getElementById('table-error-text');

  const btnCaptureAll = document.getElementById('btn-capture-all');
  const btnExportVisible = document.getElementById('btn-export-visible');
  const btnRescan = document.getElementById('btn-rescan');

  const captureProgressView = document.getElementById('capture-progress-view');
  const progressHeading = document.getElementById('progress-heading');
  const progressCounter = document.getElementById('progress-counter');
  const progressBarFill = document.getElementById('progress-bar-fill');
  const captureWarning = document.getElementById('capture-warning');
  const captureWarningText = document.getElementById('capture-warning-text');
  const btnCancelCapture = document.getElementById('btn-cancel-capture');

  const btnOpenLicense = document.getElementById('btn-open-license');
  const proModal = document.getElementById('pro-modal');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const btnCreateInvoice = document.getElementById('btn-create-invoice');
  const inputLicenseKey = document.getElementById('input-license-key');
  const btnActivatePro = document.getElementById('btn-activate-pro');
  const activationMsg = document.getElementById('activation-msg');
  const footerSupportLink = document.getElementById('footer-support-link');

  if (footerSupportLink) {
    footerSupportLink.href = `mailto:${SUPPORT_EMAIL}`;
    footerSupportLink.textContent = SUPPORT_EMAIL;
  }

  let activeTab = null;
  let detectedTables = [];
  let currentTable = null;
  let isCapturing = false;
  let selectedSpeed = 'normal';

  // Speed toggle listeners
  btnSpeedNormal?.addEventListener('click', () => {
    selectedSpeed = 'normal';
    btnSpeedNormal.classList.add('active');
    btnSpeedSlow.classList.remove('active');
  });
  btnSpeedSlow?.addEventListener('click', () => {
    selectedSpeed = 'slow';
    btnSpeedSlow.classList.add('active');
    btnSpeedNormal.classList.remove('active');
  });

  // 1. Initialize Active Tab
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    activeTab = tabs[0];
    if (activeTab?.url) {
      try {
        const urlObj = new URL(activeTab.url);
        activeDomainEl.textContent = urlObj.hostname || 'Local Page';
      } catch (_) {
        activeDomainEl.textContent = activeTab.title || 'Active Tab';
      }
    }
  } catch (err) {
    console.warn('[Popup] Error querying active tab:', err);
    activeDomainEl.textContent = 'Active Tab';
  }

  // 2. License Tier UI helper
  async function refreshLicenseUI() {
    const isPro = await isProUser();
    if (isPro) {
      tierBadgeEl.textContent = 'PRO';
      tierBadgeEl.className = 'badge badge-pro';
      btnCaptureAll.querySelector('.badge-pro-small').style.display = 'none';
    } else {
      tierBadgeEl.textContent = 'FREE';
      tierBadgeEl.className = 'badge badge-free';
      btnCaptureAll.querySelector('.badge-pro-small').style.display = 'inline-block';
    }
  }
  await refreshLicenseUI();

  // 3. Content Script Injection & Restricted Page Guard
  function isRestrictedPage(url) {
    if (!url || typeof url !== 'string') return false;
    const lower = url.trim().toLowerCase();
    // Browser internal pages
    if (lower.startsWith('chrome://') ||
        lower.startsWith('edge://') ||
        lower.startsWith('about:') ||
        lower.startsWith('chrome-extension://') ||
        lower.startsWith('extension://') ||
        lower.startsWith('view-source:') ||
        lower.startsWith('file://')) {
      return true;
    }
    // Extension web stores
    if (lower.includes('chromewebstore.google.com') ||
        lower.includes('chrome.google.com/webstore') ||
        lower.includes('microsoftedge.microsoft.com/addons')) {
      return true;
    }
    // PDF viewers
    if (lower.endsWith('.pdf') || lower.includes('.pdf?') || lower.includes('.pdf#')) {
      return true;
    }
    return false;
  }

  function showRestrictedPageUI(customMessage) {
    loadingStateEl.style.display = 'none';
    tableViewEl.style.display = 'none';
    emptyStateEl.style.display = 'flex';

    if (emptyIconEl) emptyIconEl.textContent = '🔒';
    if (emptyTitleEl) emptyTitleEl.textContent = 'Page Protected';
    if (emptyDescEl) {
      emptyDescEl.textContent = customMessage || 'Table Extractor works on standard web pages. Browser system pages (chrome://, edge://), extension web stores, PDF viewers, and file:// pages cannot be inspected.';
    }
    if (btnRescan) btnRescan.style.display = 'none';
  }

  function showEmptyStateUI() {
    loadingStateEl.style.display = 'none';
    tableViewEl.style.display = 'none';
    emptyStateEl.style.display = 'flex';

    if (emptyIconEl) emptyIconEl.textContent = '📊';
    if (emptyTitleEl) emptyTitleEl.textContent = 'No Tables Detected';
    if (emptyDescEl) {
      emptyDescEl.textContent = 'Could not find standard tables or data grids on this page.';
    }
    if (btnRescan) btnRescan.style.display = 'inline-block';
  }

  const injectedTabs = new Set();

  async function ensureContentScriptInjected(tabId) {
    if (!tabId) return false;

    if (isRestrictedPage(activeTab?.url)) {
      showRestrictedPageUI();
      return false;
    }

    // 1. If confirmed in this session, verify with ping
    if (injectedTabs.has(tabId)) {
      try {
        const ping = await chrome.tabs.sendMessage(tabId, { action: 'TE_PING' });
        if (ping?.status === 'ok') return true;
      } catch (_) {
        injectedTabs.delete(tabId);
      }
    }

    // 2. Ping to see if content script is already listening on the page
    try {
      const ping = await chrome.tabs.sendMessage(tabId, { action: 'TE_PING' });
      if (ping?.status === 'ok') {
        injectedTabs.add(tabId);
        return true;
      }
    } catch (_) {}

    // 3. Inject content.js on-demand via chrome.scripting.executeScript
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content.js']
      });
      await new Promise(r => setTimeout(r, 60));
      injectedTabs.add(tabId);
      return true;
    } catch (err) {
      console.warn('[Popup] Content script injection failed:', err);
      const errMsg = (err?.message || '').toLowerCase();
      if (errMsg.includes('cannot access') ||
          errMsg.includes('restricted') ||
          errMsg.includes('missing host permission') ||
          errMsg.includes('extensions gallery')) {
        showRestrictedPageUI();
        return false;
      }
      showRestrictedPageUI('Could not inspect this page. Please open a standard web page.');
      return false;
    }
  }

  // 4. Scan Tables on Page
  async function scanTables() {
    if (!activeTab?.id) return;

    if (isRestrictedPage(activeTab?.url)) {
      showRestrictedPageUI();
      return;
    }

    loadingStateEl.style.display = 'flex';
    emptyStateEl.style.display = 'none';
    tableViewEl.style.display = 'none';
    captureProgressView.style.display = 'none';

    try {
      const injected = await ensureContentScriptInjected(activeTab.id);
      if (!injected) return;

      const response = await chrome.tabs.sendMessage(activeTab.id, { action: 'TE_SCAN_TABLES' });
      loadingStateEl.style.display = 'none';

      if (response && response.status === 'ok' && response.tables?.length > 0) {
        detectedTables = response.tables;
        populateTableList(detectedTables);
        tableViewEl.style.display = 'block';
      } else {
        showEmptyStateUI();
      }
    } catch (err) {
      console.warn('[Popup] Error scanning tables:', err);
      loadingStateEl.style.display = 'none';
      showEmptyStateUI();
    }
  }

  // 4. Populate table selector dropdown
  function populateTableList(tables) {
    tableSelectEl.innerHTML = '';
    tables.forEach((t, i) => {
      const option = document.createElement('option');
      option.value = t.id;
      const tag = t.isVirtualized ? ' [Virtualized]' : '';
      option.textContent = `${i + 1}. ${t.title || 'Table ' + (i + 1)}${tag}`;
      tableSelectEl.appendChild(option);
    });

    onTableSelectionChange(tables[0]);
  }

  // 5. Update view when a table is selected
  function onTableSelectionChange(table) {
    if (!table) return;
    currentTable = table;

    // Reset error banner
    if (tableErrorBanner) {
      tableErrorBanner.style.display = 'none';
      tableErrorText.textContent = '';
    }

    // Dimensions
    infoDimensionsEl.textContent = `${table.visibleRowCount} visible rows × ${table.colCount} cols`;

    // Virtualization badge & alerts
    if (table.isVirtualized) {
      tableTypeBadgeEl.textContent = 'Virtualized Grid';
      tableTypeBadgeEl.className = 'badge badge-virt';
      virtBannerEl.style.display = 'flex';
      btnCaptureAll.style.display = 'inline-flex';
      btnExportVisible.textContent = 'Just visible rows';
    } else {
      tableTypeBadgeEl.textContent = 'Static Table';
      tableTypeBadgeEl.className = 'badge badge-standard';
      virtBannerEl.style.display = 'none';
      btnCaptureAll.style.display = 'none';
      btnExportVisible.textContent = 'Export Table';
    }

    // Horizontal virtualization warning
    if (table.hasHorizontalVirtualization) {
      hVirtWarningEl.style.display = 'flex';
    } else {
      hVirtWarningEl.style.display = 'none';
    }

    // Highlight on page
    if (activeTab?.id) {
      ensureContentScriptInjected(activeTab.id).then((ok) => {
        if (ok) {
          chrome.tabs.sendMessage(activeTab.id, {
            action: 'TE_HIGHLIGHT_TABLE',
            tableId: table.id
          }).catch(() => {});
        }
      }).catch(() => {});
    }
  }

  tableSelectEl.addEventListener('change', (e) => {
    const selected = detectedTables.find(t => t.id === e.target.value);
    onTableSelectionChange(selected);
  });

  btnRescan?.addEventListener('click', scanTables);

  // 6. Download helper
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function sanitizeFilename(title) {
    return (title || 'table_export').replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
  }

  function exportTableData(data, baseTitle) {
    const baseName = sanitizeFilename(baseTitle || data.title);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

    if (fmtCsvEl.checked) {
      const csvContent = tableDataToCSV(data);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      downloadBlob(blob, `${baseName}_${timestamp}.csv`);
    }

    if (fmtXlsxEl.checked) {
      const xlsxContent = tableDataToXLSX(data);
      const blob = new Blob([xlsxContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
      downloadBlob(blob, `${baseName}_${timestamp}.xls`);
    }

    if (fmtJsonEl.checked) {
      const jsonContent = tableDataToJSON(data);
      const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
      downloadBlob(blob, `${baseName}_${timestamp}.json`);
    }
  }

  // Helper to extract capture options from UI
  function getCaptureOptions() {
    const maxRows = parseInt(optMaxRowsEl?.value, 10) || 5000;
    const slowSite = (selectedSpeed === 'slow');
    const includeHiddenCols = Boolean(optHiddenColsEl?.checked);
    let rowRange = null;

    const startVal = parseInt(optRangeStartEl?.value, 10);
    const endVal = parseInt(optRangeEndEl?.value, 10);
    const hasStart = !isNaN(startVal) && startVal > 0;
    const hasEnd = !isNaN(endVal) && endVal > 0;

    if (hasStart && hasEnd) {
      rowRange = { from: Math.min(startVal, endVal), to: Math.max(startVal, endVal) };
    } else if (hasStart) {
      rowRange = { from: startVal, to: 999999 };
    } else if (hasEnd) {
      rowRange = { from: 1, to: endVal };
    }

    return {
      maxRows,
      slowSite,
      includeHiddenCols,
      rowRange,
      settleDelayMs: slowSite ? 250 : 120,
      maxSettleTimeoutMs: slowSite ? 6000 : 3000,
      maxSteps: 500
    };
  }

  // 7. Export Visible Rows (Static)
  btnExportVisible.addEventListener('click', async () => {
    if (!currentTable || !activeTab?.id) return;
    if (tableErrorBanner) tableErrorBanner.style.display = 'none';

    // Check format selection
    if (!fmtCsvEl.checked && !fmtXlsxEl.checked && !fmtJsonEl.checked) {
      alert('Please select at least one export format (CSV, XLSX, JSON).');
      return;
    }

    try {
      btnExportVisible.disabled = true;
      btnExportVisible.textContent = 'Exporting...';

      const injected = await ensureContentScriptInjected(activeTab.id);
      if (!injected) {
        return;
      }

      const response = await chrome.tabs.sendMessage(activeTab.id, {
        action: 'TE_CAPTURE_STATIC',
        tableId: currentTable.id,
        options: {
          includeHiddenCols: optHiddenColsEl?.checked
        }
      });

      if (response && response.status === 'ok') {
        let exportData = response.data;
        const options = getCaptureOptions();
        // Slice if row range is set
        if (options.rowRange) {
          const fromIdx = Math.max(0, options.rowRange.from - 1);
          const toIdx = Math.min(exportData.rows.length, options.rowRange.to);
          exportData = {
            ...exportData,
            rows: exportData.rows.slice(fromIdx, toIdx),
            totalRows: Math.max(0, toIdx - fromIdx)
          };
        }
        exportTableData(exportData, currentTable.title);
      } else {
        const errorMsg = 'Export failed: ' + (response?.error || 'Unknown error');
        if (tableErrorBanner) {
          tableErrorBanner.style.display = 'flex';
          tableErrorText.textContent = errorMsg;
        }
        alert(errorMsg);
      }
    } catch (err) {
      const errorMsg = 'Error exporting rows: ' + err.message;
      if (tableErrorBanner) {
        tableErrorBanner.style.display = 'flex';
        tableErrorText.textContent = errorMsg;
      }
      alert(errorMsg);
    } finally {
      btnExportVisible.disabled = false;
      btnExportVisible.textContent = currentTable?.isVirtualized ? 'Just visible rows' : 'Export Table';
    }
  });

  // 8. Capture All Rows (Pro - Virtualized)
  btnCaptureAll.addEventListener('click', async () => {
    if (!currentTable || !activeTab?.id) return;
    if (tableErrorBanner) tableErrorBanner.style.display = 'none';

    // Feature gate check: Pro tier required
    const isPro = await isProUser();
    if (!isPro) {
      openProModal();
      return;
    }

    // Check multi-format selection gate
    const selectedFormatsCount = [fmtCsvEl.checked, fmtXlsxEl.checked, fmtJsonEl.checked].filter(Boolean).length;
    if (selectedFormatsCount === 0) {
      alert('Please select at least one export format (CSV, XLSX, JSON).');
      return;
    }

    const injected = await ensureContentScriptInjected(activeTab.id);
    if (!injected) {
      return;
    }

    // Start virtualized capture
    isCapturing = true;
    tableViewEl.style.display = 'none';
    captureProgressView.style.display = 'block';
    captureWarning.style.display = 'none';
    progressCounter.textContent = 'Starting scan...';
    progressBarFill.style.width = '0%';
    progressHeading.textContent = 'Accumulating Table Rows...';

    // Listen for progress messages
    const progressListener = (msg) => {
      if (msg.action === 'TE_CAPTURE_PROGRESS') {
        progressCounter.textContent = `Scanned ${msg.scannedRows} rows so far...`;
        progressBarFill.style.width = `${msg.progressPct || 0}%`;
      }
    };
    chrome.runtime.onMessage.addListener(progressListener);

    try {
      const options = getCaptureOptions();
      const response = await chrome.tabs.sendMessage(activeTab.id, {
        action: 'TE_START_VIRTUALIZED_CAPTURE',
        tableId: currentTable.id,
        options
      });

      chrome.runtime.onMessage.removeListener(progressListener);

      if (response && response.status === 'ok') {
        const data = response.data;
        if (data.warning) {
          captureWarning.style.display = 'block';
          captureWarningText.textContent = data.warning;
        }

        if (data.aborted) {
          progressCounter.textContent = `Capture cancelled. Extracted ${data.totalRows} rows.`;
        } else {
          progressCounter.textContent = `Completed! Extracted ${data.totalRows} rows total.`;
          progressBarFill.style.width = '100%';
        }

        // Trigger export
        exportTableData(data, currentTable.title);

        // Delay returning to table view so user sees completion
        setTimeout(() => {
          if (!isCapturing) return;
          isCapturing = false;
          captureProgressView.style.display = 'none';
          tableViewEl.style.display = 'block';
        }, 1800);

      } else {
        const errorMsg = response?.error || 'Unknown error';
        if (tableErrorBanner) {
          tableErrorBanner.style.display = 'flex';
          tableErrorText.textContent = errorMsg;
        }
        alert(errorMsg);
        isCapturing = false;
        captureProgressView.style.display = 'none';
        tableViewEl.style.display = 'block';
      }
    } catch (err) {
      chrome.runtime.onMessage.removeListener(progressListener);
      const errorMsg = err.message || 'Error during virtualized capture';
      if (tableErrorBanner) {
        tableErrorBanner.style.display = 'flex';
        tableErrorText.textContent = errorMsg;
      }
      alert(errorMsg);
      isCapturing = false;
      captureProgressView.style.display = 'none';
      tableViewEl.style.display = 'block';
    }
  });

  // 9. Cancel capture
  btnCancelCapture.addEventListener('click', async () => {
    if (!activeTab?.id) return;
    try {
      await chrome.tabs.sendMessage(activeTab.id, { action: 'TE_CANCEL_CAPTURE' });
      progressHeading.textContent = 'Cancelling...';
    } catch (_) {}
  });

  // 10. Pro Modal Controls
  function openProModal() {
    proModal.style.display = 'flex';
    activationMsg.textContent = '';
    activationMsg.className = 'msg-text';
  }

  function closeProModal() {
    proModal.style.display = 'none';
  }

  btnOpenLicense.addEventListener('click', openProModal);
  btnCloseModal.addEventListener('click', closeProModal);
  proModal.addEventListener('click', (e) => {
    if (e.target === proModal) closeProModal();
  });

  // Create NOWPayments invoice button
  btnCreateInvoice?.addEventListener('click', async () => {
    try {
      btnCreateInvoice.disabled = true;
      btnCreateInvoice.innerHTML = '<span class="spinner-small"></span> Creating invoice...';
      activationMsg.textContent = '';
      activationMsg.className = 'msg-text';

      const res = await createPaymentInvoice();
      if (res.ok && res.invoiceUrl) {
        if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
          chrome.tabs.create({ url: res.invoiceUrl });
        } else {
          window.open(res.invoiceUrl, '_blank');
        }
        activationMsg.textContent = 'Invoice opened in a new tab! Once paid, copy the Payment ID and paste it below.';
        activationMsg.className = 'msg-text msg-success';
      } else {
        activationMsg.textContent = res.error || 'Failed to create payment invoice. Please try again.';
        activationMsg.className = 'msg-text msg-error';
      }
    } catch (err) {
      activationMsg.textContent = 'Error: ' + err.message;
      activationMsg.className = 'msg-text msg-error';
    } finally {
      btnCreateInvoice.disabled = false;
      btnCreateInvoice.innerHTML = '<span class="btn-icon">🪙</span><span>Pay with Crypto — $9.99</span>';
    }
  });

  btnActivatePro.addEventListener('click', async () => {
    const key = inputLicenseKey.value.trim();
    if (!key) {
      activationMsg.textContent = 'Please enter a Payment ID or gift code.';
      activationMsg.className = 'msg-text msg-error';
      return;
    }

    try {
      btnActivatePro.disabled = true;
      btnActivatePro.textContent = 'Verifying...';
      activationMsg.textContent = 'Checking payment status with server...';
      activationMsg.className = 'msg-text';

      const res = await activateLicense(key);
      if (res.success) {
        activationMsg.textContent = res.message;
        activationMsg.className = 'msg-text msg-success';
        await refreshLicenseUI();
        setTimeout(closeProModal, 1500);
      } else {
        activationMsg.textContent = res.message || 'Activation failed.';
        activationMsg.className = 'msg-text msg-error';
      }
    } catch (err) {
      activationMsg.textContent = 'Error: ' + err.message;
      activationMsg.className = 'msg-text msg-error';
    } finally {
      btnActivatePro.disabled = false;
      btnActivatePro.textContent = 'Activate';
    }
  });

  // Initial Scan
  await scanTables();
});
