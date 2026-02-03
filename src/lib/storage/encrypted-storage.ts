import browser from 'webextension-polyfill';
import { KeyringAccount } from '@/lib/crypto/keyring';

// Current storage version - increment when schema changes
const CURRENT_STORAGE_VERSION = 1;

// Serializable version of KeyringAccount (Uint8Array -> base64 string)
interface SerializedAccount {
  id: string;
  name: string;
  address: string;
  pubKey: string; // base64 encoded
  algo: string;
  hdPath: string;
  accountIndex: number;
}

interface ImportedAccount {
  account: SerializedAccount;
  encryptedMnemonic: string;
  salt: string;
  // Pre-derived addresses for non-Cosmos chains (so we don't need mnemonic to display them)
  derivedAddresses?: {
    bitcoin?: Record<string, string>; // networkId -> address
    evm?: Record<string, string>; // networkId -> address
  };
}

// Extended interface for accounts derived from another imported account
interface ImportedAccountWithSource extends ImportedAccount {
  sourceAddress: string; // The cosmos address of the wallet this was derived from
}

interface StoredWallet {
  version: number;
  encryptedMnemonic: string;
  salt: string;
  accounts: SerializedAccount[];
  // Imported accounts have their own encrypted mnemonics
  importedAccounts?: ImportedAccount[];
}

// Legacy wallet format (before versioning)
interface LegacyStoredWallet {
  encryptedMnemonic: string;
  salt: string;
  accounts: SerializedAccount[];
  importedAccounts?: ImportedAccount[];
}

/**
 * Migration functions to upgrade storage from version N to N+1
 * Each migration receives the data at version N and returns data at version N+1
 */
type MigrationFn = (data: any) => any;

const MIGRATIONS: Record<number, MigrationFn> = {
  // Migration from unversioned (legacy) to version 1
  // This is a no-op since the schema is the same, just adds version field
  0: (data: LegacyStoredWallet): StoredWallet => ({
    ...data,
    version: 1,
  }),

  // Future migrations go here:
  // 1: (data: StoredWalletV1): StoredWalletV2 => { ... },
  // 2: (data: StoredWalletV2): StoredWalletV3 => { ... },
};

/**
 * Migrate stored wallet data to the current version
 */
function migrateWalletData(data: any): StoredWallet {
  // Determine current version (unversioned data is version 0)
  let currentVersion = data.version ?? 0;

  // Run migrations sequentially until we reach the current version
  while (currentVersion < CURRENT_STORAGE_VERSION) {
    const migration = MIGRATIONS[currentVersion];
    if (!migration) {
      throw new Error(`No migration found for version ${currentVersion}`);
    }

    console.log(`Migrating wallet data from version ${currentVersion} to ${currentVersion + 1}`);
    data = migration(data);
    currentVersion = data.version;
  }

  return data as StoredWallet;
}

// Preferences also get versioning for future-proofing
interface StoredPreferences {
  version: number;
  selectedAccountId?: string;
  selectedChainId?: string;
  autoLockMinutes?: number;
}

const CURRENT_PREFERENCES_VERSION = 1;

const PREFERENCES_MIGRATIONS: Record<number, MigrationFn> = {
  // Migration from unversioned to version 1
  0: (data: any): StoredPreferences => ({
    ...data,
    version: 1,
  }),
};

function migratePreferencesData(data: any): StoredPreferences {
  let currentVersion = data.version ?? 0;

  while (currentVersion < CURRENT_PREFERENCES_VERSION) {
    const migration = PREFERENCES_MIGRATIONS[currentVersion];
    if (!migration) {
      throw new Error(`No preferences migration found for version ${currentVersion}`);
    }

    console.log(`Migrating preferences from version ${currentVersion} to ${currentVersion + 1}`);
    data = migration(data);
    currentVersion = data.version;
  }

  return data as StoredPreferences;
}

export class EncryptedStorage {
  private static readonly WALLET_KEY = 'vidulum_app';
  private static readonly SESSION_KEY = 'vidulum_session';
  private static readonly PREFERENCES_KEY = 'vidulum_preferences';

  // Expose current versions for debugging/diagnostics
  static readonly WALLET_VERSION = CURRENT_STORAGE_VERSION;
  static readonly PREFERENCES_VERSION = CURRENT_PREFERENCES_VERSION;

  // Convert Uint8Array to base64 string
  private static uint8ArrayToBase64(arr: Uint8Array): string {
    return btoa(String.fromCharCode(...arr));
  }

  // Convert base64 string to Uint8Array
  private static base64ToUint8Array(str: string): Uint8Array {
    return Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
  }

  // Serialize account for storage
  private static serializeAccount(account: KeyringAccount): SerializedAccount {
    return {
      id: account.id,
      name: account.name,
      address: account.address,
      pubKey: this.uint8ArrayToBase64(account.pubKey),
      algo: account.algo,
      hdPath: account.hdPath,
      accountIndex: account.accountIndex ?? 0,
    };
  }

  // Deserialize account from storage
  private static deserializeAccount(account: SerializedAccount): KeyringAccount {
    return {
      id: account.id,
      name: account.name,
      address: account.address,
      pubKey: this.base64ToUint8Array(account.pubKey),
      algo: account.algo,
      hdPath: account.hdPath,
      accountIndex: account.accountIndex ?? 0,
    };
  }

  static async saveWallet(
    mnemonic: string,
    password: string,
    accounts: KeyringAccount[]
  ): Promise<void> {
    const salt = this.generateSalt();
    const key = await this.deriveKey(password, salt);
    const encryptedMnemonic = await this.encrypt(mnemonic, key);

    const wallet: StoredWallet = {
      version: CURRENT_STORAGE_VERSION,
      encryptedMnemonic,
      salt,
      accounts: accounts.map((acc) => this.serializeAccount(acc)),
    };

    await browser.storage.local.set({ [this.WALLET_KEY]: wallet });
  }

  static async loadWallet(password: string): Promise<{
    mnemonic: string;
    accounts: KeyringAccount[];
  } | null> {
    const result = await browser.storage.local.get(this.WALLET_KEY);
    let wallet = result[this.WALLET_KEY] as StoredWallet | LegacyStoredWallet | undefined;

    if (!wallet) {
      return null;
    }

    // Run migrations if needed
    const migratedWallet = migrateWalletData(wallet);

    // Save migrated data if version changed
    if (migratedWallet.version !== (wallet as any).version) {
      await browser.storage.local.set({ [this.WALLET_KEY]: migratedWallet });
      console.log(`Wallet data migrated to version ${migratedWallet.version}`);
    }

    wallet = migratedWallet;

    const key = await this.deriveKey(password, wallet.salt);
    const mnemonic = await this.decrypt(wallet.encryptedMnemonic, key);

    return {
      mnemonic,
      accounts: wallet.accounts.map((acc) => this.deserializeAccount(acc)),
    };
  }

  static async hasWallet(): Promise<boolean> {
    const result = await browser.storage.local.get(this.WALLET_KEY);
    return !!result[this.WALLET_KEY];
  }

  // Verify the password is correct for the main wallet
  static async verifyPassword(password: string): Promise<boolean> {
    const result = await browser.storage.local.get(this.WALLET_KEY);
    const wallet = result[this.WALLET_KEY] as StoredWallet | LegacyStoredWallet | undefined;

    if (!wallet) {
      console.error('verifyPassword: No wallet found in storage');
      throw new Error('No wallet found');
    }

    const migratedWallet = migrateWalletData(wallet);

    try {
      const key = await this.deriveKey(password, migratedWallet.salt);
      await this.decrypt(migratedWallet.encryptedMnemonic, key);
      return true;
    } catch (error) {
      console.error('verifyPassword: Decryption failed', error);

      // Heuristically treat known authentication failures as "wrong password"
      if (error instanceof Error) {
        const message = error.message.toLowerCase();
        if (
          message.includes('wrong password') ||
          message.includes('invalid password') ||
          message.includes('authentication failed')
        ) {
          return false;
        }
      }

      // For all other errors (e.g. corrupted data, unexpected failures), rethrow
      throw error;
    }
  }

  // Load just the account metadata (no password required - no mnemonic returned)
  static async loadWalletMetadata(): Promise<{ accounts: KeyringAccount[] } | null> {
    const result = await browser.storage.local.get(this.WALLET_KEY);
    let wallet = result[this.WALLET_KEY] as StoredWallet | LegacyStoredWallet | undefined;

    if (!wallet) {
      return null;
    }

    // Run migrations if needed (note: full migration saved on next unlock)
    const migratedWallet = migrateWalletData(wallet);

    return {
      accounts: migratedWallet.accounts.map((acc) => this.deserializeAccount(acc)),
    };
  }

  // Update only the accounts list without re-encrypting the mnemonic
  static async updateAccounts(accounts: KeyringAccount[]): Promise<void> {
    const result = await browser.storage.local.get(this.WALLET_KEY);
    let wallet = result[this.WALLET_KEY] as StoredWallet | LegacyStoredWallet | undefined;

    if (!wallet) {
      throw new Error('No wallet found');
    }

    // Ensure wallet is migrated
    const migratedWallet = migrateWalletData(wallet);
    migratedWallet.accounts = accounts.map((acc) => this.serializeAccount(acc));
    await browser.storage.local.set({ [this.WALLET_KEY]: migratedWallet });
  }

  static async deleteWallet(): Promise<void> {
    await browser.storage.local.remove(this.WALLET_KEY);
    await this.clearSession();
  }

  // Add an imported account with its own mnemonic
  static async addImportedAccount(
    mnemonic: string,
    password: string,
    account: KeyringAccount,
    derivedAddresses?: {
      bitcoin?: Record<string, string>;
      evm?: Record<string, string>;
    }
  ): Promise<void> {
    const result = await browser.storage.local.get(this.WALLET_KEY);
    let wallet = result[this.WALLET_KEY] as StoredWallet | LegacyStoredWallet | undefined;

    if (!wallet) {
      throw new Error('No wallet found');
    }

    // Ensure wallet is migrated
    const migratedWallet = migrateWalletData(wallet);

    const salt = this.generateSalt();
    const key = await this.deriveKey(password, salt);
    const encryptedMnemonic = await this.encrypt(mnemonic, key);

    const importedAccount: ImportedAccount = {
      account: this.serializeAccount(account),
      encryptedMnemonic,
      salt,
      derivedAddresses,
    };

    migratedWallet.importedAccounts = migratedWallet.importedAccounts || [];
    migratedWallet.importedAccounts.push(importedAccount);

    await browser.storage.local.set({ [this.WALLET_KEY]: migratedWallet });
  }

  // Load all imported accounts (returns accounts without decrypting mnemonics)
  static async getImportedAccounts(): Promise<KeyringAccount[]> {
    const result = await browser.storage.local.get(this.WALLET_KEY);
    const wallet = result[this.WALLET_KEY] as StoredWallet | LegacyStoredWallet | undefined;

    if (!wallet) {
      return [];
    }

    // Run migrations if needed
    const migratedWallet = migrateWalletData(wallet);

    if (!migratedWallet.importedAccounts) {
      return [];
    }

    return migratedWallet.importedAccounts.map((imp) => this.deserializeAccount(imp.account));
  }

  // Get the mnemonic for an imported account (for signing)
  static async getImportedAccountMnemonic(
    address: string,
    password: string
  ): Promise<string | null> {
    const result = await browser.storage.local.get(this.WALLET_KEY);
    const wallet = result[this.WALLET_KEY] as StoredWallet | LegacyStoredWallet | undefined;

    if (!wallet) {
      return null;
    }

    // Run migrations if needed
    const migratedWallet = migrateWalletData(wallet);

    if (!migratedWallet.importedAccounts) {
      return null;
    }

    const imported = migratedWallet.importedAccounts.find((imp) => imp.account.address === address);

    if (!imported) {
      console.error('getImportedAccountMnemonic: Account not found in importedAccounts');
      return null;
    }

    try {
      const key = await this.deriveKey(password, imported.salt);
      return await this.decrypt(imported.encryptedMnemonic, key);
    } catch (error) {
      console.error('getImportedAccountMnemonic: Failed to decrypt (wrong password?)', error);
      return null;
    }
  }

  // Get pre-derived addresses for an imported account (no password required)
  static async getImportedAccountDerivedAddresses(
    cosmosAddress: string
  ): Promise<{ bitcoin?: Record<string, string>; evm?: Record<string, string> } | null> {
    const result = await browser.storage.local.get(this.WALLET_KEY);
    const wallet = result[this.WALLET_KEY] as StoredWallet | LegacyStoredWallet | undefined;

    if (!wallet) {
      return null;
    }

    const migratedWallet = migrateWalletData(wallet);

    if (!migratedWallet.importedAccounts) {
      return null;
    }

    const imported = migratedWallet.importedAccounts.find(
      (imp) => imp.account.address === cosmosAddress
    );

    return imported?.derivedAddresses || null;
  }

  // Get all imported accounts that were derived from a specific source wallet
  static async getImportedAccountsFromSource(sourceAddress: string): Promise<KeyringAccount[]> {
    const result = await browser.storage.local.get(this.WALLET_KEY);
    const wallet = result[this.WALLET_KEY] as StoredWallet | LegacyStoredWallet | undefined;

    if (!wallet) {
      return [];
    }

    const migratedWallet = migrateWalletData(wallet);

    if (!migratedWallet.importedAccounts) {
      return [];
    }

    // Filter accounts that have this source address
    // Include the source itself (sourceAddress matches the account) + any derived from it
    return migratedWallet.importedAccounts
      .filter(
        (imp) =>
          imp.account.address === sourceAddress ||
          (imp as ImportedAccountWithSource).sourceAddress === sourceAddress
      )
      .map((imp) => this.deserializeAccount(imp.account));
  }

  // Add an imported account that was derived from another imported account
  static async addImportedAccountFromSource(
    mnemonic: string,
    password: string,
    account: KeyringAccount,
    derivedAddresses: {
      bitcoin?: Record<string, string>;
      evm?: Record<string, string>;
    },
    sourceAddress: string
  ): Promise<void> {
    const result = await browser.storage.local.get(this.WALLET_KEY);
    let wallet = result[this.WALLET_KEY] as StoredWallet | LegacyStoredWallet | undefined;

    if (!wallet) {
      throw new Error('No wallet found');
    }

    const migratedWallet = migrateWalletData(wallet);

    const salt = this.generateSalt();
    const key = await this.deriveKey(password, salt);
    const encryptedMnemonic = await this.encrypt(mnemonic, key);

    const importedAccount: ImportedAccountWithSource = {
      account: this.serializeAccount(account),
      encryptedMnemonic,
      salt,
      derivedAddresses,
      sourceAddress, // Track which wallet this was derived from
    };

    migratedWallet.importedAccounts = migratedWallet.importedAccounts || [];
    migratedWallet.importedAccounts.push(importedAccount);

    await browser.storage.local.set({ [this.WALLET_KEY]: migratedWallet });
  }

  static async setSession(sessionId: string, serializedWallet?: string): Promise<void> {
    await browser.storage.session.set({
      [this.SESSION_KEY]: sessionId,
      serializedWallet: serializedWallet || null,
    });
  }

  static async getSession(): Promise<string | null> {
    const result = await browser.storage.session.get(this.SESSION_KEY);
    return result[this.SESSION_KEY] || null;
  }

  static async getSerializedWallet(): Promise<string | null> {
    const result = await browser.storage.session.get('serializedWallet');
    return result.serializedWallet || null;
  }

  // Update just the serialized wallet data (for updating cached Bitcoin/EVM addresses)
  static async updateSerializedWallet(serializedWallet: string): Promise<void> {
    await browser.storage.session.set({ serializedWallet });
  }

  static async clearSession(): Promise<void> {
    await browser.storage.session.remove([this.SESSION_KEY, 'serializedWallet', 'lastActivity']);
  }

  // User preferences (selected account, chain, etc.)
  static async savePreferences(preferences: {
    selectedAccountId?: string;
    selectedChainId?: string;
    autoLockMinutes?: number;
  }): Promise<void> {
    const current = await this.getPreferences();
    const updated: StoredPreferences = {
      ...current,
      ...preferences,
      version: CURRENT_PREFERENCES_VERSION,
    };
    await browser.storage.local.set({
      [this.PREFERENCES_KEY]: updated,
    });
  }

  static async getPreferences(): Promise<{
    selectedAccountId?: string;
    selectedChainId?: string;
    autoLockMinutes?: number;
  }> {
    const result = await browser.storage.local.get(this.PREFERENCES_KEY);
    const prefs = result[this.PREFERENCES_KEY];

    if (!prefs) {
      return {};
    }

    // Run migrations if needed
    const migratedPrefs = migratePreferencesData(prefs);

    // Save migrated data if version changed
    if (migratedPrefs.version !== prefs.version) {
      await browser.storage.local.set({ [this.PREFERENCES_KEY]: migratedPrefs });
      console.log(`Preferences migrated to version ${migratedPrefs.version}`);
    }

    return migratedPrefs;
  }

  // Last activity tracking for auto-lock
  static async setLastActivity(): Promise<void> {
    await browser.storage.session.set({ lastActivity: Date.now() });
  }

  static async getLastActivity(): Promise<number | null> {
    const result = await browser.storage.session.get('lastActivity');
    return result.lastActivity || null;
  }

  static async shouldAutoLock(): Promise<boolean> {
    const preferences = await this.getPreferences();
    const autoLockMinutes = preferences.autoLockMinutes ?? 15; // Default 15 minutes

    if (autoLockMinutes === 0) return false; // 0 means disabled

    const lastActivity = await this.getLastActivity();
    if (!lastActivity) return false;

    const elapsed = Date.now() - lastActivity;
    const timeoutMs = autoLockMinutes * 60 * 1000;

    return elapsed > timeoutMs;
  }

  private static generateSalt(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  private static async deriveKey(password: string, salt: string): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    return await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encoder.encode(salt),
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  private static async encrypt(text: string, key: CryptoKey): Promise<string> {
    const encoder = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoder.encode(text)
    );

    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);

    return btoa(String.fromCharCode(...combined));
  }

  private static async decrypt(encrypted: string, key: CryptoKey): Promise<string> {
    const combined = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);

    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  }
}
