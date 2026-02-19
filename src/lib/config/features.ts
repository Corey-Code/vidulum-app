/**
 * Feature Flags Configuration
 *
 * Control which features are enabled in the extension.
 * This allows for gradual rollout and easy feature toggling.
 */

import browser from 'webextension-polyfill';

export const FEATURES = {
  /**
   * Inject window.keplr provider for Keplr-compatible dApps
   * NOTE: This is now a user-configurable setting in the Settings page.
   * The runtime value used for injection is read from browser.storage.local by inject.ts.
   * This flag serves as the default/fallback configuration (e.g. for helpers/UI), and
   * does not override the user setting stored in browser.storage.local.
   * Default: false (disabled to avoid conflicts with actual Keplr).
   */
  KEPLR_INJECTION: false, // Default/fallback; user-controlled value lives in storage

  /**
   * Inject window.vidulum provider (our own provider)
   * This is always available for apps that specifically support Vidulum
   */
  VIDULUM_INJECTION: true,

  /**
   * WalletConnect support
   * Future implementation for mobile wallet and cross-device connections
   */
  WALLET_CONNECT: false,

  /**
   * Auto-open popup on approval requests
   * When enabled, the extension popup opens automatically when approval is needed
   */
  AUTO_OPEN_POPUP: true,

  /**
   * Human-readable transaction display
   * Parse and show transaction summaries instead of raw data
   */
  TX_TRANSLATION: true,

  /**
   * Developer mode logging
   * Enables console output for debugging; disabled by default.
   */
  DEVELOPER_MODE: false,
};

/**
 * Check if a feature is enabled
 */
export function isFeatureEnabled(feature: keyof typeof FEATURES): boolean {
  return FEATURES[feature] ?? false;
}

/**
 * Check if a feature is enabled based on user settings
 * Falls back to default FEATURES value if not configured
 */
export async function isFeatureEnabledWithSettings(
  feature: keyof typeof FEATURES
): Promise<boolean> {
  try {
    const result = await browser.storage.local.get('vidulum_settings');
    const settings = result.vidulum_settings || {};
    const featureSettings = settings.features || {};

    // Return user setting if exists, otherwise default
    return featureSettings[feature] ?? FEATURES[feature] ?? false;
  } catch {
    // If storage access fails, use default
    return FEATURES[feature] ?? false;
  }
}

/**
 * Get all enabled features
 */
export function getEnabledFeatures(): string[] {
  return Object.entries(FEATURES)
    .filter(([, enabled]) => enabled)
    .map(([name]) => name);
}
