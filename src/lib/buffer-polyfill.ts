/**
 * Buffer Polyfill Utility
 *
 * Provides runtime checks to ensure the Buffer polyfill is available.
 * This prevents issues with module initialization order in browser environments.
 */

import { Buffer } from 'buffer';

// Ensure Buffer is available globally on initial import
if (typeof globalThis.Buffer === 'undefined') {
  globalThis.Buffer = Buffer;
}

/**
 * Runtime check to ensure Buffer is available
 * This provides a safeguard against initialization order issues
 *
 * Note: While the module-level check (lines 11-13) should guarantee Buffer
 * is available, this function provides an additional safety layer for edge cases
 * where modules might be loaded in unexpected order or the module initialization
 * is bypassed (e.g., dynamic imports, circular dependencies).
 *
 * @returns The Buffer constructor, guaranteed to be available
 */
export function ensureBuffer(): typeof Buffer {
  if (typeof globalThis.Buffer === 'undefined') {
    globalThis.Buffer = Buffer;
  }
  return globalThis.Buffer;
}
