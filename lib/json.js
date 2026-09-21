/**
 * Table Extractor - JSON Converter
 */

/**
 * Converts table data { headers: string[], rows: any[][] } to JSON string.
 * @param {{ headers?: string[], rows: any[][], title?: string }} tableData 
 * @param {{ format?: 'objects' | 'arrays', pretty?: boolean }} options 
 * @returns {string}
 */
export function tableDataToJSON(tableData, options = {}) {
  const format = options.format || 'objects';
  const pretty = options.pretty !== false; // default true
  const headers = tableData.headers || [];
  const rows = tableData.rows || [];

  let data;
  if (format === 'objects' && headers.length > 0) {
    // Convert rows to array of objects using headers as keys
    data = rows.map(row => {
      const obj = {};
      headers.forEach((header, index) => {
        const key = header || `col_${index + 1}`;
        obj[key] = row[index] !== undefined ? row[index] : '';
      });
      return obj;
    });
  } else {
    // 2D Array format
    data = {
      headers,
      rows,
      meta: {
        totalRows: rows.length,
        totalColumns: headers.length || (rows[0] ? rows[0].length : 0),
        exportedAt: new Date().toISOString()
      }
    };
  }

  return pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
}

/**
 * Creates a downloadable Blob for JSON data.
 * @param {{ headers?: string[], rows: any[][] }} tableData 
 * @param {object} options 
 * @returns {Blob}
 */
export function createJSONBlob(tableData, options = {}) {
  const json = tableDataToJSON(tableData, options);
  return new Blob([json], { type: 'application/json;charset=utf-8;' });
}
