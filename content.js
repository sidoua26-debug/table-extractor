/**
 * Table Extractor - Content Script
 * Detects HTML tables and virtualized data grids on webpages,
 * performs static extracts, and coordinates accumulate-while-scrolling captures.
 */

(() => {
  if (window.__TABLE_EXTRACTOR_INITIALIZED__) {
    return;
  }
  window.__TABLE_EXTRACTOR_INITIALIZED__ = true;

  // Track discovered tables on the page
  let detectedTables = [];
  // Active capture abort controller
  let activeCaptureAbortController = null;
  // Currently highlighted element
  let currentlyHighlightedEl = null;

  /**
   * Fast 32-bit FNV-1a hash algorithm for deterministic cell content hashing.
   */
  function hashString(str) {
    let hash = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return (hash >>> 0).toString(16);
  }

  /**
   * Finds the true scroll container for a table or data grid.
   */
  function findScrollContainer(element) {
    if (!element || !(element instanceof HTMLElement)) {
      return document.scrollingElement || document.documentElement;
    }

    // Check element itself first (common in div-based data grids)
    try {
      const selfStyle = window.getComputedStyle(element);
      const selfOverflowY = selfStyle.overflowY;
      if ((selfOverflowY === 'auto' || selfOverflowY === 'scroll') && element.scrollHeight > element.clientHeight + 10) {
        return element;
      }
    } catch (_) {}

    // Check parent elements up to body/documentElement
    let current = element.parentElement;
    while (current && current !== document.body && current !== document.documentElement) {
      try {
        const style = window.getComputedStyle(current);
        const overflowY = style.overflowY;
        const isScrollable = (overflowY === 'auto' || overflowY === 'scroll');
        if (isScrollable && current.scrollHeight > current.clientHeight + 10) {
          return current;
        }
      } catch (_) {}
      current = current.parentElement;
    }

    if (document.scrollingElement && document.scrollingElement.scrollHeight > document.scrollingElement.clientHeight + 10) {
      return document.scrollingElement;
    }

    return element;
  }

  /**
   * Detects whether columns are virtualized horizontally.
   */
  function detectHorizontalVirtualization(element, scrollContainer) {
    const container = scrollContainer || findScrollContainer(element);
    try {
      const isHorizontallyScrollable = 
        (container.scrollWidth > container.clientWidth * 1.5) ||
        (element.scrollWidth > element.clientWidth * 1.5);

      if (!isHorizontallyScrollable) return false;

      const hasColSpacers = !!element.querySelector(
        '.virtual-col-spacer, [style*="translateX"], [aria-colindex]'
      );
      return isHorizontallyScrollable && hasColSpacers;
    } catch (_) {
      return false;
    }
  }

  /**
   * Extracts visible row elements from a table or grid.
   */
  function getVisibleRowElements(tableOrGrid) {
    if (!tableOrGrid) return [];

    // 1. Standard tbody rows
    const tbodyRows = Array.from(tableOrGrid.querySelectorAll('tbody > tr'));
    if (tbodyRows.length > 0) return tbodyRows;

    // 2. All <tr> elements excluding thead
    const directRows = Array.from(tableOrGrid.querySelectorAll('tr')).filter(tr => !tr.closest('thead'));
    if (directRows.length > 0) return directRows;

    // 3. ARIA role="row"
    const ariaRows = Array.from(tableOrGrid.querySelectorAll('[role="row"]')).filter(row => {
      return !row.closest('[role="columnheader"]') && !row.querySelector('[role="columnheader"]');
    });
    if (ariaRows.length > 0) return ariaRows;

    // 4. Class-based rows
    const classRows = Array.from(tableOrGrid.querySelectorAll('.grid-row, .virtual-row, .data-row, .table-row'));
    if (classRows.length > 0) return classRows;

    return [];
  }

  function isElementVisible(el) {
    if (!el) return false;
    if (el.hidden || el.classList.contains('cell-hidden') || el.classList.contains('hidden')) return false;
    try {
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden';
    } catch (_) {
      return true;
    }
  }

  /**
   * Extracts column headers.
   */
  function extractHeaders(tableOrGrid, includeHidden = false) {
    if (!tableOrGrid) return [];

    const filterCells = (elements) => elements.filter(el => includeHidden || isElementVisible(el));

    // 1. <th> in thead
    const theadThs = filterCells(Array.from(tableOrGrid.querySelectorAll('thead th, thead td')));
    if (theadThs.length > 0) {
      return theadThs.map(th => th.textContent.trim());
    }

    // 2. ARIA role="columnheader"
    const ariaHeaders = filterCells(Array.from(tableOrGrid.querySelectorAll('[role="columnheader"]')));
    if (ariaHeaders.length > 0) {
      return ariaHeaders.map(h => h.textContent.trim());
    }

    // 3. Header cell classes
    const headerCells = filterCells(Array.from(tableOrGrid.querySelectorAll('.grid-header .cell, .grid-header-cell, .header-cell')));
    if (headerCells.length > 0) {
      return headerCells.map(c => c.textContent.trim());
    }

    // 4. First row <th>
    const firstRow = tableOrGrid.querySelector('tr');
    if (firstRow && firstRow.querySelector('th')) {
      return filterCells(Array.from(firstRow.querySelectorAll('th'))).map(th => th.textContent.trim());
    }

    return [];
  }

  /**
   * Extracts text values from a row element.
   */
  function extractRowValues(rowElement, includeHidden = false) {
    if (!rowElement) return [];

    const filterCells = (elements) => elements.filter(el => includeHidden || isElementVisible(el));

    const cells = filterCells(Array.from(rowElement.querySelectorAll('td, th')));
    if (cells.length > 0) {
      return cells.map(c => c.textContent.trim().replace(/\s+/g, ' '));
    }

    const ariaCells = filterCells(Array.from(rowElement.querySelectorAll('[role="gridcell"], [role="cell"]')));
    if (ariaCells.length > 0) {
      return ariaCells.map(c => c.textContent.trim().replace(/\s+/g, ' '));
    }

    const classCells = filterCells(Array.from(rowElement.querySelectorAll('.cell, .grid-cell, .data-cell')));
    if (classCells.length > 0) {
      return classCells.map(c => c.textContent.trim().replace(/\s+/g, ' '));
    }

    return filterCells(Array.from(rowElement.children)).map(c => c.textContent.trim().replace(/\s+/g, ' '));
  }

  /**
   * Generates a stable deduplication key for a row.
   */
  function getRowIdentityKey(rowElement, cellValues) {
    const explicitId = 
      rowElement.getAttribute('data-row-id') ||
      rowElement.getAttribute('data-id') ||
      rowElement.getAttribute('id') ||
      rowElement.dataset?.rowId ||
      rowElement.dataset?.id ||
      rowElement.dataset?.key;

    if (explicitId) {
      return `id:${explicitId}`;
    }

    const normalizedContent = (cellValues || []).join('||~||');
    return `hash:${hashString(normalizedContent)}`;
  }

  /**
   * Evaluates if a table is a candidate for virtualization.
   */
  function detectVirtualizationCandidate(element) {
    if (!element || !(element instanceof HTMLElement)) {
      return { isCandidate: false, hasHorizontalVirtualization: false };
    }

    const container = findScrollContainer(element);
    const scrollHeight = container.scrollHeight;
    const clientHeight = container.clientHeight;
    const hasHorizontalVirtualization = detectHorizontalVirtualization(element, container);

    if (scrollHeight <= clientHeight * 1.3 || clientHeight <= 0) {
      return {
        isCandidate: false,
        hasHorizontalVirtualization,
        container,
        scrollHeight,
        clientHeight,
        renderedRowCount: 0
      };
    }

    const rowElements = getVisibleRowElements(element);
    const renderedRowCount = rowElements.length;

    if (renderedRowCount === 0) {
      return {
        isCandidate: false,
        hasHorizontalVirtualization,
        container,
        scrollHeight,
        clientHeight,
        renderedRowCount: 0
      };
    }

    const sampleRow = rowElements[Math.min(2, renderedRowCount - 1)];
    const rowRect = sampleRow.getBoundingClientRect();
    const avgRowHeight = rowRect.height > 0 ? rowRect.height : 32;
    const renderedContentHeight = renderedRowCount * avgRowHeight;

    // For page-level scrolling containers (body / html):
    // Standard tables on scrollable pages are NOT virtualized unless they have virtual markers
    const isPageContainer = (container === document.scrollingElement || container === document.documentElement || container === document.body);

    const hasVirtualSpacer = isPageContainer
      ? !!element.querySelector('.virtual-spacer, .virtual-padding, [style*="translateY"], [style*="padding-top"], [style*="padding-bottom"], [style*="position: absolute"]')
      : !!container.querySelector('.virtual-spacer, .virtual-padding, [style*="translateY"], [style*="padding-top"], [style*="padding-bottom"], [style*="position: absolute"]');

    const hasVirtualGridClass = 
      element.classList.contains('virtual-grid') || 
      element.classList.contains('ag-root') || 
      element.classList.contains('react-grid') ||
      element.classList.contains('v-grid') ||
      !!element.closest('[data-virtualized="true"]');

    if (isPageContainer && !hasVirtualSpacer && !hasVirtualGridClass) {
      return {
        isCandidate: false,
        hasHorizontalVirtualization,
        container,
        scrollHeight,
        clientHeight,
        renderedRowCount
      };
    }

    // Condition A: DOM row height is significantly smaller than container scrollable height (< 70%)
    const isHeightDiscrepancy = (renderedContentHeight / scrollHeight) < 0.7;

    // If rendered rows account for >= 85% of total scrollHeight and no virtual markers exist,
    // then all rows are already in DOM (regular table inside an overflow: auto div).
    if (renderedContentHeight >= scrollHeight * 0.85 && !hasVirtualSpacer && !hasVirtualGridClass) {
      return {
        isCandidate: false,
        hasHorizontalVirtualization,
        container,
        scrollHeight,
        clientHeight,
        renderedRowCount
      };
    }

    const isCandidate = isHeightDiscrepancy || hasVirtualSpacer || hasVirtualGridClass;
    let reason = '';
    if (isCandidate) {
      reason = `Scrollable height (${scrollHeight}px) exceeds DOM rows (${renderedRowCount} rows ~${Math.round(renderedContentHeight)}px)`;
    }

    return {
      isCandidate,
      reason,
      hasHorizontalVirtualization,
      container,
      scrollHeight,
      clientHeight,
      renderedRowCount
    };
  }

  /**
   * Settle wait helper with MutationObserver + debounce.
   */
  function waitForDOMSettle(container, debounceMs = 120, maxTimeoutMs = 3000, signal = null) {
    return new Promise((resolve) => {
      if (signal?.aborted) {
        resolve(false);
        return;
      }

      let debounceTimer = null;
      let maxTimer = null;
      let observer = null;

      const cleanup = () => {
        if (observer) observer.disconnect();
        if (debounceTimer) clearTimeout(debounceTimer);
        if (maxTimer) clearTimeout(maxTimer);
        if (signal) signal.removeEventListener('abort', onAbort);
      };

      const done = (result) => {
        cleanup();
        resolve(result);
      };

      const onAbort = () => done(false);
      if (signal) signal.addEventListener('abort', onAbort);

      const resetDebounce = () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          done(true);
        }, debounceMs);
      };

      observer = new MutationObserver(() => {
        resetDebounce();
      });

      try {
        observer.observe(container, {
          childList: true,
          subtree: true,
          characterData: true,
          attributes: false
        });
      } catch (_) {}

      resetDebounce();

      maxTimer = setTimeout(() => {
        done(true);
      }, maxTimeoutMs);
    });
  }

  /**
   * Scans document for HTML tables and data grids.
   */
  function scanPageTables() {
    detectedTables = [];
    const elements = Array.from(document.querySelectorAll(
      'table, [role="grid"], [role="table"], .data-grid, .virtual-grid, .ag-root'
    ));

    // Filter out nested tables or zero-dimension tables
    const uniqueElements = elements.filter(el => {
      const rect = el.getBoundingClientRect();
      return rect.width > 50 && rect.height > 20;
    });

    uniqueElements.forEach((el, index) => {
      const id = `te-table-${index + 1}`;
      el.setAttribute('data-te-id', id);

      // Determine table title
      let title = '';
      if (el.tagName.toLowerCase() === 'table') {
        const caption = el.querySelector('caption');
        if (caption) title = caption.textContent.trim();
      }
      if (!title && el.getAttribute('aria-label')) {
        title = el.getAttribute('aria-label');
      }
      if (!title) {
        // Look for preceding heading
        let prev = el.previousElementSibling;
        while (prev && !/^h[1-6]$/i.test(prev.tagName)) {
          prev = prev.previousElementSibling;
        }
        if (prev) title = prev.textContent.trim();
      }
      if (!title) {
        title = `Table ${index + 1} (${el.tagName.toLowerCase()})`;
      }

      const headers = extractHeaders(el);
      const visibleRows = getVisibleRowElements(el);
      const virtInfo = detectVirtualizationCandidate(el);

      detectedTables.push({
        id,
        element: el,
        title,
        headers,
        visibleRowCount: visibleRows.length,
        colCount: headers.length || (visibleRows[0] ? extractRowValues(visibleRows[0]).length : 0),
        isVirtualized: virtInfo.isCandidate,
        virtReason: virtInfo.reason || '',
        hasHorizontalVirtualization: virtInfo.hasHorizontalVirtualization
      });
    });

    return detectedTables.map(t => ({
      id: t.id,
      title: t.title,
      headers: t.headers,
      visibleRowCount: t.visibleRowCount,
      colCount: t.colCount,
      isVirtualized: t.isVirtualized,
      virtReason: t.virtReason,
      hasHorizontalVirtualization: t.hasHorizontalVirtualization
    }));
  }

  /**
   * Highlights table on page temporarily.
   */
  function highlightTable(tableId) {
    if (currentlyHighlightedEl) {
      currentlyHighlightedEl.style.outline = '';
      currentlyHighlightedEl.style.outlineOffset = '';
    }
    const tableItem = detectedTables.find(t => t.id === tableId);
    if (tableItem && tableItem.element) {
      currentlyHighlightedEl = tableItem.element;
      tableItem.element.style.outline = '3px solid #0284c7';
      tableItem.element.style.outlineOffset = '2px';
      tableItem.element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  /**
   * Static table capture.
   */
  function captureStaticTable(tableId, options = {}) {
    const tableItem = detectedTables.find(t => t.id === tableId);
    if (!tableItem || !tableItem.element) {
      throw new Error(`Table ${tableId} not found.`);
    }

    const includeHidden = Boolean(options.includeHiddenCols || options.includeHidden);
    const headers = extractHeaders(tableItem.element, includeHidden);
    const rowEls = getVisibleRowElements(tableItem.element);
    const rows = rowEls.map(r => extractRowValues(r, includeHidden)).filter(r => r.length > 0 && !r.every(c => c === ''));

    return {
      headers,
      rows,
      totalRows: rows.length,
      title: tableItem.title
    };
  }

  /**
   * Executes accumulate-while-scrolling capture.
   */
  async function runVirtualizedCapture(tableId, options = {}) {
    const tableItem = detectedTables.find(t => t.id === tableId);
    if (!tableItem || !tableItem.element) {
      throw new Error(`Table ${tableId} not found.`);
    }

    const targetElement = tableItem.element;
    const container = findScrollContainer(targetElement);
    if (!container) {
      throw new Error('Could not identify scrollable container.');
    }

    // Set up abort controller
    activeCaptureAbortController = new AbortController();
    const abortSignal = activeCaptureAbortController.signal;

    const originalScrollTop = container.scrollTop;
    const originalScrollLeft = container.scrollLeft;
    const originalOverflowAnchor = container.style ? container.style.overflowAnchor : '';
    if (container.style) {
      container.style.overflowAnchor = 'none';
    }

    const slowSite = Boolean(options.slowSite);
    const includeHiddenCols = Boolean(options.includeHiddenCols);
    const maxRows = options.maxRows || 5000;
    const rowRange = options.rowRange || null;
    const effectiveMaxRows = (rowRange && typeof rowRange.to === 'number')
      ? Math.max(maxRows, rowRange.to)
      : maxRows;

    const headers = extractHeaders(targetElement, includeHiddenCols);
    const accumulatedMap = new Map();
    let warning = null;
    let capped = false;
    let aborted = false;

    const hasHorizontal = detectHorizontalVirtualization(targetElement, container);
    if (hasHorizontal) {
      warning = 'Horizontal virtualization not yet supported — some columns may be missing';
    }

    const settleDelayMs = slowSite ? Math.max(options.settleDelayMs || 250, 250) : (options.settleDelayMs || 120);
    const maxSettleTimeoutMs = slowSite ? Math.max(options.maxSettleTimeoutMs || 6000, 6000) : (options.maxSettleTimeoutMs || 3000);
    const maxSteps = options.maxSteps || 500;

    const extractRows = () => {
      const rowEls = getVisibleRowElements(targetElement);
      let count = 0;
      for (const rowEl of rowEls) {
        const values = extractRowValues(rowEl, includeHiddenCols);
        if (values.length === 0 || values.every(v => v === '')) continue;
        const key = getRowIdentityKey(rowEl, values);
        if (!accumulatedMap.has(key)) {
          accumulatedMap.set(key, values);
          count++;
        }
      }
      return count;
    };

    try {
      // 1. Scroll to top
      if (container.scrollTop > 0) {
        container.scrollTop = 0;
      }
      await waitForDOMSettle(container, settleDelayMs, 600, abortSignal);

      // Initial capture
      extractRows();

      const sendProgress = (step, isComplete = false) => {
        const clientHeight = container.clientHeight || 400;
        const scrollHeight = container.scrollHeight;
        const maxScrollTop = Math.max(0, scrollHeight - clientHeight);
        const progressPct = maxScrollTop > 0 ? Math.min(100, Math.round((container.scrollTop / maxScrollTop) * 100)) : 100;

        try {
          if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
            chrome.runtime.sendMessage({
              action: 'TE_CAPTURE_PROGRESS',
              scannedRows: accumulatedMap.size,
              currentStep: step,
              progressPct: isComplete ? 100 : progressPct,
              isComplete
            });
          }
        } catch (_) {}
      };

      sendProgress(0);

      let step = 0;
      let consecutiveZeroNew = 0;
      let snapBackCount = 0;
      let lastScrollTop = container.scrollTop;

      while (step < maxSteps) {
        if (abortSignal.aborted) {
          aborted = true;
          break;
        }

        // Check user-configured Max Rows cap
        if (accumulatedMap.size >= effectiveMaxRows) {
          warning = warning ? `${warning} Stopped after reaching max rows limit of ${maxRows}.` : `Stopped after reaching max rows limit of ${maxRows}.`;
          break;
        }

        // Early stop if rowRange.to has been captured
        if (rowRange && typeof rowRange.to === 'number' && accumulatedMap.size >= rowRange.to) {
          break;
        }

        step++;
        const clientHeight = container.clientHeight || 400;
        const scrollHeight = container.scrollHeight;
        const maxScrollTop = Math.max(0, scrollHeight - clientHeight);

        const increment = options.scrollIncrement || Math.max(80, Math.floor(clientHeight * 0.8));
        const targetScrollTop = Math.min(maxScrollTop, container.scrollTop + increment);

        const prevScrollTop = container.scrollTop;
        container.scrollTop = targetScrollTop;
        await new Promise(r => setTimeout(r, 20));

        // Snap-back detection
        if (targetScrollTop > prevScrollTop && container.scrollTop <= prevScrollTop && prevScrollTop < maxScrollTop - 2) {
          snapBackCount++;
          if (snapBackCount >= 2) {
            throw new Error("This table's scrolling behavior isn't compatible with capture. Try 'Just visible rows' instead.");
          }
        } else {
          snapBackCount = 0;
        }

        // Wait for DOM mutation settle
        await waitForDOMSettle(container, settleDelayMs, maxSettleTimeoutMs, abortSignal);

        if (abortSignal.aborted) {
          aborted = true;
          break;
        }

        const newRows = extractRows();
        if (accumulatedMap.size >= maxRows) {
          const capMsg = `Stopped after reaching max rows limit of ${maxRows}.`;
          warning = warning ? `${warning} ${capMsg}` : capMsg;
          break;
        }

        if (newRows === 0) {
          consecutiveZeroNew++;
        } else {
          consecutiveZeroNew = 0;
        }

        sendProgress(step);

        // Stop if bottom reached and no new rows
        const atBottom = container.scrollTop >= maxScrollTop - 2;
        if (atBottom && consecutiveZeroNew >= 1) {
          await waitForDOMSettle(container, 150, 400, abortSignal);
          extractRows();
          break;
        }

        if (container.scrollTop === lastScrollTop && consecutiveZeroNew >= 2) {
          if (targetScrollTop > container.scrollTop && targetScrollTop < maxScrollTop) {
            throw new Error("This table's scrolling behavior isn't compatible with capture. Try 'Just visible rows' instead.");
          }
          break;
        }
        lastScrollTop = container.scrollTop;
      }

      if (step >= maxSteps) {
        capped = true;
        const capMsg = `Stopped after 500 scroll steps (${accumulatedMap.size} rows captured) — the table may be larger than what was captured.`;
        warning = warning ? `${warning} ${capMsg}` : capMsg;
      }

    } finally {
      // Restore original scroll position and overflow-anchor
      try {
        container.scrollTop = originalScrollTop;
        container.scrollLeft = originalScrollLeft;
        if (container.style) {
          container.style.overflowAnchor = originalOverflowAnchor;
        }
      } catch (_) {}
      activeCaptureAbortController = null;
    }

    let rows = Array.from(accumulatedMap.values());
    if (rows.length > effectiveMaxRows) {
      rows = rows.slice(0, effectiveMaxRows);
    }

    // Handle optional row range selection [from..to]
    if (rowRange && (typeof rowRange.from === 'number' || typeof rowRange.to === 'number')) {
      const from = typeof rowRange.from === 'number' ? rowRange.from : 1;
      const to = typeof rowRange.to === 'number' ? rowRange.to : rows.length;
      const fromIdx = Math.max(0, from - 1);
      const toIdx = Math.min(rows.length, to);
      rows = rows.slice(fromIdx, toIdx);
    }
    return {
      headers,
      rows,
      totalRows: rows.length,
      warning,
      capped,
      aborted,
      title: tableItem.title
    };
  }

  function cancelActiveCapture() {
    if (activeCaptureAbortController) {
      activeCaptureAbortController.abort();
    }
  }

  // Runtime message dispatcher
  if (typeof chrome !== 'undefined' && chrome?.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      const action = message.action;

      if (action === 'TE_SCAN_TABLES') {
        const tables = scanPageTables();
        sendResponse({ status: 'ok', tables });
        return true;
      }

      if (action === 'TE_HIGHLIGHT_TABLE') {
        highlightTable(message.tableId);
        sendResponse({ status: 'ok' });
        return true;
      }

      if (action === 'TE_CAPTURE_STATIC') {
        try {
          const result = captureStaticTable(message.tableId, message.options);
          sendResponse({ status: 'ok', data: result });
        } catch (err) {
          sendResponse({ status: 'error', error: err.message });
        }
        return true;
      }

      if (action === 'TE_START_VIRTUALIZED_CAPTURE') {
        (async () => {
          try {
            const result = await runVirtualizedCapture(message.tableId, message.options);
            sendResponse({ status: 'ok', data: result });
          } catch (err) {
            sendResponse({ status: 'error', error: err.message });
          }
        })();
        return true; // Keep message channel open for async response
      }

      if (action === 'TE_CANCEL_CAPTURE') {
        cancelActiveCapture();
        sendResponse({ status: 'ok' });
        return true;
      }

      return false;
    });
  }

  // Expose API on window for testing and extension consumption
  window.TableExtractor = {
    scanPageTables,
    captureStaticTable,
    runVirtualizedCapture,
    cancelActiveCapture,
    findScrollContainer,
    detectVirtualizationCandidate,
    detectHorizontalVirtualization,
    getVisibleRowElements,
    extractHeaders,
    extractRowValues,
    getRowIdentityKey,
    hashString
  };
})();
