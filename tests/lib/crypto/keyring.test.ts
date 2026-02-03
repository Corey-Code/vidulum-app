/**
 * Keyring Tests
 *
 * Tests for Keyring class, specifically around session restore and key derivation
 */

import { Keyring } from '@/lib/crypto/keyring';

// Test mnemonic - DO NOT USE IN PRODUCTION
const TEST_MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

describe('Keyring', () => {
  describe('Bitcoin key derivation', () => {
    it('should derive Bitcoin keys when mnemonic is available', async () => {
      const keyring = new Keyring();
      await keyring.createFromMnemonic(TEST_MNEMONIC, 'bze', [0]);

      // Derive Bitcoin account
      const btcAccount = await keyring.deriveBitcoinAccount(
        'bitcoin-mainnet',
        'mainnet',
        0,
        'p2wpkh'
      );

      expect(btcAccount).toBeDefined();
      expect(btcAccount?.address).toMatch(/^bc1/); // Native SegWit mainnet
      expect(btcAccount?.privateKey.length).toBeGreaterThan(0);
      expect(btcAccount?.publicKey.length).toBeGreaterThan(0);
    });

    it('should get Bitcoin private key when account exists with keys', async () => {
      const keyring = new Keyring();
      await keyring.createFromMnemonic(TEST_MNEMONIC, 'bze', [0]);

      // Derive Bitcoin account first
      await keyring.deriveBitcoinAccount('bitcoin-mainnet', 'mainnet', 0, 'p2wpkh');

      // Get private key
      const privateKey = await keyring.getBitcoinPrivateKey('bitcoin-mainnet', 0);

      expect(privateKey).toBeDefined();
      expect(privateKey?.length).toBeGreaterThan(0);
    });

    it('should derive keys on-demand when account does not exist', async () => {
      const keyring = new Keyring();
      await keyring.createFromMnemonic(TEST_MNEMONIC, 'bze', [0]);

      // Do NOT derive Bitcoin account first
      // Try to get private key - should auto-derive
      const privateKey = await keyring.getBitcoinPrivateKey('bitcoin-mainnet', 0);

      expect(privateKey).toBeDefined();
      expect(privateKey?.length).toBeGreaterThan(0);
    });

    it('should return undefined when mnemonic is not available and account does not exist', async () => {
      const keyring = new Keyring();
      // No mnemonic set, no accounts

      const privateKey = await keyring.getBitcoinPrivateKey('bitcoin-mainnet', 0);

      expect(privateKey).toBeUndefined();
    });
  });

  describe('hasMnemonic', () => {
    it('should return false for new keyring', () => {
      const keyring = new Keyring();
      expect(keyring.hasMnemonic()).toBe(false);
    });

    it('should return true after createFromMnemonic', async () => {
      const keyring = new Keyring();
      await keyring.createFromMnemonic(TEST_MNEMONIC, 'bze', [0]);
      expect(keyring.hasMnemonic()).toBe(true);
    });
  });
});
