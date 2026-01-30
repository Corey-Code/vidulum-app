/**
 * Feature Flags Configuration
 *
 * Control which features are enabled in the extension.
 * This allows for gradual rollout and easy feature toggling.
 */

export const FEATURES = {
  /**
   * Inject window.keplr provider for Keplr-compatible dApps
   * NOTE: This is now a user-configurable setting in Settings page
   * The actual value is read from chrome.storage.local by inject.ts
   * Default: false (disabled to avoid conflicts with actual Keplr)
   */
  KEPLR_INJECTION: false, // User-controlled via Settings toggle

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
   * Multi-hop swap routing
   * Enable finding swap routes through multiple pools
   */
  MULTI_HOP_SWAPS: false,

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
};

/**
 * Check if a feature is enabled
 */
export function isFeatureEnabled(feature: keyof typeof FEATURES): boolean {
  return FEATURES[feature] ?? false;
}

/**
 * Get all enabled features
 */
export function getEnabledFeatures(): string[] {
  return Object.entries(FEATURES)
    .filter(([, enabled]) => enabled)
    .map(([name]) => name);
}
