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
 * @returns The Buffer constructor, guaranteed to be available
 */
export function ensureBuffer(): typeof Buffer {
  if (typeof globalThis.Buffer === 'undefined') {
    globalThis.Buffer = Buffer;
  }
  return globalThis.Buffer;
}
