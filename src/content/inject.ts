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

// Settings storage key
const SETTINGS_KEY = 'vidulum_settings';

// ============================================================================
// Inject the inpage provider script
// ============================================================================

async function injectScript() {
  try {
    // Read user settings from chrome.storage
    let enableKeplrInjection = false; // Default: disabled
    let enableMetamaskInjection = false; // Default: disabled
    let enablePhantomInjection = false; // Default: disabled
    let enableCoinbaseInjection = false; // Default: disabled
    let features = {
      VIDULUM_INJECTION: true, // Default
      WALLET_CONNECT: false, // Default
      AUTO_OPEN_POPUP: true, // Default
      TX_TRANSLATION: true, // Default
    };

    try {
      const result = await browser.storage.local.get(SETTINGS_KEY);
      const settings = result[SETTINGS_KEY] || {};
      enableKeplrInjection = settings.enableKeplrInjection ?? false;
      enableMetamaskInjection = settings.enableMetamaskInjection ?? false;
      enablePhantomInjection = settings.enablePhantomInjection ?? false;
      enableCoinbaseInjection = settings.enableCoinbaseInjection ?? false;

      // Load feature settings
      if (settings.features) {
        features = {
          VIDULUM_INJECTION: settings.features.VIDULUM_INJECTION ?? true,
          WALLET_CONNECT: settings.features.WALLET_CONNECT ?? false,
          AUTO_OPEN_POPUP: settings.features.AUTO_OPEN_POPUP ?? true,
          TX_TRANSLATION: settings.features.TX_TRANSLATION ?? true,
        };
      }
    } catch {
      // Storage access failed, use default
    }

    // Create a config element to pass settings to inpage script
    const configElement = document.createElement('script');
    configElement.id = 'vidulum-config';
    configElement.type = 'application/json';
    configElement.textContent = JSON.stringify({
      enableKeplrInjection,
      enableMetamaskInjection,
      enablePhantomInjection,
      enableCoinbaseInjection,
      features,
    });
    (document.head || document.documentElement).appendChild(configElement);

    // Inject the main inpage script
    const script = document.createElement('script');
    script.src = browser.runtime.getURL('inpage.js');
    script.type = 'text/javascript';
    script.onload = () => {
      script.remove(); // Clean up after injection
      configElement.remove(); // Clean up config element
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
  // Cosmos/Keplr methods
  enable: MessageType.ENABLE,
  getKey: MessageType.GET_KEY,
  signAmino: MessageType.SIGN_AMINO,
  signDirect: MessageType.SIGN_DIRECT,
  signArbitrary: MessageType.SIGN_ARBITRARY,
  verifyArbitrary: MessageType.VERIFY_ARBITRARY,
  disconnect: MessageType.DISCONNECT,
  suggestChain: MessageType.REQUEST_CONNECTION,
  getChainInfos: MessageType.GET_CONNECTION_STATUS,

  // EVM/Ethereum methods
  eth_requestAccounts: MessageType.ETH_REQUEST_ACCOUNTS,
  eth_accounts: MessageType.ETH_ACCOUNTS,
  eth_chainId: MessageType.ETH_CHAIN_ID,
  eth_sendTransaction: MessageType.ETH_SEND_TRANSACTION,
  eth_signTransaction: MessageType.ETH_SIGN_TRANSACTION,
  eth_sign: MessageType.ETH_SIGN,
  personal_sign: MessageType.PERSONAL_SIGN,
  eth_signTypedData: MessageType.ETH_SIGN_TYPED_DATA,
  eth_signTypedData_v3: MessageType.ETH_SIGN_TYPED_DATA_V3,
  eth_signTypedData_v4: MessageType.ETH_SIGN_TYPED_DATA_V4,
  wallet_switchEthereumChain: MessageType.WALLET_SWITCH_ETHEREUM_CHAIN,
  wallet_addEthereumChain: MessageType.WALLET_ADD_ETHEREUM_CHAIN,
  wallet_watchAsset: MessageType.WALLET_WATCH_ASSET,
  eth_getBalance: MessageType.ETH_GET_BALANCE,
  eth_blockNumber: MessageType.ETH_BLOCK_NUMBER,
  eth_call: MessageType.ETH_CALL,
  eth_estimateGas: MessageType.ETH_ESTIMATE_GAS,
  eth_gasPrice: MessageType.ETH_GAS_PRICE,

  // Solana/Phantom methods
  sol_connect: MessageType.SOL_CONNECT,
  sol_disconnect: MessageType.SOL_DISCONNECT,
  sol_signTransaction: MessageType.SOL_SIGN_TRANSACTION,
  sol_signAllTransactions: MessageType.SOL_SIGN_ALL_TRANSACTIONS,
  sol_signMessage: MessageType.SOL_SIGN_MESSAGE,
  sol_signAndSendTransaction: MessageType.SOL_SIGN_AND_SEND_TRANSACTION,
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
