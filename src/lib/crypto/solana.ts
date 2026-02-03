/**
 * Solana Cryptography Utilities
 *
 * Handles Solana key derivation from mnemonic using BIP44.
 * Uses BIP32/BIP44 with coin type 501 for Solana.
 */

import { mnemonicToSeedSync } from 'bip39';
import { sha512 } from '@noble/hashes/sha512';
import { hmac } from '@noble/hashes/hmac';
import { ed25519 } from '@noble/curves/ed25519.js';

/**
 * Solana uses Ed25519 curve (different from secp256k1 used by Bitcoin/Ethereum/Cosmos)
 * BIP44 path: m/44'/501'/accountIndex'/0'
 */

export interface SolanaKeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
  address: string; // Base58-encoded public key
}

// Base58 encoding/decoding
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function encodeBase58(buffer: Uint8Array): string {
  if (buffer.length === 0) return '';

  const digits = [0];
  for (let i = 0; i < buffer.length; i++) {
    let carry = buffer[i];
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }

  // Leading zeros
  for (let i = 0; buffer[i] === 0 && i < buffer.length - 1; i++) {
    digits.push(0);
  }

  return digits
    .reverse()
    .map((digit) => BASE58_ALPHABET[digit])
    .join('');
}

function decodeBase58(str: string): Uint8Array {
  if (str.length === 0) return new Uint8Array(0);

  // Convert base58 string to bytes
  const bytes = [0];
  for (let i = 0; i < str.length; i++) {
    const charIndex = BASE58_ALPHABET.indexOf(str[i]);
    if (charIndex === -1) {
      throw new Error(`Invalid base58 character: ${str[i]}`);
    }

    let carry = charIndex;
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j] * 58;
      bytes[j] = carry % 256;
      carry = (carry / 256) | 0;
    }

    while (carry > 0) {
      bytes.push(carry % 256);
      carry = (carry / 256) | 0;
    }
  }

  // Handle leading '1' characters (which represent leading zero bytes)
  // Count leading '1's in the input
  let leadingOnes = 0;
  for (let i = 0; i < str.length && str[i] === '1'; i++) {
    leadingOnes++;
  }

  // Count trailing zeros already in bytes (these will become leading zeros after reverse)
  let trailingZeros = 0;
  for (let i = bytes.length - 1; i >= 0 && bytes[i] === 0; i--) {
    trailingZeros++;
  }

  // Add additional zeros needed for leading '1's
  for (let i = trailingZeros; i < leadingOnes; i++) {
    bytes.push(0);
  }

  return new Uint8Array(bytes.reverse());
}

/**
 * Get Solana derivation path for account index
 * @param accountIndex Account index (default: 0)
 * @returns BIP44 path string
 */
export function getSolanaDerivationPath(accountIndex: number = 0): string {
  // Solana standard: m/44'/501'/accountIndex'/0'
  return `m/44'/501'/${accountIndex}'/0'`;
}

/**
 * Derive a hardened child key using SLIP-0010 for Ed25519
 */
function deriveHardenedChild(
  parentKey: Uint8Array,
  parentChainCode: Uint8Array,
  index: number
): { key: Uint8Array; chainCode: Uint8Array } {
  // For hardened derivation, index must be >= 0x80000000
  const hardenedIndex = index + 0x80000000;

  // Data = 0x00 || parent_key || index
  const data = new Uint8Array(1 + 32 + 4);
  data[0] = 0x00;
  data.set(parentKey.slice(0, 32), 1);
  data[33] = (hardenedIndex >>> 24) & 0xff;
  data[34] = (hardenedIndex >>> 16) & 0xff;
  data[35] = (hardenedIndex >>> 8) & 0xff;
  data[36] = hardenedIndex & 0xff;

  const I = hmac(sha512, parentChainCode, data);
  return {
    key: new Uint8Array(I.slice(0, 32)),
    chainCode: new Uint8Array(I.slice(32)),
  };
}

/**
 * Derive Solana keypair from mnemonic using SLIP-0010 Ed25519 derivation
 *
 * @param mnemonic BIP39 mnemonic phrase
 * @param accountIndex Account index (default: 0)
 * @returns Solana keypair with address
 */
export async function deriveSolanaKeyPair(
  mnemonic: string,
  accountIndex: number = 0
): Promise<SolanaKeyPair> {
  // Convert mnemonic to seed
  const seed = mnemonicToSeedSync(mnemonic);

  // Derive master key using SLIP-0010 for Ed25519
  // The hmac function expects key as Uint8Array
  const ed25519SeedKey = new TextEncoder().encode('ed25519 seed');
  const masterI = hmac(sha512, ed25519SeedKey, new Uint8Array(seed));
  let key = new Uint8Array(masterI.slice(0, 32));
  let chainCode = new Uint8Array(masterI.slice(32));

  // Derive path: m/44'/501'/accountIndex'/0'
  // All segments are hardened for Ed25519
  const path = [44, 501, accountIndex, 0];

  for (const segment of path) {
    const result = deriveHardenedChild(key, chainCode, segment);
    key = new Uint8Array(result.key);
    chainCode = new Uint8Array(result.chainCode);
  }

  // The derived key is the Ed25519 private key seed (32 bytes)
  const privateKey = key;

  // Derive public key from private key using Ed25519
  const publicKey = ed25519.getPublicKey(privateKey);

  // Solana address is the base58-encoded public key
  const address = encodeBase58(publicKey);

  return {
    publicKey,
    privateKey,
    address,
  };
}

/**
 * Get Solana address from mnemonic
 */
export async function getSolanaAddress(
  mnemonic: string,
  accountIndex: number = 0
): Promise<string> {
  const keyPair = await deriveSolanaKeyPair(mnemonic, accountIndex);
  return keyPair.address;
}

/**
 * Validate a Solana address (base58-encoded 32-byte public key)
 */
export function isValidSolanaAddress(address: string): boolean {
  if (!address || address.length < 32 || address.length > 44) {
    return false;
  }

  // Try to decode the base58 address and verify it's exactly 32 bytes
  try {
    const decoded = decodeBase58(address);
    return decoded.length === 32;
  } catch (error) {
    // Invalid base58 encoding
    return false;
  }
}
