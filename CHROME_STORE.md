# Chrome Web Store Listing: Table Extractor

*Single source of truth for Chrome Web Store Developer Dashboard submission, store listing copy, permissions justifications, and reviewer instructions.*

---

## 🚀 Quick Submission Guide

1. **Open Chrome Web Store Developer Dashboard**:
   👉 [https://chrome.google.com/webstore/devconsole](https://chrome.google.com/webstore/devconsole)
2. **Select / Upload Extension**:
   - Upload the package file:
     ```
     /home/sid/projects/table-extractor/dist/table-extractor-store.zip
     ```
3. **Fill in Store Listing & Upload Assets** (use the paste-ready copy and file paths below).
4. **Enter Privacy & Permission Justifications** (see Section 3).
5. **Enter Reviewer Notes** (see Section 4 for test gift code).
6. **Submit for Review**.

---

## 1. Store Listing Metadata

### Product Details
- **Extension Name** *(max 45 characters)*:
  ```
  Table Extractor - HTML & Data Grid Exporter
  ```
  *(Character count: 42 / 45)*

- **Short Description / Summary** *(max 132 characters)*:
  ```
  Detect and export HTML tables and virtualized data grids to CSV, Excel (XLSX), and JSON.
  ```
  *(Character count: 91 / 132)*

- **Category**: Productivity *(Secondary: Developer Tools)*
- **Default Language**: English
- **Support Contact / Email**: sidoua26@gmail.com
- **Privacy Policy URL**: https://bulkgrab-licensing.sidoua26.workers.dev/privacy/table-extractor
- **Website URL**: https://bulkgrab-licensing.sidoua26.workers.dev/privacy/table-extractor

---

### Detailed Description (Paste-Ready for CWS)

```
Export a table from a webpage to Excel (.xlsx), CSV, or JSON. The free version works with standard HTML tables and lets you download one format at a time. Pro adds capture for supported virtualized grids, including AG Grid, and lets you export several formats at once. Table extraction runs locally in your browser.

Whether you are extracting financial reports, public datasets, directories, or enterprise dashboards, Table Extractor scans the page and gives you clean, one-click exports without messy manual copy-pasting or broken column formatting.

KEY FEATURES:

• Instant HTML Table Detection
Automatically discovers standard HTML tables (<thead>/<tbody>) across any web page. Cleanly handles headers, row indices, and numeric formatting.

• Multi-Format Spreadsheet Exports
Export your data directly to:
- CSV (includes UTF-8 BOM encoding for seamless opening in Microsoft Excel)
- Microsoft Excel Spreadsheet (.xlsx / SpreadsheetML XML)
- JSON (structured 2D arrays or key-value object lists)

• Virtualized Data Grid Capture (Pro Feature)
Modern web apps only render the 15-20 rows visible on screen to save memory. Table Extractor's smooth accumulate-while-scrolling engine scrolls through DOM-recycling containers like AG Grid, gathers all rows, deduplicates batches, and reconstructs the complete dataset.

• Granular Extraction Controls
- Row Range Selection: Extract specific row slices (e.g. rows 100 to 500) without grabbing unnecessary rows.
- Max Row Limits: Set custom row limits (up to 50,000 rows) to prevent browser memory issues on massive datasets.
- Hidden Column Recovery: Option to reveal and export columns hidden by CSS or overflow.
- Adjustable Settle Speeds: Switch between Normal (3s) and Slow-Site (6s) settle delays for heavy or lagging pages.

• 100% Privacy & Local Processing
All table detection, row accumulation, and file generation happen entirely inside your local browser sandbox. Your webpage data and extracted tables never leave your computer and are never sent to external servers. External network calls are strictly limited to license activation when you voluntarily purchase or redeem a Pro license key.

• Transparent Pricing & Simple Lifetime Access
Use basic static exports completely free forever. An optional one-time Pro upgrade ($9.99 lifetime, no recurring subscription) unlocks unlimited virtualized grid capture (including AG Grid) and simultaneous multi-format downloads.
```

---

## 2. Store Assets Checklist

Upload the following pre-rendered assets generated directly from the project:

| Asset | Dimensions | File Location | Purpose |
| :--- | :--- | :--- | :--- |
| **Store Icon** | 128 × 128 px | `assets/icons/icon-128.png` | Extension icon displayed in Web Store search and listings |
| **Small Promo Tile** | 440 × 280 px | `small_promo.png` | Promo tile for Chrome Web Store search results and category lists |
| **Marquee Promo Banner** | 1400 × 560 px | `marquee_promo.png` | Hero banner for featured placement in Chrome Web Store |
| **Screenshot 1** | 1280 × 800 px | `assets/screenshots/01-static-detection.png` | Free tier: "Export HTML tables to Excel or CSV" with standard HTML table and readable column headers |
| **Screenshot 2** | 1280 × 800 px | `assets/screenshots/02-virtualized-detection.png` | Pro tier: "Capture virtualized grids with Pro" with AG Grid fixture and verified 100-row reconstructed capture |
| **Thumbnail 1** | 320 × 200 px | `assets/screenshots/preview-320-01-static-detection.png` | Mobile / low-resolution preview verification for Screenshot 1 |
| **Thumbnail 2** | 320 × 200 px | `assets/screenshots/preview-320-02-virtualized-detection.png` | Mobile / low-resolution preview verification for Screenshot 2 |
| **Screenshot 3** | 1280 × 800 px | `assets/screenshots/03-pro-unlocked.png` | Pro unlocked state with multi-format export |
| **Screenshot 4** | 1280 × 800 px | `assets/screenshots/04-export-options.png` | Detailed capture options (range, hidden columns, limits) |

---

## 3. Privacy Practices & Permissions Justifications

Under the **Privacy practices** tab in the Developer Dashboard:

### Single Purpose Description
```
Table Extractor detects HTML tables and virtualized data grids on webpages and exports them to CSV, XLSX, and JSON.
```

### Permission Justifications
- **`activeTab`**:
  > *Justification*: Required to access the active tab only when the user explicitly clicks the extension icon in the toolbar. The extension does not monitor browsing history, has no background tracking, and only interacts with the page currently open when launched.

- **`scripting`**:
  > *Justification*: Required to inject the table extraction script (`content.js`) into the active tab on-demand only when the user opens the extension popup. It runs client-side to calculate table dimensions, extract row/cell contents, and coordinate virtualized scroll capture.

- **`storage`**:
  > *Justification*: Required to store user export preferences (such as selected file format, row range, and max row limits) and persist the user's Pro license activation status locally on the device.

- **Host Permissions & Content Scripts**:
  > *None*: No broad host permissions (`<all_urls>`, `*://*/*`) or automatic background `content_scripts` are requested or declared. The extension never runs code on pages automatically in the background.

### Data Usage Disclosures
- **User Data Collection**: None. The extension does not collect, store, or transmit personal data, browser history, or page content.
- **Data Transfer**: Zero table data or webpage content is transferred to external servers. All extraction and export generation occur client-side.

---

## 4. Notes for Reviewers / Certification Instructions

Paste the following text into the **"Trader / Reviewer Information"** field:

```
Hello Chrome Web Store Review Team,

Table Extractor detects standard HTML tables and virtualized data grids on webpages and exports them to CSV, XLSX, and JSON.

Testing Instructions:
1. Load any webpage containing a standard HTML table (e.g. Wikipedia: https://en.wikipedia.org/wiki/List_of_highest-grossing_films).
2. Click the Table Extractor icon in the toolbar.
   - The popup opens and injects content.js on-demand via activeTab and chrome.scripting.
3. The popup will display the detected table name, row/column dimensions, and an "Export Table" button. Click "Export Table" to download the CSV export.
4. To test Virtualized Data Grid detection:
   Visit any web page with an AG Grid or virtualized scroll container (e.g. https://www.ag-grid.com/example/). Click the extension icon. The extension identifies the grid as "Virtualized Grid" and offers "Capture all" or "Just visible rows".
5. To test Pro tier features:
   Click "License & Pro Status" in the footer, enter the test review gift code:
   TE-GIFT-TEST
   Click "Activate". Pro status activates immediately, unlocking all export formats and virtualized capture.

All table processing occurs entirely on the client side in the user's browser sandbox. No background monitoring or automatic script injection occurs.
Support contact: sidoua26@gmail.com
Privacy policy: https://bulkgrab-licensing.sidoua26.workers.dev/privacy/table-extractor

Thank you!
```
