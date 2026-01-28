/**
 * Bitcoin Crypto Utilities
 * 
 * Provides Bitcoin-specific key derivation and address generation.
 * Uses BIP32 (HD wallets), BIP39 (mnemonics), BIP44 (derivation paths),
 * BIP84 (native SegWit), and BIP141 (SegWit encoding).
 */

import { Buffer } from 'buffer';
// Polyfill Buffer for browser environment
if (typeof globalThis.Buffer === 'undefined') {
  globalThis.Buffer = Buffer;
}

import { sha256 } from '@noble/hashes/sha256';
import { ripemd160 } from '@noble/hashes/ripemd160';
import * as secp256k1 from '@noble/secp256k1';
import { hmac } from '@noble/hashes/hmac';
import { sha512 } from '@noble/hashes/sha512';

// UTXO network parameters for address generation
export const UTXO_NETWORKS = {
  // Bitcoin
  'bitcoin-mainnet': {
    name: 'Bitcoin',
    bech32: 'bc',
    pubKeyHash: 0x00,
    scriptHash: 0x05,
    wif: 0x80,
    coinType: 0,
  },
  'bitcoin-testnet': {
    name: 'Bitcoin Testnet',
    bech32: 'tb',
    pubKeyHash: 0x6f,
    scriptHash: 0xc4,
    wif: 0xef,
    coinType: 1,
  },
  // Zcash - transparent addresses (t1..., t3...)
  // Zcash uses two-byte version prefixes
  'zcash-mainnet': {
    name: 'Zcash',
    pubKeyHash: [0x1c, 0xb8], // t1 addresses
    scriptHash: [0x1c, 0xbd], // t3 addresses
    wif: 0x80,
    coinType: 133,
  },
  // Flux (formerly ZelCash) - same as Zcash
  'flux-mainnet': {
    name: 'Flux',
    pubKeyHash: [0x1c, 0xb8], // t1 addresses
    scriptHash: [0x1c, 0xbd], // t3 addresses
    wif: 0x80,
    coinType: 19167,
  },
  // Ravencoin - R addresses
  'ravencoin-mainnet': {
    name: 'Ravencoin',
    pubKeyHash: 0x3c, // R addresses (60)
    scriptHash: 0x7a, // r addresses (122)
    wif: 0x80,
    coinType: 175,
  },
  // Litecoin - L addresses (legacy) or ltc1 (SegWit)
  'litecoin-mainnet': {
    name: 'Litecoin',
    bech32: 'ltc',
    pubKeyHash: 0x30, // L addresses (48)
    scriptHash: 0x32, // M addresses (50)
    wif: 0xb0,
    coinType: 2,
  },
  // BitcoinZ - t1 addresses (Zcash-derived)
  'bitcoinz-mainnet': {
    name: 'BitcoinZ',
    pubKeyHash: [0x1c, 0xb8], // t1 addresses
    scriptHash: [0x1c, 0xbd], // t3 addresses
    wif: 0x80,
    coinType: 177,
  },
  // Dogecoin - D addresses (no SegWit)
  'dogecoin-mainnet': {
    name: 'Dogecoin',
    pubKeyHash: 0x1e, // D addresses (30)
    scriptHash: 0x16, // 9 or A addresses (22)
    wif: 0x9e,
    coinType: 3,
  },
  // Ritocoin - R addresses (Ravencoin fork)
  'ritocoin-mainnet': {
    name: 'Ritocoin',
    pubKeyHash: 0x19, // R addresses (25)
    scriptHash: 0x69, // r addresses (105)
    wif: 0x80,
    coinType: 175, // Uses Ravencoin's coin type
  },
  // NOSO - X addresses (Dash fork)
  'noso-mainnet': {
    name: 'NOSO',
    pubKeyHash: 0x4c, // X addresses (76, like Dash)
    scriptHash: 0x10, // 7 addresses (16, like Dash)
    wif: 0xcc,
    coinType: 5, // Uses Dash's coin type
  },
} as const;

export type UtxoNetworkId = keyof typeof UTXO_NETWORKS;

// Legacy alias for backward compatibility
export const BITCOIN_NETWORKS = {
  mainnet: UTXO_NETWORKS['bitcoin-mainnet'],
  testnet: UTXO_NETWORKS['bitcoin-testnet'],
} as const;

export type BitcoinNetwork = 'mainnet' | 'testnet';

// Bech32 character set
const BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

/**
 * Bech32 encoding for SegWit addresses (BIP173/BIP350)
 */
function bech32Polymod(values: number[]): number {
  const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let chk = 1;
  for (const v of values) {
    const b = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) {
      if ((b >> i) & 1) chk ^= GEN[i];
    }
  }
  return chk;
}

function bech32HrpExpand(hrp: string): number[] {
  const ret: number[] = [];
  for (const c of hrp) {
    ret.push(c.charCodeAt(0) >> 5);
  }
  ret.push(0);
  for (const c of hrp) {
    ret.push(c.charCodeAt(0) & 31);
  }
  return ret;
}

function bech32CreateChecksum(hrp: string, data: number[], encoding: 'bech32' | 'bech32m'): number[] {
  const BECH32_CONST = encoding === 'bech32m' ? 0x2bc830a3 : 1;
  const values = bech32HrpExpand(hrp).concat(data);
  const polymod = bech32Polymod(values.concat([0, 0, 0, 0, 0, 0])) ^ BECH32_CONST;
  const ret: number[] = [];
  for (let i = 0; i < 6; i++) {
    ret.push((polymod >> (5 * (5 - i))) & 31);
  }
  return ret;
}

function bech32Encode(hrp: string, data: number[], encoding: 'bech32' | 'bech32m' = 'bech32'): string {
  const combined = data.concat(bech32CreateChecksum(hrp, data, encoding));
  let ret = hrp + '1';
  for (const d of combined) {
    ret += BECH32_CHARSET[d];
  }
  return ret;
}

function convertBits(data: Uint8Array, fromBits: number, toBits: number, pad: boolean): number[] {
  let acc = 0;
  let bits = 0;
  const ret: number[] = [];
  const maxv = (1 << toBits) - 1;
  
  for (const value of data) {
    acc = (acc << fromBits) | value;
    bits += fromBits;
    while (bits >= toBits) {
      bits -= toBits;
      ret.push((acc >> bits) & maxv);
    }
  }
  
  if (pad) {
    if (bits > 0) {
      ret.push((acc << (toBits - bits)) & maxv);
    }
  }
  
  return ret;
}

/**
 * Hash160: RIPEMD160(SHA256(data))
 */
function hash160(data: Uint8Array): Uint8Array {
  return ripemd160(sha256(data));
}

/**
 * Derive Bitcoin keys from mnemonic using BIP32
 */
export interface BitcoinKeyPair {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
}

/**
 * Get BIP44/84 derivation path for Bitcoin
 * BIP44: m/44'/0'/0'/0/index (legacy P2PKH)
 * BIP84: m/84'/0'/0'/0/index (native SegWit P2WPKH)
 */
export function getBitcoinDerivationPath(
  accountIndex: number = 0,
  addressIndex: number = 0,
  isChange: boolean = false,
  addressType: 'p2wpkh' | 'p2sh-p2wpkh' | 'p2pkh' = 'p2wpkh',
  network: BitcoinNetwork = 'mainnet'
): string {
  // BIP44 purpose based on address type
  const purpose = addressType === 'p2wpkh' ? 84 : addressType === 'p2sh-p2wpkh' ? 49 : 44;
  // Coin type: 0 for mainnet, 1 for testnet
  const coinType = network === 'mainnet' ? 0 : 1;
  const change = isChange ? 1 : 0;
  
  return `m/${purpose}'/${coinType}'/${accountIndex}'/${change}/${addressIndex}`;
}

/**
 * Derive a child key using BIP32
 * This is a simplified implementation for basic key derivation
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
  let parentBig = BigInt('0x' + Buffer.from(parentKey).toString('hex'));
  let ILBig = BigInt('0x' + Buffer.from(IL).toString('hex'));
  let childKey = (parentBig + ILBig) % n;
  
  const keyHex = childKey.toString(16).padStart(64, '0');
  return {
    key: new Uint8Array(Buffer.from(keyHex, 'hex')),
    chainCode: IR,
  };
}

/**
 * Parse a BIP32 path and derive keys
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
 * Derive Bitcoin key pair from seed
 */
export async function deriveBitcoinKeyPairFromSeed(
  seed: Uint8Array,
  path: string
): Promise<BitcoinKeyPair> {
  // Generate master key using HMAC-SHA512
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
  
  // Generate public key
  const publicKey = secp256k1.getPublicKey(key, true);
  
  return {
    privateKey: key,
    publicKey: new Uint8Array(publicKey),
  };
}

/**
 * Generate UTXO address from public key
 * Supports Bitcoin, Zcash, Flux, Ravencoin, and other UTXO chains
 */
export function getBitcoinAddress(
  publicKey: Uint8Array,
  addressType: 'p2wpkh' | 'p2sh-p2wpkh' | 'p2pkh' | 'transparent' = 'p2wpkh',
  network: BitcoinNetwork = 'mainnet'
): string {
  const networkParams = BITCOIN_NETWORKS[network];
  const pubKeyHash = hash160(publicKey);
  
  if (addressType === 'p2wpkh') {
    // Native SegWit (bc1...)
    // Version 0 witness program
    const words = convertBits(pubKeyHash, 8, 5, true);
    return bech32Encode(networkParams.bech32!, [0, ...words], 'bech32');
  } else if (addressType === 'p2sh-p2wpkh') {
    // Nested SegWit (3...)
    // Create witness script: OP_0 <20-byte-hash>
    const witnessScript = new Uint8Array([0x00, 0x14, ...pubKeyHash]);
    const scriptHash = hash160(witnessScript);
    return base58CheckEncode(scriptHash, networkParams.scriptHash);
  } else {
    // Legacy P2PKH (1...) or transparent (t1..., R...)
    return base58CheckEncode(pubKeyHash, networkParams.pubKeyHash);
  }
}

/**
 * Generate UTXO address from public key using network ID
 * This is the preferred method for generating addresses for any UTXO chain
 */
export function getUtxoAddress(
  publicKey: Uint8Array,
  networkId: UtxoNetworkId,
  addressType: 'p2wpkh' | 'p2sh-p2wpkh' | 'p2pkh' | 'transparent' = 'p2pkh'
): string {
  const networkParams = UTXO_NETWORKS[networkId];
  const pubKeyHash = hash160(publicKey);
  
  // Check if this network supports bech32 (only Bitcoin)
  if (addressType === 'p2wpkh' && 'bech32' in networkParams && networkParams.bech32) {
    const words = convertBits(pubKeyHash, 8, 5, true);
    return bech32Encode(networkParams.bech32, [0, ...words], 'bech32');
  } else if (addressType === 'p2sh-p2wpkh' && 'bech32' in networkParams) {
    // Nested SegWit (3...)
    const witnessScript = new Uint8Array([0x00, 0x14, ...pubKeyHash]);
    const scriptHash = hash160(witnessScript);
    return base58CheckEncode(scriptHash, networkParams.scriptHash);
  } else {
    // Legacy P2PKH or transparent addresses
    return base58CheckEncode(pubKeyHash, networkParams.pubKeyHash);
  }
}

/**
 * Get the derivation path for a UTXO chain
 */
export function getUtxoDerivationPath(
  networkId: UtxoNetworkId,
  accountIndex: number = 0,
  addressIndex: number = 0,
  isChange: boolean = false
): string {
  const networkParams = UTXO_NETWORKS[networkId];
  const coinType = networkParams.coinType;
  const change = isChange ? 1 : 0;
  
  // Use BIP44 standard: m/44'/coinType'/account'/change/addressIndex
  return `m/44'/${coinType}'/${accountIndex}'/${change}/${addressIndex}`;
}

/**
 * Base58Check encoding for legacy addresses
 * Supports both single-byte and two-byte version prefixes (for Zcash/Flux)
 */
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58CheckEncode(payload: Uint8Array, version: number | number[]): string {
  // Handle both single-byte and two-byte version prefixes
  const versionBytes = Array.isArray(version) ? version : [version];
  const data = new Uint8Array([...versionBytes, ...payload]);
  const checksum = sha256(sha256(data)).slice(0, 4);
  const bytes = new Uint8Array([...data, ...checksum]);
  
  // Convert to base58
  let num = BigInt('0x' + Buffer.from(bytes).toString('hex'));
  let result = '';
  
  while (num > 0n) {
    const remainder = Number(num % 58n);
    num = num / 58n;
    result = BASE58_ALPHABET[remainder] + result;
  }
  
  // Add leading 1s for leading zeros
  for (const byte of bytes) {
    if (byte === 0) {
      result = '1' + result;
    } else {
      break;
    }
  }
  
  return result;
}

/**
 * Validate a Bitcoin address
 */
export function isValidBitcoinAddress(address: string, network: BitcoinNetwork = 'mainnet'): boolean {
  const params = BITCOIN_NETWORKS[network];
  
  // Check bech32 (native SegWit)
  if (address.toLowerCase().startsWith(params.bech32 + '1')) {
    try {
      // Basic bech32 validation
      const hrp = params.bech32;
      if (address.length < 14 || address.length > 74) return false;
      
      // Check for valid characters
      const data = address.slice(hrp.length + 1).toLowerCase();
      for (const c of data) {
        if (!BECH32_CHARSET.includes(c)) return false;
      }
      
      return true;
    } catch {
      return false;
    }
  }
  
  // Check base58 (legacy and nested SegWit)
  try {
    if (network === 'mainnet') {
      // P2PKH starts with 1, P2SH starts with 3
      if (!/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address)) return false;
    } else {
      // Testnet: P2PKH starts with m or n, P2SH starts with 2
      if (!/^[mn2][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address)) return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Format satoshis to BTC string
 */
export function formatBTC(satoshis: number | string, decimals: number = 8): string {
  const sats = typeof satoshis === 'string' ? parseInt(satoshis, 10) : satoshis;
  const btc = sats / 100_000_000;
  return btc.toFixed(decimals);
}

/**
 * Parse BTC string to satoshis
 */
export function parseBTC(btc: string): number {
  const value = parseFloat(btc);
  return Math.round(value * 100_000_000);
}
