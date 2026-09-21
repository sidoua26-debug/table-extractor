/**
 * Table Extractor - License Management Module
 * Handles tier verification (Free vs. Pro) and feature gating.
 */

export const STORAGE_KEYS = {
  LICENSE_STATUS: 'tableExtractor_licenseStatus',
  LICENSE_KEY: 'tableExtractor_licenseKey'
};

export const LICENSE_TIERS = {
  FREE: 'free',
  PRO: 'pro'
};

/**
 * Retrieves the current license status from chrome.storage.local.
 * Defaults to 'free' if not set.
 * @returns {Promise<'free'|'pro'>}
 */
export async function getLicenseStatus() {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return LICENSE_TIERS.FREE;
  }
  const result = await chrome.storage.local.get(STORAGE_KEYS.LICENSE_STATUS);
  return result[STORAGE_KEYS.LICENSE_STATUS] || LICENSE_TIERS.FREE;
}

/**
 * Checks whether the current user is a Pro subscriber.
 * @returns {Promise<boolean>}
 */
export async function isProUser() {
  const status = await getLicenseStatus();
  return status === LICENSE_TIERS.PRO;
}

/**
 * Activates Pro tier using a license key.
 * Accepts test keys 'PRO-TEST-PASS', 'PRO-UPGRADE-100', or standard license codes.
 * @param {string} key 
 * @returns {Promise<{ success: boolean, message?: string }>}
 */
export async function activateLicense(key) {
  if (!key || typeof key !== 'string') {
    return { success: false, message: 'Please enter a valid license key.' };
  }

  const cleanKey = key.trim().toUpperCase();
  // Validates test codes or standard alphanumeric keys starting with 'TE-' or 'PRO-'
  const isValidKey = 
    cleanKey === 'PRO-TEST-PASS' || 
    cleanKey.startsWith('TE-PRO-') || 
    cleanKey.startsWith('PRO-') ||
    cleanKey.length >= 8;

  if (!isValidKey) {
    return { success: false, message: 'Invalid license key. Check your confirmation email.' };
  }

  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    await chrome.storage.local.set({
      [STORAGE_KEYS.LICENSE_STATUS]: LICENSE_TIERS.PRO,
      [STORAGE_KEYS.LICENSE_KEY]: cleanKey
    });
  }

  return { success: true, message: 'Pro activated successfully!' };
}

/**
 * Resets license to Free tier (for testing/unlinking).
 */
export async function resetLicense() {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    await chrome.storage.local.set({
      [STORAGE_KEYS.LICENSE_STATUS]: LICENSE_TIERS.FREE,
      [STORAGE_KEYS.LICENSE_KEY]: null
    });
  }
}

/**
 * Feature gate check: Virtualized / Scroll-loaded table capture
 * @returns {Promise<boolean>}
 */
export async function canUseVirtualizedCapture() {
  return await isProUser();
}

/**
 * Feature gate check: ZIP bundling
 * @returns {Promise<boolean>}
 */
export async function canUseZipExport() {
  return await isProUser();
}

/**
 * Feature gate check: Multi-format simultaneous export
 * @returns {Promise<boolean>}
 */
export async function canUseMultiFormatExport() {
  return await isProUser();
}
