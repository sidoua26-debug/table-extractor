/**
 * Table Extractor - CSV Converter (RFC 4180 compliant)
 */

/**
 * Escapes a single cell value for CSV.
 * Quotes cell if it contains delimiter, quote, or newline.
 * Replaces double-quotes with doubled double-quotes.
 * @param {any} value 
 * @param {string} delimiter 
 * @returns {string}
 */
export function escapeCSVCell(value, delimiter = ',') {
  if (value === null || value === undefined) {
    return '';
  }
  const str = String(value);
  const needsQuotes = str.includes(delimiter) || str.includes('"') || str.includes('\n') || str.includes('\r');
  if (needsQuotes) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Converts table data { headers: string[], rows: any[][] } to CSV string.
 * Prepends UTF-8 BOM (\uFEFF) for broad spreadsheet compatibility.
 * @param {{ headers?: string[], rows: any[][] }} tableData 
 * @param {{ delimiter?: string, includeBom?: boolean }} options 
 * @returns {string}
 */
export function tableDataToCSV(tableData, options = {}) {
  const delimiter = options.delimiter || ',';
  const includeBom = options.includeBom !== false; // default true
  const lines = [];

  if (tableData.headers && tableData.headers.length > 0) {
    const headerLine = tableData.headers.map(h => escapeCSVCell(h, delimiter)).join(delimiter);
    lines.push(headerLine);
  }

  if (tableData.rows && Array.isArray(tableData.rows)) {
    for (const row of tableData.rows) {
      const rowLine = row.map(cell => escapeCSVCell(cell, delimiter)).join(delimiter);
      lines.push(rowLine);
    }
  }

  const csvContent = lines.join('\r\n');
  return includeBom ? '\uFEFF' + csvContent : csvContent;
}

/**
 * Creates a downloadable Blob for CSV data.
 * @param {{ headers?: string[], rows: any[][] }} tableData 
 * @returns {Blob}
 */
export function createCSVBlob(tableData) {
  const csv = tableDataToCSV(tableData);
  return new Blob([csv], { type: 'text/csv;charset=utf-8;' });
}
