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

    // Check if element contains an inner scrollable viewport (e.g. .ag-body-viewport)
    try {
      const candidateViewports = Array.from(element.querySelectorAll(
        '.ag-body-viewport, .ag-center-cols-viewport, .grid-viewport, .virtual-viewport, [class*="viewport"], [class*="scroll"], [role="rowgroup"]'
      ));
      for (const vp of candidateViewports) {
        if (vp instanceof HTMLElement) {
          const vpStyle = window.getComputedStyle(vp);
          const vpOverflowY = vpStyle.overflowY;
          if ((vpOverflowY === 'auto' || vpOverflowY === 'scroll') && vp.scrollHeight > vp.clientHeight + 10) {
            return vp;
          }
        }
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
   * Detects whether a cell/column is a pure row-selection or select-all checkbox control
   * (e.g. AG Grid's selection column, __check__, or checkbox without business text).
   * These are UI controls rather than data columns and should be excluded from exports.
   */
  function isSelectionColumn(cell) {
    if (!cell || !(cell instanceof HTMLElement)) return false;

    const colId = (
      cell.getAttribute('col-id') ||
      cell.getAttribute('data-col-id') ||
      cell.getAttribute('data-field') ||
      cell.id ||
      ''
    ).toLowerCase();

    // If column id explicitly indicates selection or checkbox control (and not a business field like bought/verified/active/status)
    const isSelectionId = /selection|checkbox|__check__/.test(colId) && !/bought|active|enabled|status|verified|flag|completed|done|is_/.test(colId);
    if (isSelectionId) return true;

    const hasCheckbox = !!cell.querySelector('input[type="checkbox"], .ag-checkbox, [role="checkbox"], .ag-selection-checkbox');
    const text = (cell.innerText || cell.textContent || '').trim();
    const ariaLabel = (cell.getAttribute('aria-label') || '').toLowerCase();

    // If cell has a checkbox control and no business text (or text / ariaLabel explicitly says select all / toggle)
    if (hasCheckbox && (text === '' || /select all|toggle all|select row|toggle row/i.test(ariaLabel) || /select all|toggle all/i.test(text))) {
      return true;
    }

    // Class-based selection detection
    if (cell.classList.contains('ag-selection-checkbox') || cell.classList.contains('selection-cell') || cell.classList.contains('select-cell')) {
      return true;
    }

    return false;
  }

  /**
   * Builds a column schema for a table or data grid.
   * Accurately detects the leaf header row (avoiding group headers and filter inputs),
   * identifies column identifiers (col-id, aria-colindex), filters out pure selection columns,
   * and extracts clean header labels.
   */
  function buildColumnSchema(tableOrGrid, includeHidden = false) {
    if (!tableOrGrid || !(tableOrGrid instanceof HTMLElement)) {
      return { headers: [], schema: [] };
    }

    // 1. Standard HTML <thead> elements
    const thead = tableOrGrid.querySelector('thead');
    if (thead) {
      const trs = Array.from(thead.querySelectorAll('tr')).filter(tr => includeHidden || isElementVisible(tr));
      // Traverse in reverse to find the leaf header row (last tr containing th or td)
      for (let i = trs.length - 1; i >= 0; i--) {
        const cells = Array.from(trs[i].querySelectorAll('th, td')).filter(c => includeHidden || isElementVisible(c));
        if (cells.length > 0) {
          const schema = [];
          cells.forEach((c, idx) => {
            if (isSelectionColumn(c)) return;
            const colId = c.getAttribute('col-id') || c.getAttribute('data-col-id') || c.getAttribute('data-field') || c.id || null;
            let name = c.innerText?.trim() || '';
            if (!name) {
              name = c.getAttribute('aria-label')?.trim() || c.getAttribute('title')?.trim() || '';
            }
            if (!name && colId) {
              name = colId === 'ag-Grid-RowNumbersColumn' ? 'Row Number' : colId.replace(/^.*[._]/, '');
            }
            if (!name) name = `Column ${idx + 1}`;

            schema.push({
              index: idx,
              colId,
              ariaColIndex: c.getAttribute('aria-colindex') || null,
              name
            });
          });
          if (schema.length > 0) {
            return { headers: schema.map(s => s.name), schema };
          }
        }
      }
    }

    // 2. Data grid header rows (.ag-header-row, .grid-header-row, [role="row"] inside header)
    const allHeaderRows = Array.from(tableOrGrid.querySelectorAll('.ag-header-row, .grid-header-row, .header-row, [role="row"]')).filter(r => {
      if (!includeHidden && !isElementVisible(r)) return false;
      return r.closest('.ag-header, .grid-header, [role="rowgroup"]:first-child') || 
             r.querySelector('[role="columnheader"], th, .ag-header-cell');
    });

    // Exclude filter rows and group rows
    const candidateRows = allHeaderRows.filter(r => {
      if (r.classList.contains('ag-header-row-filter') || r.classList.contains('floating-filter-row')) return false;
      if (r.classList.contains('ag-header-row-group')) return false;
      const cells = Array.from(r.querySelectorAll('[role="columnheader"], th, .ag-header-cell'));
      if (cells.length === 0) return false;
      // Check if all cells are floating filters or filter inputs
      const allFilters = cells.every(c => c.classList.contains('ag-floating-filter') || (c.querySelector('input') && !c.innerText?.trim()));
      return !allFilters;
    });

    let bestHeaderRow = null;
    let maxCellCount = -1;

    for (const r of candidateRows) {
      const cells = Array.from(r.querySelectorAll('[role="columnheader"], th, .ag-header-cell')).filter(c => includeHidden || isElementVisible(c));
      if (cells.length > maxCellCount) {
        maxCellCount = cells.length;
        bestHeaderRow = r;
      }
    }

    if (bestHeaderRow) {
      const rawCells = Array.from(bestHeaderRow.querySelectorAll('[role="columnheader"], th, .ag-header-cell')).filter(c => includeHidden || isElementVisible(c));
      const schema = [];
      rawCells.forEach((c, idx) => {
        if (isSelectionColumn(c)) return;
        const colId = c.getAttribute('col-id') || c.getAttribute('data-col-id') || c.getAttribute('data-field') || c.id || null;
        let name = c.innerText?.trim() || '';
        if (!name) {
          name = c.getAttribute('aria-label')?.trim() || c.getAttribute('title')?.trim() || '';
        }
        if (!name && colId) {
          if (colId === 'ag-Grid-RowNumbersColumn') name = 'Row Number';
          else name = colId.replace(/^.*[._]/, '');
        }
        if (!name) name = `Column ${idx + 1}`;

        schema.push({
          index: idx,
          colId,
          ariaColIndex: c.getAttribute('aria-colindex') || null,
          name
        });
      });
      if (schema.length > 0) {
        return { headers: schema.map(s => s.name), schema };
      }
    }

    // 3. Fallback: Flat column headers (e.g. .grid-header > [role="columnheader"])
    const flatHeaders = Array.from(tableOrGrid.querySelectorAll('[role="columnheader"], .grid-header .cell, .grid-header-cell, .header-cell')).filter(c => {
      if (!includeHidden && !isElementVisible(c)) return false;
      if (c.classList.contains('ag-floating-filter') || c.classList.contains('ag-header-group-cell')) return false;
      return true;
    });

    if (flatHeaders.length > 0) {
      const schema = [];
      flatHeaders.forEach((c, idx) => {
        if (isSelectionColumn(c)) return;
        const colId = c.getAttribute('col-id') || c.getAttribute('data-col-id') || c.getAttribute('data-field') || c.id || null;
        let name = c.innerText?.trim() || '';
        if (!name) {
          name = c.getAttribute('aria-label')?.trim() || c.getAttribute('title')?.trim() || '';
        }
        if (!name && colId) {
          name = colId === 'ag-Grid-RowNumbersColumn' ? 'Row Number' : colId.replace(/^.*[._]/, '');
        }
        if (!name) name = `Column ${idx + 1}`;

        schema.push({
          index: idx,
          colId,
          ariaColIndex: c.getAttribute('aria-colindex') || null,
          name
        });
      });
      if (schema.length > 0) {
        return { headers: schema.map(s => s.name), schema };
      }
    }

    // 4. First <tr> if it contains <th>
    const firstRow = tableOrGrid.querySelector('tr');
    if (firstRow) {
      const ths = Array.from(firstRow.querySelectorAll('th')).filter(c => includeHidden || isElementVisible(c));
      if (ths.length > 0) {
        const schema = [];
        ths.forEach((c, idx) => {
          if (isSelectionColumn(c)) return;
          const name = c.innerText?.trim() || c.getAttribute('aria-label')?.trim() || `Column ${idx + 1}`;
          schema.push({
            index: idx,
            colId: c.getAttribute('col-id') || null,
            ariaColIndex: c.getAttribute('aria-colindex') || null,
            name
          });
        });
        return { headers: schema.map(s => s.name), schema };
      }
    }

    return { headers: [], schema: [] };
  }

  /**
   * Extracts column headers.
   * Uses buildColumnSchema to find leaf headers and exclude selection controls.
   */
  function extractHeaders(tableOrGrid, includeHidden = false) {
    const { headers } = buildColumnSchema(tableOrGrid, includeHidden);
    return headers;
  }

  /**
   * Extracts text content array from a row element.
   * Accurately maps cells to schema columns by col-id or aria-colindex when available,
   * handles boolean checkboxes, and extracts image/SVG labels (e.g. star ratings).
   */
  function extractRowValues(rowElement, schemaOrIncludeHidden = null, maybeIncludeHidden = false) {
    if (!rowElement || !(rowElement instanceof HTMLElement)) return [];

    let schema = null;
    let includeHidden = false;

    if (Array.isArray(schemaOrIncludeHidden)) {
      schema = schemaOrIncludeHidden;
      includeHidden = Boolean(maybeIncludeHidden);
    } else if (typeof schemaOrIncludeHidden === 'boolean') {
      includeHidden = schemaOrIncludeHidden;
    }

    // Query all candidate cells including rowheader, gridcell, ag-cell, td, th
    const rawCells = Array.from(rowElement.querySelectorAll(
      'td, th, [role="gridcell"], [role="rowheader"], [role="cell"], .ag-cell, .grid-cell, .data-cell, .cell'
    ));

    // Deduplicate and filter out nested cells (cells that are children of another cell in rawCells)
    const cellSet = new Set(rawCells);
    const uniqueCells = [];
    for (const c of rawCells) {
      if (!includeHidden && !isElementVisible(c)) continue;
      let isChild = false;
      let parent = c.parentElement;
      while (parent && parent !== rowElement) {
        if (cellSet.has(parent)) {
          isChild = true;
          break;
        }
        parent = parent.parentElement;
      }
      if (!isChild && !uniqueCells.includes(c)) {
        uniqueCells.push(c);
      }
    }

    // Value extractor for an individual cell
    function extractCellValue(cell) {
      if (!cell) return '';

      // 1. Data checkbox: check for checkbox state if text is empty
      const checkbox = cell.querySelector('input[type="checkbox"], .ag-checkbox, [role="checkbox"]');
      const text = (cell.innerText || '').trim();

      if (checkbox && !text) {
        const isChecked = 
          cell.querySelector('input[type="checkbox"]')?.checked ?? 
          cell.querySelector('.ag-checked') !== null ?? 
          checkbox.classList.contains('ag-checked') ??
          checkbox.getAttribute('aria-checked') === 'true';
        return isChecked ? 'true' : 'false';
      }

      // 2. Image alt or SVG label (e.g. rating stars, status icons)
      if (!text) {
        const img = cell.querySelector('img[alt], svg[aria-label]');
        if (img) {
          return img.getAttribute('alt') || img.getAttribute('aria-label') || '';
        }
      }

      // 3. Normalized text content
      return (cell.innerText || cell.textContent || '').trim().replace(/\s+/g, ' ');
    }

    // If a column schema was provided
    if (schema && schema.length > 0) {
      const colIdMap = new Map();
      const ariaColIndexMap = new Map();

      for (const c of uniqueCells) {
        const colId = c.getAttribute('col-id') || c.getAttribute('data-col-id') || c.getAttribute('data-field') || c.id;
        if (colId) colIdMap.set(colId, c);
        const ariaCol = c.getAttribute('aria-colindex');
        if (ariaCol) ariaColIndexMap.set(ariaCol, c);
      }

      const hasAttributeMapping = schema.some(s => (s.colId && colIdMap.has(s.colId)) || (s.ariaColIndex && ariaColIndexMap.has(s.ariaColIndex)));

      if (hasAttributeMapping) {
        return schema.map(s => {
          const cell = (s.colId ? colIdMap.get(s.colId) : null) || 
                       (s.ariaColIndex ? ariaColIndexMap.get(s.ariaColIndex) : null);
          return extractCellValue(cell);
        });
      }

      // Positional fallback with pure selection columns filtered out
      const nonSelectionCells = uniqueCells.filter(c => !isSelectionColumn(c));
      const values = [];
      for (let i = 0; i < schema.length; i++) {
        values.push(extractCellValue(nonSelectionCells[i] || null));
      }
      return values;
    }

    // Fallback without schema: return values of all non-selection cells
    return uniqueCells.filter(c => !isSelectionColumn(c)).map(extractCellValue);
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
   * Extracts a numeric row sequence/order key from a row element or its cell values.
   */
  function extractRowOrderKey(rowElement, values = null, schema = null) {
    if (!rowElement || !(rowElement instanceof HTMLElement)) {
      return null;
    }

    // 1. row-index or data-row-index (AG Grid standard: 0-based integer, e.g. row-index="0")
    const rowIndexAttr = rowElement.getAttribute('row-index') || rowElement.getAttribute('data-row-index');
    if (rowIndexAttr !== null && rowIndexAttr !== '') {
      const parsed = parseInt(rowIndexAttr, 10);
      if (!isNaN(parsed)) return parsed;
    }

    // 2. aria-rowindex (ARIA standard: 1-based integer, e.g. aria-rowindex="2")
    const ariaRowIndexAttr = rowElement.getAttribute('aria-rowindex');
    if (ariaRowIndexAttr !== null && ariaRowIndexAttr !== '') {
      const parsed = parseInt(ariaRowIndexAttr, 10);
      if (!isNaN(parsed)) return parsed;
    }

    // 3. row-id or data-row-id or id (e.g. row-id="0", data-row-id="row-1", id="row-42")
    const idAttr = 
      rowElement.getAttribute('row-id') ||
      rowElement.getAttribute('data-row-id') ||
      rowElement.getAttribute('data-id') ||
      rowElement.getAttribute('id') ||
      rowElement.dataset?.rowId ||
      rowElement.dataset?.id;

    if (idAttr) {
      if (/^\d+$/.test(idAttr)) {
        const parsed = parseInt(idAttr, 10);
        if (!isNaN(parsed)) return parsed;
      }
      const match = idAttr.match(/^[a-zA-Z_\-]+(\d+)$/);
      if (match) {
        const parsed = parseInt(match[1], 10);
        if (!isNaN(parsed)) return parsed;
      }
    }

    // 4. HTMLTableRowElement.rowIndex (standard <tr> element)
    if (typeof rowElement.rowIndex === 'number' && rowElement.rowIndex >= 0) {
      return rowElement.rowIndex;
    }

    // 5. CSS transform translateY or top (common in virtualized grids like react-window, TanStack)
    const styleTransform = rowElement.style ? rowElement.style.transform : '';
    if (styleTransform) {
      const match = styleTransform.match(/translateY\(\s*(-?\d+(?:\.\d+)?)\s*px\)/i);
      if (match) {
        const parsed = parseFloat(match[1]);
        if (!isNaN(parsed)) return parsed;
      }
    }
    const styleTop = rowElement.style ? rowElement.style.top : '';
    if (styleTop && /^-?\d+(?:\.\d+)?px$/i.test(styleTop)) {
      const parsed = parseFloat(styleTop);
      if (!isNaN(parsed)) return parsed;
    }

    // 6. Dedicated sequence / row number column in cell values
    if (schema && values && values.length > 0) {
      const rowNumColIdx = schema.findIndex(s => 
        s.colId === 'ag-Grid-RowNumbersColumn' || 
        /^(row\s*(number|no|#)?|#|no\.?|idx|index)$/i.test((s.name || '').trim())
      );
      if (rowNumColIdx !== -1 && values[rowNumColIdx]) {
        const cellVal = String(values[rowNumColIdx]).trim().replace(/,/g, '');
        if (/^\d+$/.test(cellVal)) {
          const parsed = parseInt(cellVal, 10);
          if (!isNaN(parsed)) return parsed;
        }
      }
    }

    return null;
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

      const { headers, schema } = buildColumnSchema(el);
      const visibleRows = getVisibleRowElements(el);
      const virtInfo = detectVirtualizationCandidate(el);

      detectedTables.push({
        id,
        element: el,
        title,
        headers,
        schema,
        visibleRowCount: visibleRows.length,
        colCount: headers.length || (visibleRows[0] ? extractRowValues(visibleRows[0], schema).length : 0),
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
    const { headers, schema } = buildColumnSchema(tableItem.element, includeHidden);
    const rowEls = getVisibleRowElements(tableItem.element);
    const rows = [];
    for (const r of rowEls) {
      const values = extractRowValues(r, schema, includeHidden);
      if (values.length === 0 || values.every(c => c === '')) continue;
      // Strict assertion: verify row cell count matches header column count
      if (headers.length > 0 && values.length !== headers.length) {
        throw new Error(`Column alignment mismatch: Table header has ${headers.length} columns ("${headers.join(', ')}"), but extracted row has ${values.length} cells ("${values.join(', ')}").`);
      }
      rows.push(values);
    }

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

    const { headers, schema } = buildColumnSchema(targetElement, includeHiddenCols);
    const accumulatedMap = new Map();
    let encounterCount = 0;
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
        const values = extractRowValues(rowEl, schema, includeHiddenCols);
        if (values.length === 0 || values.every(v => v === '')) continue;
        // Strict assertion: verify row cell count matches header column count
        if (headers.length > 0 && values.length !== headers.length) {
          throw new Error(`Column alignment mismatch: Table header has ${headers.length} columns ("${headers.join(', ')}"), but extracted row has ${values.length} cells ("${values.join(', ')}").`);
        }
        const key = getRowIdentityKey(rowEl, values);
        if (!accumulatedMap.has(key)) {
          const orderKey = extractRowOrderKey(rowEl, values, schema);
          accumulatedMap.set(key, {
            values,
            orderKey,
            encounterIndex: encounterCount++
          });
          count++;
        }
      }
      return count;
    };

    try {
      // 1. Scroll to top
      if (container.scrollTop > 0) {
        container.scrollTop = 0;
        try {
          container.dispatchEvent(new Event('scroll', { bubbles: true }));
        } catch (_) {}

        await new Promise(r => {
          if (typeof requestAnimationFrame !== 'undefined') {
            requestAnimationFrame(() => setTimeout(r, 60));
          } else {
            setTimeout(r, 60);
          }
        });

        await waitForDOMSettle(container, Math.max(settleDelayMs, 80), Math.max(maxSettleTimeoutMs, 1000), abortSignal);

        const visibleRows = getVisibleRowElements(targetElement);
        if (visibleRows.length > 0) {
          let minKey = Infinity;
          for (const vr of visibleRows) {
            const k = extractRowOrderKey(vr);
            if (typeof k === 'number' && !isNaN(k) && k < minKey) {
              minKey = k;
            }
          }
          if (minKey > 2 && minKey !== Infinity) {
            await new Promise(r => setTimeout(r, 100));
            await waitForDOMSettle(container, Math.max(settleDelayMs, 100), 1000, abortSignal);
          }
        }
      } else {
        await waitForDOMSettle(container, settleDelayMs, 300, abortSignal);
      }

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

    const allEntries = Array.from(accumulatedMap.values());

    // Determine if we have reliable order keys (numeric on >= 80% of rows)
    const validOrderKeysCount = allEntries.filter(e => typeof e.orderKey === 'number' && !isNaN(e.orderKey)).length;
    const hasOrderKeys = allEntries.length > 0 && (validOrderKeysCount / allEntries.length >= 0.8);

    let sortedEntries;
    if (hasOrderKeys) {
      sortedEntries = allEntries.slice().sort((a, b) => {
        const aHasKey = typeof a.orderKey === 'number' && !isNaN(a.orderKey);
        const bHasKey = typeof b.orderKey === 'number' && !isNaN(b.orderKey);
        if (aHasKey && bHasKey) {
          if (a.orderKey !== b.orderKey) {
            return a.orderKey - b.orderKey;
          }
        } else if (aHasKey) {
          return -1;
        } else if (bHasKey) {
          return 1;
        }
        return a.encounterIndex - b.encounterIndex;
      });
    } else {
      // No reliable orderable keys available across rows
      sortedEntries = allEntries;

      // Check if partial order keys indicate non-monotonic / scrambled ordering
      const partialKeys = allEntries.map(e => e.orderKey).filter(k => typeof k === 'number' && !isNaN(k));
      let isScrambled = false;
      for (let i = 1; i < partialKeys.length; i++) {
        if (partialKeys[i] < partialKeys[i - 1]) {
          isScrambled = true;
          break;
        }
      }

      if (isScrambled || (!hasOrderKeys && allEntries.length > 50)) {
        const orderWarn = 'No reliable row sequence attributes were available; rows were exported in scroll-encounter order.';
        warning = warning ? `${warning} ${orderWarn}` : orderWarn;
      }
    }

    let rows = sortedEntries.map(e => e.values);
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

      if (action === 'TE_PING') {
        sendResponse({ status: 'ok', initialized: true });
        return true;
      }

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
    buildColumnSchema,
    isSelectionColumn,
    getRowIdentityKey,
    extractRowOrderKey,
    hashString
  };
})();
