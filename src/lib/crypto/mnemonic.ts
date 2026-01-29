import { sha256 } from '@noble/hashes/sha256';
import { ripemd160, EnglishMnemonic } from '@cosmjs/crypto';
import { toBech32, fromBech32 } from '@cosmjs/encoding';
import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import * as bip39 from 'bip39';

export interface DerivedKey {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
  address: string;
}

export class MnemonicManager {
  /**
   * @deprecated Use generateMnemonicAsync instead
   */
  static generateMnemonic(_strength: number = 256): string {
    // Mnemonic generation requires async operations in CosmJS
    throw new Error('Use generateMnemonicAsync instead');
  }

  static async generateMnemonicAsync(): Promise<string> {
    // Generate a wallet which creates a valid 24-word mnemonic (256 bits of entropy)
    const wallet = await DirectSecp256k1HdWallet.generate(24);
    return wallet.mnemonic;
  }

  static validateMnemonic(mnemonic: string): boolean {
    console.log('Validating mnemonic...');
    console.log('Mnemonic:', mnemonic);
    console.log('Word count:', mnemonic.split(' ').length);

    try {
      // Use CosmJS EnglishMnemonic which has built-in validation
      new EnglishMnemonic(mnemonic);
      console.log('CosmJS validation result: true');
      return true;
    } catch (error) {
      console.log('CosmJS validation result: false');
      console.log('Validation error:', error instanceof Error ? error.message : error);
      return false;
    }
  }

  /**
   * Derive a BIP39 seed from a mnemonic phrase.
   * Returns a 64-byte seed that can be used for HD key derivation.
   */
  static async mnemonicToSeed(mnemonic: string): Promise<Uint8Array> {
    const seedBuffer = await bip39.mnemonicToSeed(mnemonic);
    return new Uint8Array(seedBuffer);
  }

  static async deriveKeyFromMnemonic(
    mnemonic: string,
    prefix: string = 'bze'
  ): Promise<DerivedKey> {
    // Use CosmJS to derive the key instead of manual BIP32
    const wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {
      prefix,
    });

    const accounts = await wallet.getAccounts();
    if (accounts.length === 0) {
      throw new Error('No accounts derived from mnemonic');
    }

    const account = accounts[0];

    // We can't get the private key from DirectSecp256k1HdWallet directly
    // This is a security feature. For display purposes, we'll return empty array
    // The actual signing will be done through the wallet methods
    return {
      privateKey: new Uint8Array(32), // Placeholder - not exposed by CosmJS
      publicKey: account.pubkey,
      address: account.address,
    };
  }

  static publicKeyToAddress(publicKey: Uint8Array, prefix: string): string {
    const hash1 = sha256(publicKey);
    const hash2 = ripemd160(hash1);
    return toBech32(prefix, hash2);
  }

  static verifyAddress(address: string, expectedPrefix: string): boolean {
    try {
      const { prefix } = fromBech32(address);
      return prefix === expectedPrefix;
    } catch {
      return false;
    }
  }
}
