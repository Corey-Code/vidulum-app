import { Buffer } from 'buffer';
// Polyfill Buffer for browser environment (needed by bip39)
if (typeof globalThis.Buffer === 'undefined') {
  globalThis.Buffer = Buffer;
}

import { DirectSecp256k1HdWallet, makeCosmoshubPath } from '@cosmjs/proto-signing';
import {
  AminoSignResponse,
  StdSignDoc,
  makeSignDoc as makeAminoSignDoc,
  Secp256k1HdWallet,
} from '@cosmjs/amino';
import { DirectSignResponse } from '@cosmjs/proto-signing';
import { toBech32, fromBech32 } from '@cosmjs/encoding';
import { sha256 } from '@noble/hashes/sha256';
import * as secp256k1 from '@noble/secp256k1';
import * as bip39 from 'bip39';
import {
  deriveBitcoinKeyPairFromSeed,
  getBitcoinAddress,
  getBitcoinDerivationPath,
  getUtxoAddress,
  getUtxoDerivationPath,
  BitcoinNetwork,
  UtxoNetworkId,
  UTXO_NETWORKS,
} from './bitcoin';
import { deriveEvmKeyPair, getEvmDerivationPath } from './evm';
import { networkRegistry } from '@/lib/networks';

export interface KeyringAccount {
  id: string;
  name: string;
  address: string;
  pubKey: Uint8Array;
  algo: string;
  hdPath: string;
  accountIndex: number; // Track which HD index this account uses
}

// Bitcoin account with additional fields
export interface BitcoinKeyringAccount {
  id: string;
  name: string;
  address: string;
  publicKey: Uint8Array;
  privateKey: Uint8Array;
  network: BitcoinNetwork;
  addressType: 'p2wpkh' | 'p2sh-p2wpkh' | 'p2pkh';
  hdPath: string;
  accountIndex: number;
}

// EVM account
export interface EvmKeyringAccount {
  id: string;
  name: string;
  address: string;
  publicKey: Uint8Array;
  privateKey: Uint8Array;
  chainId: number;
  hdPath: string;
  accountIndex: number;
}

export class Keyring {
  private wallet: DirectSecp256k1HdWallet | null = null;
  private aminoWallet: Secp256k1HdWallet | null = null;
  private accounts: KeyringAccount[] = [];
  private bitcoinAccounts: Map<string, BitcoinKeyringAccount> = new Map(); // `networkId-accountIndex` -> account
  private evmAccounts: Map<string, EvmKeyringAccount> = new Map(); // `networkId-accountIndex` -> account
  private mnemonic: string = '';
  private prefix: string = 'bze';

  // Helper to create composite key for account maps
  private getAccountKey(networkId: string, accountIndex: number): string {
    return `${networkId}-${accountIndex}`;
  }

  async createFromMnemonic(
    mnemonic: string,
    prefix: string = 'bze',
    accountIndices: number[] = [0]
  ): Promise<void> {
    this.mnemonic = mnemonic;
    this.prefix = prefix;

    // Create HD paths for all account indices
    const hdPaths = accountIndices.map((index) => makeCosmoshubPath(index));

    // Create both Direct and Amino wallets
    this.wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {
      prefix,
      hdPaths,
    });

    this.aminoWallet = await Secp256k1HdWallet.fromMnemonic(mnemonic, {
      prefix,
      hdPaths,
    });

    await this.loadAccounts(accountIndices);
  }

  async addAccount(name: string): Promise<KeyringAccount> {
    if (!this.mnemonic) {
      throw new Error('Wallet not initialized');
    }

    // Find the next available account index
    const existingIndices = this.accounts.map((acc) => acc.accountIndex);
    const nextIndex = existingIndices.length > 0 ? Math.max(...existingIndices) + 1 : 1;

    // Recreate wallets with all existing indices plus the new one
    const allIndices = [...existingIndices, nextIndex];
    const hdPaths = allIndices.map((index) => makeCosmoshubPath(index));

    this.wallet = await DirectSecp256k1HdWallet.fromMnemonic(this.mnemonic, {
      prefix: this.prefix,
      hdPaths,
    });

    this.aminoWallet = await Secp256k1HdWallet.fromMnemonic(this.mnemonic, {
      prefix: this.prefix,
      hdPaths,
    });

    // Get the new account from the wallet
    const cosmosAccounts = await this.wallet.getAccounts();
    const newCosmosAccount = cosmosAccounts[cosmosAccounts.length - 1];

    const newAccount: KeyringAccount = {
      id: `account-${nextIndex}`,
      name,
      address: newCosmosAccount.address,
      pubKey: newCosmosAccount.pubkey,
      algo: newCosmosAccount.algo,
      hdPath: `m/44'/118'/0'/0/${nextIndex}`,
      accountIndex: nextIndex,
    };

    this.accounts.push(newAccount);
    return newAccount;
  }

  getMnemonic(): string {
    return this.mnemonic;
  }

  async importFromMnemonic(
    mnemonic: string,
    name: string,
    prefix: string = 'bze'
  ): Promise<KeyringAccount> {
    await this.createFromMnemonic(mnemonic, prefix);
    if (this.accounts.length === 0) {
      throw new Error('No accounts generated from mnemonic');
    }

    const account = this.accounts[0];
    account.name = name;
    return account;
  }

  private async loadAccounts(accountIndices: number[]): Promise<void> {
    if (!this.wallet) {
      throw new Error('Wallet not initialized');
    }

    const cosmosAccounts = await this.wallet.getAccounts();
    this.accounts = cosmosAccounts.map((acc, i) => ({
      id: `account-${accountIndices[i]}`,
      name: `Account ${accountIndices[i] + 1}`,
      address: acc.address,
      pubKey: acc.pubkey,
      algo: acc.algo,
      hdPath: `m/44'/118'/0'/0/${accountIndices[i]}`,
      accountIndex: accountIndices[i],
    }));
  }

  async signAmino(signerAddress: string, signDoc: StdSignDoc): Promise<AminoSignResponse> {
    if (!this.aminoWallet) {
      throw new Error('Wallet not initialized');
    }

    return await this.aminoWallet.signAmino(signerAddress, signDoc);
  }

  async signDirect(
    signerAddress: string,
    signDoc: {
      bodyBytes: Uint8Array;
      authInfoBytes: Uint8Array;
      chainId: string;
      accountNumber: bigint;
    }
  ): Promise<DirectSignResponse> {
    if (!this.wallet) {
      throw new Error('Wallet not initialized');
    }

    return await this.wallet.signDirect(signerAddress, {
      ...signDoc,
      accountNumber: BigInt(signDoc.accountNumber),
    });
  }

  async signArbitrary(
    signerAddress: string,
    data: string | Uint8Array
  ): Promise<{ signature: string; pub_key: { type: string; value: string } }> {
    if (!this.wallet) {
      throw new Error('Wallet not initialized');
    }

    const dataBytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;

    const account = this.accounts.find((acc) => acc.address === signerAddress);
    if (!account) {
      throw new Error('Account not found');
    }

    // Create a fake sign doc for arbitrary signing
    const signDoc = makeAminoSignDoc(
      [],
      { gas: '0', amount: [] },
      '',
      new TextEncoder().encode(dataBytes.toString()).toString(),
      0,
      0
    );

    const response = await this.signAmino(signerAddress, signDoc);

    return {
      signature: response.signature.signature,
      pub_key: {
        type: 'tendermint/PubKeySecp256k1',
        value: Buffer.from(account.pubKey).toString('base64'),
      },
    };
  }

  /**
   * Verify an arbitrary message signature (ADR-036)
   * This verifies that the signature was created by the public key in the signature
   */
  async verifyArbitrary(
    signerAddress: string,
    data: string | Uint8Array,
    signature: { signature: string; pub_key: { type: string; value: string } }
  ): Promise<boolean> {
    try {
      // Decode the signature and public key from base64
      const signatureBytes = Buffer.from(signature.signature, 'base64');
      const pubKeyBytes = Buffer.from(signature.pub_key.value, 'base64');

      // Verify the public key matches the signer address
      // Derive address from public key and compare
      const account = this.accounts.find((acc) => acc.address === signerAddress);
      if (account) {
        // If we have the account, verify the pubkey matches
        const storedPubKeyBase64 = Buffer.from(account.pubKey).toString('base64');
        if (storedPubKeyBase64 !== signature.pub_key.value) {
          return false;
        }
      }

      // Create the same sign doc that was used for signing
      const dataBytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
      const signDoc = makeAminoSignDoc(
        [],
        { gas: '0', amount: [] },
        '',
        new TextEncoder().encode(dataBytes.toString()).toString(),
        0,
        0
      );

      // Serialize and hash the sign doc (same as what was signed)
      const signDocBytes = new TextEncoder().encode(JSON.stringify(signDoc));
      const messageHash = sha256(signDocBytes);

      // Verify the signature using secp256k1
      const isValid = secp256k1.verify(signatureBytes, messageHash, pubKeyBytes);

      return isValid;
    } catch (error) {
      return false;
    }
  }

  getAccounts(): KeyringAccount[] {
    return [...this.accounts];
  }

  getAccount(address: string): KeyringAccount | undefined {
    return this.accounts.find((acc) => acc.address === address);
  }

  // Convert an address from one bech32 prefix to another
  // Works because all Cosmos chains with coinType 118 use the same underlying key
  static convertAddress(address: string, newPrefix: string): string {
    try {
      const { data } = fromBech32(address);
      return toBech32(newPrefix, data);
    } catch {
      throw new Error('Invalid address format');
    }
  }

  // Get address for a specific chain prefix
  getAddressForChain(accountIndex: number, prefix: string): string | undefined {
    const account = this.accounts.find((acc) => acc.accountIndex === accountIndex);
    if (!account) return undefined;

    // If same prefix, return stored address
    if (account.address.startsWith(prefix)) {
      return account.address;
    }

    // Convert to new prefix
    return Keyring.convertAddress(account.address, prefix);
  }

  getWallet(): DirectSecp256k1HdWallet {
    if (!this.wallet) {
      throw new Error('Wallet not initialized');
    }
    return this.wallet;
  }

  // ============================================================================
  // Bitcoin Support
  // ============================================================================

  /**
   * Derive a UTXO account from the mnemonic
   * Supports Bitcoin, Zcash, Flux, Ravencoin, and other UTXO chains
   * @param forceReDerive - If true, re-derive keys even if account exists (useful after session restore)
   */
  async deriveBitcoinAccount(
    networkId: string,
    network: BitcoinNetwork = 'mainnet',
    accountIndex: number = 0,
    addressType: 'p2wpkh' | 'p2sh-p2wpkh' | 'p2pkh' | 'transparent' = 'p2wpkh',
    forceReDerive: boolean = false
  ): Promise<BitcoinKeyringAccount> {
    if (!this.mnemonic) {
      throw new Error('Wallet not initialized');
    }

    // Check if already derived using composite key
    const accountKey = this.getAccountKey(networkId, accountIndex);
    const existing = this.bitcoinAccounts.get(accountKey);

    // Return existing if it has valid keys (non-empty) and we're not forcing re-derivation
    if (existing && existing.privateKey.length > 0 && !forceReDerive) {
      return existing;
    }

    // Derive keys - ensure seed is a proper Uint8Array
    const seedBuffer = await bip39.mnemonicToSeed(this.mnemonic);
    const seed = new Uint8Array(seedBuffer);

    let path: string;
    let address: string;

    // Check if this is a known UTXO network with specific parameters
    if (networkId in UTXO_NETWORKS) {
      // Use UTXO-specific derivation path and address generation
      const utxoNetworkId = networkId as UtxoNetworkId;
      // Pass addressType to get correct BIP purpose (84 for native SegWit, 44 for legacy, etc.)
      path = getUtxoDerivationPath(utxoNetworkId, accountIndex, 0, false, addressType);
      const keyPair = await deriveBitcoinKeyPairFromSeed(seed, path);
      address = getUtxoAddress(keyPair.publicKey, utxoNetworkId, addressType);

      const account: BitcoinKeyringAccount = {
        id: `utxo-${networkId}-${accountIndex}`,
        name: `${UTXO_NETWORKS[utxoNetworkId].name} Account ${accountIndex + 1}`,
        address,
        publicKey: keyPair.publicKey,
        privateKey: keyPair.privateKey,
        network,
        addressType: addressType === 'transparent' ? 'p2pkh' : addressType,
        hdPath: path,
        accountIndex,
      };

      this.bitcoinAccounts.set(accountKey, account);
      return account;
    } else {
      // Fallback to Bitcoin-style derivation for unknown networks
      path = getBitcoinDerivationPath(
        accountIndex,
        0,
        false,
        addressType === 'transparent' ? 'p2pkh' : addressType,
        network
      );
      const keyPair = await deriveBitcoinKeyPairFromSeed(seed, path);
      address = getBitcoinAddress(
        keyPair.publicKey,
        addressType === 'transparent' ? 'p2pkh' : addressType,
        network
      );

      const account: BitcoinKeyringAccount = {
        id: `bitcoin-${networkId}-${accountIndex}`,
        name: `Bitcoin Account ${accountIndex + 1}`,
        address,
        publicKey: keyPair.publicKey,
        privateKey: keyPair.privateKey,
        network,
        addressType: addressType === 'transparent' ? 'p2pkh' : addressType,
        hdPath: path,
        accountIndex,
      };

      this.bitcoinAccounts.set(accountKey, account);
      return account;
    }
  }

  /**
   * Get Bitcoin account for a network and account index
   */
  getBitcoinAccount(
    networkId: string,
    accountIndex: number = 0
  ): BitcoinKeyringAccount | undefined {
    const accountKey = this.getAccountKey(networkId, accountIndex);
    return this.bitcoinAccounts.get(accountKey);
  }

  /**
   * Get all Bitcoin accounts
   */
  getAllBitcoinAccounts(): BitcoinKeyringAccount[] {
    return Array.from(this.bitcoinAccounts.values());
  }

  /**
   * Get Bitcoin address for a network and account index
   */
  getBitcoinAddress(networkId: string, accountIndex: number = 0): string | undefined {
    const accountKey = this.getAccountKey(networkId, accountIndex);
    return this.bitcoinAccounts.get(accountKey)?.address;
  }

  /**
   * Get Bitcoin private key for signing (use carefully!)
   * Will re-derive keys if they were restored from session without keys
   */
  async getBitcoinPrivateKey(
    networkId: string,
    accountIndex: number = 0
  ): Promise<Uint8Array | undefined> {
    const accountKey = this.getAccountKey(networkId, accountIndex);
    let account = this.bitcoinAccounts.get(accountKey);

    // If account doesn't exist or keys are empty, try to derive
    if ((!account || account.privateKey.length === 0) && this.mnemonic) {
      const network = networkRegistry.getBitcoin(networkId);
      if (network) {
        const reDerived = await this.deriveBitcoinAccount(
          networkId,
          network.network,
          accountIndex,
          network.addressType as 'p2wpkh' | 'p2sh-p2wpkh' | 'p2pkh' | 'transparent',
          true // forceReDerive
        );
        return reDerived?.privateKey;
      }
    }

    return account?.privateKey;
  }

  /**
   * Get Bitcoin public key
   * Will re-derive keys if they were restored from session without keys
   */
  async getBitcoinPublicKey(
    networkId: string,
    accountIndex: number = 0
  ): Promise<Uint8Array | undefined> {
    const accountKey = this.getAccountKey(networkId, accountIndex);
    let account = this.bitcoinAccounts.get(accountKey);

    // If account doesn't exist or keys are empty, try to derive
    if ((!account || account.publicKey.length === 0) && this.mnemonic) {
      const network = networkRegistry.getBitcoin(networkId);
      if (network) {
        const reDerived = await this.deriveBitcoinAccount(
          networkId,
          network.network,
          accountIndex,
          network.addressType as 'p2wpkh' | 'p2sh-p2wpkh' | 'p2pkh' | 'transparent',
          true // forceReDerive
        );
        return reDerived?.publicKey;
      }
    }

    return account?.publicKey;
  }

  // ============================================================================
  // EVM Support
  // ============================================================================

  /**
   * Derive an EVM account from the mnemonic
   */
  async deriveEvmAccount(
    networkId: string,
    chainId: number,
    accountIndex: number = 0
  ): Promise<EvmKeyringAccount> {
    if (!this.mnemonic) {
      throw new Error('Wallet not initialized');
    }

    // Check if already derived using composite key
    const accountKey = this.getAccountKey(networkId, accountIndex);
    const existing = this.evmAccounts.get(accountKey);
    if (existing) {
      return existing;
    }

    // Derive EVM keys
    const keyPair = await deriveEvmKeyPair(this.mnemonic, accountIndex, 0);
    const path = getEvmDerivationPath(accountIndex, 0);

    const account: EvmKeyringAccount = {
      id: `evm-${networkId}-${accountIndex}`,
      name: `EVM Account ${accountIndex + 1}`,
      address: keyPair.address,
      publicKey: keyPair.publicKey,
      privateKey: keyPair.privateKey,
      chainId,
      hdPath: path,
      accountIndex,
    };

    this.evmAccounts.set(accountKey, account);
    return account;
  }

  /**
   * Get EVM account for a network and account index
   */
  getEvmAccount(networkId: string, accountIndex: number = 0): EvmKeyringAccount | undefined {
    const accountKey = this.getAccountKey(networkId, accountIndex);
    return this.evmAccounts.get(accountKey);
  }

  /**
   * Get all EVM accounts
   */
  getAllEvmAccounts(): EvmKeyringAccount[] {
    return Array.from(this.evmAccounts.values());
  }

  /**
   * Get EVM address for a network and account index
   */
  getEvmAddress(networkId: string, accountIndex: number = 0): string | undefined {
    const accountKey = this.getAccountKey(networkId, accountIndex);
    return this.evmAccounts.get(accountKey)?.address;
  }

  /**
   * Get EVM private key for signing (use carefully!)
   */
  getEvmPrivateKey(networkId: string, accountIndex: number = 0): Uint8Array | undefined {
    const accountKey = this.getAccountKey(networkId, accountIndex);
    return this.evmAccounts.get(accountKey)?.privateKey;
  }

  /**
   * Get EVM public key
   */
  getEvmPublicKey(networkId: string, accountIndex: number = 0): Uint8Array | undefined {
    const accountKey = this.getAccountKey(networkId, accountIndex);
    return this.evmAccounts.get(accountKey)?.publicKey;
  }

  // Serialize wallet for session storage (keeps wallet unlocked across popup opens)
  async serialize(): Promise<string> {
    if (!this.wallet || !this.aminoWallet) {
      throw new Error('Wallet not initialized');
    }
    // Both wallet types have serialize methods that encrypt with a password
    // We use an empty password since this is just for session storage
    const serialized = await this.wallet.serialize('');
    const aminoSerialized = await this.aminoWallet.serialize('');

    // Serialize Bitcoin accounts (excluding private keys for safety in session)
    const bitcoinAccountsData: Array<{
      accountKey: string; // composite key: networkId-accountIndex
      address: string;
      network: BitcoinNetwork;
      addressType: 'p2wpkh' | 'p2sh-p2wpkh' | 'p2pkh';
      accountIndex: number;
    }> = [];

    for (const [accountKey, account] of this.bitcoinAccounts) {
      bitcoinAccountsData.push({
        accountKey,
        address: account.address,
        network: account.network,
        addressType: account.addressType,
        accountIndex: account.accountIndex,
      });
    }

    // Serialize EVM accounts (excluding private keys for safety in session)
    const evmAccountsData: Array<{
      accountKey: string; // composite key: networkId-accountIndex
      address: string;
      chainId: number;
      accountIndex: number;
    }> = [];

    for (const [accountKey, account] of this.evmAccounts) {
      evmAccountsData.push({
        accountKey,
        address: account.address,
        chainId: account.chainId,
        accountIndex: account.accountIndex,
      });
    }

    const data = {
      serialized,
      aminoSerialized,
      accountIndices: this.accounts.map((acc) => acc.accountIndex),
      prefix: this.prefix,
      bitcoinAccounts: bitcoinAccountsData,
      evmAccounts: evmAccountsData,
      hasMnemonic: !!this.mnemonic,
    };
    return JSON.stringify(data);
  }

  // Restore wallet from serialized data
  async restoreFromSerialized(serializedData: string): Promise<void> {
    const data = JSON.parse(serializedData);
    this.wallet = await DirectSecp256k1HdWallet.deserialize(data.serialized, '');
    this.prefix = data.prefix || 'bze';

    // Restore amino wallet if available
    if (data.aminoSerialized) {
      this.aminoWallet = await Secp256k1HdWallet.deserialize(data.aminoSerialized, '');
    } else {
      this.aminoWallet = null;
    }

    await this.loadAccounts(data.accountIndices || [0]);

    // Restore Bitcoin accounts (addresses only, no private keys)
    this.bitcoinAccounts.clear();
    if (data.bitcoinAccounts) {
      for (const btcData of data.bitcoinAccounts) {
        // Create a partial account with address info only (no keys)
        const account: BitcoinKeyringAccount = {
          id: `bitcoin-restored-${btcData.accountKey}`,
          name: `Bitcoin Account ${btcData.accountIndex + 1}`,
          address: btcData.address,
          publicKey: new Uint8Array(), // Empty - will be re-derived if needed
          privateKey: new Uint8Array(), // Empty - will be re-derived if needed
          network: btcData.network,
          addressType: btcData.addressType,
          hdPath: '',
          accountIndex: btcData.accountIndex,
        };
        this.bitcoinAccounts.set(btcData.accountKey, account);
      }
    }

    // Restore EVM accounts (addresses only, no private keys)
    this.evmAccounts.clear();
    if (data.evmAccounts) {
      for (const evmData of data.evmAccounts) {
        // Create a partial account with address info only (no keys)
        const account: EvmKeyringAccount = {
          id: `evm-restored-${evmData.accountKey}`,
          name: `EVM Account ${evmData.accountIndex + 1}`,
          address: evmData.address,
          publicKey: new Uint8Array(), // Empty - will be re-derived if needed
          privateKey: new Uint8Array(), // Empty - will be re-derived if needed
          chainId: evmData.chainId,
          hdPath: '',
          accountIndex: evmData.accountIndex,
        };
        this.evmAccounts.set(evmData.accountKey, account);
      }
    }
  }

  // Set mnemonic (called during unlock to enable Bitcoin derivation)
  setMnemonic(mnemonic: string): void {
    this.mnemonic = mnemonic;
  }

  // Check if mnemonic is available (needed for Bitcoin)
  hasMnemonic(): boolean {
    return !!this.mnemonic;
  }

  clear(): void {
    this.wallet = null;
    this.aminoWallet = null;
    this.accounts = [];
    this.bitcoinAccounts.clear();
    this.evmAccounts.clear();
    this.mnemonic = '';
  }
}
