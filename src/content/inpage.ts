/**
 * Inpage Provider Script
 *
 * This script runs in the PAGE context (not content script context).
 * It provides the window.keplr API that dApps use to interact with the wallet.
 *
 * Communication flow:
 * dApp → window.keplr → postMessage → content script → background → response
 */

import { FEATURE_FLAGS } from '../lib/config/features';

// Message types for communication with content script
const VIDULUM_REQUEST = 'VIDULUM_REQUEST';
const VIDULUM_RESPONSE = 'VIDULUM_RESPONSE';

// Pending requests waiting for responses
const pendingRequests = new Map<
  string,
  { resolve: (value: unknown) => void; reject: (error: Error) => void }
>();

// Generate unique request IDs
let requestId = 0;
function generateRequestId(): string {
  return `vidulum_${Date.now()}_${++requestId}`;
}

// Send request to content script and wait for response
function sendRequest(method: string, params: unknown = {}): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const id = generateRequestId();

    pendingRequests.set(id, { resolve, reject });

    window.postMessage(
      {
        type: VIDULUM_REQUEST,
        id,
        method,
        params,
      },
      '*'
    );

    // Timeout after 5 minutes (for user approval flows)
    setTimeout(
      () => {
        if (pendingRequests.has(id)) {
          pendingRequests.delete(id);
          reject(new Error('Request timed out'));
        }
      },
      5 * 60 * 1000
    );
  });
}

// Listen for responses from content script
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (event.data?.type !== VIDULUM_RESPONSE) return;

  const { id, result, error } = event.data;

  const pending = pendingRequests.get(id);
  if (!pending) return;

  pendingRequests.delete(id);

  if (error) {
    pending.reject(new Error(error));
  } else {
    pending.resolve(result);
  }
});

// ============================================================================
// Keplr-compatible API
// ============================================================================

interface Key {
  name: string;
  algo: string;
  pubKey: Uint8Array;
  address: Uint8Array;
  bech32Address: string;
  isNanoLedger: boolean;
  isKeystone: boolean;
}

interface AminoSignResponse {
  signed: {
    chain_id: string;
    account_number: string;
    sequence: string;
    fee: unknown;
    msgs: unknown[];
    memo: string;
  };
  signature: {
    pub_key: { type: string; value: string };
    signature: string;
  };
}

interface DirectSignResponse {
  signed: {
    bodyBytes: Uint8Array;
    authInfoBytes: Uint8Array;
    chainId: string;
    accountNumber: bigint;
  };
  signature: {
    pub_key: { type: string; value: string };
    signature: string;
  };
}

// Create the Keplr-compatible provider object
const keplr = {
  /**
   * Request access to a chain
   */
  async enable(chainId: string | string[]): Promise<void> {
    const chainIds = Array.isArray(chainId) ? chainId : [chainId];
    for (const id of chainIds) {
      await sendRequest('enable', { chainId: id });
    }
  },

  /**
   * Disable (disconnect) from a chain
   */
  async disable(chainId?: string | string[]): Promise<void> {
    const chainIds = chainId ? (Array.isArray(chainId) ? chainId : [chainId]) : undefined;
    await sendRequest('disconnect', { chainIds });
  },

  /**
   * Get account key for a chain
   */
  async getKey(chainId: string): Promise<Key> {
    const result = (await sendRequest('getKey', { chainId })) as {
      name: string;
      algo: string;
      pubKey: number[];
      address: string;
      bech32Address: string;
      isNanoLedger: boolean;
      isKeystone: boolean;
    };

    // Convert pubKey array back to Uint8Array
    return {
      ...result,
      pubKey: new Uint8Array(result.pubKey),
      address: new Uint8Array([]), // Keplr returns empty for non-Ledger
    };
  },

  /**
   * Sign Amino-encoded transaction
   */
  async signAmino(
    chainId: string,
    signer: string,
    signDoc: unknown,
    _signOptions?: unknown
  ): Promise<AminoSignResponse> {
    const result = (await sendRequest('signAmino', {
      chainId,
      signer,
      signDoc,
    })) as AminoSignResponse;

    return result;
  },

  /**
   * Sign Direct (Protobuf) transaction
   */
  async signDirect(
    chainId: string,
    signer: string,
    signDoc: {
      bodyBytes?: Uint8Array | null;
      authInfoBytes?: Uint8Array | null;
      chainId?: string | null;
      accountNumber?: bigint | string | null;
    },
    _signOptions?: unknown
  ): Promise<DirectSignResponse> {
    // Convert Uint8Array to regular arrays for message passing
    const serializedSignDoc = {
      bodyBytes: signDoc.bodyBytes ? Array.from(signDoc.bodyBytes) : [],
      authInfoBytes: signDoc.authInfoBytes ? Array.from(signDoc.authInfoBytes) : [],
      chainId: signDoc.chainId || chainId,
      accountNumber: signDoc.accountNumber?.toString() || '0',
    };

    const result = (await sendRequest('signDirect', {
      chainId,
      signer,
      signDoc: serializedSignDoc,
    })) as {
      signed: {
        bodyBytes: number[];
        authInfoBytes: number[];
        chainId: string;
        accountNumber: string;
      };
      signature: {
        pub_key: { type: string; value: string };
        signature: string;
      };
    };

    // Convert arrays back to Uint8Array
    return {
      signed: {
        bodyBytes: new Uint8Array(result.signed.bodyBytes),
        authInfoBytes: new Uint8Array(result.signed.authInfoBytes),
        chainId: result.signed.chainId,
        accountNumber: BigInt(result.signed.accountNumber),
      },
      signature: result.signature,
    };
  },

  /**
   * Sign arbitrary message (ADR-036)
   */
  async signArbitrary(
    chainId: string,
    signer: string,
    data: string | Uint8Array
  ): Promise<{ pub_key: { type: string; value: string }; signature: string }> {
    const dataToSign = typeof data === 'string' ? data : Array.from(data);

    const result = (await sendRequest('signArbitrary', {
      chainId,
      signer,
      data: dataToSign,
    })) as { pub_key: { type: string; value: string }; signature: string };

    return result;
  },

  /**
   * Verify arbitrary message signature
   */
  async verifyArbitrary(
    chainId: string,
    signer: string,
    data: string | Uint8Array,
    signature: { pub_key: { type: string; value: string }; signature: string }
  ): Promise<boolean> {
    const dataToVerify = typeof data === 'string' ? data : Array.from(data);

    const result = (await sendRequest('verifyArbitrary', {
      chainId,
      signer,
      data: dataToVerify,
      signature,
    })) as boolean;

    return result;
  },

  /**
   * Get offline signer for a chain (Amino)
   */
  getOfflineSigner(chainId: string) {
    return {
      chainId,
      getAccounts: async () => {
        const key = await keplr.getKey(chainId);
        return [
          {
            address: key.bech32Address,
            pubkey: key.pubKey,
            algo: key.algo as 'secp256k1',
          },
        ];
      },
      signAmino: async (signerAddress: string, signDoc: unknown) => {
        return keplr.signAmino(chainId, signerAddress, signDoc);
      },
    };
  },

  /**
   * Get offline signer for a chain (Direct/Protobuf)
   */
  getOfflineSignerOnlyAmino(chainId: string) {
    return keplr.getOfflineSigner(chainId);
  },

  /**
   * Get offline signer that supports both Amino and Direct
   */
  getOfflineSignerAuto: async (chainId: string) => {
    return {
      chainId,
      getAccounts: async () => {
        const key = await keplr.getKey(chainId);
        return [
          {
            address: key.bech32Address,
            pubkey: key.pubKey,
            algo: key.algo as 'secp256k1',
          },
        ];
      },
      signAmino: async (signerAddress: string, signDoc: unknown) => {
        return keplr.signAmino(chainId, signerAddress, signDoc);
      },
      signDirect: async (signerAddress: string, signDoc: unknown) => {
        return keplr.signDirect(chainId, signerAddress, signDoc as any);
      },
    };
  },

  /**
   * Suggest a chain to be added to wallet
   */
  async experimentalSuggestChain(chainInfo: unknown): Promise<void> {
    await sendRequest('suggestChain', { chainInfo });
  },

  /**
   * Get enabled chains
   */
  async getChainInfosWithoutEndpoints(): Promise<unknown[]> {
    const result = (await sendRequest('getChainInfos', {})) as unknown[];
    return result;
  },

  // Version info
  version: '0.12.0', // Keplr compatibility version
  mode: 'extension' as const,
};

// ============================================================================
// Expose to window
// ============================================================================

// Conditionally expose as window.keplr for Keplr compatibility
// NOTE: Code is preserved for future WalletConnect implementation
if (FEATURE_FLAGS.KEPLR_INJECTION) {
  Object.defineProperty(window, 'keplr', {
    value: keplr,
    writable: false,
    configurable: false,
  });
}

// Always expose as window.vidulum for apps that want to specifically use Vidulum
if (FEATURE_FLAGS.VIDULUM_INJECTION) {
  Object.defineProperty(window, 'vidulum', {
    value: keplr,
    writable: false,
    configurable: false,
  });
}

// Conditionally expose getOfflineSigner globally (some dApps expect this)
// Only exposed when Keplr injection is enabled
if (FEATURE_FLAGS.KEPLR_INJECTION) {
  Object.defineProperty(window, 'getOfflineSigner', {
    value: keplr.getOfflineSigner.bind(keplr),
    writable: false,
    configurable: false,
  });

  Object.defineProperty(window, 'getOfflineSignerOnlyAmino', {
    value: keplr.getOfflineSignerOnlyAmino.bind(keplr),
    writable: false,
    configurable: false,
  });

  Object.defineProperty(window, 'getOfflineSignerAuto', {
    value: keplr.getOfflineSignerAuto.bind(keplr),
    writable: false,
    configurable: false,
  });

  // Dispatch event to notify dApps that wallet is ready
  window.dispatchEvent(new Event('keplr_keystorechange'));
}
