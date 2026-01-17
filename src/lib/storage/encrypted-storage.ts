import browser from 'webextension-polyfill';
import { KeyringAccount } from '@/lib/crypto/keyring';

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

interface StoredWallet {
  encryptedMnemonic: string;
  salt: string;
  accounts: SerializedAccount[];
  // Imported accounts have their own encrypted mnemonics
  importedAccounts?: ImportedAccount[];
}

interface ImportedAccount {
  account: SerializedAccount;
  encryptedMnemonic: string;
  salt: string;
}

export class EncryptedStorage {
  private static readonly WALLET_KEY = 'vidulum_app';
  private static readonly SESSION_KEY = 'vidulum_session';
  private static readonly PREFERENCES_KEY = 'vidulum_preferences';

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
    const wallet = result[this.WALLET_KEY] as StoredWallet | undefined;

    if (!wallet) {
      return null;
    }

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

  // Load just the account metadata (no password required - no mnemonic returned)
  static async loadWalletMetadata(): Promise<{ accounts: KeyringAccount[] } | null> {
    const result = await browser.storage.local.get(this.WALLET_KEY);
    const wallet = result[this.WALLET_KEY] as StoredWallet | undefined;

    if (!wallet) {
      return null;
    }

    return {
      accounts: wallet.accounts.map((acc) => this.deserializeAccount(acc)),
    };
  }

  // Update only the accounts list without re-encrypting the mnemonic
  static async updateAccounts(accounts: KeyringAccount[]): Promise<void> {
    const result = await browser.storage.local.get(this.WALLET_KEY);
    const wallet = result[this.WALLET_KEY] as StoredWallet | undefined;

    if (!wallet) {
      throw new Error('No wallet found');
    }

    wallet.accounts = accounts.map((acc) => this.serializeAccount(acc));
    await browser.storage.local.set({ [this.WALLET_KEY]: wallet });
  }

  static async deleteWallet(): Promise<void> {
    await browser.storage.local.remove(this.WALLET_KEY);
    await this.clearSession();
  }

  // Add an imported account with its own mnemonic
  static async addImportedAccount(
    mnemonic: string,
    password: string,
    account: KeyringAccount
  ): Promise<void> {
    const result = await browser.storage.local.get(this.WALLET_KEY);
    const wallet = result[this.WALLET_KEY] as StoredWallet | undefined;

    if (!wallet) {
      throw new Error('No wallet found');
    }

    const salt = this.generateSalt();
    const key = await this.deriveKey(password, salt);
    const encryptedMnemonic = await this.encrypt(mnemonic, key);

    const importedAccount: ImportedAccount = {
      account: this.serializeAccount(account),
      encryptedMnemonic,
      salt,
    };

    wallet.importedAccounts = wallet.importedAccounts || [];
    wallet.importedAccounts.push(importedAccount);

    await browser.storage.local.set({ [this.WALLET_KEY]: wallet });
  }

  // Load all imported accounts (returns accounts without decrypting mnemonics)
  static async getImportedAccounts(): Promise<KeyringAccount[]> {
    const result = await browser.storage.local.get(this.WALLET_KEY);
    const wallet = result[this.WALLET_KEY] as StoredWallet | undefined;

    if (!wallet || !wallet.importedAccounts) {
      return [];
    }

    return wallet.importedAccounts.map((imp) => this.deserializeAccount(imp.account));
  }

  // Get the mnemonic for an imported account (for signing)
  static async getImportedAccountMnemonic(
    address: string,
    password: string
  ): Promise<string | null> {
    const result = await browser.storage.local.get(this.WALLET_KEY);
    const wallet = result[this.WALLET_KEY] as StoredWallet | undefined;

    if (!wallet || !wallet.importedAccounts) {
      return null;
    }

    const imported = wallet.importedAccounts.find((imp) => imp.account.address === address);

    if (!imported) {
      return null;
    }

    const key = await this.deriveKey(password, imported.salt);
    return await this.decrypt(imported.encryptedMnemonic, key);
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
    await browser.storage.local.set({
      [this.PREFERENCES_KEY]: { ...current, ...preferences },
    });
  }

  static async getPreferences(): Promise<{
    selectedAccountId?: string;
    selectedChainId?: string;
    autoLockMinutes?: number;
  }> {
    const result = await browser.storage.local.get(this.PREFERENCES_KEY);
    return result[this.PREFERENCES_KEY] || {};
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
