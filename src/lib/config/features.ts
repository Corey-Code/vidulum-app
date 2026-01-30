/**
 * Feature Flags Configuration
 *
 * This file controls which features are enabled in the Vidulum Wallet.
 * These flags allow us to toggle features on/off without removing code.
 */

export const FEATURE_FLAGS = {
  /**
   * KEPLR_INJECTION: Controls whether window.keplr is injected into web pages
   *
   * When enabled (true):
   * - window.keplr will be available for dApps
   * - Vidulum wallet will be compatible with Keplr-based dApps
   *
   * When disabled (false):
   * - window.keplr will NOT be injected
   * - Keplr code is preserved for future WalletConnect implementation
   * - dApps must use window.vidulum instead
   *
   * Default: false (disabled)
   */
  KEPLR_INJECTION: false,

  /**
   * VIDULUM_INJECTION: Controls whether window.vidulum is injected into web pages
   *
   * When enabled (true):
   * - window.vidulum will be available for dApps
   * - Native Vidulum wallet integration is active
   *
   * When disabled (false):
   * - window.vidulum will NOT be injected
   * - Native Vidulum integration is not available
   *
   * Default: true (enabled)
   */
  VIDULUM_INJECTION: true,
} as const;
