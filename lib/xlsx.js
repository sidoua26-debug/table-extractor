/**
 * Table Extractor - XLSX / Excel Spreadsheet Converter
 * Uses Microsoft Excel XML SpreadsheetML format (Excel 2003+ standard),
 * perfectly rendered by MS Excel, Apple Numbers, Google Sheets, and LibreOffice Calc.
 */

function escapeXml(unsafe) {
  if (unsafe === null || unsafe === undefined) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Determines cell data type and value format for Excel SpreadsheetML
 * @param {any} val 
 * @returns {{ type: 'String' | 'Number', val: string }}
 */
function getCellTypeAndVal(val) {
  if (val === null || val === undefined) {
    return { type: 'String', val: '' };
  }
  const str = String(val).trim();
  // Check if pure numeric
  if (str !== '' && !isNaN(str) && !str.startsWith('0') && isFinite(Number(str))) {
    return { type: 'Number', val: str };
  }
  return { type: 'String', val: escapeXml(str) };
}

/**
 * Converts table data { headers: string[], rows: any[][] } to Excel XML workbook string.
 * @param {{ headers?: string[], rows: any[][], title?: string }} tableData 
 * @returns {string}
 */
export function tableDataToXLSX(tableData) {
  const sheetName = escapeXml((tableData.title || 'Table_Export').substring(0, 31));
  const headers = tableData.headers || [];
  const rows = tableData.rows || [];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Borders/>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#000000"/>
  </Style>
  <Style ss:ID="Header">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#0284c7"/>
   </Borders>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#0284c7" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="EvenRow">
   <Interior ss:Color="#F8FAFC" ss:Pattern="Solid"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="${sheetName}">
  <Table>`;

  // Write headers
  if (headers.length > 0) {
    xml += '\n   <Row ss:StyleID="Header" ss:Height="22">';
    for (const h of headers) {
      xml += `\n    <Cell><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`;
    }
    xml += '\n   </Row>';
  }

  // Write rows
  rows.forEach((row, rowIndex) => {
    const styleId = rowIndex % 2 === 1 ? ' ss:StyleID="EvenRow"' : '';
    xml += `\n   <Row${styleId} ss:Height="18">`;
    for (const cell of row) {
      const { type, val } = getCellTypeAndVal(cell);
      xml += `\n    <Cell><Data ss:Type="${type}">${val}</Data></Cell>`;
    }
    xml += '\n   </Row>';
  });

  xml += `\n  </Table>
 </Worksheet>
</Workbook>`;

  return xml;
}

/**
 * Creates a downloadable Blob for Excel XML.
 * @param {{ headers?: string[], rows: any[][] }} tableData 
 * @returns {Blob}
 */
export function createXLSXBlob(tableData) {
  const xml = tableDataToXLSX(tableData);
  return new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
}
