import { create } from 'zustand';
import browser from 'webextension-polyfill';
import {
  Keyring,
  KeyringAccount,
  BitcoinKeyringAccount,
  EvmKeyringAccount,
} from '@/lib/crypto/keyring';
import { EncryptedStorage } from '@/lib/storage/encrypted-storage';
import { MnemonicManager } from '@/lib/crypto/mnemonic';
import { cosmosClient } from '@/lib/cosmos/client';
import { SUPPORTED_CHAINS } from '@/lib/cosmos/chains';
import { coin } from '@cosmjs/stargate';
import { simulateSendFee } from '@/lib/cosmos/fees';
import { networkRegistry } from '@/lib/networks';
import { MessageType } from '@/types/messages';
import { DirectSecp256k1HdWallet, makeCosmoshubPath } from '@cosmjs/proto-signing';

/**
 * Sync keyring state with background service worker
 * This ensures dApps can use the wallet when popup has unlocked
 * Note: Only works in extension builds, skipped in web builds
 */
async function syncKeyringWithBackground(serializedKeyring: string): Promise<void> {
  // Skip in web builds - no background service worker
  if (__IS_WEB_BUILD__) {
    return;
  }

  try {
    const response = await browser.runtime.sendMessage({
      type: MessageType.SYNC_KEYRING,
      payload: { serializedKeyring },
    });
    if (response?.success) {
      console.log('Background service worker synced');
    } else {
      console.warn('Background sync failed:', response?.error);
    }
  } catch (error) {
    console.warn('Failed to sync with background:', error);
    // Non-fatal - popup can still work, but dApps won't work until background is synced
  }
}

/**
 * Notify background to lock
 * Note: Only works in extension builds, skipped in web builds
 */
async function lockBackground(): Promise<void> {
  // Skip in web builds - no background service worker
  if (__IS_WEB_BUILD__) {
    return;
  }

  try {
    await browser.runtime.sendMessage({
      type: MessageType.LOCK_WALLET,
    });
  } catch (error) {
    console.warn('Failed to notify background of lock:', error);
  }
}

/**
 * Pre-derive all addresses (Cosmos, Bitcoin, EVM) for all accounts
 * Called on wallet create/import/unlock to ensure all addresses are ready
 * Also handles new networks added after wallet was created
 */
async function preDeriveAllAccounts(
  keyring: Keyring
): Promise<void> {
  const accounts = keyring.getAccounts();
  const bitcoinNetworks = networkRegistry.getEnabledByType('bitcoin');
  const evmNetworks = networkRegistry.getEnabledByType('evm');

  for (const account of accounts) {
    const accountIndex = account.accountIndex;

    // Derive all Bitcoin/UTXO addresses
    for (const network of bitcoinNetworks) {
      // Skip if already derived
      if (keyring.getBitcoinAddress(network.id, accountIndex)) continue;

      try {
        await keyring.deriveBitcoinAccount(
          network.id,
          network.network,
          accountIndex,
          network.addressType
        );
      } catch (error) {
        console.warn(`Could not derive ${network.id} address for account ${accountIndex}:`, error);
      }
    }

    // Derive all EVM addresses
    for (const network of evmNetworks) {
      // Skip if already derived
      if (keyring.getEvmAddress(network.id, accountIndex)) continue;

      try {
        await keyring.deriveEvmAccount(network.id, network.chainId, accountIndex);
      } catch (error) {
        console.warn(`Could not derive ${network.id} address for account ${accountIndex}:`, error);
      }
    }
  }
}

interface WalletState {
  // State
  isInitialized: boolean;
  isLocked: boolean;
  accounts: KeyringAccount[];
  selectedAccount: KeyringAccount | null;
  selectedChainId: string;
  autoLockMinutes: number;
  connectedDapps: Map<string, Set<string>>; // origin -> chainIds
  keyring: Keyring | null;

  // Actions
  initialize: () => Promise<void>;
  createWallet: (password: string, accountName?: string) => Promise<string>;
  importWallet: (mnemonic: string, password: string, accountName?: string) => Promise<void>;
  unlock: (password: string) => Promise<void>;
  lock: () => Promise<void>;
  selectAccount: (accountId: string) => void;
  selectChain: (chainId: string) => void;
  setAutoLockMinutes: (minutes: number) => Promise<void>;
  updateActivity: () => void;
  renameAccount: (address: string, newName: string) => Promise<void>;
  addAccount: (name: string) => Promise<KeyringAccount>;
  createAccountWithNewMnemonic: (
    name: string,
    password: string
  ) => Promise<{ account: KeyringAccount; mnemonic: string }>;
  importAccountFromMnemonic: (
    mnemonic: string,
    name: string,
    password: string
  ) => Promise<KeyringAccount>;
  // Derive a new account from a specific source wallet (main or imported)
  deriveAccountFromSource: (
    sourceCosmosAddress: string | null, // null = main wallet
    name: string,
    password: string
  ) => Promise<KeyringAccount>;
  // Get wallets that can be used as derivation source (main + imported with their own mnemonic)
  getSourceWallets: () => Array<{ address: string; name: string; isMain: boolean }>;

  // DApp connections
  requestConnection: (origin: string, chainId: string) => Promise<boolean>;
  disconnect: (origin: string, chainId?: string) => void;
  isConnected: (origin: string, chainId: string) => boolean;
  getConnectedChains: (origin: string) => string[];

  // Transaction signing
  signAmino: (signerAddress: string, signDoc: any) => Promise<any>;
  signDirect: (signerAddress: string, signDoc: any) => Promise<any>;
  signArbitrary: (signerAddress: string, data: string | Uint8Array) => Promise<any>;

  // Send tokens
  sendTokens: (
    chainId: string,
    fromAddress: string,
    toAddress: string,
    amount: string,
    denom: string,
    memo?: string
  ) => Promise<string>; // Returns tx hash

  // Sign and broadcast arbitrary Cosmos messages
  signAndBroadcast: (
    chainId: string,
    messages: Array<{ typeUrl: string; value: any }>,
    fee?: { amount: Array<{ denom: string; amount: string }>; gas: string },
    memo?: string
  ) => Promise<string>; // Returns tx hash

  // Sign and broadcast with password (for cross-chain operations when mnemonic not in memory)
  signAndBroadcastWithPassword: (
    chainId: string,
    messages: Array<{ typeUrl: string; value: any }>,
    password: string,
    fee?: { amount: Array<{ denom: string; amount: string }>; gas: string },
    memo?: string
  ) => Promise<string>; // Returns tx hash

  // Check if mnemonic is available in memory (for cross-chain signing)
  hasMnemonicInMemory: () => boolean;

  // Get address for a specific chain (converts bech32 prefix)
  getAddressForChain: (chainPrefix: string) => string | null;

  // Session management
  updateSession: () => Promise<void>;

  // Bitcoin-specific methods
  // cosmosAddress is used to identify imported accounts (which have their own mnemonics)
  getBitcoinAddress: (
    networkId: string,
    accountIndex?: number,
    cosmosAddress?: string
  ) => Promise<string | null>;
  deriveBitcoinAccount: (
    networkId: string,
    accountIndex?: number
  ) => Promise<BitcoinKeyringAccount | null>;

  // EVM-specific methods
  // cosmosAddress is used to identify imported accounts (which have their own mnemonics)
  getEvmAddress: (
    networkId: string,
    accountIndex?: number,
    cosmosAddress?: string
  ) => Promise<string | null>;
  deriveEvmAccount: (networkId: string, accountIndex?: number) => Promise<EvmKeyringAccount | null>;
}

export const useWalletStore = create<WalletState>((set, get) => ({
  isInitialized: false,
  isLocked: true,
  accounts: [],
  selectedAccount: null,
  selectedChainId: 'beezee-1',
  autoLockMinutes: 15,
  connectedDapps: new Map(),
  keyring: null,

  initialize: async () => {
    const hasWallet = await EncryptedStorage.hasWallet();
    const hasSession = await EncryptedStorage.getSession();
    const preferences = await EncryptedStorage.getPreferences();

    console.log('=== Wallet Initialize ===');
    console.log('hasWallet:', hasWallet);
    console.log('hasSession:', hasSession);

    // Check if we should auto-lock due to inactivity
    const shouldAutoLock = await EncryptedStorage.shouldAutoLock();
    if (shouldAutoLock && hasSession) {
      console.log('Auto-locking due to inactivity');
      await EncryptedStorage.clearSession();
      set({
        isInitialized: hasWallet,
        isLocked: true,
        autoLockMinutes: preferences.autoLockMinutes ?? 15,
      });
      return;
    }

    // If we have a session, try to restore the wallet from session storage
    if (hasSession) {
      const serializedWallet = await EncryptedStorage.getSerializedWallet();
      if (serializedWallet) {
        try {
          // Restore the wallet from session storage
          const keyring = new Keyring();
          await keyring.restoreFromSerialized(serializedWallet);

          // Load accounts
          const walletData = await EncryptedStorage.loadWalletMetadata();
          const keyringAccounts = keyring.getAccounts();

          // Restore account names
          if (walletData) {
            walletData.accounts.forEach((storedAcc, i) => {
              if (keyringAccounts[i]) {
                keyringAccounts[i].name = storedAcc.name;
              }
            });
          }

          // Load imported accounts
          const importedAccounts = await EncryptedStorage.getImportedAccounts();
          const allAccounts = [...keyringAccounts, ...importedAccounts];

          // Deduplicate accounts by address (keep first occurrence, which is main wallet)
          const seenAddresses = new Set<string>();
          const uniqueAccounts = allAccounts.filter((acc) => {
            if (seenAddresses.has(acc.address)) {
              console.log('Removing duplicate account:', acc.name, acc.address);
              return false;
            }
            seenAddresses.add(acc.address);
            return true;
          });

          // Restore selected account
          let selectedAccount = uniqueAccounts[0] || null;
          if (preferences.selectedAccountId) {
            const savedAccount = uniqueAccounts.find(
              (acc) => acc.id === preferences.selectedAccountId
            );
            if (savedAccount) {
              selectedAccount = savedAccount;
            }
          }

          console.log('Restored wallet from session, accounts:', uniqueAccounts.length);

          // Sync with background service worker so dApps can use the wallet
          syncKeyringWithBackground(serializedWallet);

          set({
            isInitialized: true,
            isLocked: false,
            accounts: uniqueAccounts,
            selectedAccount,
            selectedChainId: preferences.selectedChainId || 'beezee-1',
            autoLockMinutes: preferences.autoLockMinutes ?? 15,
            keyring,
          });
          return;
        } catch (error) {
          console.error('Failed to restore wallet from session:', error);
          // Fall through to locked state
        }
      }
    }

    // No valid session or failed to restore - show as locked
    set({
      isInitialized: hasWallet,
      isLocked: hasWallet, // If wallet exists, show unlock; otherwise show create
      autoLockMinutes: preferences.autoLockMinutes ?? 15,
    });
  },

  createWallet: async (password: string, accountName: string = 'Account 1') => {
    const mnemonic = await MnemonicManager.generateMnemonicAsync();
    const keyring = new Keyring();

    // Create wallet with account index 0
    await keyring.createFromMnemonic(mnemonic, 'bze', [0]);
    const accounts = keyring.getAccounts();

    if (accounts.length > 0) {
      accounts[0].name = accountName;
    }

    // Pre-derive all addresses for all accounts
    await preDeriveAllAccounts(keyring);

    await EncryptedStorage.saveWallet(mnemonic, password, accounts);

    // Serialize wallet for session storage (includes derived Bitcoin/EVM addresses)
    const serializedWallet = await keyring.serialize();
    const sessionId = crypto.randomUUID();
    await EncryptedStorage.setSession(sessionId, serializedWallet);
    await EncryptedStorage.setLastActivity();

    set({
      isInitialized: true,
      isLocked: false,
      accounts,
      selectedAccount: accounts[0] || null,
      keyring,
    });

    return mnemonic;
  },

  importWallet: async (mnemonic: string, password: string, accountName: string = 'Account 1') => {
    if (!MnemonicManager.validateMnemonic(mnemonic)) {
      throw new Error('Invalid mnemonic phrase');
    }

    const keyring = new Keyring();
    // Create wallet with account index 0
    await keyring.createFromMnemonic(mnemonic, 'bze', [0]);
    const accounts = keyring.getAccounts();

    if (accounts.length > 0) {
      accounts[0].name = accountName;
    }

    // Pre-derive all addresses for all accounts
    await preDeriveAllAccounts(keyring);

    await EncryptedStorage.saveWallet(mnemonic, password, accounts);

    // Serialize wallet for session storage (includes derived Bitcoin/EVM addresses)
    const serializedWallet = await keyring.serialize();
    const sessionId = crypto.randomUUID();
    await EncryptedStorage.setSession(sessionId, serializedWallet);
    await EncryptedStorage.setLastActivity();

    set({
      isInitialized: true,
      isLocked: false,
      accounts,
      selectedAccount: accounts[0] || null,
      keyring,
    });
  },

  unlock: async (password: string) => {
    const wallet = await EncryptedStorage.loadWallet(password);

    if (!wallet) {
      throw new Error('Failed to load wallet');
    }

    const keyring = new Keyring();
    // Restore keyring with all account indices from stored accounts
    const accountIndices = wallet.accounts.map((acc) => acc.accountIndex ?? 0);
    await keyring.createFromMnemonic(wallet.mnemonic, 'bze', accountIndices);

    // Set mnemonic for Bitcoin derivation
    keyring.setMnemonic(wallet.mnemonic);

    // Pre-derive all addresses for all accounts (handles new networks added after wallet creation)
    await preDeriveAllAccounts(keyring);

    // Restore account names from storage
    const keyringAccounts = keyring.getAccounts();
    wallet.accounts.forEach((storedAcc, i) => {
      if (keyringAccounts[i]) {
        keyringAccounts[i].name = storedAcc.name;
      }
    });

    // Load imported accounts
    const importedAccounts = await EncryptedStorage.getImportedAccounts();
    const allAccounts = [...keyringAccounts, ...importedAccounts];

    // Deduplicate accounts by address (keep first occurrence, which is main wallet)
    const seenAddresses = new Set<string>();
    const uniqueAccounts = allAccounts.filter((acc) => {
      if (seenAddresses.has(acc.address)) {
        console.log('Removing duplicate account:', acc.name, acc.address);
        return false;
      }
      seenAddresses.add(acc.address);
      return true;
    });

    // Restore preferences (selected account & chain)
    const preferences = await EncryptedStorage.getPreferences();
    let selectedAccount = uniqueAccounts[0] || null;
    if (preferences.selectedAccountId) {
      const savedAccount = uniqueAccounts.find((acc) => acc.id === preferences.selectedAccountId);
      if (savedAccount) {
        selectedAccount = savedAccount;
      }
    }

    const selectedChainId = preferences.selectedChainId || 'beezee-1';

    // Serialize wallet for session storage (includes all derived Bitcoin/EVM addresses)
    const serializedWallet = await keyring.serialize();
    const sessionId = crypto.randomUUID();
    await EncryptedStorage.setSession(sessionId, serializedWallet);
    await EncryptedStorage.setLastActivity(); // Start activity tracking

    // Sync with background service worker so dApps can use the wallet
    syncKeyringWithBackground(serializedWallet);

    set({
      isLocked: false,
      accounts: uniqueAccounts,
      selectedAccount,
      selectedChainId,
      autoLockMinutes: preferences.autoLockMinutes ?? 15,
      keyring,
    });
  },

  lock: async () => {
    await EncryptedStorage.clearSession();
    const { keyring } = get();

    if (keyring) {
      keyring.clear();
    }

    // Notify background to also lock
    lockBackground();

    set({
      isLocked: true,
      keyring: null,
      connectedDapps: new Map(),
    });
  },

  selectAccount: (accountId: string) => {
    const { accounts } = get();
    // Find by ID only - no fallback to address
    const account = accounts.find((acc) => acc.id === accountId);

    if (account) {
      console.log('Selecting account:', account.id, account.name);
      set({ selectedAccount: account });
      // Persist selection
      EncryptedStorage.savePreferences({ selectedAccountId: account.id });
    } else {
      console.warn('Account not found:', accountId);
    }
  },

  selectChain: (chainId: string) => {
    set({ selectedChainId: chainId });
    // Persist selection
    EncryptedStorage.savePreferences({ selectedChainId: chainId });
    // Update activity
    EncryptedStorage.setLastActivity();
  },

  setAutoLockMinutes: async (minutes: number) => {
    set({ autoLockMinutes: minutes });
    await EncryptedStorage.savePreferences({ autoLockMinutes: minutes });
  },

  updateActivity: () => {
    // Update last activity timestamp (call this on user interactions)
    EncryptedStorage.setLastActivity();
  },

  renameAccount: async (address: string, newName: string) => {
    const { accounts, selectedAccount } = get();
    const updatedAccounts = accounts.map((acc) =>
      acc.address === address ? { ...acc, name: newName } : acc
    );

    // Update selected account if it's the one being renamed
    const updatedSelected =
      selectedAccount?.address === address
        ? { ...selectedAccount, name: newName }
        : selectedAccount;

    // Persist to storage
    await EncryptedStorage.updateAccounts(updatedAccounts);

    set({
      accounts: updatedAccounts,
      selectedAccount: updatedSelected,
    });
  },

  addAccount: async (name: string) => {
    const { keyring, accounts, updateSession } = get();

    if (!keyring) {
      throw new Error('Wallet is locked');
    }

    // Add account using the keyring (which holds the mnemonic in memory)
    const newAccount = await keyring.addAccount(name);

    // Pre-derive all addresses for all accounts (including the new one)
    await preDeriveAllAccounts(keyring);

    // Update accounts list
    const updatedAccounts = [...accounts, newAccount];

    // Persist to storage
    await EncryptedStorage.updateAccounts(updatedAccounts);

    // Update session with newly derived addresses
    await updateSession();

    set({
      accounts: updatedAccounts,
      selectedAccount: newAccount, // Select the newly created account
    });

    return newAccount;
  },

  createAccountWithNewMnemonic: async (name: string, password: string) => {
    const { accounts } = get();

    // Verify the password is correct for the main wallet
    const isValidPassword = await EncryptedStorage.verifyPassword(password);
    if (!isValidPassword) {
      throw new Error('Incorrect password');
    }

    // Generate a new mnemonic
    const mnemonic = await MnemonicManager.generateMnemonicAsync();

    // Create a temporary keyring to derive the account
    const tempKeyring = new Keyring();
    await tempKeyring.createFromMnemonic(mnemonic, 'bze', [0]);
    const derivedAccounts = tempKeyring.getAccounts();

    if (derivedAccounts.length === 0) {
      throw new Error('Failed to derive account from generated mnemonic');
    }

    const newAccount = derivedAccounts[0];
    newAccount.name = name;
    newAccount.id = `imported-${Date.now()}`; // Use imported- prefix so it shows in Settings

    // Check if account already exists (very unlikely with new mnemonic)
    if (accounts.some((acc) => acc.address === newAccount.address)) {
      throw new Error('Account collision - please try again');
    }

    // Pre-derive Bitcoin and EVM addresses for this account
    const derivedAddresses: {
      bitcoin: Record<string, string>;
      evm: Record<string, string>;
    } = {
      bitcoin: {},
      evm: {},
    };

    // Derive Bitcoin addresses for all enabled Bitcoin networks
    const bitcoinNetworks = networkRegistry.getEnabledByType('bitcoin');
    for (const network of bitcoinNetworks) {
      try {
        const btcAccount = await tempKeyring.deriveBitcoinAccount(
          network.id,
          network.network,
          0,
          network.addressType
        );
        if (btcAccount?.address) {
          derivedAddresses.bitcoin[network.id] = btcAccount.address;
        }
      } catch (error) {
        console.warn(`Could not derive ${network.id} address:`, error);
      }
    }

    // Derive EVM addresses for all enabled EVM networks
    const evmNetworks = networkRegistry.getEnabledByType('evm');
    for (const network of evmNetworks) {
      try {
        const evmAccount = await tempKeyring.deriveEvmAccount(network.id, network.chainId, 0);
        if (evmAccount?.address) {
          derivedAddresses.evm[network.id] = evmAccount.address;
        }
      } catch (error) {
        console.warn(`Could not derive ${network.id} address:`, error);
      }
    }

    // Save to storage with its own encrypted mnemonic and pre-derived addresses
    await EncryptedStorage.addImportedAccount(mnemonic, password, newAccount, derivedAddresses);

    // Add to accounts list
    const updatedAccounts = [...accounts, newAccount];
    await EncryptedStorage.updateAccounts(updatedAccounts);

    set({
      accounts: updatedAccounts,
      selectedAccount: newAccount,
    });

    return { account: newAccount, mnemonic };
  },

  // Get wallets that can be used as derivation source
  getSourceWallets: () => {
    const { accounts } = get();
    const sources: Array<{ address: string; name: string; isMain: boolean }> = [];

    // Find the main wallet account (first account without 'imported-' prefix)
    const mainAccount = accounts.find((acc) => !acc.id.startsWith('imported-'));
    if (mainAccount) {
      sources.push({
        address: mainAccount.address,
        name: 'Main Wallet',
        isMain: true,
      });
    }

    // Find all imported accounts (they have their own mnemonics)
    const importedAccounts = accounts.filter((acc) => acc.id.startsWith('imported-'));
    for (const acc of importedAccounts) {
      sources.push({
        address: acc.address,
        name: acc.name,
        isMain: false,
      });
    }

    return sources;
  },

  // Derive a new account from a specific source wallet
  deriveAccountFromSource: async (
    sourceCosmosAddress: string | null,
    name: string,
    password: string
  ) => {
    const { keyring, accounts, updateSession } = get();

    // Helper function to derive from main wallet
    const deriveFromMainWallet = async () => {
      // Try to use keyring if it has mnemonic
      if (keyring && keyring.getMnemonic()) {
        const newAccount = await keyring.addAccount(name);
        await preDeriveAllAccounts(keyring);
        const updatedAccounts = [...accounts, newAccount];
        await EncryptedStorage.updateAccounts(updatedAccounts);
        await updateSession();
        set({
          accounts: updatedAccounts,
          selectedAccount: newAccount,
        });
        return newAccount;
      }

      // Keyring doesn't have mnemonic - load from storage with password
      const walletData = await EncryptedStorage.loadWallet(password);
      if (!walletData) {
        throw new Error('Incorrect password or wallet not found');
      }

      // Create a temporary keyring with the loaded mnemonic
      const existingIndices = accounts
        .filter((acc) => !acc.id.startsWith('imported-'))
        .map((acc) => acc.accountIndex);
      const nextIndex = existingIndices.length > 0 ? Math.max(...existingIndices) + 1 : 1;

      const tempKeyring = new Keyring();
      await tempKeyring.createFromMnemonic(walletData.mnemonic, 'bze', [nextIndex]);
      const derivedAccounts = tempKeyring.getAccounts();

      if (derivedAccounts.length === 0) {
        throw new Error('Failed to derive new account');
      }

      const newAccount = derivedAccounts[0];
      newAccount.name = name;
      newAccount.id = `account-${nextIndex}`;
      newAccount.accountIndex = nextIndex;

      // Pre-derive Bitcoin and EVM addresses
      const derivedAddresses: {
        bitcoin: Record<string, string>;
        evm: Record<string, string>;
      } = { bitcoin: {}, evm: {} };

      const bitcoinNetworks = networkRegistry.getEnabledByType('bitcoin');
      for (const network of bitcoinNetworks) {
        try {
          const btcAccount = await tempKeyring.deriveBitcoinAccount(
            network.id,
            network.network,
            nextIndex,
            network.addressType
          );
          if (btcAccount?.address) {
            derivedAddresses.bitcoin[network.id] = btcAccount.address;
          }
        } catch (error) {
          console.warn(`Could not derive ${network.id} address:`, error);
        }
      }

      const evmNetworks = networkRegistry.getEnabledByType('evm');
      for (const network of evmNetworks) {
        try {
          const evmAccount = await tempKeyring.deriveEvmAccount(
            network.id,
            network.chainId,
            nextIndex
          );
          if (evmAccount?.address) {
            derivedAddresses.evm[network.id] = evmAccount.address;
          }
        } catch (error) {
          console.warn(`Could not derive ${network.id} address:`, error);
        }
      }

      const updatedAccounts = [...accounts, newAccount];
      await EncryptedStorage.updateAccounts(updatedAccounts);

      set({
        accounts: updatedAccounts,
        selectedAccount: newAccount,
      });

      return newAccount;
    };

    // If source is null, derive from main wallet
    if (sourceCosmosAddress === null) {
      return await deriveFromMainWallet();
    }

    // Check if source is the main wallet by checking if it's a non-imported account
    const sourceAccount = accounts.find((acc) => acc.address === sourceCosmosAddress);
    if (!sourceAccount) {
      throw new Error('Source wallet not found');
    }

    if (!sourceAccount.id.startsWith('imported-')) {
      // Source is main wallet
      return await deriveFromMainWallet();
    }

    // Source is an imported account - need to get its mnemonic and derive next index
    const sourceMnemonic = await EncryptedStorage.getImportedAccountMnemonic(
      sourceCosmosAddress,
      password
    );

    if (!sourceMnemonic) {
      throw new Error(
        'Incorrect password for this imported wallet. Use the password you set when you imported/created this wallet.'
      );
    }

    // Count existing accounts derived from this source
    // For now, we'll track by finding accounts that share the same parent
    // Since we store imported accounts separately, we need to count how many
    // accounts have been derived from this specific mnemonic
    // We'll use a simple approach: get all indices used by this source's mnemonic
    const existingFromSource =
      await EncryptedStorage.getImportedAccountsFromSource(sourceCosmosAddress);
    const nextIndex = existingFromSource.length > 0 ? existingFromSource.length : 1; // Start from index 1 if source exists at 0

    // Create a temporary keyring with the source mnemonic
    const tempKeyring = new Keyring();
    await tempKeyring.createFromMnemonic(sourceMnemonic, 'bze', [nextIndex]);
    const derivedAccounts = tempKeyring.getAccounts();

    if (derivedAccounts.length === 0) {
      throw new Error('Failed to derive new account');
    }

    const newAccount = derivedAccounts[0];
    newAccount.name = name;
    newAccount.id = `imported-${Date.now()}`;
    newAccount.accountIndex = nextIndex;

    // Check if account already exists
    if (accounts.some((acc) => acc.address === newAccount.address)) {
      throw new Error('This account already exists in your wallet');
    }

    // Pre-derive Bitcoin and EVM addresses
    const derivedAddresses: {
      bitcoin: Record<string, string>;
      evm: Record<string, string>;
    } = {
      bitcoin: {},
      evm: {},
    };

    const bitcoinNetworks = networkRegistry.getEnabledByType('bitcoin');
    for (const network of bitcoinNetworks) {
      try {
        const btcAccount = await tempKeyring.deriveBitcoinAccount(
          network.id,
          network.network,
          nextIndex,
          network.addressType
        );
        if (btcAccount?.address) {
          derivedAddresses.bitcoin[network.id] = btcAccount.address;
        }
      } catch (error) {
        console.warn(`Could not derive ${network.id} address:`, error);
      }
    }

    const evmNetworks = networkRegistry.getEnabledByType('evm');
    for (const network of evmNetworks) {
      try {
        const evmAccount = await tempKeyring.deriveEvmAccount(
          network.id,
          network.chainId,
          nextIndex
        );
        if (evmAccount?.address) {
          derivedAddresses.evm[network.id] = evmAccount.address;
        }
      } catch (error) {
        console.warn(`Could not derive ${network.id} address:`, error);
      }
    }

    // Save with reference to source
    await EncryptedStorage.addImportedAccountFromSource(
      sourceMnemonic,
      password,
      newAccount,
      derivedAddresses,
      sourceCosmosAddress
    );

    const updatedAccounts = [...accounts, newAccount];
    await EncryptedStorage.updateAccounts(updatedAccounts);

    set({
      accounts: updatedAccounts,
      selectedAccount: newAccount,
    });

    return newAccount;
  },

  importAccountFromMnemonic: async (mnemonic: string, name: string, password: string) => {
    const { accounts } = get();

    // Verify the password is correct for the main wallet
    const isValidPassword = await EncryptedStorage.verifyPassword(password);
    if (!isValidPassword) {
      throw new Error('Incorrect password');
    }

    // Validate mnemonic
    if (!MnemonicManager.validateMnemonic(mnemonic)) {
      throw new Error('Invalid recovery phrase');
    }

    // Create a temporary keyring to derive the account
    const tempKeyring = new Keyring();
    await tempKeyring.createFromMnemonic(mnemonic, 'bze', [0]);
    const derivedAccounts = tempKeyring.getAccounts();

    if (derivedAccounts.length === 0) {
      throw new Error('Failed to derive account from mnemonic');
    }

    const importedAccount = derivedAccounts[0];
    importedAccount.name = name;
    importedAccount.id = `imported-${Date.now()}`; // Unique ID for imported accounts

    // Check if account already exists
    if (accounts.some((acc) => acc.address === importedAccount.address)) {
      throw new Error('This account is already in your wallet');
    }

    // Pre-derive Bitcoin and EVM addresses for this imported account
    // These are stored so we can display them without needing the mnemonic
    const derivedAddresses: {
      bitcoin: Record<string, string>;
      evm: Record<string, string>;
    } = {
      bitcoin: {},
      evm: {},
    };

    // Derive Bitcoin addresses for all enabled Bitcoin networks
    const bitcoinNetworks = networkRegistry.getEnabledByType('bitcoin');
    for (const network of bitcoinNetworks) {
      try {
        const btcAccount = await tempKeyring.deriveBitcoinAccount(
          network.id,
          network.network,
          0, // accountIndex 0 for the imported account
          network.addressType
        );
        if (btcAccount?.address) {
          derivedAddresses.bitcoin[network.id] = btcAccount.address;
        }
      } catch (error) {
        console.warn(`Could not derive ${network.id} address for imported account:`, error);
      }
    }

    // Derive EVM addresses for all enabled EVM networks
    const evmNetworks = networkRegistry.getEnabledByType('evm');
    for (const network of evmNetworks) {
      try {
        const evmAccount = await tempKeyring.deriveEvmAccount(network.id, network.chainId, 0);
        if (evmAccount?.address) {
          derivedAddresses.evm[network.id] = evmAccount.address;
        }
      } catch (error) {
        console.warn(`Could not derive ${network.id} address for imported account:`, error);
      }
    }

    // Save to storage with its own encrypted mnemonic and pre-derived addresses
    await EncryptedStorage.addImportedAccount(
      mnemonic,
      password,
      importedAccount,
      derivedAddresses
    );

    // Update state
    const updatedAccounts = [...accounts, importedAccount];
    set({
      accounts: updatedAccounts,
      selectedAccount: importedAccount,
    });

    return importedAccount;
  },

  requestConnection: async (origin: string, chainId: string) => {
    const { connectedDapps, isLocked } = get();

    if (isLocked) {
      throw new Error('Wallet is locked');
    }

    // In production, show approval modal to user
    const approved = true; // TODO: Implement approval flow

    if (approved) {
      const chainSet = connectedDapps.get(origin) || new Set();
      chainSet.add(chainId);
      connectedDapps.set(origin, chainSet);

      set({ connectedDapps: new Map(connectedDapps) });
    }

    return approved;
  },

  disconnect: (origin: string, chainId?: string) => {
    const { connectedDapps } = get();

    if (chainId) {
      const chainSet = connectedDapps.get(origin);
      if (chainSet) {
        chainSet.delete(chainId);
        if (chainSet.size === 0) {
          connectedDapps.delete(origin);
        }
      }
    } else {
      connectedDapps.delete(origin);
    }

    set({ connectedDapps: new Map(connectedDapps) });
  },

  isConnected: (origin: string, chainId: string) => {
    const { connectedDapps } = get();
    const chainSet = connectedDapps.get(origin);
    return chainSet ? chainSet.has(chainId) : false;
  },

  getConnectedChains: (origin: string) => {
    const { connectedDapps } = get();
    const chainSet = connectedDapps.get(origin);
    return chainSet ? Array.from(chainSet) : [];
  },

  signAmino: async (signerAddress: string, signDoc: any) => {
    const { keyring, isLocked } = get();

    if (isLocked || !keyring) {
      throw new Error('Wallet is locked');
    }

    return await keyring.signAmino(signerAddress, signDoc);
  },

  signDirect: async (signerAddress: string, signDoc: any) => {
    const { keyring, isLocked } = get();

    if (isLocked || !keyring) {
      throw new Error('Wallet is locked');
    }

    return await keyring.signDirect(signerAddress, signDoc);
  },

  signArbitrary: async (signerAddress: string, data: string | Uint8Array) => {
    const { keyring, isLocked } = get();

    if (isLocked || !keyring) {
      throw new Error('Wallet is locked');
    }

    return await keyring.signArbitrary(signerAddress, data);
  },

  sendTokens: async (
    chainId: string,
    fromAddress: string,
    toAddress: string,
    amount: string,
    denom: string,
    memo: string = ''
  ) => {
    const { keyring, isLocked, selectedAccount } = get();

    if (isLocked || !keyring) {
      throw new Error('Wallet is locked');
    }

    if (!selectedAccount) {
      throw new Error('No account selected');
    }

    // Get chain info
    const chainInfo = SUPPORTED_CHAINS.get(chainId);
    if (!chainInfo) {
      throw new Error(`Chain ${chainId} not supported`);
    }

    // Use the existing wallet from the keyring
    // The wallet was created with bze prefix but we can sign for any chain
    // since the underlying keys are the same (coinType 118)
    const wallet = keyring.getWallet();

    // Get all wallet accounts and find the one that matches our selected account
    const walletAccounts = await wallet.getAccounts();
    const signerAddress = selectedAccount.address;
    const matchingWalletAccount = walletAccounts.find((acc) => acc.address === signerAddress);

    if (!matchingWalletAccount) {
      throw new Error('Selected account not found in wallet');
    }

    // Simulate transaction to get accurate gas estimate
    const feeDenom = chainInfo.feeCurrencies[0]?.coinMinimalDenom || 'ubze';
    const MIN_GAS_PRICE = 0.01; // ubze per gas

    let gasLimit: number;
    let feeAmount: number;

    try {
      const simResult = await simulateSendFee(
        chainInfo.rest,
        fromAddress,
        toAddress,
        amount,
        denom,
        matchingWalletAccount.pubkey
      );
      gasLimit = simResult.gas;
      feeAmount = parseInt(simResult.fee.amount);
      console.log(`Simulated gas: ${gasLimit}, fee: ${feeAmount} ${feeDenom}`);
    } catch (error) {
      console.warn('Simulation failed, using default gas estimate:', error);
      // Fallback to higher default estimate
      gasLimit = 150000;
      feeAmount = Math.ceil(gasLimit * MIN_GAS_PRICE);
    }

    const fee = {
      amount: [coin(feeAmount.toString(), feeDenom)],
      gas: gasLimit.toString(),
    };

    // Create signing client
    const signingClient = await cosmosClient.getSigningClient(chainInfo.rpc, wallet);

    // Build the send message
    const sendAmount = coin(amount, denom);

    // Send the transaction using the bze-prefixed address as signer
    const result = await signingClient.sendTokens(
      signerAddress,
      toAddress,
      [sendAmount],
      fee,
      memo
    );

    if (result.code !== 0) {
      throw new Error(`Transaction failed: ${result.rawLog}`);
    }

    return result.transactionHash;
  },

  signAndBroadcast: async (
    chainId: string,
    messages: Array<{ typeUrl: string; value: any }>,
    fee?: { amount: Array<{ denom: string; amount: string }>; gas: string },
    memo: string = ''
  ) => {
    const { keyring, isLocked, selectedAccount } = get();

    if (isLocked || !keyring) {
      throw new Error('Wallet is locked');
    }

    if (!selectedAccount) {
      throw new Error('No account selected');
    }

    // Get chain info
    const chainInfo = SUPPORTED_CHAINS.get(chainId);
    if (!chainInfo) {
      throw new Error(`Chain ${chainId} not supported`);
    }

    // Get the bech32 prefix for this chain
    const chainPrefix = chainInfo.bech32Config.bech32PrefixAccAddr;

    // Get a wallet with the correct prefix for this chain, ensuring the selected account's index is included
    const wallet = await keyring.getWalletForChain(chainPrefix, selectedAccount.accountIndex);

    // Convert selected account address to this chain's prefix
    const signerAddress = Keyring.convertAddress(selectedAccount.address, chainPrefix);

    // Get all wallet accounts and find the one that matches
    const walletAccounts = await wallet.getAccounts();
    const matchingWalletAccount = walletAccounts.find((acc) => acc.address === signerAddress);

    if (!matchingWalletAccount) {
      throw new Error('Selected account not found in wallet');
    }

    // Use provided fee or default
    const txFee = fee || {
      amount: [{ denom: chainInfo.feeCurrencies[0]?.coinMinimalDenom || 'ubze', amount: '5000' }],
      gas: '200000',
    };

    // Create signing client
    const signingClient = await cosmosClient.getSigningClient(chainInfo.rpc, wallet);

    // Sign and broadcast the transaction
    const result = await signingClient.signAndBroadcast(signerAddress, messages, txFee, memo);

    if (result.code !== 0) {
      throw new Error(`Transaction failed: ${result.rawLog}`);
    }

    return result.transactionHash;
  },

  signAndBroadcastWithPassword: async (
    chainId: string,
    messages: Array<{ typeUrl: string; value: any }>,
    password: string,
    fee?: { amount: Array<{ denom: string; amount: string }>; gas: string },
    memo: string = ''
  ) => {
    const { keyring, isLocked, selectedAccount } = get();

    if (isLocked || !keyring) {
      throw new Error('Wallet is locked');
    }

    if (!selectedAccount) {
      throw new Error('No account selected');
    }

    // Get chain info
    const chainInfo = SUPPORTED_CHAINS.get(chainId);
    if (!chainInfo) {
      throw new Error(`Chain ${chainId} not supported`);
    }

    // Get the bech32 prefix for this chain
    const chainPrefix = chainInfo.bech32Config.bech32PrefixAccAddr;

    // Check if this is an imported account (has its own mnemonic)
    const isImportedAccount = selectedAccount.id.startsWith('imported-');

    let wallet: DirectSecp256k1HdWallet;

    if (isImportedAccount) {
      // For imported accounts, load their specific mnemonic
      const importedMnemonic = await EncryptedStorage.getImportedAccountMnemonic(
        selectedAccount.address,
        password
      );

      if (!importedMnemonic) {
        throw new Error('Failed to decrypt imported account mnemonic: incorrect password or corrupted data');
      }

      // Create wallet from imported account's mnemonic with the target chain prefix
      wallet = await DirectSecp256k1HdWallet.fromMnemonic(importedMnemonic, {
        prefix: chainPrefix,
        hdPaths: [makeCosmoshubPath(0)], // Imported accounts always use index 0
      });
    } else {
      // For main wallet accounts, load the main mnemonic if needed
      if (!keyring.hasMnemonic()) {
        const storedWallet = await EncryptedStorage.loadWallet(password);
        if (!storedWallet || !storedWallet.mnemonic) {
          throw new Error('Incorrect password or wallet not found');
        }
        keyring.setMnemonic(storedWallet.mnemonic);
      }

      // Get a wallet with the correct prefix for this chain
      const accountIndexToUse = selectedAccount.accountIndex ?? 0;
      wallet = await keyring.getWalletForChain(chainPrefix, accountIndexToUse);
    }

    // Convert selected account address to this chain's prefix
    const signerAddress = Keyring.convertAddress(selectedAccount.address, chainPrefix);

    // Get all wallet accounts and find the one that matches
    const walletAccounts = await wallet.getAccounts();
    const matchingWalletAccount = walletAccounts.find((acc) => acc.address === signerAddress);

    if (!matchingWalletAccount) {
      throw new Error('Selected account not found in wallet');
    }

    // Use provided fee or default
    const txFee = fee || {
      amount: [{ denom: chainInfo.feeCurrencies[0]?.coinMinimalDenom || 'ubze', amount: '5000' }],
      gas: '200000',
    };

    // Create signing client
    const signingClient = await cosmosClient.getSigningClient(chainInfo.rpc, wallet);

    // Sign and broadcast the transaction
    const result = await signingClient.signAndBroadcast(signerAddress, messages, txFee, memo);

    if (result.code !== 0) {
      throw new Error(`Transaction failed: ${result.rawLog}`);
    }

    return result.transactionHash;
  },

  hasMnemonicInMemory: () => {
    const { keyring } = get();
    return keyring ? keyring.hasMnemonic() : false;
  },

  getAddressForChain: (chainPrefix: string) => {
    const { selectedAccount } = get();
    if (!selectedAccount) return null;

    // If address already has the right prefix, return it
    if (selectedAccount.address.startsWith(chainPrefix)) {
      return selectedAccount.address;
    }

    // Convert to new prefix using Keyring utility
    try {
      return Keyring.convertAddress(selectedAccount.address, chainPrefix);
    } catch {
      return null;
    }
  },

  // Helper to update session after deriving new addresses
  updateSession: async () => {
    const { keyring } = get();
    if (!keyring) return;

    try {
      const serializedWallet = await keyring.serialize();
      await EncryptedStorage.updateSerializedWallet(serializedWallet);
    } catch (error) {
      console.error('Failed to update session:', error);
    }
  },

  // Bitcoin-specific methods
  getBitcoinAddress: async (networkId: string, accountIndex?: number, cosmosAddress?: string) => {
    const { keyring, selectedAccount, accounts, updateSession } = get();
    if (!keyring) return null;

    // Determine which account we're getting the address for
    const targetCosmosAddress = cosmosAddress ?? selectedAccount?.address;

    // Check if this is an imported account (ID starts with 'imported-')
    const targetAccount = accounts.find((acc) => acc.address === targetCosmosAddress);
    const isImportedAccount = targetAccount?.id?.startsWith('imported-');

    // For imported accounts, retrieve pre-derived addresses from storage
    if (isImportedAccount && targetCosmosAddress) {
      const derivedAddresses =
        await EncryptedStorage.getImportedAccountDerivedAddresses(targetCosmosAddress);
      if (derivedAddresses?.bitcoin?.[networkId]) {
        return derivedAddresses.bitcoin[networkId];
      }
      // If no pre-derived address found, return null (can't derive without password)
      console.warn(`No pre-derived Bitcoin address for imported account on ${networkId}`);
      return null;
    }

    // For main wallet accounts, use the keyring
    // Use provided accountIndex or fall back to selected account's index
    const idx = accountIndex ?? selectedAccount?.accountIndex ?? 0;

    // Try to get existing Bitcoin account (may have address from session restore)
    let btcAccount = keyring.getBitcoinAccount(networkId, idx);

    // If mnemonic is available and account has no private key (restored from session),
    // always re-derive to ensure correct BIP32 derivation
    const needsRederivation =
      keyring.hasMnemonic() && btcAccount && btcAccount.privateKey.length === 0;

    // Return cached address only if it has valid keys (not a stale session restore)
    if (btcAccount?.address && btcAccount.privateKey.length > 0) {
      return btcAccount.address;
    }

    // Try to derive if mnemonic is available
    if (keyring.hasMnemonic()) {
      const network = networkRegistry.getBitcoin(networkId);
      if (!network) return null;

      try {
        // Force re-derivation to ensure correct addresses after BIP32 fix
        btcAccount = await keyring.deriveBitcoinAccount(
          networkId,
          network.network,
          idx,
          network.addressType,
          needsRederivation // Force re-derive if restored from session
        );
        // Update session with newly derived address
        await updateSession();
      } catch (error) {
        console.error('Failed to derive Bitcoin address:', error);
        return null;
      }
    }

    return btcAccount?.address || null;
  },

  deriveBitcoinAccount: async (networkId: string, accountIndex?: number) => {
    const { keyring, selectedAccount, updateSession } = get();
    if (!keyring) return null;

    const network = networkRegistry.getBitcoin(networkId);
    if (!network) return null;

    // Use provided accountIndex or fall back to selected account's index
    const idx = accountIndex ?? selectedAccount?.accountIndex ?? 0;

    try {
      const account = await keyring.deriveBitcoinAccount(
        networkId,
        network.network,
        idx,
        network.addressType
      );
      // Update session with newly derived address
      await updateSession();
      return account;
    } catch (error) {
      console.error('Failed to derive Bitcoin account:', error);
      return null;
    }
  },

  // EVM-specific methods
  getEvmAddress: async (networkId: string, accountIndex?: number, cosmosAddress?: string) => {
    const { keyring, selectedAccount, accounts, updateSession } = get();
    if (!keyring) return null;

    // Determine which account we're getting the address for
    const targetCosmosAddress = cosmosAddress ?? selectedAccount?.address;

    // Check if this is an imported account (ID starts with 'imported-')
    const targetAccount = accounts.find((acc) => acc.address === targetCosmosAddress);
    const isImportedAccount = targetAccount?.id?.startsWith('imported-');

    // For imported accounts, retrieve pre-derived addresses from storage
    if (isImportedAccount && targetCosmosAddress) {
      const derivedAddresses =
        await EncryptedStorage.getImportedAccountDerivedAddresses(targetCosmosAddress);
      if (derivedAddresses?.evm?.[networkId]) {
        return derivedAddresses.evm[networkId];
      }
      // If no pre-derived address found, return null (can't derive without password)
      console.warn(`No pre-derived EVM address for imported account on ${networkId}`);
      return null;
    }

    // For main wallet accounts, use the keyring
    // Use provided accountIndex or fall back to selected account's index
    const idx = accountIndex ?? selectedAccount?.accountIndex ?? 0;

    // Try to get existing EVM account (may have address from session restore)
    let evmAccount = keyring.getEvmAccount(networkId, idx);

    // Return cached address if available
    if (evmAccount?.address) {
      return evmAccount.address;
    }

    // Try to derive if mnemonic is available
    if (keyring.hasMnemonic()) {
      const network = networkRegistry.getEvm(networkId);
      if (!network) return null;

      try {
        evmAccount = await keyring.deriveEvmAccount(networkId, network.chainId, idx);
        // Update session with newly derived address
        await updateSession();
      } catch (error) {
        console.error('Failed to derive EVM address:', error);
        return null;
      }
    }

    return evmAccount?.address || null;
  },

  deriveEvmAccount: async (networkId: string, accountIndex?: number) => {
    const { keyring, selectedAccount, updateSession } = get();
    if (!keyring) return null;

    const network = networkRegistry.getEvm(networkId);
    if (!network) return null;

    // Use provided accountIndex or fall back to selected account's index
    const idx = accountIndex ?? selectedAccount?.accountIndex ?? 0;

    try {
      const account = await keyring.deriveEvmAccount(networkId, network.chainId, idx);
      // Update session with newly derived address
      await updateSession();
      return account;
    } catch (error) {
      console.error('Failed to derive EVM account:', error);
      return null;
    }
  },
}));
