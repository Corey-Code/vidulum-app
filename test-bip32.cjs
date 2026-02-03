const bip39 = require('bip39');
const crypto = require('crypto');
const secp256k1 = require('@noble/secp256k1');
const { ripemd160 } = require('@noble/hashes/ripemd160');
const { sha256 } = require('@noble/hashes/sha256');

const testMnemonic =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

// BIP32 derivation using Node.js crypto (known to work correctly)
function deriveChild(parentKey, parentChainCode, index, hardened) {
  const data = Buffer.alloc(37);
  if (hardened) {
    data[0] = 0;
    parentKey.copy(data, 1);
    data.writeUInt32BE(index + 0x80000000, 33);
  } else {
    const pubKey = Buffer.from(secp256k1.getPublicKey(parentKey, true));
    pubKey.copy(data, 0);
    data.writeUInt32BE(index, 33);
  }

  const I = crypto.createHmac('sha512', parentChainCode).update(data).digest();
  const IL = I.slice(0, 32);
  const IR = I.slice(32);

  const n = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
  const parentBig = BigInt('0x' + parentKey.toString('hex'));
  const ILBig = BigInt('0x' + IL.toString('hex'));
  const childKey = (parentBig + ILBig) % n;

  return {
    key: Buffer.from(childKey.toString(16).padStart(64, '0'), 'hex'),
    chainCode: IR,
  };
}

function derivePath(seed, path) {
  // Generate master key using "Bitcoin seed"
  const I = crypto.createHmac('sha512', 'Bitcoin seed').update(seed).digest();
  let key = I.slice(0, 32);
  let chainCode = I.slice(32);

  const parts = path.replace('m/', '').split('/');
  for (const part of parts) {
    const hardened = part.endsWith("'") || part.endsWith('h');
    const index = parseInt(part.replace(/['h]$/, ''), 10);
    const derived = deriveChild(key, chainCode, index, hardened);
    key = derived.key;
    chainCode = derived.chainCode;
  }

  return { key, chainCode };
}

// Bech32 encoding
const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
function bech32Polymod(values) {
  const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let chk = 1;
  for (const v of values) {
    const b = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) if ((b >> i) & 1) chk ^= GEN[i];
  }
  return chk;
}
function bech32HrpExpand(hrp) {
  const ret = [];
  for (const c of hrp) ret.push(c.charCodeAt(0) >> 5);
  ret.push(0);
  for (const c of hrp) ret.push(c.charCodeAt(0) & 31);
  return ret;
}
function bech32Encode(hrp, data) {
  const values = bech32HrpExpand(hrp).concat(data);
  const polymod = bech32Polymod(values.concat([0, 0, 0, 0, 0, 0])) ^ 1;
  const checksum = [];
  for (let i = 0; i < 6; i++) checksum.push((polymod >> (5 * (5 - i))) & 31);
  let ret = hrp + '1';
  for (const d of data.concat(checksum)) ret += CHARSET[d];
  return ret;
}
function convertBits(data, fromBits, toBits) {
  let acc = 0,
    bits = 0;
  const ret = [];
  for (const v of data) {
    acc = (acc << fromBits) | v;
    bits += fromBits;
    while (bits >= toBits) {
      bits -= toBits;
      ret.push((acc >> bits) & ((1 << toBits) - 1));
    }
  }
  if (bits > 0) ret.push((acc << (toBits - bits)) & ((1 << toBits) - 1));
  return ret;
}

async function test() {
  const seed = bip39.mnemonicToSeedSync(testMnemonic, '');

  console.log('=== Using Node.js crypto HMAC with "Bitcoin seed" ===');

  // BIP84 path: m/84'/0'/0'/0/0 (mainnet native segwit)
  const mainnetPath = "m/84'/0'/0'/0/0";
  const mainnetDerived = derivePath(seed, mainnetPath);

  const mainnetPubKey = Buffer.from(secp256k1.getPublicKey(mainnetDerived.key, true));
  const mainnetHash160 = ripemd160(sha256(mainnetPubKey));
  const mainnetWords = convertBits(mainnetHash160, 8, 5);
  const mainnetAddress = bech32Encode('bc', [0].concat(mainnetWords));

  console.log('\n=== BIP84 Mainnet (bc1...) ===');
  console.log('Path:', mainnetPath);
  console.log('Private key:', mainnetDerived.key.toString('hex'));
  console.log('Public key:', mainnetPubKey.toString('hex'));
  console.log('Derived address:', mainnetAddress);
  console.log('Expected:        bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu');
  console.log(
    'Match:',
    mainnetAddress === 'bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu' ? '✅' : '❌'
  );

  // BIP84 testnet path: m/84'/1'/0'/0/0
  const testnetPath = "m/84'/1'/0'/0/0";
  const testnetDerived = derivePath(seed, testnetPath);

  const testnetPubKey = Buffer.from(secp256k1.getPublicKey(testnetDerived.key, true));
  const testnetHash160 = ripemd160(sha256(testnetPubKey));
  const testnetWords = convertBits(testnetHash160, 8, 5);
  const testnetAddress = bech32Encode('tb', [0].concat(testnetWords));

  console.log('\n=== BIP84 Testnet (tb1...) ===');
  console.log('Path:', testnetPath);
  console.log('Private key:', testnetDerived.key.toString('hex'));
  console.log('Public key:', testnetPubKey.toString('hex'));
  console.log('Derived address:', testnetAddress);
  console.log('Expected:        tb1q6rz28mcfaxtmd6v789l9rrlrusdprr9pqcpvkl');
  console.log(
    'Match:',
    testnetAddress === 'tb1q6rz28mcfaxtmd6v789l9rrlrusdprr9pqcpvkl' ? '✅' : '❌'
  );
}

test().catch(console.error);
