/**
 * Table Extractor - Virtualized / Scroll-Loaded Table Capture Engine
 * 
 * Provides:
 * 1. Virtualization candidate detection (scrollHeight vs clientHeight, DOM row constancy).
 * 2. Horizontal virtualization detection (column virtualization warning).
 * 3. Scroll container identification (inner div with overflow: auto/scroll vs window).
 * 4. Step-by-step programmatic scrolling with MutationObserver + settle debounce.
 * 5. Robust row extraction and deduplication (data-row-id/id preference, cell hash fallback).
 * 6. Snap-back detection (abort if container resets scroll).
 * 7. Safety cap (500 steps) and cancellation support (AbortSignal).
 * 8. Scroll position restoration.
 */

/**
 * Fast 32-bit FNV-1a hash algorithm for strings.
 * Used for deterministic row content hashing when no stable DOM ID exists.
 * @param {string} str 
 * @returns {string} Hex string representation
 */
export function hashString(str) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16);
}

/**
 * Traverses up the DOM tree from a target table/grid to find its true scroll container.
 * Inspects overflow-y properties and compares scrollHeight against clientHeight.
 * @param {HTMLElement} element 
 * @returns {HTMLElement} Scrollable container element or document.scrollingElement
 */
export function findScrollContainer(element) {
  if (!element || !(element instanceof HTMLElement)) {
    return document.scrollingElement || document.documentElement;
  }

  // Check element itself first (common in div-based data grids)
  const selfStyle = window.getComputedStyle(element);
  const selfOverflowY = selfStyle.overflowY;
  if ((selfOverflowY === 'auto' || selfOverflowY === 'scroll') && element.scrollHeight > element.clientHeight + 10) {
    return element;
  }

  // Check parent elements
  let current = element.parentElement;
  while (current && current !== document.body && current !== document.documentElement) {
    const style = window.getComputedStyle(current);
    const overflowY = style.overflowY;
    const isScrollable = (overflowY === 'auto' || overflowY === 'scroll');
    if (isScrollable && current.scrollHeight > current.clientHeight + 10) {
      return current;
    }
    current = current.parentElement;
  }

  // Check body / documentElement
  if (document.scrollingElement && document.scrollingElement.scrollHeight > document.scrollingElement.clientHeight + 10) {
    return document.scrollingElement;
  }

  return element;
}

/**
 * Inspects a table/grid element to detect if columns are virtualized horizontally.
 * @param {HTMLElement} element 
 * @param {HTMLElement} scrollContainer 
 * @returns {boolean}
 */
export function detectHorizontalVirtualization(element, scrollContainer) {
  const container = scrollContainer || findScrollContainer(element);
  
  // Check if container or element has significant horizontal overflow
  const isHorizontallyScrollable = 
    (container.scrollWidth > container.clientWidth * 1.5) ||
    (element.scrollWidth > element.clientWidth * 1.5);

  if (!isHorizontallyScrollable) {
    return false;
  }

  // Look for horizontal spacers or transform translateX or aria-colindex virtualization
  const hasColSpacers = !!element.querySelector(
    '.virtual-col-spacer, [style*="translateX"], [style*="width:"][style*="min-width:"], [aria-colindex]'
  );

  return isHorizontallyScrollable && hasColSpacers;
}

/**
 * Checks whether a table or grid is a candidate for virtualization.
 * 
 * Criteria:
 * 1. Scroll container's scrollHeight significantly exceeds clientHeight (e.g. > 1.4x).
 * 2. Either virtual spacers exist (.spacer, padding-top/bottom, transform: translateY),
 *    OR the rendered DOM row count * average row height is significantly smaller than scrollHeight.
 * 
 * @param {HTMLElement} element 
 * @returns {{
 *   isCandidate: boolean,
 *   reason?: string,
 *   hasHorizontalVirtualization: boolean,
 *   container: HTMLElement,
 *   scrollHeight: number,
 *   clientHeight: number,
 *   renderedRowCount: number
 * }}
 */
export function detectVirtualizationCandidate(element) {
  if (!element || !(element instanceof HTMLElement)) {
    return { isCandidate: false, hasHorizontalVirtualization: false, container: null };
  }

  const container = findScrollContainer(element);
  const scrollHeight = container.scrollHeight;
  const clientHeight = container.clientHeight;
  const hasHorizontalVirtualization = detectHorizontalVirtualization(element, container);

  // If container cannot scroll vertically, it cannot be vertically virtualized
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

  // Find all row elements currently rendered in DOM
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

  // Measure average row height
  const sampleRow = rowElements[Math.min(2, renderedRowCount - 1)];
  const rowRect = sampleRow.getBoundingClientRect();
  const avgRowHeight = rowRect.height > 0 ? rowRect.height : 30;

  // Expected total DOM height if all rows were rendered simultaneously
  const renderedContentHeight = renderedRowCount * avgRowHeight;

  // For page-level scrolling containers (body / html):
  // Standard tables on scrollable pages are NOT virtualized unless they have virtual markers
  const isPageContainer = (container === document.scrollingElement || container === document.documentElement || container === document.body);

  const hasVirtualSpacer = !!container.querySelector(
    '.virtual-spacer, .virtual-padding, [style*="translateY"], [style*="padding-top"], [style*="padding-bottom"], [style*="position: absolute"]'
  );

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
    reason = `Scroll height (${scrollHeight}px) exceeds rendered rows (${renderedRowCount} rows ~${Math.round(renderedContentHeight)}px)`;
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
 * Extracts all row elements from a table or grid container.
 * Supports standard HTML <tr> elements and ARIA/div grid rows.
 * @param {HTMLElement} tableOrGrid 
 * @returns {HTMLElement[]}
 */
export function getVisibleRowElements(tableOrGrid) {
  if (!tableOrGrid) return [];

  // 1. Check for standard <tr> elements inside tbody or direct children
  const tbodyRows = Array.from(tableOrGrid.querySelectorAll('tbody > tr'));
  if (tbodyRows.length > 0) return tbodyRows;

  const directRows = Array.from(tableOrGrid.querySelectorAll('tr')).filter(tr => !tr.closest('thead'));
  if (directRows.length > 0) return directRows;

  // 2. Check for ARIA role="row"
  const ariaRows = Array.from(tableOrGrid.querySelectorAll('[role="row"]')).filter(row => {
    // Exclude header rows
    return !row.closest('[role="columnheader"]') && !row.querySelector('[role="columnheader"]');
  });
  if (ariaRows.length > 0) return ariaRows;

  // 3. Check for common class names in modern frameworks (.grid-row, .table-row, .row)
  const classRows = Array.from(tableOrGrid.querySelectorAll('.grid-row, .virtual-row, .data-row, .table-row'));
  if (classRows.length > 0) return classRows;

  return [];
}

/**
 * Helper to check if a DOM element is visible or hidden via CSS / attributes.
 * @param {HTMLElement} el 
 * @returns {boolean}
 */
export function isElementVisible(el) {
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
 * Extracts table column headers.
 * Looks in <thead>, <th> elements, or role="columnheader".
 * @param {HTMLElement} tableOrGrid 
 * @param {boolean} [includeHidden=false]
 * @returns {string[]}
 */
export function extractHeaders(tableOrGrid, includeHidden = false) {
  if (!tableOrGrid) return [];

  const filterCells = (elements) => {
    return elements.filter(el => includeHidden || isElementVisible(el));
  };

  // 1. Standard <th> elements in thead or first tr
  const theadThs = filterCells(Array.from(tableOrGrid.querySelectorAll('thead th, thead td')));
  if (theadThs.length > 0) {
    return theadThs.map(th => th.textContent.trim());
  }

  // 2. ARIA role="columnheader"
  const ariaHeaders = filterCells(Array.from(tableOrGrid.querySelectorAll('[role="columnheader"]')));
  if (ariaHeaders.length > 0) {
    return ariaHeaders.map(h => h.textContent.trim());
  }

  // 3. Header row with class .grid-header or .header-cell
  const headerCells = filterCells(Array.from(tableOrGrid.querySelectorAll('.grid-header .cell, .grid-header-cell, .header-cell')));
  if (headerCells.length > 0) {
    return headerCells.map(c => c.textContent.trim());
  }

  // 4. First <tr> if it contains <th>
  const firstRow = tableOrGrid.querySelector('tr');
  if (firstRow && firstRow.querySelector('th')) {
    return filterCells(Array.from(firstRow.querySelectorAll('th'))).map(th => th.textContent.trim());
  }

  return [];
}

/**
 * Extracts text content array from a row element.
 * @param {HTMLElement} rowElement 
 * @param {boolean} [includeHidden=false]
 * @returns {string[]}
 */
export function extractRowValues(rowElement, includeHidden = false) {
  if (!rowElement) return [];

  const filterCells = (elements) => {
    return elements.filter(el => includeHidden || isElementVisible(el));
  };

  // Check <td> or <th>
  const cells = filterCells(Array.from(rowElement.querySelectorAll('td, th')));
  if (cells.length > 0) {
    return cells.map(c => c.textContent.trim().replace(/\s+/g, ' '));
  }

  // Check ARIA role="gridcell" or role="cell"
  const ariaCells = filterCells(Array.from(rowElement.querySelectorAll('[role="gridcell"], [role="cell"]')));
  if (ariaCells.length > 0) {
    return ariaCells.map(c => c.textContent.trim().replace(/\s+/g, ' '));
  }

  // Check direct children with cell classes
  const classCells = filterCells(Array.from(rowElement.querySelectorAll('.cell, .grid-cell, .data-cell')));
  if (classCells.length > 0) {
    return classCells.map(c => c.textContent.trim().replace(/\s+/g, ' '));
  }

  // Fallback: direct children
  return filterCells(Array.from(rowElement.children)).map(c => c.textContent.trim().replace(/\s+/g, ' '));
}

/**
 * Computes a unique and stable identity key for a row element.
 * Prioritizes explicit identifiers (data-row-id, id, dataset.key, data-id)
 * and falls back to a deterministic hash of the cell contents.
 * @param {HTMLElement} rowElement 
 * @param {string[]} cellValues 
 * @returns {string} Unique row identity key
 */
export function getRowIdentityKey(rowElement, cellValues) {
  // 1. Stable explicit attributes
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

  // 2. Fallback: Content hash
  const normalizedContent = (cellValues || []).join('||~||');
  return `hash:${hashString(normalizedContent)}`;
}

/**
 * Waits for DOM mutations to settle on a target container.
 * Uses a MutationObserver combined with a debounce delay.
 * Also enforces a maximum settle timeout (e.g. 3000ms / 6000ms) to accommodate network latency.
 * 
 * @param {HTMLElement} container 
 * @param {number} debounceMs Settle debounce after last mutation (e.g. 120ms)
 * @param {number} maxTimeoutMs Maximum wait time if no mutation occurs or slow network (e.g. 3000ms / 6000ms)
 * @param {AbortSignal} [signal] 
 * @returns {Promise<boolean>} Resolves true when mutations settled, false on timeout/abort
 */
export function waitForDOMSettle(container, debounceMs = 120, maxTimeoutMs = 3000, signal = null) {
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

    // Debounce timer handler: when no mutations occur for debounceMs, consider settled
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
    } catch (err) {
      // In case container cannot be observed
      console.warn('[TableExtractor] MutationObserver observe failed:', err);
    }

    // Start initial debounce timer (if DOM was already updated synchronously or fast)
    resetDebounce();

    // Enforce safety cap on waiting (network latency ceiling)
    maxTimer = setTimeout(() => {
      done(true);
    }, maxTimeoutMs);
  });
}

/**
 * Executes the accumulate-while-scrolling capture strategy on a table or grid.
 * 
 * @param {HTMLElement} tableOrGrid 
 * @param {object} options
 * @param {number} [options.scrollIncrement] Pixels to scroll each step (defaults to ~80% clientHeight)
 * @param {number} [options.settleDelayMs] Debounce wait after DOM mutation (default: 120ms)
 * @param {number} [options.maxSettleTimeoutMs] Max wait per step for slow network (default: 3000ms, or 6000ms if slowSite)
 * @param {number} [options.maxSteps] Safety iteration cap (default: 500)
 * @param {number} [options.maxRows] User-defined row limit (default: 5000)
 * @param {boolean} [options.slowSite] Extend settle window up to 6s for laggy infinite-scroll APIs
 * @param {boolean} [options.includeHiddenCols] Include columns hidden via CSS
 * @param {{ from?: number, to?: number }} [options.rowRange] Slice rows to [from..to]
 * @param {Function} [onProgress] Callback ({ scannedRows, currentStep, estimatedProgress, isComplete })
 * @param {AbortSignal} [abortSignal] AbortSignal to cancel capture
 * @returns {Promise<{
 *   headers: string[],
 *   rows: any[][],
 *   totalRows: number,
 *   warning?: string,
 *   capped: boolean,
 *   aborted: boolean
 * }>}
 */
export async function captureVirtualizedTable(
  tableOrGrid,
  options = {},
  onProgress = null,
  abortSignal = null
) {
  if (!tableOrGrid || !(tableOrGrid instanceof HTMLElement)) {
    throw new Error('Valid table or data grid element is required.');
  }

  const container = findScrollContainer(tableOrGrid);
  if (!container) {
    throw new Error('Unable to determine scrollable container.');
  }

  // Check for horizontal virtualization edge case
  const hasHorizontalVirtualization = detectHorizontalVirtualization(tableOrGrid, container);

  const slowSite = Boolean(options.slowSite);
  const includeHiddenCols = Boolean(options.includeHiddenCols);
  const maxRows = options.maxRows || 5000;
  const rowRange = options.rowRange || null;

  const settleDelayMs = slowSite ? Math.max(options.settleDelayMs || 250, 250) : (options.settleDelayMs || 120);
  const maxSettleTimeoutMs = slowSite ? Math.max(options.maxSettleTimeoutMs || 6000, 6000) : (options.maxSettleTimeoutMs || 3000);
  const maxSteps = options.maxSteps || 500;

  // Extract column headers
  const headers = extractHeaders(tableOrGrid, includeHiddenCols);

  // Save original scroll position to restore at the end
  const originalScrollTop = container.scrollTop;
  const originalScrollLeft = container.scrollLeft;
  const originalOverflowAnchor = container.style ? container.style.overflowAnchor : '';
  if (container.style) {
    container.style.overflowAnchor = 'none';
  }

  // Accumulator map: key -> row values
  const accumulatedRowsMap = new Map();
  let capped = false;
  let warning = null;
  let aborted = false;

  if (hasHorizontalVirtualization) {
    warning = 'Horizontal virtualization not yet supported — some columns may be missing';
  }

  try {
    // 1. Scroll to very top first to ensure complete dataset capture from row 0
    if (container.scrollTop > 0) {
      container.scrollTop = 0;
      await waitForDOMSettle(container, settleDelayMs, 600, abortSignal);
    }

    let step = 0;
    let consecutiveNoNewRows = 0;
    let lastScrollTop = container.scrollTop;
    let snapBackCount = 0;

    // Helper to extract currently visible rows and merge
    const extractCurrentStepRows = () => {
      const rowEls = getVisibleRowElements(tableOrGrid);
      let newRowsCount = 0;
      for (const rowEl of rowEls) {
        const values = extractRowValues(rowEl, includeHiddenCols);
        if (values.length === 0 || values.every(v => v === '')) {
          continue; // Skip empty rows
        }
        const key = getRowIdentityKey(rowEl, values);
        if (!accumulatedRowsMap.has(key)) {
          accumulatedRowsMap.set(key, values);
          newRowsCount++;
        }
      }
      return newRowsCount;
    };

    // Initial capture at top
    extractCurrentStepRows();

    if (onProgress) {
      onProgress({
        scannedRows: accumulatedRowsMap.size,
        currentStep: step,
        estimatedProgress: 0,
        isComplete: false
      });
    }

    // Programmatic scrolling loop
    while (step < maxSteps) {
      if (abortSignal?.aborted) {
        aborted = true;
        break;
      }

      // Check user-configured Max Rows cap
      if (accumulatedRowsMap.size >= maxRows) {
        warning = warning ? `${warning} Stopped after reaching max rows limit of ${maxRows}.` : `Stopped after reaching max rows limit of ${maxRows}.`;
        break;
      }

      step++;

      const clientHeight = container.clientHeight || 400;
      const scrollHeight = container.scrollHeight;
      const maxScrollTop = Math.max(0, scrollHeight - clientHeight);

      // Determine step increment (80% of viewport to avoid skipping rows at boundary)
      const increment = options.scrollIncrement || Math.max(80, Math.floor(clientHeight * 0.8));
      const targetScrollTop = Math.min(maxScrollTop, container.scrollTop + increment);

      // Edge case: Container that resets scroll position itself (snap-back detection)
      const prevScrollTop = container.scrollTop;
      container.scrollTop = targetScrollTop;

      // Allow 20ms for browser to register scroll
      await new Promise(r => setTimeout(r, 20));

      // Check if container snapped back or refused to scroll
      if (targetScrollTop > prevScrollTop && container.scrollTop <= prevScrollTop && prevScrollTop < maxScrollTop - 2) {
        snapBackCount++;
        if (snapBackCount >= 2) {
          throw new Error("This table's scrolling behavior isn't compatible with capture. Try 'Just visible rows' instead.");
        }
      } else {
        snapBackCount = 0;
      }

      // Wait for new rows to render using MutationObserver + settle debounce
      await waitForDOMSettle(container, settleDelayMs, maxSettleTimeoutMs, abortSignal);

      if (abortSignal?.aborted) {
        aborted = true;
        break;
      }

      // Extract visible rows after scroll
      const newRowsAdded = extractCurrentStepRows();
      if (accumulatedRowsMap.size >= maxRows) {
        const capMsg = `Stopped after reaching max rows limit of ${maxRows}.`;
        warning = warning ? `${warning} ${capMsg}` : capMsg;
        break;
      }

      if (newRowsAdded === 0) {
        consecutiveNoNewRows++;
      } else {
        consecutiveNoNewRows = 0;
      }

      // Progress reporting
      const currentScroll = container.scrollTop;
      const progressFraction = maxScrollTop > 0 ? Math.min(1, currentScroll / maxScrollTop) : 1;
      
      if (onProgress) {
        onProgress({
          scannedRows: accumulatedRowsMap.size,
          currentStep: step,
          estimatedProgress: Math.round(progressFraction * 100),
          isComplete: false
        });
      }

      // Stop condition: reached bottom AND no new rows appear after settle delay
      const atBottom = container.scrollTop >= maxScrollTop - 2;
      if (atBottom && consecutiveNoNewRows >= 1) {
        // Double-check with an extra short settle to be completely sure
        await waitForDOMSettle(container, 200, 500, abortSignal);
        extractCurrentStepRows();
        break;
      }

      // Stop condition: no progress in scroll position and no new rows
      if (container.scrollTop === lastScrollTop && consecutiveNoNewRows >= 2) {
        if (targetScrollTop > container.scrollTop && targetScrollTop < maxScrollTop) {
          throw new Error("This table's scrolling behavior isn't compatible with capture. Try 'Just visible rows' instead.");
        }
        break;
      }

      lastScrollTop = container.scrollTop;
    }

    if (step >= maxSteps) {
      capped = true;
      const capMsg = `Stopped after 500 scroll steps (${accumulatedRowsMap.size} rows captured) — the table may be larger than what was captured.`;
      warning = warning ? `${warning} ${capMsg}` : capMsg;
    }

  } finally {
    // Restore original scroll position so user's view isn't left at bottom
    try {
      container.scrollTop = originalScrollTop;
      container.scrollLeft = originalScrollLeft;
      if (container.style) {
        container.style.overflowAnchor = originalOverflowAnchor;
      }
    } catch (err) {
      console.warn('[TableExtractor] Error restoring scroll position:', err);
    }
  }

  let rows = Array.from(accumulatedRowsMap.values());
  if (rows.length > maxRows) {
    rows = rows.slice(0, maxRows);
  }

  // Handle optional row range selection [from..to]
  if (rowRange && typeof rowRange.from === 'number' && typeof rowRange.to === 'number') {
    const fromIdx = Math.max(0, rowRange.from - 1);
    const toIdx = Math.min(rows.length, rowRange.to);
    rows = rows.slice(fromIdx, toIdx);
  }

  if (onProgress) {
    onProgress({
      scannedRows: rows.length,
      currentStep: maxSteps,
      estimatedProgress: 100,
      isComplete: true,
      aborted
    });
  }

  return {
    headers,
    rows,
    totalRows: rows.length,
    warning: warning || undefined,
    capped,
    aborted
  };
}
