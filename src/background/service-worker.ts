import browser from 'webextension-polyfill';
import { MessageType, Message, MessageResponse } from '@/types/messages';
import { Keyring } from '@/lib/crypto/keyring';
import { EncryptedStorage } from '@/lib/storage/encrypted-storage';
import { getChainInfo, SUPPORTED_CHAINS } from '@/lib/cosmos/chains';

// Storage key for connected dApps
const CONNECTED_DAPPS_KEY = 'connected_dapps';

// In-memory storage for the current session
class SessionManager {
  private keyring: Keyring | null = null;
  private connectedDapps: Map<string, Set<string>> = new Map(); // origin -> chainIds
  private initialized: boolean = false;

  async initialize() {
    if (this.initialized) return;

    // Restore connected dApps from storage
    await this.loadConnections();

    const sessionId = await EncryptedStorage.getSession();
    if (sessionId) {
      // Session exists but keyring needs to be synced from popup
      // The popup will send SYNC_KEYRING when it opens
    }

    this.initialized = true;
  }

  private async loadConnections() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        const result = await chrome.storage.local.get(CONNECTED_DAPPS_KEY);
        const stored = result[CONNECTED_DAPPS_KEY] as Record<string, string[]> | undefined;
        if (stored) {
          for (const [origin, chainIds] of Object.entries(stored)) {
            this.connectedDapps.set(origin, new Set(chainIds));
          }
        }
      }
    } catch {
      // Ignore errors
    }
  }

  private async saveConnections() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        const toStore: Record<string, string[]> = {};
        for (const [origin, chainIds] of this.connectedDapps.entries()) {
          toStore[origin] = Array.from(chainIds);
        }
        await chrome.storage.local.set({ [CONNECTED_DAPPS_KEY]: toStore });
      }
    } catch {
      // Ignore errors
    }
  }

  setKeyring(keyring: Keyring) {
    this.keyring = keyring;
  }

  getKeyring(): Keyring | null {
    return this.keyring;
  }

  clearKeyring() {
    if (this.keyring) {
      this.keyring.clear();
    }
    this.keyring = null;
    // Note: Don't clear connections when locking - keep them for when user unlocks
  }

  async clearConnections() {
    this.connectedDapps.clear();
    await this.saveConnections();
  }

  isConnected(origin: string, chainId: string): boolean {
    const chains = this.connectedDapps.get(origin);
    return chains ? chains.has(chainId) : false;
  }

  async connect(origin: string, chainId: string) {
    let chains = this.connectedDapps.get(origin);
    if (!chains) {
      chains = new Set();
      this.connectedDapps.set(origin, chains);
    }
    chains.add(chainId);
    await this.saveConnections();
  }

  async disconnect(origin: string, chainId?: string) {
    if (chainId) {
      const chains = this.connectedDapps.get(origin);
      if (chains) {
        chains.delete(chainId);
        if (chains.size === 0) {
          this.connectedDapps.delete(origin);
        }
      }
    } else {
      this.connectedDapps.delete(origin);
    }
    await this.saveConnections();
  }

  // Debug helper to see connected dApps
  getConnectedDapps(): Record<string, string[]> {
    const result: Record<string, string[]> = {};
    this.connectedDapps.forEach((chains, origin) => {
      result[origin] = Array.from(chains);
    });
    return result;
  }
}

const sessionManager = new SessionManager();

// Message handler
browser.runtime.onMessage.addListener(
  async (message: Message, sender): Promise<MessageResponse> => {
    // Ensure session manager is initialized before handling messages
    await sessionManager.initialize();

    let origin = '';
    if (sender && typeof sender === 'object') {
      if (typeof (sender as any).origin === 'string' && (sender as any).origin) {
        origin = (sender as any).origin;
      } else if ((sender as any).tab && typeof (sender as any).tab.url === 'string') {
        try {
          const url = new URL((sender as any).tab.url);
          origin = url.origin;
        } catch {
          origin = '';
        }
      }
    }

    try {
      switch (message.type) {
        case MessageType.ENABLE:
          return await handleEnable(origin, message.payload);

        case MessageType.GET_KEY:
          return await handleGetKey(origin, message.payload);

        case MessageType.SIGN_AMINO:
          return await handleSignAmino(origin, message.payload);

        case MessageType.SIGN_DIRECT:
          return await handleSignDirect(origin, message.payload);

        case MessageType.SIGN_ARBITRARY:
          return await handleSignArbitrary(origin, message.payload);

        case MessageType.DISCONNECT:
          return handleDisconnect(origin, message.payload);

        case MessageType.REQUEST_CONNECTION:
          // Handle experimentalSuggestChain - for now, just acknowledge
          // In production, you might want to validate and store the chain info
          return handleSuggestChain(message.payload);

        case MessageType.GET_CONNECTION_STATUS:
          // Handle getChainInfosWithoutEndpoints
          return handleGetChainInfos();

        case MessageType.VERIFY_ARBITRARY:
          return await handleVerifyArbitrary(origin, message.payload);

        case MessageType.UNLOCK_WALLET:
          return await handleUnlock(message.payload);

        case MessageType.LOCK_WALLET:
          return handleLock();

        case MessageType.SYNC_KEYRING:
          return await handleSyncKeyring(message.payload);

        case MessageType.GET_APPROVAL:
          return await handleGetApproval(message.payload);

        case MessageType.RESOLVE_APPROVAL:
          return await handleResolveApproval(message.payload);

        default:
          return {
            success: false,
            error: `Unknown message type: ${message.type}`,
          };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
);

// Handler functions
async function handleEnable(origin: string, payload: any = {}): Promise<MessageResponse> {
  const { chainId } = payload;

  if (!chainId) {
    return { success: false, error: 'Chain ID is required' };
  }

  const chainInfo = getChainInfo(chainId);
  if (!chainInfo) {
    return { success: false, error: `Unsupported chain: ${chainId}` };
  }

  const keyring = sessionManager.getKeyring();
  if (!keyring) {
    return { success: false, error: 'Wallet is locked. Please unlock your wallet first.' };
  }

  // In production, show approval popup to user
  // For now, auto-approve for development
  const approved = await showApprovalPopup(origin, chainId);

  if (approved) {
    await sessionManager.connect(origin, chainId);
    return { success: true, data: null };
  }

  return { success: false, error: 'User rejected the connection' };
}

async function handleGetKey(origin: string, payload: any = {}): Promise<MessageResponse> {
  const { chainId } = payload;

  if (!sessionManager.isConnected(origin, chainId)) {
    return { success: false, error: 'Not connected to this chain' };
  }

  const keyring = sessionManager.getKeyring();
  if (!keyring) {
    return { success: false, error: 'Wallet is locked' };
  }

  const accounts = keyring.getAccounts();
  if (accounts.length === 0) {
    return { success: false, error: 'No accounts available' };
  }

  const account = accounts[0]; // Use first account for now

  // Get the chain's bech32 prefix and convert address
  const chainInfo = getChainInfo(chainId);
  let bech32Address = account.address;

  if (chainInfo?.bech32Config?.bech32PrefixAccAddr) {
    // Convert address to chain's prefix
    bech32Address = Keyring.convertAddress(
      account.address,
      chainInfo.bech32Config.bech32PrefixAccAddr
    );
  }

  const key = {
    name: account.name,
    algo: account.algo,
    // Serialize pubKey as array for consistency with signDirect bytes handling
    // Consumer can convert back: new Uint8Array(pubKey)
    pubKey: Array.from(account.pubKey),
    address: bech32Address,
    bech32Address: bech32Address,
    isNanoLedger: false,
    isKeystone: false,
  };

  return { success: true, data: key };
}

async function handleSignAmino(origin: string, payload: any = {}): Promise<MessageResponse> {
  const { chainId, signer, signDoc } = payload;

  if (!sessionManager.isConnected(origin, chainId)) {
    return { success: false, error: 'Not connected to this chain' };
  }

  const keyring = sessionManager.getKeyring();
  if (!keyring) {
    return { success: false, error: 'Wallet is locked' };
  }

  // Show transaction approval popup
  const approved = await showTransactionApproval(signDoc, origin);

  if (!approved) {
    return { success: false, error: 'User rejected the transaction' };
  }

  const result = await keyring.signAmino(signer, signDoc);

  return {
    success: true,
    data: {
      signed: result.signed,
      signature: {
        pub_key: {
          type: 'tendermint/PubKeySecp256k1',
          value: result.signature.pub_key.value,
        },
        signature: result.signature.signature,
      },
    },
  };
}

async function handleSignDirect(origin: string, payload: any = {}): Promise<MessageResponse> {
  const { chainId, signer, signDoc } = payload;

  if (!sessionManager.isConnected(origin, chainId)) {
    return { success: false, error: 'Not connected to this chain' };
  }

  const keyring = sessionManager.getKeyring();
  if (!keyring) {
    return { success: false, error: 'Wallet is locked' };
  }

  // Convert arrays back to Uint8Array
  const directSignDoc = {
    bodyBytes: new Uint8Array(signDoc.bodyBytes),
    authInfoBytes: new Uint8Array(signDoc.authInfoBytes),
    chainId: signDoc.chainId,
    accountNumber: BigInt(signDoc.accountNumber),
  };

  // Show transaction approval popup
  const approved = await showTransactionApproval(directSignDoc, origin);

  if (!approved) {
    return { success: false, error: 'User rejected the transaction' };
  }

  const result = await keyring.signDirect(signer, directSignDoc);

  return {
    success: true,
    data: {
      signed: {
        bodyBytes: Array.from(result.signed.bodyBytes),
        authInfoBytes: Array.from(result.signed.authInfoBytes),
        chainId: result.signed.chainId,
        accountNumber: result.signed.accountNumber.toString(),
      },
      signature: {
        pub_key: {
          type: 'tendermint/PubKeySecp256k1',
          value: result.signature.pub_key.value,
        },
        signature: result.signature.signature,
      },
    },
  };
}

async function handleSignArbitrary(origin: string, payload: any = {}): Promise<MessageResponse> {
  const { chainId, signer, data } = payload;

  if (!sessionManager.isConnected(origin, chainId)) {
    return { success: false, error: 'Not connected to this chain' };
  }

  const keyring = sessionManager.getKeyring();
  if (!keyring) {
    return { success: false, error: 'Wallet is locked' };
  }

  // Show signing approval popup
  const approved = await showSigningApproval(data, origin);

  if (!approved) {
    return { success: false, error: 'User rejected the signing request' };
  }

  const result = await keyring.signArbitrary(signer, data);

  return { success: true, data: result };
}

async function handleDisconnect(origin: string, payload: any = {}): Promise<MessageResponse> {
  const { chainId } = payload;
  await sessionManager.disconnect(origin, chainId);
  return { success: true, data: null };
}

// Storage key for custom chains
const CUSTOM_CHAINS_KEY = 'custom_chains';

// Get stored custom chains
async function getCustomChains(): Promise<Record<string, any>> {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      const result = await chrome.storage.local.get(CUSTOM_CHAINS_KEY);
      return result[CUSTOM_CHAINS_KEY] || {};
    }
  } catch {
    // Ignore errors
  }
  return {};
}

// Save custom chain
async function saveCustomChain(chainInfo: any): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    const customChains = await getCustomChains();
    customChains[chainInfo.chainId] = chainInfo;
    await chrome.storage.local.set({ [CUSTOM_CHAINS_KEY]: customChains });
  }
}

// Validate chain info has required fields
function validateChainInfo(chainInfo: any): boolean {
  if (!chainInfo) return false;

  // Required fields per Keplr's ChainInfo interface
  const requiredFields = [
    'chainId',
    'chainName',
    'rpc',
    'rest',
    'bip44',
    'bech32Config',
    'currencies',
    'feeCurrencies',
    'stakeCurrency',
  ];

  for (const field of requiredFields) {
    if (!(field in chainInfo)) {
      return false;
    }
  }

  // Validate nested required fields
  if (!chainInfo.bip44?.coinType) return false;
  if (!chainInfo.bech32Config?.bech32PrefixAccAddr) return false;
  if (!Array.isArray(chainInfo.currencies) || chainInfo.currencies.length === 0) return false;
  if (!Array.isArray(chainInfo.feeCurrencies) || chainInfo.feeCurrencies.length === 0) return false;

  return true;
}

async function handleSuggestChain(payload: any = {}): Promise<MessageResponse> {
  const { chainInfo } = payload;

  // Validate chain info
  if (!validateChainInfo(chainInfo)) {
    return { success: false, error: 'Invalid chain info: missing required fields' };
  }

  // Check if chain is already natively supported
  const existingChain = getChainInfo(chainInfo.chainId);
  if (existingChain) {
    // Chain already supported, just acknowledge
    return { success: true, data: null };
  }

  // Store the custom chain config
  try {
    await saveCustomChain(chainInfo);
    return { success: true, data: null };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save chain config',
    };
  }
}

function handleGetChainInfos(): MessageResponse {
  // Return info about supported chains (without endpoints for privacy)
  // This is used by dApps to check what chains the wallet supports
  const chains = Array.from(SUPPORTED_CHAINS.values()).map((chain) => ({
    chainId: chain.chainId,
    chainName: chain.chainName,
    bech32Config: chain.bech32Config,
    bip44: chain.bip44,
    currencies: chain.currencies,
    feeCurrencies: chain.feeCurrencies,
    stakeCurrency: chain.stakeCurrency,
  }));

  return { success: true, data: chains };
}

async function handleVerifyArbitrary(origin: string, payload: any = {}): Promise<MessageResponse> {
  const { chainId, signer, data, signature } = payload;

  if (!sessionManager.isConnected(origin, chainId)) {
    return { success: false, error: 'Not connected to this chain' };
  }

  const keyring = sessionManager.getKeyring();
  if (!keyring) {
    return { success: false, error: 'Wallet is locked' };
  }

  try {
    const isValid = await keyring.verifyArbitrary(signer, data, signature);
    return { success: true, data: isValid };
  } catch (error) {
    return { success: true, data: false };
  }
}

async function handleUnlock(payload: any = {}): Promise<MessageResponse> {
  const { password } = payload;

  if (!password) {
    return { success: false, error: 'Password is required' };
  }

  try {
    const wallet = await EncryptedStorage.loadWallet(password);

    if (!wallet) {
      return { success: false, error: 'Invalid password' };
    }

    const keyring = new Keyring();
    await keyring.createFromMnemonic(wallet.mnemonic, 'bze');

    sessionManager.setKeyring(keyring);

    const sessionId = crypto.randomUUID();
    await EncryptedStorage.setSession(sessionId);

    return { success: true, data: { accounts: wallet.accounts } };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to unlock wallet',
    };
  }
}

async function handleLock(): Promise<MessageResponse> {
  sessionManager.clearKeyring();
  await EncryptedStorage.clearSession();
  return { success: true, data: null };
}

async function handleSyncKeyring(payload: any = {}): Promise<MessageResponse> {
  const { serializedKeyring } = payload;

  if (!serializedKeyring) {
    return { success: false, error: 'Serialized keyring is required' };
  }

  try {
    // Restore keyring from serialized data
    const keyring = new Keyring();
    await keyring.restoreFromSerialized(serializedKeyring);

    sessionManager.setKeyring(keyring);

    return { success: true, data: null };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to sync keyring',
    };
  }
}

// ============================================================================
// Approval Popup System
// ============================================================================

// Storage key for pending approvals
const PENDING_APPROVALS_KEY = 'pending_approvals';

// Pending approval structure for storage
interface StoredApproval {
  id: string;
  type: 'connection' | 'transaction' | 'signing';
  origin: string;
  data: any;
  createdAt: number;
}

// In-memory resolvers for pending approvals
const approvalResolvers = new Map<
  string,
  { resolve: (approved: boolean) => void; reject: (error: Error) => void }
>();

// Generate unique approval ID
let approvalIdCounter = 0;
function generateApprovalId(): string {
  return `approval_${Date.now()}_${++approvalIdCounter}`;
}

// Save pending approval to storage (so popup can access it)
async function savePendingApproval(approval: StoredApproval): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    const result = await chrome.storage.local.get(PENDING_APPROVALS_KEY);
    const approvals: StoredApproval[] = result[PENDING_APPROVALS_KEY] || [];
    approvals.push(approval);
    await chrome.storage.local.set({ [PENDING_APPROVALS_KEY]: approvals });
    // Update badge to show pending count
    await updateBadge(approvals.length);
  }
}

// Get all pending approvals from storage
async function getPendingApprovals(): Promise<StoredApproval[]> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    const result = await chrome.storage.local.get(PENDING_APPROVALS_KEY);
    return result[PENDING_APPROVALS_KEY] || [];
  }
  return [];
}

// Remove pending approval from storage
async function removePendingApproval(approvalId: string): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    const approvals = await getPendingApprovals();
    const filtered = approvals.filter((a) => a.id !== approvalId);
    await chrome.storage.local.set({ [PENDING_APPROVALS_KEY]: filtered });
    await updateBadge(filtered.length);
  }
}

// Update extension badge to show pending approval count
async function updateBadge(count: number): Promise<void> {
  try {
    if (typeof chrome !== 'undefined' && chrome.action) {
      if (count > 0) {
        await chrome.action.setBadgeText({ text: count.toString() });
        await chrome.action.setBadgeBackgroundColor({ color: '#F97316' }); // Orange
      } else {
        await chrome.action.setBadgeText({ text: '' });
      }
    }
  } catch {
    // Badge API might not be available in all contexts
  }
}

// Track if popup window is already open to avoid duplicates
let popupWindowId: number | null = null;

// Open the extension popup automatically when approval is needed
async function openExtensionPopup(): Promise<void> {
  try {
    // Check if popup window is already open
    if (popupWindowId !== null) {
      try {
        const existingWindow = await chrome.windows.get(popupWindowId);
        if (existingWindow) {
          // Focus the existing window
          await chrome.windows.update(popupWindowId, { focused: true });
          return;
        }
      } catch {
        // Window doesn't exist anymore
        popupWindowId = null;
      }
    }

    // Try chrome.action.openPopup first (Chrome 99+, requires user gesture in some contexts)
    try {
      if (typeof chrome !== 'undefined' && chrome.action?.openPopup) {
        await chrome.action.openPopup();
        return;
      }
    } catch {
      // openPopup failed (likely no user gesture), fall back to window.create
    }

    // Fallback: Open as a popup window
    const popupUrl = chrome.runtime.getURL('popup.html');
    const newWindow = await chrome.windows.create({
      url: popupUrl,
      type: 'popup',
      width: 400,
      height: 650,
      focused: true,
    });

    if (newWindow.id) {
      popupWindowId = newWindow.id;

      // Listen for window close to reset the ID
      chrome.windows.onRemoved.addListener(function onRemoved(windowId) {
        if (windowId === popupWindowId) {
          popupWindowId = null;
          chrome.windows.onRemoved.removeListener(onRemoved);
        }
      });
    }
  } catch (error) {
    // Fallback failed - user will need to click the extension icon
    console.error('Failed to open popup:', error);
  }
}

// Get pending approval by ID (called by popup to get approval details)
async function handleGetApproval(payload: any = {}): Promise<MessageResponse> {
  const { approvalId } = payload;

  if (approvalId) {
    // Get specific approval
    const approvals = await getPendingApprovals();
    const approval = approvals.find((a) => a.id === approvalId);
    if (!approval) {
      return { success: false, error: 'Approval not found' };
    }
    return { success: true, data: approval };
  } else {
    // Get first pending approval (for when popup opens normally)
    const approvals = await getPendingApprovals();
    if (approvals.length === 0) {
      return { success: true, data: null };
    }
    return { success: true, data: approvals[0] };
  }
}

// Resolve pending approval (called by popup when user approves/rejects)
async function handleResolveApproval(payload: any = {}): Promise<MessageResponse> {
  const { approvalId, approved } = payload;

  // Remove from storage
  await removePendingApproval(approvalId);

  // Resolve the in-memory promise if it exists
  const resolver = approvalResolvers.get(approvalId);
  if (resolver) {
    approvalResolvers.delete(approvalId);
    resolver.resolve(approved);
  }

  return { success: true, data: null };
}

// Helper functions to show approval popups
async function showApprovalPopup(origin: string, chainId: string): Promise<boolean> {
  const approvalId = generateApprovalId();

  return new Promise((resolve, reject) => {
    // Store resolver in memory
    approvalResolvers.set(approvalId, { resolve, reject });

    // Save approval to storage for popup to access
    const approval: StoredApproval = {
      id: approvalId,
      type: 'connection',
      origin,
      data: { chainId },
      createdAt: Date.now(),
    };

    savePendingApproval(approval)
      .then(() => {
        // Open the extension popup automatically
        openExtensionPopup();
      })
      .catch((error) => {
        approvalResolvers.delete(approvalId);
        reject(error);
      });

    // Timeout after 5 minutes
    setTimeout(
      async () => {
        if (approvalResolvers.has(approvalId)) {
          approvalResolvers.delete(approvalId);
          await removePendingApproval(approvalId);
          resolve(false); // Auto-reject on timeout
        }
      },
      5 * 60 * 1000
    );
  });
}

async function showTransactionApproval(signDoc: any, origin: string = ''): Promise<boolean> {
  const approvalId = generateApprovalId();

  return new Promise((resolve, reject) => {
    approvalResolvers.set(approvalId, { resolve, reject });

    const approval: StoredApproval = {
      id: approvalId,
      type: 'transaction',
      origin,
      data: { signDoc },
      createdAt: Date.now(),
    };

    savePendingApproval(approval)
      .then(() => {
        // Open the extension popup automatically
        openExtensionPopup();
      })
      .catch((error) => {
        approvalResolvers.delete(approvalId);
        reject(error);
      });

    setTimeout(
      async () => {
        if (approvalResolvers.has(approvalId)) {
          approvalResolvers.delete(approvalId);
          await removePendingApproval(approvalId);
          resolve(false);
        }
      },
      5 * 60 * 1000
    );
  });
}

async function showSigningApproval(data: any, origin: string = ''): Promise<boolean> {
  const approvalId = generateApprovalId();

  return new Promise((resolve, reject) => {
    approvalResolvers.set(approvalId, { resolve, reject });

    const approval: StoredApproval = {
      id: approvalId,
      type: 'signing',
      origin,
      data: { message: data },
      createdAt: Date.now(),
    };

    savePendingApproval(approval)
      .then(() => {
        // Open the extension popup automatically
        openExtensionPopup();
      })
      .catch((error) => {
        approvalResolvers.delete(approvalId);
        reject(error);
      });

    setTimeout(
      async () => {
        if (approvalResolvers.has(approvalId)) {
          approvalResolvers.delete(approvalId);
          await removePendingApproval(approvalId);
          resolve(false);
        }
      },
      5 * 60 * 1000
    );
  });
}

// Auto-lock on browser close
browser.runtime.onSuspend.addListener(() => {
  sessionManager.clearKeyring();
});
