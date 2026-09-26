# Microsoft Edge Add-ons Listing: Table Extractor

*Single source of truth for Microsoft Edge Partner Center submission, store listing copy, permissions justifications, and reviewer notes.*

---

## 🚀 Quick Submission Guide

1. **Open Microsoft Partner Center**:
   👉 [https://partner.microsoft.com/dashboard/microsoftedge](https://partner.microsoft.com/dashboard/microsoftedge)
2. **Create New Extension**:
   - Click **"Create new extension"**.
   - Drag & drop or browse to upload the package file:
     ```
     /home/sid/projects/table-extractor/dist/table-extractor-store.zip
     ```
3. **Fill in Store Listing & Upload Assets** (use the copy and file paths below).
4. **Enter Reviewer Notes** (see Section 4 for test gift code).
5. **Submit for Certification**.

---

## 1. Store Listing Metadata

### Product Details
- **Extension Name**: Table Extractor - HTML & Data Grid Exporter
- **Short Description** *(under 100 characters)*:
  ```
  Detect and export HTML tables and virtualized data grids to CSV, Excel (XLSX), and JSON.
  ```
- **Category**: Productivity *(Secondary: Developer tools)*
- **Version**: 1.0.1
- **Support Contact / Email**: sidoua26@gmail.com
- **Privacy Policy URL**: https://bulkgrab-licensing.sidoua26.workers.dev/privacy/table-extractor
- **Website URL**: https://bulkgrab-licensing.sidoua26.workers.dev/privacy/table-extractor

### Detailed Description
```markdown
Table Extractor makes it effortless to capture, inspect, and export data tables and complex data grids from any webpage into clean spreadsheets and structured data files.

Whether you are extracting financial tables, public datasets, directories, or enterprise dashboards, Table Extractor scans the page and gives you clean, one-click exports without messy manual copy-pasting or broken column formatting.

Key Capabilities:

• Instant Table Detection
Automatically discovers standard HTML tables (<thead>/<tbody>) as well as modern virtualized data grids (AG Grid, React Virtualized, and scroll-loaded containers).

• Multi-Format Clean Export
Export your data directly to:
- CSV (with UTF-8 BOM encoding for seamless opening in Microsoft Excel)
- Microsoft Excel Spreadsheet (.xlsx)
- JSON (structured record objects or 2D arrays)

• Virtualized Data Grid Capture (Pro Feature)
Modern web apps only render the 15-20 rows visible on screen to save memory. Table Extractor's smooth accumulate-while-scrolling engine scrolls the container, gathers thousands of rows, and exports the complete dataset.

• Granular Extraction Controls
- Row Range Selection: Extract specific row slices (e.g. rows 100 to 500) without grabbing the whole table.
- Max Rows Limit: Set custom limits (up to 50,000 rows) to prevent browser freezes on massive tables.
- Hidden Column Recovery: Option to reveal and export columns hidden by CSS or overflow.
- Adjustable Settle Speeds: Switch between Normal (3s) and Slow-Site (6s) settle delays for heavy or lagging pages.

• 100% Privacy & Local Processing
All table detection, row accumulation, and file generation happen entirely inside your local browser sandbox. Your webpage data and extracted tables never leave your computer and are never sent to external servers (licensing network requests are made only to our backend if you choose to purchase or activate a Pro license).

• Simple Lifetime Access
Use basic static exports completely free forever, or upgrade to Pro for a one-time payment of $9.99 for unlimited virtualized capture and multi-format simultaneous export.
```

---

## 2. Store Assets Checklist

Upload the following pre-rendered assets generated directly from the project:

| Asset | Size | File Location | Purpose |
| :--- | :--- | :--- | :--- |
| **Store Logo** | 300 × 300 px | `assets/icons/icon-300.png` | Main extension logo in Edge Add-ons store and search results |
| **Screenshot 1** | 1280 × 800 px | `assets/screenshots/01-static-detection.png` | Static HTML table detection & one-click export |
| **Screenshot 2** | 1280 × 800 px | `assets/screenshots/02-virtualized-detection.png` | Virtualized data grid detection & capture prompt |
| **Screenshot 3** | 1280 × 800 px | `assets/screenshots/03-pro-unlocked.png` | Pro unlocked state with multi-format export |
| **Screenshot 4** | 1280 × 800 px | `assets/screenshots/04-export-options.png` | Detailed capture options (range, hidden columns, limits) |

---

## 3. Permissions Justifications (For Reviewers)

When requested in the Partner Center submission form:

- **`activeTab`**:
  > *Justification*: Required to access the active tab only when the user explicitly clicks the extension popup action. The extension does not monitor browsing history, has no background tracking, and only interacts with the webpage currently open when the popup is launched.

- **`scripting`**:
  > *Justification*: Required to inject the table extraction script (`content.js`) into the active tab on-demand only when the user opens the extension popup. It runs client-side to calculate table dimensions, extract row/cell contents, and coordinate virtualized scroll capture.

- **`storage`**:
  > *Justification*: Required to store user export preferences (such as selected file format, row range, and max row limits) and persist the user's Pro license activation status locally on the device.

- **Host Permissions & Content Scripts**:
  > *None*: No broad host permissions (`<all_urls>`, `*://*/*`) or automatic background `content_scripts` are requested or declared. The extension never runs code on pages automatically in the background.

---

## 4. Notes for Certification / Reviewer Instructions

Paste the following text into the **"Notes for certification"** box to help the Microsoft review team test the extension quickly and approve it without friction:

```
Hello Microsoft Edge Review Team,

Table Extractor detects standard HTML tables and virtualized data grids on webpages and exports them to CSV, XLSX, and JSON.

Testing Instructions:
1. Load any webpage containing a standard HTML table (for example, Wikipedia: https://en.wikipedia.org/wiki/List_of_highest-grossing_films).
2. Click the Table Extractor extension icon in the toolbar.
   - When the popup opens, activeTab and scripting inject the extraction script on-demand into that tab.
3. The popup will display the detected table name, row/col dimensions, and an "Export Table" button. Click "Export Table" to download the CSV export.
4. To test Virtualized Data Grid detection:
   Visit any web page with an AG Grid or virtualized scroll container (e.g. https://www.ag-grid.com/example/). Click the extension icon. The extension will identify the grid as "Virtualized Grid" and offer "Capture all" or "Just visible rows".
5. To test Pro tier features:
   Click "License & Pro Status" in the footer, enter the test review gift code:
   TE-GIFT-PUT-CODE-HERE
   Click "Activate". Pro status will be activated immediately, unlocking all export formats and virtualized capture.

All table processing occurs entirely on the client side in the user's browser. No background monitoring or automatic script injection occurs.
Support contact: sidoua26@gmail.com
Privacy policy: https://bulkgrab-licensing.sidoua26.workers.dev/privacy/table-extractor

Thank you!
```
