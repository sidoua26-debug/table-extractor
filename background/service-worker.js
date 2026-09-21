/**
 * Table Extractor - Background Service Worker (Manifest V3)
 */

import { STORAGE_KEYS, LICENSE_TIERS } from '../lib/license.js';

// Initialize default state on extension install/update
chrome.runtime.onInstalled.addListener(async (details) => {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.LICENSE_STATUS);
  if (!stored[STORAGE_KEYS.LICENSE_STATUS]) {
    await chrome.storage.local.set({
      [STORAGE_KEYS.LICENSE_STATUS]: LICENSE_TIERS.FREE
    });
  }
  console.log('[Table Extractor] Extension installed/updated:', details.reason);
});

// Update badge when license changes
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[STORAGE_KEYS.LICENSE_STATUS]) {
    const newTier = changes[STORAGE_KEYS.LICENSE_STATUS].newValue;
    if (newTier === LICENSE_TIERS.PRO) {
      chrome.action.setBadgeText({ text: 'PRO' });
      chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
    } else {
      chrome.action.setBadgeText({ text: '' });
    }
  }
});
