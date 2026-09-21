/**
 * Table Extractor - Chrome Web Store Packaging Script
 * Builds dist/table-extractor-store.zip containing ONLY what the extension needs at runtime.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const OUTPUT_ZIP = path.join(DIST_DIR, 'table-extractor-store.zip');

const INCLUDED_FOLDERS = [
  'assets',
  'background',
  'lib',
  'popup'
];

const INCLUDED_ROOT_FILES = [
  'manifest.json',
  'content.js'
];

const EXCLUDED_PATTERNS = [
  /^(test|scripts|node_modules|\.git|dist)(\/|$)/,
  /^assets\/screenshots(\/|$)/,
  /^assets\/icons\/icon-300\.png$/i,
  /^assets\/icons\/.*\.svg$/i,
  /\.md$/i,
  /package.*\.json$/i,
  /\.gitignore$/i,
  /\.DS_Store$/i
];

function shouldExclude(relPath) {
  const norm = relPath.replace(/\\/g, '/');
  return EXCLUDED_PATTERNS.some(pat => pat.test(norm));
}

function getAllFiles(dir, baseDir = dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of list) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      if (!shouldExclude(relPath + '/')) {
        results = results.concat(getAllFiles(fullPath, baseDir));
      }
    } else if (entry.isFile()) {
      if (!shouldExclude(relPath)) {
        results.push({ fullPath, relPath });
      }
    }
  }
  return results;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = (bytes / 1024).toFixed(2);
  return `${kb} KB`;
}

export async function buildPackage(options = {}) {
  const quiet = Boolean(options.quiet);
  const outPath = options.outputPath || OUTPUT_ZIP;

  if (!quiet) {
    console.log('========================================================');
    console.log('📦  Building Table Extractor Chrome Web Store ZIP Archive');
    console.log('========================================================\n');
  }

  const filesToInclude = [];

  // 1. Root files
  for (const file of INCLUDED_ROOT_FILES) {
    const fullPath = path.join(ROOT_DIR, file);
    if (fs.existsSync(fullPath)) {
      filesToInclude.push({ fullPath, relPath: file });
    } else {
      throw new Error(`Required file not found: ${file}`);
    }
  }

  // 2. Runtime directories
  for (const folder of INCLUDED_FOLDERS) {
    const folderPath = path.join(ROOT_DIR, folder);
    const files = getAllFiles(folderPath, ROOT_DIR);
    filesToInclude.push(...files);
  }

  // Sort files alphabetically
  filesToInclude.sort((a, b) => a.relPath.localeCompare(b.relPath));

  const zip = new JSZip();
  let totalRawBytes = 0;

  if (!quiet) {
    console.log('Included Files:');
  }

  for (const item of filesToInclude) {
    const content = fs.readFileSync(item.fullPath);
    const size = content.length;
    totalRawBytes += size;
    zip.file(item.relPath, content);
    if (!quiet) {
      console.log(`  ✓  ${item.relPath.padEnd(38)} (${formatBytes(size)})`);
    }
  }

  const outDir = path.dirname(outPath);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const zipBuffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 }
  });

  fs.writeFileSync(outPath, zipBuffer);

  if (!quiet) {
    console.log('\n--------------------------------------------------------');
    console.log(`Total Files Included : ${filesToInclude.length}`);
    console.log(`Uncompressed Size    : ${formatBytes(totalRawBytes)} (${totalRawBytes} bytes)`);
    console.log(`Final ZIP Size       : ${formatBytes(zipBuffer.length)} (${zipBuffer.length} bytes)`);
    console.log(`Output Location      : ${outPath}`);
    console.log('--------------------------------------------------------\n');
    console.log('✅ Store packaging complete!\n');
  }

  return {
    outputPath: outPath,
    files: filesToInclude.map(f => f.relPath),
    totalFiles: filesToInclude.length,
    uncompressedBytes: totalRawBytes,
    zipBytes: zipBuffer.length
  };
}

// CLI execution
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  buildPackage().catch(err => {
    console.error('❌ Packaging failed:', err.message);
    process.exit(1);
  });
}
