/**
 * Content Script - Message Bridge
 *
 * This script runs in the CONTENT SCRIPT context (isolated from page).
 * It bridges communication between:
 * - Page (via window.postMessage) ↔ Background (via browser.runtime.sendMessage)
 *
 * Security: Content scripts can access chrome.runtime API but are isolated from page JS.
 */

import browser from 'webextension-polyfill';
import { MessageType, Message } from '@/types/messages';

// Message type constants (must match inpage.ts)
const VIDULUM_REQUEST = 'VIDULUM_REQUEST';
const VIDULUM_RESPONSE = 'VIDULUM_RESPONSE';

// ============================================================================
// Inject the inpage provider script
// ============================================================================

function injectScript() {
  try {
    const script = document.createElement('script');
    script.src = browser.runtime.getURL('inpage.js');
    script.type = 'text/javascript';
    script.onload = () => {
      script.remove(); // Clean up after injection
    };
    (document.head || document.documentElement).appendChild(script);
  } catch (error) {
    console.error('[Vidulum] Failed to inject provider script:', error);
  }
}

// Inject as early as possible
injectScript();

// ============================================================================
// Message Bridge: Page ↔ Background
// ============================================================================

// Map method names from inpage to MessageType enum
const methodToMessageType: Record<string, MessageType> = {
  enable: MessageType.ENABLE,
  getKey: MessageType.GET_KEY,
  signAmino: MessageType.SIGN_AMINO,
  signDirect: MessageType.SIGN_DIRECT,
  signArbitrary: MessageType.SIGN_ARBITRARY,
  verifyArbitrary: MessageType.VERIFY_ARBITRARY,
  disconnect: MessageType.DISCONNECT,
  suggestChain: MessageType.REQUEST_CONNECTION, // Map to connection request
  getChainInfos: MessageType.GET_CONNECTION_STATUS,
};

// Listen for messages from the inpage script
window.addEventListener('message', async (event) => {
  // Only accept messages from the same window
  if (event.source !== window) return;

  // Only process our messages
  if (event.data?.type !== VIDULUM_REQUEST) return;

  const { id, method, params } = event.data;

  try {
    const messageType = methodToMessageType[method];

    if (!messageType) {
      throw new Error(`Unknown method: ${method}`);
    }

    // Create message for background script
    const message: Message = {
      type: messageType,
      payload: params,
      id,
    };

    // Send to background and wait for response
    const response = await browser.runtime.sendMessage(message);

    if (response.success) {
      // Send success response back to page
      window.postMessage(
        {
          type: VIDULUM_RESPONSE,
          id,
          result: response.data,
        },
        '*'
      );
    } else {
      // Send error response back to page
      window.postMessage(
        {
          type: VIDULUM_RESPONSE,
          id,
          error: response.error || 'Unknown error',
        },
        '*'
      );
    }
  } catch (error) {
    // Send error response back to page
    window.postMessage(
      {
        type: VIDULUM_RESPONSE,
        id,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      '*'
    );
  }
});

// ============================================================================
// Listen for events from background (e.g., account changes)
// ============================================================================

browser.runtime.onMessage.addListener((message) => {
  if (message.type === 'KEYSTORE_CHANGE') {
    // Notify the page that accounts may have changed
    window.dispatchEvent(new Event('keplr_keystorechange'));
  }
});
