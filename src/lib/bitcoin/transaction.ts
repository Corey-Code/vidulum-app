/**
 * UTXO Transaction Builder and Signer
 *
 * Supports transaction construction and signing for all UTXO-based chains:
 * - Bitcoin (P2WPKH native SegWit)
 * - Litecoin (P2WPKH native SegWit)
 * - Dogecoin (P2PKH legacy)
 * - Zcash (transparent t-addresses)
 * - Flux (transparent t-addresses)
 * - Ravencoin (P2PKH legacy)
 * - And other UTXO chains
 *
 * This module handles:
 * - Transaction serialization
 * - Input signing with ECDSA
 * - SegWit witness data
 * - Legacy signature scripts
 */

import { ensureBuffer } from '../buffer-polyfill';
import { sha256 } from '@noble/hashes/sha256';
import { ripemd160 } from '@noble/hashes/ripemd160';
import * as secp256k1 from '@noble/secp256k1';
import { UTXO } from './client';
import { BitcoinNetworkConfig } from '../networks/types';

// ============================================================================
// Types
// ============================================================================

export interface TransactionInput {
  txid: string;
  vout: number;
  value: number; // satoshis
  scriptPubKey?: string; // hex
}

export interface TransactionOutput {
  address: string;
  value: number; // satoshis
}

export interface SignedTransaction {
  txHex: string;
  txid: string;
  size: number;
  vsize: number; // virtual size for SegWit
  fee: number;
}

export interface BuildTransactionOptions {
  inputs: TransactionInput[];
  outputs: TransactionOutput[];
  privateKey: Uint8Array;
  publicKey: Uint8Array;
  network: BitcoinNetworkConfig;
  changeAddress?: string;
  feeRate?: number; // sat/vB
}

// ============================================================================
// Constants
// ============================================================================

// Sighash types
const SIGHASH_ALL = 0x01;

// OP codes
const OP_DUP = 0x76;
const OP_HASH160 = 0xa9;
const OP_EQUALVERIFY = 0x88;
const OP_CHECKSIG = 0xac;
const OP_0 = 0x00;

// Fee validation thresholds
const MAX_SWEEP_FEE_PERCENTAGE = 20; // Maximum fee as percentage of total balance for sweep transactions

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Double SHA256 hash
 */
function hash256(data: Uint8Array): Uint8Array {
  return sha256(sha256(data));
}

/**
 * Hash160: RIPEMD160(SHA256(data))
 */
function hash160(data: Uint8Array): Uint8Array {
  return ripemd160(sha256(data));
}

/**
 * Reverse bytes (for txid display)
 */
function reverseBytes(bytes: Uint8Array): Uint8Array {
  return new Uint8Array([...bytes].reverse());
}

/**
 * Convert hex string to Uint8Array
 */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Convert Uint8Array to hex string
 */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Write variable length integer (CompactSize)
 */
function writeVarInt(n: number): Uint8Array {
  if (n < 0xfd) {
    return new Uint8Array([n]);
  } else if (n <= 0xffff) {
    const buf = new Uint8Array(3);
    buf[0] = 0xfd;
    new DataView(buf.buffer).setUint16(1, n, true);
    return buf;
  } else if (n <= 0xffffffff) {
    const buf = new Uint8Array(5);
    buf[0] = 0xfe;
    new DataView(buf.buffer).setUint32(1, n, true);
    return buf;
  } else {
    const buf = new Uint8Array(9);
    buf[0] = 0xff;
    new DataView(buf.buffer).setBigUint64(1, BigInt(n), true);
    return buf;
  }
}

/**
 * Write uint32 little-endian
 */
function writeUint32LE(n: number): Uint8Array {
  const buf = new Uint8Array(4);
  new DataView(buf.buffer).setUint32(0, n, true);
  return buf;
}

/**
 * Write uint64 little-endian
 */
function writeUint64LE(n: number | bigint): Uint8Array {
  const buf = new Uint8Array(8);
  new DataView(buf.buffer).setBigUint64(0, BigInt(n), true);
  return buf;
}

/**
 * Concatenate multiple Uint8Arrays
 */
function concat(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

// ============================================================================
// Address Encoding/Decoding
// ============================================================================

const BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/**
 * Decode bech32 address to get witness program
 */
function decodeBech32(
  address: string
): { hrp: string; version: number; program: Uint8Array } | null {
  try {
    const lower = address.toLowerCase();
    const pos = lower.lastIndexOf('1');
    if (pos < 1 || pos + 7 > lower.length) return null;

    const hrp = lower.slice(0, pos);
    const data = lower.slice(pos + 1);

    // Decode data
    const values: number[] = [];
    for (const c of data) {
      const idx = BECH32_CHARSET.indexOf(c);
      if (idx === -1) return null;
      values.push(idx);
    }

    // Remove checksum (last 6 characters)
    const decoded = values.slice(0, -6);
    if (decoded.length < 1) return null;

    const version = decoded[0];
    const program = convertBits(new Uint8Array(decoded.slice(1)), 5, 8, false);
    if (!program) return null;

    return { hrp, version, program: new Uint8Array(program) };
  } catch {
    return null;
  }
}

/**
 * Convert bits between bases
 */
function convertBits(
  data: Uint8Array,
  fromBits: number,
  toBits: number,
  pad: boolean
): number[] | null {
  let acc = 0;
  let bits = 0;
  const ret: number[] = [];
  const maxv = (1 << toBits) - 1;

  for (const value of data) {
    if (value < 0 || value >> fromBits !== 0) return null;
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
  } else if (bits >= fromBits || (acc << (toBits - bits)) & maxv) {
    return null;
  }

  return ret;
}

/**
 * Decode base58check address
 */
function decodeBase58Check(
  address: string
): { version: number | number[]; hash: Uint8Array } | null {
  try {
    // Decode base58
    let num = BigInt(0);
    for (const c of address) {
      const idx = BASE58_ALPHABET.indexOf(c);
      if (idx === -1) return null;
      num = num * 58n + BigInt(idx);
    }

    // Convert to bytes
    let hex = num.toString(16);
    if (hex.length % 2) hex = '0' + hex;

    // Add leading zeros
    let leadingZeros = 0;
    for (const c of address) {
      if (c === '1') leadingZeros++;
      else break;
    }

    const decoded = new Uint8Array(leadingZeros + hex.length / 2);
    for (let i = 0; i < hex.length / 2; i++) {
      decoded[leadingZeros + i] = parseInt(hex.substr(i * 2, 2), 16);
    }

    // Verify checksum
    const payload = decoded.slice(0, -4);
    const checksum = decoded.slice(-4);
    const expectedChecksum = hash256(payload).slice(0, 4);

    if (!checksum.every((b, i) => b === expectedChecksum[i])) {
      return null;
    }

    // Handle single-byte or two-byte version
    if (payload.length === 21) {
      // Single byte version (Bitcoin, Dogecoin, etc.)
      return {
        version: payload[0],
        hash: payload.slice(1),
      };
    } else if (payload.length === 22) {
      // Two byte version (Zcash, Flux, etc.)
      return {
        version: [payload[0], payload[1]],
        hash: payload.slice(2),
      };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Get scriptPubKey for an address
 */
function getScriptPubKey(address: string, network: BitcoinNetworkConfig): Uint8Array | null {
  // Try bech32 first (SegWit)
  const bech32Result = decodeBech32(address);
  if (bech32Result) {
    if (bech32Result.version === 0 && bech32Result.program.length === 20) {
      // P2WPKH: OP_0 <20-byte-hash>
      return concat(new Uint8Array([OP_0, 0x14]), bech32Result.program);
    } else if (bech32Result.version === 0 && bech32Result.program.length === 32) {
      // P2WSH: OP_0 <32-byte-hash>
      return concat(new Uint8Array([OP_0, 0x20]), bech32Result.program);
    }
    return null;
  }

  // Try base58check (legacy)
  const base58Result = decodeBase58Check(address);
  if (base58Result) {
    const version = base58Result.version;
    const hash = base58Result.hash;

    // Check if it's a P2PKH address
    const pubKeyHash = network.addressPrefix?.pubKeyHash;
    if (pubKeyHash !== undefined) {
      const versionMatches = Array.isArray(version)
        ? Array.isArray(pubKeyHash)
          ? version[0] === pubKeyHash[0] && version[1] === pubKeyHash[1]
          : false
        : typeof pubKeyHash === 'number'
          ? version === pubKeyHash
          : false;

      if (versionMatches) {
        // P2PKH: OP_DUP OP_HASH160 <20-byte-hash> OP_EQUALVERIFY OP_CHECKSIG
        return concat(
          new Uint8Array([OP_DUP, OP_HASH160, 0x14]),
          hash,
          new Uint8Array([OP_EQUALVERIFY, OP_CHECKSIG])
        );
      }
    }

    // Check if it's a P2SH address
    const scriptHash = network.addressPrefix?.scriptHash;
    if (scriptHash !== undefined) {
      const versionMatches = Array.isArray(version)
        ? Array.isArray(scriptHash)
          ? version[0] === scriptHash[0] && version[1] === scriptHash[1]
          : false
        : typeof scriptHash === 'number'
          ? version === scriptHash
          : false;

      if (versionMatches) {
        // P2SH: OP_HASH160 <20-byte-hash> OP_EQUAL
        return concat(new Uint8Array([0xa9, 0x14]), hash, new Uint8Array([0x87]));
      }
    }
  }

  return null;
}

// ============================================================================
// Transaction Building
// ============================================================================

/**
 * Check if network supports SegWit
 */
function networkSupportsSegWit(network: BitcoinNetworkConfig): boolean {
  return network.addressType === 'p2wpkh' || network.addressType === 'p2sh-p2wpkh';
}

/**
 * Create sighash for legacy (non-SegWit) signing
 */
function createLegacySighash(
  inputs: TransactionInput[],
  outputs: TransactionOutput[],
  inputIndex: number,
  publicKey: Uint8Array,
  network: BitcoinNetworkConfig
): Uint8Array {
  const parts: Uint8Array[] = [];

  // Version
  parts.push(writeUint32LE(2));

  // Inputs
  parts.push(writeVarInt(inputs.length));

  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i];
    parts.push(reverseBytes(hexToBytes(input.txid)));
    parts.push(writeUint32LE(input.vout));

    if (i === inputIndex) {
      // For the input being signed, use the scriptPubKey (P2PKH script from pubkey)
      const pubKeyHash = hash160(publicKey);
      const scriptPubKey = concat(
        new Uint8Array([OP_DUP, OP_HASH160, 0x14]),
        pubKeyHash,
        new Uint8Array([OP_EQUALVERIFY, OP_CHECKSIG])
      );
      parts.push(writeVarInt(scriptPubKey.length));
      parts.push(scriptPubKey);
    } else {
      // Empty script for other inputs
      parts.push(writeVarInt(0));
    }

    parts.push(writeUint32LE(0xfffffffe));
  }

  // Outputs
  parts.push(writeVarInt(outputs.length));
  for (const output of outputs) {
    parts.push(writeUint64LE(output.value));
    const scriptPubKey = getScriptPubKey(output.address, network);
    if (!scriptPubKey) throw new Error(`Invalid address: ${output.address}`);
    parts.push(writeVarInt(scriptPubKey.length));
    parts.push(scriptPubKey);
  }

  // Locktime
  parts.push(writeUint32LE(0));

  // Sighash type
  parts.push(writeUint32LE(SIGHASH_ALL));

  return hash256(concat(...parts));
}

/**
 * Create sighash for SegWit (BIP143) signing
 */
function createSegWitSighash(
  inputs: TransactionInput[],
  outputs: TransactionOutput[],
  inputIndex: number,
  publicKey: Uint8Array,
  network: BitcoinNetworkConfig
): Uint8Array {
  // 1. hashPrevouts: hash256 of all input outpoints
  const prevouts: Uint8Array[] = [];
  for (const input of inputs) {
    prevouts.push(reverseBytes(hexToBytes(input.txid)));
    prevouts.push(writeUint32LE(input.vout));
  }
  const hashPrevouts = hash256(concat(...prevouts));

  // 2. hashSequence: hash256 of all input sequences
  const sequences: Uint8Array[] = [];
  for (const _ of inputs) {
    sequences.push(writeUint32LE(0xfffffffe));
  }
  const hashSequence = hash256(concat(...sequences));

  // 3. hashOutputs: hash256 of all outputs
  const outputsData: Uint8Array[] = [];
  for (const output of outputs) {
    outputsData.push(writeUint64LE(output.value));
    const scriptPubKey = getScriptPubKey(output.address, network);
    if (!scriptPubKey) throw new Error(`Invalid address: ${output.address}`);
    outputsData.push(writeVarInt(scriptPubKey.length));
    outputsData.push(scriptPubKey);
  }
  const hashOutputs = hash256(concat(...outputsData));

  // 4. Build preimage
  const input = inputs[inputIndex];
  const pubKeyHash = hash160(publicKey);

  // scriptCode for P2WPKH: OP_DUP OP_HASH160 <20-byte-hash> OP_EQUALVERIFY OP_CHECKSIG
  const scriptCode = concat(
    new Uint8Array([0x19, OP_DUP, OP_HASH160, 0x14]),
    pubKeyHash,
    new Uint8Array([OP_EQUALVERIFY, OP_CHECKSIG])
  );

  const preimage = concat(
    writeUint32LE(2), // version
    hashPrevouts,
    hashSequence,
    reverseBytes(hexToBytes(input.txid)), // outpoint
    writeUint32LE(input.vout),
    scriptCode, // scriptCode
    writeUint64LE(input.value), // value
    writeUint32LE(0xfffffffe), // sequence
    hashOutputs,
    writeUint32LE(0), // locktime
    writeUint32LE(SIGHASH_ALL) // sighash type
  );

  return hash256(preimage);
}

/**
 * Sign a message hash with private key (DER encoded)
 */
async function signHash(hash: Uint8Array, privateKey: Uint8Array): Promise<Uint8Array> {
  // Sign using secp256k1
  const signature = await secp256k1.signAsync(hash, privateKey, {
    lowS: true, // Enforce low S for malleability fix
  });

  // Convert to DER format
  const r = signature.r;
  const s = signature.s;

  // Encode r
  let rHex = r.toString(16).padStart(64, '0');
  let rBytes = hexToBytes(rHex);
  // Add leading zero if high bit is set
  if (rBytes[0] & 0x80) {
    rBytes = concat(new Uint8Array([0x00]), rBytes);
  }
  // Remove leading zeros (except one if needed for sign bit)
  while (rBytes.length > 1 && rBytes[0] === 0 && !(rBytes[1] & 0x80)) {
    rBytes = rBytes.slice(1);
  }

  // Encode s
  let sHex = s.toString(16).padStart(64, '0');
  let sBytes = hexToBytes(sHex);
  if (sBytes[0] & 0x80) {
    sBytes = concat(new Uint8Array([0x00]), sBytes);
  }
  while (sBytes.length > 1 && sBytes[0] === 0 && !(sBytes[1] & 0x80)) {
    sBytes = sBytes.slice(1);
  }

  // DER format: 0x30 [total-length] 0x02 [r-length] [r] 0x02 [s-length] [s]
  const der = concat(
    new Uint8Array([0x30, 4 + rBytes.length + sBytes.length]),
    new Uint8Array([0x02, rBytes.length]),
    rBytes,
    new Uint8Array([0x02, sBytes.length]),
    sBytes
  );

  return der;
}

/**
 * Build and sign a legacy (non-SegWit) transaction
 */
async function buildLegacyTransaction(
  inputs: TransactionInput[],
  outputs: TransactionOutput[],
  privateKey: Uint8Array,
  publicKey: Uint8Array,
  network: BitcoinNetworkConfig
): Promise<SignedTransaction> {
  const parts: Uint8Array[] = [];

  // Version
  parts.push(writeUint32LE(2));

  // Inputs with signatures
  parts.push(writeVarInt(inputs.length));

  for (let i = 0; i < inputs.length; i++) {
    const input = inputs[i];

    // Create sighash for this input
    const sighash = createLegacySighash(inputs, outputs, i, publicKey, network);

    // Sign
    const signature = await signHash(sighash, privateKey);
    const sigWithType = concat(signature, new Uint8Array([SIGHASH_ALL]));

    // Build scriptSig: <sig> <pubkey>
    const scriptSig = concat(
      writeVarInt(sigWithType.length),
      sigWithType,
      writeVarInt(publicKey.length),
      publicKey
    );

    // Previous output
    parts.push(reverseBytes(hexToBytes(input.txid)));
    parts.push(writeUint32LE(input.vout));

    // ScriptSig
    parts.push(writeVarInt(scriptSig.length));
    parts.push(scriptSig);

    // Sequence
    parts.push(writeUint32LE(0xfffffffe));
  }

  // Outputs
  parts.push(writeVarInt(outputs.length));
  for (const output of outputs) {
    parts.push(writeUint64LE(output.value));
    const scriptPubKey = getScriptPubKey(output.address, network);
    if (!scriptPubKey) throw new Error(`Invalid address: ${output.address}`);
    parts.push(writeVarInt(scriptPubKey.length));
    parts.push(scriptPubKey);
  }

  // Locktime
  parts.push(writeUint32LE(0));

  const txBytes = concat(...parts);
  const txid = bytesToHex(reverseBytes(hash256(txBytes)));

  return {
    txHex: bytesToHex(txBytes),
    txid,
    size: txBytes.length,
    vsize: txBytes.length, // No witness discount for legacy
    fee: inputs.reduce((sum, i) => sum + i.value, 0) - outputs.reduce((sum, o) => sum + o.value, 0),
  };
}

/**
 * Build and sign a SegWit transaction
 */
async function buildSegWitTransaction(
  inputs: TransactionInput[],
  outputs: TransactionOutput[],
  privateKey: Uint8Array,
  publicKey: Uint8Array,
  network: BitcoinNetworkConfig
): Promise<SignedTransaction> {
  // Build witness data for each input
  const witnesses: Uint8Array[] = [];

  for (let i = 0; i < inputs.length; i++) {
    // Create BIP143 sighash
    const sighash = createSegWitSighash(inputs, outputs, i, publicKey, network);

    // Sign
    const signature = await signHash(sighash, privateKey);
    const sigWithType = concat(signature, new Uint8Array([SIGHASH_ALL]));

    // Witness: <num-items> <sig-length> <sig> <pubkey-length> <pubkey>
    const witness = concat(
      new Uint8Array([0x02]), // 2 items
      writeVarInt(sigWithType.length),
      sigWithType,
      writeVarInt(publicKey.length),
      publicKey
    );
    witnesses.push(witness);
  }

  // Build transaction with witness
  const parts: Uint8Array[] = [];

  // Version
  parts.push(writeUint32LE(2));

  // Marker and flag (SegWit)
  parts.push(new Uint8Array([0x00, 0x01]));

  // Inputs (with empty scriptSig for P2WPKH)
  parts.push(writeVarInt(inputs.length));
  for (const input of inputs) {
    parts.push(reverseBytes(hexToBytes(input.txid)));
    parts.push(writeUint32LE(input.vout));
    parts.push(writeVarInt(0)); // Empty scriptSig
    parts.push(writeUint32LE(0xfffffffe));
  }

  // Outputs
  parts.push(writeVarInt(outputs.length));
  for (const output of outputs) {
    parts.push(writeUint64LE(output.value));
    const scriptPubKey = getScriptPubKey(output.address, network);
    if (!scriptPubKey) throw new Error(`Invalid address: ${output.address}`);
    parts.push(writeVarInt(scriptPubKey.length));
    parts.push(scriptPubKey);
  }

  // Witness data
  for (const witness of witnesses) {
    parts.push(witness);
  }

  // Locktime
  parts.push(writeUint32LE(0));

  const txBytes = concat(...parts);

  // Calculate txid (without witness)
  const txidParts: Uint8Array[] = [];
  txidParts.push(writeUint32LE(2)); // version
  txidParts.push(writeVarInt(inputs.length));
  for (const input of inputs) {
    txidParts.push(reverseBytes(hexToBytes(input.txid)));
    txidParts.push(writeUint32LE(input.vout));
    txidParts.push(writeVarInt(0));
    txidParts.push(writeUint32LE(0xfffffffe));
  }
  txidParts.push(writeVarInt(outputs.length));
  for (const output of outputs) {
    txidParts.push(writeUint64LE(output.value));
    const scriptPubKey = getScriptPubKey(output.address, network);
    if (!scriptPubKey) throw new Error(`Invalid address: ${output.address}`);
    txidParts.push(writeVarInt(scriptPubKey.length));
    txidParts.push(scriptPubKey);
  }
  txidParts.push(writeUint32LE(0));
  const txidBytes = concat(...txidParts);
  const txid = bytesToHex(reverseBytes(hash256(txidBytes)));

  // Calculate vsize (weight / 4)
  const baseSize = txidBytes.length;
  const totalSize = txBytes.length;
  const weight = baseSize * 3 + totalSize;
  const vsize = Math.ceil(weight / 4);

  return {
    txHex: bytesToHex(txBytes),
    txid,
    size: totalSize,
    vsize,
    fee: inputs.reduce((sum, i) => sum + i.value, 0) - outputs.reduce((sum, o) => sum + o.value, 0),
  };
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Build and sign a UTXO transaction
 *
 * Automatically selects legacy or SegWit format based on network configuration.
 */
export async function buildTransaction(
  options: BuildTransactionOptions
): Promise<SignedTransaction> {
  const { inputs, outputs, privateKey, publicKey, network } = options;

  if (inputs.length === 0) {
    throw new Error('No inputs provided');
  }

  if (outputs.length === 0) {
    throw new Error('No outputs provided');
  }

  // Validate outputs
  for (const output of outputs) {
    if (output.value < 0) {
      throw new Error('Output value cannot be negative');
    }
    const scriptPubKey = getScriptPubKey(output.address, network);
    if (!scriptPubKey) {
      throw new Error(`Invalid output address: ${output.address}`);
    }
  }

  // Check if we should use SegWit
  const useSegWit = networkSupportsSegWit(network);

  if (useSegWit) {
    return buildSegWitTransaction(inputs, outputs, privateKey, publicKey, network);
  } else {
    return buildLegacyTransaction(inputs, outputs, privateKey, publicKey, network);
  }
}

/**
 * Create a simple send transaction
 *
 * Helper that handles UTXO selection and change address automatically.
 */
export async function createSendTransaction(
  utxos: UTXO[],
  recipientAddress: string,
  amountSats: number,
  feeRateSatPerVB: number,
  privateKey: Uint8Array,
  publicKey: Uint8Array,
  changeAddress: string,
  network: BitcoinNetworkConfig,
  options?: { sweepAll?: boolean }
): Promise<SignedTransaction> {
  // Select UTXOs
  const confirmedUtxos = utxos.filter((u) => u.status.confirmed);

  if (confirmedUtxos.length === 0) {
    throw new Error('No confirmed UTXOs available');
  }

  // For sweep transactions, use all UTXOs and send everything minus fee
  if (options?.sweepAll) {
    const isSegWit = networkSupportsSegWit(network);
    const inputSize = isSegWit ? 68 : 148;
    const outputSize = isSegWit ? 31 : 34;
    const overhead = isSegWit ? 11 : 10;

    // Use all confirmed UTXOs
    const allInputs: TransactionInput[] = confirmedUtxos.map((utxo) => ({
      txid: utxo.txid,
      vout: utxo.vout,
      value: utxo.value,
    }));

    const totalInput = confirmedUtxos.reduce((sum, utxo) => sum + utxo.value, 0);

    // Single output (no change in sweep)
    const estimatedVSize = overhead + allInputs.length * inputSize + outputSize;
    const fee = Math.ceil(estimatedVSize * feeRateSatPerVB);

    const sweepAmount = totalInput - fee;

    // Validate that fee doesn't exceed a reasonable percentage of total balance
    const feePercentage = (fee / totalInput) * 100;
    if (feePercentage > MAX_SWEEP_FEE_PERCENTAGE) {
      throw new Error(
        `Fee too high: ${fee} sats (${feePercentage.toFixed(1)}%) exceeds ${MAX_SWEEP_FEE_PERCENTAGE}% of total balance (${totalInput} sats). ` +
        `This may happen when sweeping many small UTXOs with high fee rates. Consider consolidating UTXOs at a lower fee rate first.`
      );
    }

    if (sweepAmount <= 0) {
      throw new Error(`Insufficient funds: fee (${fee} sats) exceeds balance (${totalInput} sats)`);
    }

    const dustThreshold = isSegWit ? 294 : 546;
    if (sweepAmount < dustThreshold) {
      throw new Error(
        `Amount after fees (${sweepAmount} sats) is below dust threshold (${dustThreshold} sats)`
      );
    }

    return buildTransaction({
      inputs: allInputs,
      outputs: [{ address: recipientAddress, value: sweepAmount }],
      privateKey,
      publicKey,
      network,
    });
  }

  // Sort by value descending for better selection
  const sorted = [...confirmedUtxos].sort((a, b) => b.value - a.value);

  // Estimate transaction size for fee calculation
  const isSegWit = networkSupportsSegWit(network);
  const inputSize = isSegWit ? 68 : 148; // vBytes per input
  const outputSize = isSegWit ? 31 : 34; // vBytes per output
  const overhead = isSegWit ? 11 : 10; // Transaction overhead

  // Select UTXOs
  const selectedInputs: TransactionInput[] = [];
  let totalInput = 0;

  for (const utxo of sorted) {
    selectedInputs.push({
      txid: utxo.txid,
      vout: utxo.vout,
      value: utxo.value,
    });
    totalInput += utxo.value;

    // Estimate fee with current selection
    const numOutputs = 2; // recipient + change (pessimistic)
    const estimatedVSize = overhead + selectedInputs.length * inputSize + numOutputs * outputSize;
    const estimatedFee = Math.ceil(estimatedVSize * feeRateSatPerVB);

    if (totalInput >= amountSats + estimatedFee) {
      break;
    }
  }

  // Final fee calculation
  const hasChange = totalInput > amountSats;
  const numOutputs = hasChange ? 2 : 1;
  const estimatedVSize = overhead + selectedInputs.length * inputSize + numOutputs * outputSize;
  const fee = Math.ceil(estimatedVSize * feeRateSatPerVB);

  if (totalInput < amountSats + fee) {
    throw new Error(`Insufficient funds: need ${amountSats + fee} sats, have ${totalInput} sats`);
  }

  // Build outputs
  const outputs: TransactionOutput[] = [{ address: recipientAddress, value: amountSats }];

  const change = totalInput - amountSats - fee;
  const dustThreshold = isSegWit ? 294 : 546; // Minimum output value

  if (change >= dustThreshold) {
    outputs.push({ address: changeAddress, value: change });
  }

  // Build and sign transaction
  return buildTransaction({
    inputs: selectedInputs,
    outputs,
    privateKey,
    publicKey,
    network,
  });
}

/**
 * Estimate transaction fee
 */
export function estimateFee(
  numInputs: number,
  numOutputs: number,
  feeRateSatPerVB: number,
  isSegWit: boolean
): number {
  const inputSize = isSegWit ? 68 : 148;
  const outputSize = isSegWit ? 31 : 34;
  const overhead = isSegWit ? 11 : 10;

  const vSize = overhead + numInputs * inputSize + numOutputs * outputSize;
  return Math.ceil(vSize * feeRateSatPerVB);
}
