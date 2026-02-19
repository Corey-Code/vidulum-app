/**
 * Inpage Provider Script
 *
 * This script runs in the PAGE context (not content script context).
 * It provides the window.keplr API that dApps use to interact with the wallet.
 *
 * Communication flow:
 * dApp → window.keplr → postMessage → content script → background → response
 */

// ============================================================================
// Feature Flags (read from config element injected by content script)
// ============================================================================
function readConfig(): {
  enableKeplrInjection: boolean;
  enableMetamaskInjection: boolean;
  enablePhantomInjection: boolean;
  enableCoinbaseInjection: boolean;
  features?: {
    VIDULUM_INJECTION?: boolean;
    WALLET_CONNECT?: boolean;
    AUTO_OPEN_POPUP?: boolean;
    TX_TRANSLATION?: boolean;
    DEVELOPER_MODE?: boolean;
  };
} {
  try {
    const configElement = document.getElementById('vidulum-config');
    if (configElement && configElement.textContent) {
      return JSON.parse(configElement.textContent);
    }
  } catch {
    // Config parsing failed, use defaults
  }
  return {
    enableKeplrInjection: false,
    enableMetamaskInjection: false,
    enablePhantomInjection: false,
    enableCoinbaseInjection: false,
    features: {
      VIDULUM_INJECTION: true,
      WALLET_CONNECT: false,
      AUTO_OPEN_POPUP: true,
      TX_TRANSLATION: true,
      DEVELOPER_MODE: false,
    },
  };
}

const CONFIG = readConfig();

const FEATURES = {
  // User-configurable: Enable window.keplr injection (Keplr replacement mode)
  KEPLR_INJECTION: CONFIG.enableKeplrInjection,

  // User-configurable: Enable window.ethereum injection (Metamask replacement mode)
  METAMASK_INJECTION: CONFIG.enableMetamaskInjection,

  // User-configurable: Enable window.solana injection (Phantom replacement mode)
  PHANTOM_INJECTION: CONFIG.enablePhantomInjection,

  // User-configurable: Enable Coinbase Wallet injection
  COINBASE_INJECTION: CONFIG.enableCoinbaseInjection,

  // User-configurable: Inject window.vidulum for apps that specifically support Vidulum
  VIDULUM_INJECTION: CONFIG.features?.VIDULUM_INJECTION ?? true,

  // User-configurable: WalletConnect support
  WALLET_CONNECT: CONFIG.features?.WALLET_CONNECT ?? false,

  // User-configurable: Auto-open popup on approval requests
  AUTO_OPEN_POPUP: CONFIG.features?.AUTO_OPEN_POPUP ?? true,

  // User-configurable: Human-readable transaction display
  TX_TRANSLATION: CONFIG.features?.TX_TRANSLATION ?? true,

  // User-configurable: developer console output
  DEVELOPER_MODE: CONFIG.features?.DEVELOPER_MODE ?? false,
};

const ORIGINAL_CONSOLE = {
  log: console.log.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  debug: console.debug.bind(console),
  trace: console.trace.bind(console),
};

if (!FEATURES.DEVELOPER_MODE) {
  const noop = () => {};
  console.log = noop;
  console.info = noop;
  console.warn = noop;
  console.error = noop;
  console.debug = noop;
  console.trace = noop;
} else {
  console.log = ORIGINAL_CONSOLE.log;
  console.info = ORIGINAL_CONSOLE.info;
  console.warn = ORIGINAL_CONSOLE.warn;
  console.error = ORIGINAL_CONSOLE.error;
  console.debug = ORIGINAL_CONSOLE.debug;
  console.trace = ORIGINAL_CONSOLE.trace;
}

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
// Disabled by default to avoid conflicts with actual Keplr extension
if (FEATURES.KEPLR_INJECTION) {
  Object.defineProperty(window, 'keplr', {
    value: keplr,
    writable: false,
    configurable: false,
  });

  // Expose getOfflineSigner globally (some dApps expect this)
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

// Always expose as window.vidulum for apps that specifically support Vidulum
if (FEATURES.VIDULUM_INJECTION) {
  Object.defineProperty(window, 'vidulum', {
    value: keplr,
    writable: false,
    configurable: false,
  });

  // Dispatch Vidulum-specific ready event
  window.dispatchEvent(new Event('vidulum_ready'));
}

// ============================================================================
// Metamask-compatible EIP-1193 Provider
// ============================================================================

if (FEATURES.METAMASK_INJECTION) {
  // EIP-1193 Provider
  class EthereumProvider {
    readonly isMetaMask = true;
    readonly isVidulum = true;
    readonly _vidulum = true;

    // Metamask chainId format (hex string)
    chainId: string | null = null;
    selectedAddress: string | null = null;

    // Event listeners
    private eventListeners: Map<string, Set<Function>> = new Map();

    constructor() {
      // Initialize with Ethereum Mainnet (0x1)
      this.chainId = '0x1';
    }

    // EIP-1193 request method
    async request(args: { method: string; params?: unknown[] }): Promise<unknown> {
      const { method, params = [] } = args;

      switch (method) {
        case 'eth_requestAccounts':
        case 'eth_accounts': {
          try {
            // Request EVM account from Vidulum
            const result = await sendRequest('eth_requestAccounts', {});
            const accounts = result as string[];
            if (accounts.length > 0) {
              this.selectedAddress = accounts[0];
            }
            return accounts;
          } catch (error) {
            throw new Error('User rejected the request');
          }
        }

        case 'eth_chainId': {
          return this.chainId || '0x1';
        }

        case 'net_version': {
          // Return decimal chainId
          const chainIdHex = this.chainId || '0x1';
          return parseInt(chainIdHex, 16).toString();
        }

        case 'eth_getBalance':
        case 'eth_blockNumber':
        case 'eth_getBlockByNumber':
        case 'eth_getTransactionByHash':
        case 'eth_getTransactionReceipt':
        case 'eth_call':
        case 'eth_estimateGas':
        case 'eth_gasPrice':
        case 'eth_maxPriorityFeePerGas':
        case 'eth_feeHistory': {
          // Forward read-only RPC calls to background
          return sendRequest(method, { params });
        }

        case 'eth_sendTransaction': {
          // Request user approval for transaction
          return sendRequest('eth_sendTransaction', { params: params[0] });
        }

        case 'eth_signTransaction': {
          return sendRequest('eth_signTransaction', { params: params[0] });
        }

        case 'personal_sign': {
          // personal_sign(message, account)
          return sendRequest('personal_sign', { message: params[0], account: params[1] });
        }

        case 'eth_sign': {
          // eth_sign(account, message)
          return sendRequest('eth_sign', { account: params[0], message: params[1] });
        }

        case 'eth_signTypedData':
        case 'eth_signTypedData_v3':
        case 'eth_signTypedData_v4': {
          return sendRequest(method, { account: params[0], data: params[1] });
        }

        case 'wallet_switchEthereumChain': {
          const chainIdParam = (params[0] as { chainId: string })?.chainId;
          if (chainIdParam) {
            this.chainId = chainIdParam;
            this.emit('chainChanged', chainIdParam);
            return null;
          }
          throw new Error('Invalid chainId');
        }

        case 'wallet_addEthereumChain': {
          // Request to add a custom network
          await sendRequest('wallet_addEthereumChain', { params: params[0] });
          return null;
        }

        case 'wallet_watchAsset': {
          // Request to add a token
          await sendRequest('wallet_watchAsset', { params: params[0] });
          return true;
        }

        default:
          throw new Error(`Method ${method} not supported`);
      }
    }

    // Legacy send methods for older dApps
    send(
      methodOrPayload: string | { method: string; params?: unknown[] },
      paramsOrCallback?: unknown[] | Function
    ): unknown {
      // Handle different send signatures
      if (typeof methodOrPayload === 'string') {
        // send(method, params) - synchronous (deprecated)
        return this.request({ method: methodOrPayload, params: paramsOrCallback as unknown[] });
      } else if (typeof paramsOrCallback === 'function') {
        // send(payload, callback) - async callback style (deprecated)
        this.request(methodOrPayload)
          .then((result) => (paramsOrCallback as Function)(null, { result }))
          .catch((error) => (paramsOrCallback as Function)(error));
        return undefined;
      } else {
        // send(payload) - promise style (use request instead)
        return this.request(methodOrPayload);
      }
    }

    // Legacy sendAsync for older dApps
    sendAsync(
      payload: { method: string; params?: unknown[] },
      callback: (error: Error | null, response?: { result: unknown }) => void
    ): void {
      this.request(payload)
        .then((result) => callback(null, { result }))
        .catch((error) => callback(error));
    }

    // Event emitter methods
    on(event: string, listener: Function): void {
      if (!this.eventListeners.has(event)) {
        this.eventListeners.set(event, new Set());
      }
      this.eventListeners.get(event)!.add(listener);
    }

    removeListener(event: string, listener: Function): void {
      const listeners = this.eventListeners.get(event);
      if (listeners) {
        listeners.delete(listener);
      }
    }

    emit(event: string, ...args: unknown[]): void {
      const listeners = this.eventListeners.get(event);
      if (listeners) {
        listeners.forEach((listener) => {
          try {
            listener(...args);
          } catch (error) {
            console.error('[Vidulum] Error in event listener:', error);
          }
        });
      }
    }

    // Convenience methods
    enable(): Promise<string[]> {
      return this.request({ method: 'eth_requestAccounts' }) as Promise<string[]>;
    }

    // Check if connected
    isConnected(): boolean {
      return true;
    }
  }

  const ethereum = new EthereumProvider();

  // Expose as window.ethereum
  Object.defineProperty(window, 'ethereum', {
    get() {
      return ethereum;
    },
    set() {
      // Prevent overwriting
    },
    configurable: false,
  });

  // Dispatch ethereum#initialized event (EIP-6963)
  window.dispatchEvent(new Event('ethereum#initialized'));
}

// ============================================================================
// Phantom-compatible Solana Provider
// ============================================================================

if (FEATURES.PHANTOM_INJECTION) {
  // Solana Provider
  class SolanaProvider {
    readonly isPhantom = true;
    readonly isVidulum = true;
    readonly _vidulum = true;

    publicKey: { toBase58: () => string } | null = null;
    isConnected = false;

    // Event listeners
    private eventListeners: Map<string, Set<Function>> = new Map();

    constructor() {
      // Initialize
    }

    // Connect to wallet
    async connect(options?: {
      onlyIfTrusted?: boolean;
    }): Promise<{ publicKey: { toBase58: () => string } }> {
      try {
        if (options?.onlyIfTrusted && !this.isConnected) {
          throw new Error('User not trusted');
        }

        const result = (await sendRequest('sol_connect', {})) as { publicKey: string };

        this.publicKey = {
          toBase58: () => result.publicKey,
        };
        this.isConnected = true;
        this.emit('connect', this.publicKey);

        return { publicKey: this.publicKey };
      } catch (error) {
        throw new Error('User rejected the request');
      }
    }

    // Disconnect from wallet
    async disconnect(): Promise<void> {
      await sendRequest('sol_disconnect', {});
      this.publicKey = null;
      this.isConnected = false;
      this.emit('disconnect');
    }

    // Sign a transaction
    async signTransaction(transaction: unknown): Promise<unknown> {
      if (!this.isConnected) {
        throw new Error('Wallet not connected');
      }
      return sendRequest('sol_signTransaction', { transaction });
    }

    // Sign multiple transactions
    async signAllTransactions(transactions: unknown[]): Promise<unknown[]> {
      if (!this.isConnected) {
        throw new Error('Wallet not connected');
      }
      return sendRequest('sol_signAllTransactions', { transactions }) as Promise<unknown[]>;
    }

    // Sign a message
    async signMessage(
      message: Uint8Array,
      display?: string
    ): Promise<{ signature: Uint8Array; publicKey: { toBase58: () => string } }> {
      if (!this.isConnected) {
        throw new Error('Wallet not connected');
      }
      const result = (await sendRequest('sol_signMessage', {
        message: Array.from(message),
        display,
      })) as { signature: number[]; publicKey: string };

      return {
        signature: new Uint8Array(result.signature),
        publicKey: {
          toBase58: () => result.publicKey,
        },
      };
    }

    // Sign and send transaction
    async signAndSendTransaction(
      transaction: unknown,
      options?: unknown
    ): Promise<{ signature: string }> {
      if (!this.isConnected) {
        throw new Error('Wallet not connected');
      }
      return sendRequest('sol_signAndSendTransaction', { transaction, options }) as Promise<{
        signature: string;
      }>;
    }

    // Event emitter methods
    on(event: string, listener: Function): void {
      if (!this.eventListeners.has(event)) {
        this.eventListeners.set(event, new Set());
      }
      this.eventListeners.get(event)!.add(listener);
    }

    removeListener(event: string, listener: Function): void {
      const listeners = this.eventListeners.get(event);
      if (listeners) {
        listeners.delete(listener);
      }
    }

    emit(event: string, ...args: unknown[]): void {
      const listeners = this.eventListeners.get(event);
      if (listeners) {
        listeners.forEach((listener) => {
          try {
            listener(...args);
          } catch (error) {
            console.error('[Vidulum] Error in Solana event listener:', error);
          }
        });
      }
    }

    // Request method for compatibility
    async request(args: { method: string; params?: unknown }): Promise<unknown> {
      const { method, params } = args;

      switch (method) {
        case 'connect':
          return this.connect(params as any);
        case 'disconnect':
          return this.disconnect();
        case 'signTransaction':
          return this.signTransaction((params as any)?.transaction);
        case 'signAllTransactions':
          return this.signAllTransactions((params as any)?.transactions);
        case 'signMessage':
          return this.signMessage((params as any)?.message, (params as any)?.display);
        case 'signAndSendTransaction':
          return this.signAndSendTransaction(
            (params as any)?.transaction,
            (params as any)?.options
          );
        default:
          throw new Error(`Method ${method} not supported`);
      }
    }
  }

  const solana = new SolanaProvider();

  // Expose as window.solana
  Object.defineProperty(window, 'solana', {
    get() {
      return solana;
    },
    set() {
      // Prevent overwriting
    },
    configurable: false,
  });

  // Also expose as window.phantom.solana for full Phantom compatibility
  Object.defineProperty(window, 'phantom', {
    value: { solana },
    writable: false,
    configurable: false,
  });
}

// ============================================================================
// Coinbase Wallet Provider
// ============================================================================

if (FEATURES.COINBASE_INJECTION) {
  // Coinbase Wallet uses the same EIP-1193 interface as Metamask
  // but identifies itself differently
  class CoinbaseProvider {
    readonly isCoinbaseWallet = true;
    readonly isVidulum = true;
    readonly _vidulum = true;

    // Also support Metamask compatibility
    readonly isMetaMask = false;

    chainId: string | null = null;
    selectedAddress: string | null = null;

    // Event listeners
    private eventListeners: Map<string, Set<Function>> = new Map();

    constructor() {
      this.chainId = '0x1';
    }

    // EIP-1193 request method (same as Metamask)
    async request(args: { method: string; params?: unknown[] }): Promise<unknown> {
      const { method, params = [] } = args;

      switch (method) {
        case 'eth_requestAccounts':
        case 'eth_accounts': {
          try {
            const result = await sendRequest('eth_requestAccounts', {});
            const accounts = result as string[];
            if (accounts.length > 0) {
              this.selectedAddress = accounts[0];
            }
            return accounts;
          } catch (error) {
            throw new Error('User rejected the request');
          }
        }

        case 'eth_chainId': {
          return this.chainId || '0x1';
        }

        case 'net_version': {
          const chainIdHex = this.chainId || '0x1';
          return parseInt(chainIdHex, 16).toString();
        }

        case 'eth_getBalance':
        case 'eth_blockNumber':
        case 'eth_getBlockByNumber':
        case 'eth_getTransactionByHash':
        case 'eth_getTransactionReceipt':
        case 'eth_call':
        case 'eth_estimateGas':
        case 'eth_gasPrice':
        case 'eth_maxPriorityFeePerGas':
        case 'eth_feeHistory': {
          return sendRequest(method, { params });
        }

        case 'eth_sendTransaction': {
          return sendRequest('eth_sendTransaction', { params: params[0] });
        }

        case 'eth_signTransaction': {
          return sendRequest('eth_signTransaction', { params: params[0] });
        }

        case 'personal_sign': {
          return sendRequest('personal_sign', { message: params[0], account: params[1] });
        }

        case 'eth_sign': {
          return sendRequest('eth_sign', { account: params[0], message: params[1] });
        }

        case 'eth_signTypedData':
        case 'eth_signTypedData_v3':
        case 'eth_signTypedData_v4': {
          return sendRequest(method, { account: params[0], data: params[1] });
        }

        case 'wallet_switchEthereumChain': {
          const chainIdParam = (params[0] as { chainId: string })?.chainId;
          if (chainIdParam) {
            this.chainId = chainIdParam;
            this.emit('chainChanged', chainIdParam);
            return null;
          }
          throw new Error('Invalid chainId');
        }

        case 'wallet_addEthereumChain': {
          await sendRequest('wallet_addEthereumChain', { params: params[0] });
          return null;
        }

        case 'wallet_watchAsset': {
          await sendRequest('wallet_watchAsset', { params: params[0] });
          return true;
        }

        default:
          throw new Error(`Method ${method} not supported`);
      }
    }

    // Legacy send methods
    send(
      methodOrPayload: string | { method: string; params?: unknown[] },
      paramsOrCallback?: unknown[] | Function
    ): unknown {
      if (typeof methodOrPayload === 'string') {
        return this.request({ method: methodOrPayload, params: paramsOrCallback as unknown[] });
      } else if (typeof paramsOrCallback === 'function') {
        this.request(methodOrPayload)
          .then((result) => (paramsOrCallback as Function)(null, { result }))
          .catch((error) => (paramsOrCallback as Function)(error));
        return undefined;
      } else {
        return this.request(methodOrPayload);
      }
    }

    sendAsync(
      payload: { method: string; params?: unknown[] },
      callback: (error: Error | null, response?: { result: unknown }) => void
    ): void {
      this.request(payload)
        .then((result) => callback(null, { result }))
        .catch((error) => callback(error));
    }

    // Event emitter methods
    on(event: string, listener: Function): void {
      if (!this.eventListeners.has(event)) {
        this.eventListeners.set(event, new Set());
      }
      this.eventListeners.get(event)!.add(listener);
    }

    removeListener(event: string, listener: Function): void {
      const listeners = this.eventListeners.get(event);
      if (listeners) {
        listeners.delete(listener);
      }
    }

    emit(event: string, ...args: unknown[]): void {
      const listeners = this.eventListeners.get(event);
      if (listeners) {
        listeners.forEach((listener) => {
          try {
            listener(...args);
          } catch (error) {
            console.error('[Vidulum] Error in Coinbase Wallet event listener:', error);
          }
        });
      }
    }

    enable(): Promise<string[]> {
      return this.request({ method: 'eth_requestAccounts' }) as Promise<string[]>;
    }

    isConnected(): boolean {
      return true;
    }
  }

  const coinbaseWallet = new CoinbaseProvider();

  // Expose as window.ethereum if Metamask is not enabled
  // Coinbase Wallet can coexist with Metamask via different access patterns
  if (!FEATURES.METAMASK_INJECTION) {
    Object.defineProperty(window, 'ethereum', {
      get() {
        return coinbaseWallet;
      },
      set() {
        // Prevent overwriting
      },
      configurable: false,
    });
  }

  // Also expose as window.coinbaseWalletExtension
  Object.defineProperty(window, 'coinbaseWalletExtension', {
    value: coinbaseWallet,
    writable: false,
    configurable: false,
  });
}
