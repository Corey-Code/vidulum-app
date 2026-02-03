const { hmac } = require('@noble/hashes/hmac');
const { sha512 } = require('@noble/hashes/sha512');
const * as bip39 = require('bip39');
const * as secp256k1 = require('@noble/secp256k1');
const { bech32 } = require('bech32');
const { sha256 } = require('@noble/hashes/sha256');
const { ripemd160 } = require('@noble/hashes/ripemd160');

// hash160 = RIPEMD160(SHA256(data))
function hash160(data) {
  return ripemd160(sha256(data));
}

// Bech32 encoding helper
function convertBits(data, fromBits, toBits, pad) {
  let acc = 0;
  let bits = 0;
  const result = [];
  const maxv = (1 << toBits) - 1;

  for (const value of data) {
    acc = (acc << fromBits) | value;
    bits += fromBits;
    while (bits >= toBits) {
      bits -= toBits;
      result.push((acc >> bits) & maxv);
    }
  }

  if (pad && bits > 0) {
    result.push((acc << (toBits - bits)) & maxv);
  }

  return result;
}

// Bech32 encode
function bech32Encode(hrp, data) {
  return bech32.encode(hrp, data);
}

// Parse BIP32 path
function parsePath(path) {
  const parts = path.split('/').slice(1);
  return parts.map(part => {
    const hardened = part.endsWith("'") || part.endsWith('h');
    const index = parseInt(part.replace(/['h]$/, ''), 10);
    return { index, hardened };
  });
}

// BIP32 derive child key
function deriveChild(parentKey, parentChainCode, index, hardened) {
  const data = new Uint8Array(37);
  
  if (hardened) {
    data[0] = 0x00;
    data.set(parentKey, 1);
    new DataView(data.buffer).setUint32(33, index + 0x80000000, false);
  } else {
    const pubKey = secp256k1.getPublicKey(parentKey, true);
    data.set(pubKey, 0);
    new DataView(data.buffer).setUint32(33, index, false);
  }
  
  const I = hmac(sha512, parentChainCode, data);
  const IL = I.slice(0, 32);
  const IR = I.slice(32);
  
  // Add parent key to derived key (mod n)
  const keyBigInt = (BigInt('0x' + Buffer.from(IL).toString('hex')) + 
                    BigInt('0x' + Buffer.from(parentKey).toString('hex'))) % 
                    BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
  const newKey = new Uint8Array(32);
  const keyHex = keyBigInt.toString(16).padStart(64, '0');
  for (let i = 0; i < 32; i++) {
    newKey[i] = parseInt(keyHex.substr(i * 2, 2), 16);
  }
  
  return { key: newKey, chainCode: IR };
}

// Derive from seed with path
function deriveFromSeed(seed, path) {
  const I = hmac(sha512, Buffer.from('Bitcoin seed'), seed);
  let key = I.slice(0, 32);
  let chainCode = I.slice(32);
  
  const components = parsePath(path);
  for (const { index, hardened } of components) {
    const derived = deriveChild(key, chainCode, index, hardened);
    key = derived.key;
    chainCode = derived.chainCode;
  }
  
  return { privateKey: key, publicKey: secp256k1.getPublicKey(key, true) };
}

// Generate bc1 address from public key
function getBitcoinAddress(publicKey, hrp = 'bc') {
  const pubKeyHash = hash160(publicKey);
  const words = convertBits(pubKeyHash, 8, 5, true);
  return bech32Encode(hrp, [0, ...words]);
}

async function main() {
  // Replace with your test mnemonic
  const mnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
  
  console.log("Testing derivation paths with standard test mnemonic\n");
  
  const seedBuffer = await bip39.mnemonicToSeed(mnemonic);
  const seed = new Uint8Array(seedBuffer);
  
  console.log("=== BIP84 Standard: Account index in third position ===");
  console.log("m/84'/0'/ACCOUNT'/0/0\n");
  
  for (let account = 0; account < 3; account++) {
    const path = `m/84'/0'/${account}'/0/0`;
    const { publicKey } = deriveFromSeed(seed, path);
    const address = getBitcoinAddress(publicKey, 'bc');
    console.log(`Account ${account}: ${path}`);
    console.log(`  Address: ${address}\n`);
  }
  
  console.log("=== Alternative: Address index in last position ===");
  console.log("m/84'/0'/0'/0/ADDRESS\n");
  
  for (let addrIdx = 0; addrIdx < 3; addrIdx++) {
    const path = `m/84'/0'/0'/0/${addrIdx}`;
    const { publicKey } = deriveFromSeed(seed, path);
    const address = getBitcoinAddress(publicKey, 'bc');
    console.log(`Address ${addrIdx}: ${path}`);
    console.log(`  Address: ${address}\n`);
  }
}

main().catch(console.error);
