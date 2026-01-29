import browser from 'webextension-polyfill';
import { MessageType, Message, MessageResponse } from '@/types/messages';
import { Keyring } from '@/lib/crypto/keyring';
import { EncryptedStorage } from '@/lib/storage/encrypted-storage';
import { getChainInfo } from '@/lib/cosmos/chains';

// In-memory storage for the current session
class SessionManager {
  private keyring: Keyring | null = null;
  private connectedDapps: Map<string, Set<string>> = new Map(); // origin -> chainIds

  async initialize() {
    const sessionId = await EncryptedStorage.getSession();
    if (sessionId) {
      // Try to restore the session
      // In production, you might want to keep password in memory temporarily
      // or require re-authentication
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
    this.connectedDapps.clear();
  }

  isConnected(origin: string, chainId: string): boolean {
    const chains = this.connectedDapps.get(origin);
    return chains ? chains.has(chainId) : false;
  }

  connect(origin: string, chainId: string) {
    let chains = this.connectedDapps.get(origin);
    if (!chains) {
      chains = new Set();
      this.connectedDapps.set(origin, chains);
    }
    chains.add(chainId);
  }

  disconnect(origin: string, chainId?: string) {
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
  }
}

const sessionManager = new SessionManager();

// Initialize on startup
sessionManager.initialize();

// Message handler
browser.runtime.onMessage.addListener(async (message: Message, sender): Promise<MessageResponse> => {
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

      case MessageType.UNLOCK_WALLET:
        return await handleUnlock(message.payload);

      case MessageType.LOCK_WALLET:
        return handleLock();

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
});

// Handler functions
async function handleEnable(origin: string, payload: any): Promise<MessageResponse> {
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
    return { success: false, error: 'Wallet is locked' };
  }

  // In production, show approval popup to user
  // For now, auto-approve for development
  const approved = await showApprovalPopup(origin, chainId);

  if (approved) {
    sessionManager.connect(origin, chainId);
    return { success: true, data: null };
  }

  return { success: false, error: 'User rejected the connection' };
}

async function handleGetKey(origin: string, payload: any): Promise<MessageResponse> {
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

  const key = {
    name: account.name,
    algo: account.algo,
    pubKey: btoa(String.fromCharCode(...account.pubKey)),
    address: account.address,
    bech32Address: account.address,
    isNanoLedger: false,
    isKeystone: false,
  };

  return { success: true, data: key };
}

async function handleSignAmino(origin: string, payload: any): Promise<MessageResponse> {
  const { chainId, signer, signDoc } = payload;

  if (!sessionManager.isConnected(origin, chainId)) {
    return { success: false, error: 'Not connected to this chain' };
  }

  const keyring = sessionManager.getKeyring();
  if (!keyring) {
    return { success: false, error: 'Wallet is locked' };
  }

  // In production, show transaction approval popup
  const approved = await showTransactionApproval(signDoc);

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

async function handleSignDirect(origin: string, payload: any): Promise<MessageResponse> {
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

  // In production, show transaction approval popup
  const approved = await showTransactionApproval(directSignDoc);

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

async function handleSignArbitrary(origin: string, payload: any): Promise<MessageResponse> {
  const { chainId, signer, data } = payload;

  if (!sessionManager.isConnected(origin, chainId)) {
    return { success: false, error: 'Not connected to this chain' };
  }

  const keyring = sessionManager.getKeyring();
  if (!keyring) {
    return { success: false, error: 'Wallet is locked' };
  }

  // In production, show signing approval popup
  const approved = await showSigningApproval(data);

  if (!approved) {
    return { success: false, error: 'User rejected the signing request' };
  }

  const result = await keyring.signArbitrary(signer, data);

  return { success: true, data: result };
}

function handleDisconnect(origin: string, payload: any): MessageResponse {
  const { chainId } = payload;
  sessionManager.disconnect(origin, chainId);
  return { success: true, data: null };
}

async function handleUnlock(payload: any): Promise<MessageResponse> {
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

function handleLock(): MessageResponse {
  sessionManager.clearKeyring();
  EncryptedStorage.clearSession();
  return { success: true, data: null };
}

// Helper functions to show approval popups
// In production, these would open the extension popup with approval UI
async function showApprovalPopup(origin: string, chainId: string): Promise<boolean> {
  // TODO: Implement approval popup
  // For now, auto-approve in development
  console.log(`Connection request from ${origin} for chain ${chainId}`);
  return true;
}

async function showTransactionApproval(signDoc: any): Promise<boolean> {
  // TODO: Implement transaction approval popup
  console.log('Transaction approval request:', signDoc);
  return true;
}

async function showSigningApproval(data: any): Promise<boolean> {
  // TODO: Implement signing approval popup
  console.log('Signing approval request:', data);
  return true;
}

// Auto-lock on browser close
browser.runtime.onSuspend.addListener(() => {
  sessionManager.clearKeyring();
});
