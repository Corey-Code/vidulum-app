/**
 * EVM Crypto Utilities
 * 
 * Provides EVM-specific key derivation and address generation.
 * Uses BIP32/BIP44 with coin type 60 for Ethereum-compatible chains.
 */

import { Buffer } from 'buffer';
// Polyfill Buffer for browser environment
if (typeof globalThis.Buffer === 'undefined') {
  globalThis.Buffer = Buffer;
}

import * as bip39 from 'bip39';
import * as secp256k1 from '@noble/secp256k1';
import { hmac } from '@noble/hashes/hmac';
import { sha512 } from '@noble/hashes/sha512';
import { keccak_256 } from '@noble/hashes/sha3';

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
export function getEvmDerivationPath(
  accountIndex: number = 0,
  addressIndex: number = 0
): string {
  return `m/44'/60'/${accountIndex}'/0/${addressIndex}`;
}

/**
 * Derive a child key using BIP32
 */
function deriveChild(
  parentKey: Uint8Array,
  parentChainCode: Uint8Array,
  index: number,
  hardened: boolean = false
): { key: Uint8Array; chainCode: Uint8Array } {
  const data = new Uint8Array(37);
  
  if (hardened) {
    // Hardened derivation: 0x00 || private key || index
    data[0] = 0x00;
    data.set(parentKey, 1);
    const indexBytes = new Uint8Array(4);
    new DataView(indexBytes.buffer).setUint32(0, index + 0x80000000, false);
    data.set(indexBytes, 33);
  } else {
    // Normal derivation: public key || index
    const pubKey = secp256k1.getPublicKey(parentKey, true);
    data.set(pubKey, 0);
    const indexBytes = new Uint8Array(4);
    new DataView(indexBytes.buffer).setUint32(0, index, false);
    data.set(indexBytes, 33);
  }
  
  const I = hmac(sha512, parentChainCode, data);
  const IL = I.slice(0, 32);
  const IR = I.slice(32);
  
  // Add IL to parent key (mod n)
  const n = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
  const parentBig = BigInt('0x' + Buffer.from(parentKey).toString('hex'));
  const ILBig = BigInt('0x' + Buffer.from(IL).toString('hex'));
  const childKey = (parentBig + ILBig) % n;
  
  const keyHex = childKey.toString(16).padStart(64, '0');
  return {
    key: new Uint8Array(Buffer.from(keyHex, 'hex')),
    chainCode: IR,
  };
}

/**
 * Parse a BIP32 path
 */
function parsePath(path: string): Array<{ index: number; hardened: boolean }> {
  const parts = path.split('/').slice(1); // Remove 'm'
  return parts.map(part => {
    const hardened = part.endsWith("'") || part.endsWith('h');
    const index = parseInt(part.replace(/['h]$/, ''), 10);
    return { index, hardened };
  });
}

/**
 * Derive EVM key pair from seed
 */
export async function deriveEvmKeyPairFromSeed(
  seed: Uint8Array,
  path: string
): Promise<EvmKeyPair> {
  // Generate master key using HMAC-SHA512 with Bitcoin seed
  const I = hmac(sha512, new TextEncoder().encode('Bitcoin seed'), seed);
  let key = I.slice(0, 32);
  let chainCode = I.slice(32);
  
  // Derive child keys according to path
  const pathComponents = parsePath(path);
  for (const { index, hardened } of pathComponents) {
    const derived = deriveChild(key, chainCode, index, hardened);
    key = derived.key;
    chainCode = derived.chainCode;
  }
  
  // Generate uncompressed public key (65 bytes: 0x04 + x + y)
  const publicKeyCompressed = secp256k1.getPublicKey(key, false);
  
  // Generate address: keccak256 of public key (without 0x04 prefix), take last 20 bytes
  const publicKeyWithoutPrefix = publicKeyCompressed.slice(1); // Remove 0x04 prefix
  const addressHash = keccak_256(publicKeyWithoutPrefix);
  const addressBytes = addressHash.slice(-20);
  
  // Convert to checksummed address
  const address = toChecksumAddress('0x' + Buffer.from(addressBytes).toString('hex'));
  
  return {
    privateKey: key,
    publicKey: new Uint8Array(publicKeyCompressed),
    address,
  };
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
  const hash = Buffer.from(keccak_256(new TextEncoder().encode(addr))).toString('hex');
  
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
 * Validate EVM address format
 */
export function isValidEvmAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Check if address has valid checksum
 */
export function hasValidChecksum(address: string): boolean {
  if (!isValidEvmAddress(address)) return false;
  
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
  return '0x' + Buffer.from(privateKey).toString('hex');
}

/**
 * Parse private key from hex string
 */
export function hexToPrivateKey(hex: string): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  return new Uint8Array(Buffer.from(cleanHex, 'hex'));
}
