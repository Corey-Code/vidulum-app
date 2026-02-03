/**
 * Bitcoin Crypto Tests
 *
 * Tests for Bitcoin/UTXO address generation and derivation paths
 */

import {
  UTXO_NETWORKS,
  getBitcoinAddress,
  getUtxoAddress,
  getBitcoinDerivationPath,
  getUtxoDerivationPath,
  deriveBitcoinKeyPairFromSeed,
  formatBTC,
  parseBTC,
  isValidBitcoinAddress,
} from '@/lib/crypto/bitcoin';
import * as bip39 from 'bip39';

describe('Bitcoin Crypto', () => {
  // Test mnemonic for deterministic key derivation
  const testMnemonic =
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
  let testSeed: Uint8Array;

  beforeAll(async () => {
    // bip39.mnemonicToSeed returns a Buffer, convert to Uint8Array
    const seedBuffer = await bip39.mnemonicToSeed(testMnemonic);
    testSeed = new Uint8Array(seedBuffer);
  });

  describe('UTXO_NETWORKS', () => {
    it('should have Bitcoin mainnet configuration', () => {
      const btc = UTXO_NETWORKS['bitcoin-mainnet'];
      expect(btc).toBeDefined();
      expect(btc.name).toBe('Bitcoin');
      expect(btc.coinType).toBe(0);
      expect(btc.bech32).toBe('bc');
      expect(btc.pubKeyHash).toBe(0x00);
      expect(btc.scriptHash).toBe(0x05);
    });

    it('should have Bitcoin testnet configuration', () => {
      const tbtc = UTXO_NETWORKS['bitcoin-testnet'];
      expect(tbtc).toBeDefined();
      expect(tbtc.coinType).toBe(1);
      expect(tbtc.bech32).toBe('tb');
    });

    it('should have Litecoin configuration', () => {
      const ltc = UTXO_NETWORKS['litecoin-mainnet'];
      expect(ltc).toBeDefined();
      expect(ltc.coinType).toBe(2);
      expect(ltc.bech32).toBe('ltc');
    });

    it('should have Dogecoin configuration', () => {
      const doge = UTXO_NETWORKS['dogecoin-mainnet'];
      expect(doge).toBeDefined();
      expect(doge.coinType).toBe(3);
      expect(doge.pubKeyHash).toBe(0x1e); // D addresses
    });

    it('should have Zcash configuration with two-byte prefix', () => {
      const zec = UTXO_NETWORKS['zcash-mainnet'];
      expect(zec).toBeDefined();
      expect(zec.coinType).toBe(133);
      expect(Array.isArray(zec.pubKeyHash)).toBe(true);
      expect(zec.pubKeyHash).toEqual([0x1c, 0xb8]); // t1 addresses
    });

    it('should have Ravencoin configuration', () => {
      const rvn = UTXO_NETWORKS['ravencoin-mainnet'];
      expect(rvn).toBeDefined();
      expect(rvn.coinType).toBe(175);
      expect(rvn.pubKeyHash).toBe(0x3c); // R addresses
    });

    it('should have Flux configuration', () => {
      const flux = UTXO_NETWORKS['flux-mainnet'];
      expect(flux).toBeDefined();
      expect(flux.coinType).toBe(19167);
      expect(flux.pubKeyHash).toEqual([0x1c, 0xb8]); // t1 addresses (Zcash-derived)
    });

    it('should have BitcoinZ configuration', () => {
      const btcz = UTXO_NETWORKS['bitcoinz-mainnet'];
      expect(btcz).toBeDefined();
      expect(btcz.coinType).toBe(177);
    });

    it('should have Ritocoin configuration', () => {
      const rito = UTXO_NETWORKS['ritocoin-mainnet'];
      expect(rito).toBeDefined();
      expect(rito.coinType).toBe(175);
      expect(rito.pubKeyHash).toBe(0x19); // R addresses
    });

    it('should have NOSO configuration', () => {
      const noso = UTXO_NETWORKS['noso-mainnet'];
      expect(noso).toBeDefined();
      expect(noso.coinType).toBe(5);
      expect(noso.pubKeyHash).toBe(0x4c); // X addresses
    });
  });

  describe('getBitcoinDerivationPath', () => {
    it('should generate BIP84 path for native SegWit', () => {
      const path = getBitcoinDerivationPath(0, 0, false, 'p2wpkh', 'mainnet');
      expect(path).toBe("m/84'/0'/0'/0/0");
    });

    it('should generate BIP49 path for nested SegWit', () => {
      const path = getBitcoinDerivationPath(0, 0, false, 'p2sh-p2wpkh', 'mainnet');
      expect(path).toBe("m/49'/0'/0'/0/0");
    });

    it('should generate BIP44 path for legacy', () => {
      const path = getBitcoinDerivationPath(0, 0, false, 'p2pkh', 'mainnet');
      expect(path).toBe("m/44'/0'/0'/0/0");
    });

    it('should use coin type 1 for testnet', () => {
      const path = getBitcoinDerivationPath(0, 0, false, 'p2wpkh', 'testnet');
      expect(path).toBe("m/84'/1'/0'/0/0");
    });

    it('should increment account index in address position (Keplr-compatible)', () => {
      // Keplr compatibility: accountIndex goes in the last position (address index)
      // Path: m/purpose'/coinType'/0'/change/accountIndex
      const path = getBitcoinDerivationPath(5, 0, false, 'p2wpkh', 'mainnet');
      expect(path).toBe("m/84'/0'/0'/0/5");
    });

    it('should ignore addressIndex parameter (uses accountIndex in last position)', () => {
      // In Keplr-compatible mode, addressIndex parameter is effectively ignored
      // since accountIndex takes the last position
      const path = getBitcoinDerivationPath(0, 3, false, 'p2wpkh', 'mainnet');
      expect(path).toBe("m/84'/0'/0'/0/0");
    });

    it('should use change path when isChange is true', () => {
      const path = getBitcoinDerivationPath(0, 0, true, 'p2wpkh', 'mainnet');
      expect(path).toBe("m/84'/0'/0'/1/0");
    });
  });

  describe('getUtxoDerivationPath', () => {
    it('should generate BIP84 path for Bitcoin with p2wpkh (native SegWit)', () => {
      const path = getUtxoDerivationPath('bitcoin-mainnet', 0, 0, false, 'p2wpkh');
      expect(path).toBe("m/84'/0'/0'/0/0");
    });

    it('should generate BIP44 path for Bitcoin with p2pkh (legacy)', () => {
      const path = getUtxoDerivationPath('bitcoin-mainnet', 0, 0, false, 'p2pkh');
      expect(path).toBe("m/44'/0'/0'/0/0");
    });

    it('should use correct coin type for Litecoin with legacy', () => {
      const path = getUtxoDerivationPath('litecoin-mainnet', 0, 0, false, 'p2pkh');
      expect(path).toBe("m/44'/2'/0'/0/0");
    });

    it('should use correct coin type for Zcash', () => {
      const path = getUtxoDerivationPath('zcash-mainnet', 0, 0, false, 'p2pkh');
      expect(path).toBe("m/44'/133'/0'/0/0");
    });

    it('should use correct coin type for Ravencoin', () => {
      const path = getUtxoDerivationPath('ravencoin-mainnet', 0, 0, false, 'p2pkh');
      expect(path).toBe("m/44'/175'/0'/0/0");
    });

    it('should use correct coin type for Dogecoin', () => {
      const path = getUtxoDerivationPath('dogecoin-mainnet', 0, 0, false, 'p2pkh');
      expect(path).toBe("m/44'/3'/0'/0/0");
    });

    it('should use change path', () => {
      const path = getUtxoDerivationPath('bitcoin-mainnet', 0, 0, true, 'p2pkh');
      expect(path).toBe("m/44'/0'/0'/1/0");
    });

    it('should use BIP49 for nested SegWit', () => {
      const path = getUtxoDerivationPath('bitcoin-mainnet', 0, 0, false, 'p2sh-p2wpkh');
      expect(path).toBe("m/49'/0'/0'/0/0");
    });

    it('should use BIP86 for taproot', () => {
      const path = getUtxoDerivationPath('bitcoin-mainnet', 0, 0, false, 'taproot');
      expect(path).toBe("m/86'/0'/0'/0/0");
    });
  });

  describe('deriveBitcoinKeyPairFromSeed', () => {
    it('should derive key pair from seed', async () => {
      const path = "m/84'/0'/0'/0/0";
      const keyPair = await deriveBitcoinKeyPairFromSeed(testSeed, path);

      expect(keyPair.privateKey).toBeInstanceOf(Uint8Array);
      expect(keyPair.publicKey).toBeInstanceOf(Uint8Array);
      expect(keyPair.privateKey.length).toBe(32);
      expect(keyPair.publicKey.length).toBe(33); // Compressed public key
    });

    it('should derive consistent keys for same seed and path', async () => {
      const path = "m/84'/0'/0'/0/0";
      const keyPair1 = await deriveBitcoinKeyPairFromSeed(testSeed, path);
      const keyPair2 = await deriveBitcoinKeyPairFromSeed(testSeed, path);

      expect(Buffer.from(keyPair1.privateKey).toString('hex')).toBe(
        Buffer.from(keyPair2.privateKey).toString('hex')
      );
      expect(Buffer.from(keyPair1.publicKey).toString('hex')).toBe(
        Buffer.from(keyPair2.publicKey).toString('hex')
      );
    });

    it('should derive different keys for different paths', async () => {
      const keyPair1 = await deriveBitcoinKeyPairFromSeed(testSeed, "m/84'/0'/0'/0/0");
      const keyPair2 = await deriveBitcoinKeyPairFromSeed(testSeed, "m/84'/0'/0'/0/1");

      expect(Buffer.from(keyPair1.privateKey).toString('hex')).not.toBe(
        Buffer.from(keyPair2.privateKey).toString('hex')
      );
    });
  });

  describe('getBitcoinAddress', () => {
    let publicKey: Uint8Array;

    beforeAll(async () => {
      const keyPair = await deriveBitcoinKeyPairFromSeed(testSeed, "m/84'/0'/0'/0/0");
      publicKey = keyPair.publicKey;
    });

    it('should generate native SegWit address (bc1...)', () => {
      const address = getBitcoinAddress(publicKey, 'p2wpkh', 'mainnet');
      expect(address.startsWith('bc1q')).toBe(true);
    });

    it('should generate testnet SegWit address (tb1...)', () => {
      const address = getBitcoinAddress(publicKey, 'p2wpkh', 'testnet');
      expect(address.startsWith('tb1q')).toBe(true);
    });

    it('should generate legacy address (1...)', () => {
      const address = getBitcoinAddress(publicKey, 'p2pkh', 'mainnet');
      expect(address.startsWith('1')).toBe(true);
    });

    it('should generate nested SegWit address (3...)', () => {
      const address = getBitcoinAddress(publicKey, 'p2sh-p2wpkh', 'mainnet');
      expect(address.startsWith('3')).toBe(true);
    });

    it('should generate consistent addresses', () => {
      const address1 = getBitcoinAddress(publicKey, 'p2wpkh', 'mainnet');
      const address2 = getBitcoinAddress(publicKey, 'p2wpkh', 'mainnet');
      expect(address1).toBe(address2);
    });
  });

  describe('getUtxoAddress', () => {
    let publicKey: Uint8Array;

    beforeAll(async () => {
      const keyPair = await deriveBitcoinKeyPairFromSeed(testSeed, "m/44'/0'/0'/0/0");
      publicKey = keyPair.publicKey;
    });

    it('should generate Bitcoin SegWit address', () => {
      const address = getUtxoAddress(publicKey, 'bitcoin-mainnet', 'p2wpkh');
      expect(address.startsWith('bc1')).toBe(true);
    });

    it('should generate Litecoin SegWit address', () => {
      const address = getUtxoAddress(publicKey, 'litecoin-mainnet', 'p2wpkh');
      expect(address.startsWith('ltc1')).toBe(true);
    });

    it('should generate Dogecoin legacy address (D...)', () => {
      const address = getUtxoAddress(publicKey, 'dogecoin-mainnet', 'p2pkh');
      expect(address.startsWith('D')).toBe(true);
    });

    it('should generate Ravencoin address (R...)', () => {
      const address = getUtxoAddress(publicKey, 'ravencoin-mainnet', 'p2pkh');
      expect(address.startsWith('R')).toBe(true);
    });

    it('should generate Zcash transparent address (t1...)', () => {
      const address = getUtxoAddress(publicKey, 'zcash-mainnet', 'transparent');
      expect(address.startsWith('t1')).toBe(true);
    });

    it('should generate Flux address (t1...)', () => {
      const address = getUtxoAddress(publicKey, 'flux-mainnet', 'transparent');
      expect(address.startsWith('t1')).toBe(true);
    });

    it('should generate BitcoinZ address (t1...)', () => {
      const address = getUtxoAddress(publicKey, 'bitcoinz-mainnet', 'transparent');
      expect(address.startsWith('t1')).toBe(true);
    });
  });

  describe('isValidBitcoinAddress', () => {
    it('should validate native SegWit address', () => {
      expect(isValidBitcoinAddress('bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq', 'mainnet')).toBe(
        true
      );
    });

    it('should validate legacy address', () => {
      expect(isValidBitcoinAddress('1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2', 'mainnet')).toBe(true);
    });

    it('should validate P2SH address', () => {
      expect(isValidBitcoinAddress('3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy', 'mainnet')).toBe(true);
    });

    it('should reject invalid address', () => {
      expect(isValidBitcoinAddress('invalid-address', 'mainnet')).toBe(false);
    });

    it('should reject empty address', () => {
      expect(isValidBitcoinAddress('', 'mainnet')).toBe(false);
    });

    it('should validate testnet address', () => {
      expect(isValidBitcoinAddress('tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx', 'testnet')).toBe(
        true
      );
    });
  });

  describe('formatBTC', () => {
    it('should format satoshis to BTC', () => {
      expect(formatBTC(100000000)).toBe('1.00000000');
      expect(formatBTC(50000000)).toBe('0.50000000');
      expect(formatBTC(1)).toBe('0.00000001');
      expect(formatBTC(0)).toBe('0.00000000');
    });

    it('should handle string input', () => {
      expect(formatBTC('100000000')).toBe('1.00000000');
    });

    it('should respect decimal parameter', () => {
      expect(formatBTC(123456789, 4)).toBe('1.2346');
    });
  });

  describe('parseBTC', () => {
    it('should parse BTC to satoshis', () => {
      expect(parseBTC('1')).toBe(100000000);
      expect(parseBTC('0.5')).toBe(50000000);
      expect(parseBTC('0.00000001')).toBe(1);
      expect(parseBTC('0')).toBe(0);
    });

    it('should handle fractional values', () => {
      expect(parseBTC('1.5')).toBe(150000000);
      expect(parseBTC('0.12345678')).toBe(12345678);
    });
  });
});
