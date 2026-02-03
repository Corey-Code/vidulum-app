/**
 * EVM Crypto Utilities
 *
 * Provides EVM-specific key derivation and address generation.
 * Uses BIP32/BIP44 with coin type 60 for Ethereum-compatible chains.
 */

import { Buffer } from 'buffer';
import * as bip39 from 'bip39';
import * as secp256k1 from '@noble/secp256k1';
import { hmac } from '@noble/hashes/hmac';
import { sha512 } from '@noble/hashes/sha512';
import { keccak_256 } from '@noble/hashes/sha3';

// Polyfill Buffer for browser environment
if (typeof globalThis.Buffer === 'undefined') {
  globalThis.Buffer = Buffer;
}

/**
 * Runtime check to ensure Buffer is available
 * This provides a safeguard against initialization order issues
 */
function ensureBuffer(): typeof Buffer {
  if (typeof globalThis.Buffer === 'undefined') {
    globalThis.Buffer = Buffer;
  }
  return globalThis.Buffer;
}

/**
 * EVM Key Pair
 */
export interface EvmKeyPair {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
  address: string;
}

/**
 * Get BIP44 derivation path for EVM
 * Standard: m/44'/60'/0'/0/index
 */
export function getEvmDerivationPath(accountIndex: number = 0, addressIndex: number = 0): string {
  return `m/44'/60'/${accountIndex}'/0/${addressIndex}`;
}

/**
 * Derive a child key using BIP32
 * Implements secure key derivation with memory cleanup
 */
function deriveChild(
  parentKey: Uint8Array,
  parentChainCode: Uint8Array,
  index: number,
  hardened: boolean = false
): { key: Uint8Array; chainCode: Uint8Array } {
  // Curve order for secp256k1
  const n = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
  const BufferImpl = ensureBuffer();
  const parentBig = BigInt('0x' + BufferImpl.from(parentKey).toString('hex'));
  let currentIndex = index;

  const intermediates: Uint8Array[] = [];
  let pubKey: Uint8Array | null = null;

  try {
    // Retry derivation with subsequent indices if we hit invalid values as per BIP32
    for (let attempts = 0; attempts < 1000; attempts++) {
      const data = new Uint8Array(37);
      intermediates.push(data);

      if (hardened) {
        // Hardened derivation: 0x00 || private key || (index + 0x80000000)
        data[0] = 0x00;
        data.set(parentKey, 1);
        const indexBytes = new Uint8Array(4);
        new DataView(indexBytes.buffer).setUint32(0, currentIndex + 0x80000000, false);
        data.set(indexBytes, 33);
      } else {
        // Normal derivation: public key || index
        // Clean up old pubKey if this is a retry
        if (pubKey !== null) {
          secureZero(pubKey);
        }
        pubKey = secp256k1.getPublicKey(parentKey, true);
        data.set(pubKey, 0);
        const indexBytes = new Uint8Array(4);
        new DataView(indexBytes.buffer).setUint32(0, currentIndex, false);
        data.set(indexBytes, 33);
      }

      const I = hmac(sha512, parentChainCode, data);
      intermediates.push(I);

      const IL = I.slice(0, 32);
      const IR = I.slice(32);
      intermediates.push(IL);

      const BufferImpl = ensureBuffer();
      const ILBig = BigInt('0x' + BufferImpl.from(IL).toString('hex'));

      // BIP32: if IL == 0 or IL >= n, discard this child and try next index
      if (ILBig === 0n || ILBig >= n) {
        currentIndex++;
        continue;
      }

      // Add IL to parent key (mod n)
      const childKey = (parentBig + ILBig) % n;

      // BIP32: if resulting key == 0, discard this child and try next index
      if (childKey === 0n) {
        currentIndex++;
        continue;
      }

      const keyHex = childKey.toString(16).padStart(64, '0');
      return {
        key: new Uint8Array(BufferImpl.from(keyHex, 'hex')),
        chainCode: new Uint8Array(IR),
      };
    }

    throw new Error('Unable to derive valid child key after multiple attempts');
  } finally {
    // Zero out all intermediate data
    if (pubKey !== null) {
      secureZero(pubKey);
    }
    for (const arr of intermediates) {
      if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        crypto.getRandomValues(arr);
      }
      arr.fill(0);
    }
  }
}

/**
 * Clear a Uint8Array to reduce the likelihood of sensitive data lingering in memory
 */
function secureZero(arr: Uint8Array): void {
  arr.fill(0);
}

/**
 * Validate that a private key is valid for secp256k1
 */
function isValidPrivateKey(key: Uint8Array): boolean {
  if (key.length !== 32) return false;

  // Check if all zeros
  let isZero = true;
  for (const byte of key) {
    if (byte !== 0) {
      isZero = false;
      break;
    }
  }
  if (isZero) return false;

  // Check if less than curve order n
  const n = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
  const BufferImpl = ensureBuffer();
  const keyBig = BigInt('0x' + BufferImpl.from(key).toString('hex'));
  return keyBig < n;
}

/**
 * Validate a BIP32 derivation path
 */
function isValidDerivationPath(path: string): boolean {
  if (!path.startsWith('m/')) return false;

  const parts = path.split('/').slice(1);
  if (parts.length === 0 || parts.length > 10) return false;

  for (const part of parts) {
    const cleaned = part.replace(/['h]$/, '');
    const index = parseInt(cleaned, 10);
    if (isNaN(index) || index < 0 || index >= 0x80000000) return false;
  }

  return true;
}

/**
 * Parse a BIP32 path
 */
function parsePath(path: string): Array<{ index: number; hardened: boolean }> {
  const parts = path.split('/').slice(1); // Remove 'm'
  return parts.map((part) => {
    const hardened = part.endsWith("'") || part.endsWith('h');
    const index = parseInt(part.replace(/['h]$/, ''), 10);
    return { index, hardened };
  });
}

/**
 * Derive EVM key pair from seed
 * Implements BIP32 HD key derivation with security hardening
 */
export async function deriveEvmKeyPairFromSeed(
  seed: Uint8Array,
  path: string
): Promise<EvmKeyPair> {
  // Validate path before processing
  if (!isValidDerivationPath(path)) {
    throw new Error('Invalid derivation path');
  }

  // Generate master key using HMAC-SHA512 (BIP32 standard uses "Bitcoin seed" for all chains)
  const I = hmac(sha512, new TextEncoder().encode('Bitcoin seed'), seed);
  let key: Uint8Array = new Uint8Array(I.slice(0, 32));
  let chainCode: Uint8Array = new Uint8Array(I.slice(32));

  // Track intermediate keys for secure cleanup
  const keysToZero: Uint8Array[] = [I];

  try {
    // Validate master key
    if (!isValidPrivateKey(key)) {
      throw new Error('Invalid master key derived from seed');
    }

    // Derive child keys according to path
    const pathComponents = parsePath(path);
    for (const { index, hardened } of pathComponents) {
      const derived = deriveChild(key, chainCode, index, hardened);

      // Track old keys for cleanup
      keysToZero.push(key, chainCode);

      key = new Uint8Array(derived.key);
      chainCode = new Uint8Array(derived.chainCode);

      // Validate each derived key
      if (!isValidPrivateKey(key)) {
        throw new Error('Invalid key derived at path component');
      }
    }

    // Generate uncompressed public key (65 bytes: 0x04 + x + y)
    const publicKeyUncompressed = secp256k1.getPublicKey(key, false);

    // Generate address: keccak256 of public key (without 0x04 prefix), take last 20 bytes
    const publicKeyWithoutPrefix = publicKeyUncompressed.slice(1);
    const addressHash = keccak_256(publicKeyWithoutPrefix);
    const addressBytes = addressHash.slice(-20);

    // Convert to checksummed address
    const BufferImpl = ensureBuffer();
    const address = toChecksumAddress('0x' + BufferImpl.from(addressBytes).toString('hex'));

    // Create copies for return (originals will be zeroed)
    const privateKeyCopy = key.slice() as Uint8Array;
    const publicKeyCopy = new Uint8Array(publicKeyUncompressed) as Uint8Array;

    return {
      privateKey: privateKeyCopy,
      publicKey: publicKeyCopy,
      address,
    };
  } finally {
    // Securely zero all intermediate keys
    for (const k of keysToZero) {
      secureZero(k);
    }
    secureZero(key);
    secureZero(chainCode);
  }
}

/**
 * Derive EVM key pair from mnemonic
 */
export async function deriveEvmKeyPair(
  mnemonic: string,
  accountIndex: number = 0,
  addressIndex: number = 0
): Promise<EvmKeyPair> {
  const seed = await bip39.mnemonicToSeed(mnemonic);
  const path = getEvmDerivationPath(accountIndex, addressIndex);
  return deriveEvmKeyPairFromSeed(seed, path);
}

/**
 * Convert address to checksum format (EIP-55)
 */
export function toChecksumAddress(address: string): string {
  const addr = address.toLowerCase().replace('0x', '');
  const BufferImpl = ensureBuffer();
  const hash = BufferImpl.from(keccak_256(new TextEncoder().encode(addr))).toString('hex');

  let checksumAddress = '0x';
  for (let i = 0; i < addr.length; i++) {
    if (parseInt(hash[i], 16) >= 8) {
      checksumAddress += addr[i].toUpperCase();
    } else {
      checksumAddress += addr[i];
    }
  }

  return checksumAddress;
}

/**
 * Validate EVM address format (basic hex validation only)
 */
function isValidEvmAddressFormat(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Check if address is all lowercase (after 0x prefix)
 */
function isAllLowercase(address: string): boolean {
  const hex = address.slice(2);
  return hex === hex.toLowerCase();
}

/**
 * Check if address is all uppercase (after 0x prefix)
 */
function isAllUppercase(address: string): boolean {
  const hex = address.slice(2);
  return hex === hex.toUpperCase();
}

/**
 * Validate EVM address with EIP-55 checksum enforcement
 *
 * - All lowercase addresses are valid (not checksummed)
 * - All uppercase addresses are valid (not checksummed)
 * - Mixed case addresses MUST have valid EIP-55 checksum
 */
export function isValidEvmAddress(address: string): boolean {
  if (!isValidEvmAddressFormat(address)) return false;

  // All lowercase or all uppercase are valid (no checksum)
  if (isAllLowercase(address) || isAllUppercase(address)) {
    return true;
  }

  // Mixed case must have valid checksum
  try {
    const checksummed = toChecksumAddress(address);
    return checksummed === address;
  } catch {
    return false;
  }
}

/**
 * Check if address has valid EIP-55 checksum
 * Returns true only if address is properly checksummed (not all lower/upper)
 */
export function hasValidChecksum(address: string): boolean {
  if (!isValidEvmAddressFormat(address)) return false;

  // All lowercase or uppercase are not checksummed
  if (isAllLowercase(address) || isAllUppercase(address)) {
    return false;
  }

  try {
    const checksummed = toChecksumAddress(address);
    return checksummed === address;
  } catch {
    return false;
  }
}

/**
 * Get private key as hex string
 */
export function privateKeyToHex(privateKey: Uint8Array): string {
  const BufferImpl = ensureBuffer();
  return '0x' + BufferImpl.from(privateKey).toString('hex');
}

/**
 * Parse private key from hex string
 */
export function hexToPrivateKey(hex: string): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  const BufferImpl = ensureBuffer();
  return new Uint8Array(BufferImpl.from(cleanHex, 'hex'));
}
