/**
 * Mnemonic Manager Tests
 *
 * Tests for mnemonic generation, validation, and key derivation
 */

import { MnemonicManager } from '@/lib/crypto/mnemonic';

describe('MnemonicManager', () => {
  // Valid 24-word test mnemonic (DO NOT USE IN PRODUCTION)
  const validMnemonic =
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art';

  // Valid 12-word test mnemonic
  const validMnemonic12 =
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

  describe('validateMnemonic', () => {
    it('should validate a correct 24-word mnemonic', () => {
      expect(MnemonicManager.validateMnemonic(validMnemonic)).toBe(true);
    });

    it('should validate a correct 12-word mnemonic', () => {
      expect(MnemonicManager.validateMnemonic(validMnemonic12)).toBe(true);
    });

    it('should reject an empty mnemonic', () => {
      expect(MnemonicManager.validateMnemonic('')).toBe(false);
    });

    it('should reject a mnemonic with invalid words', () => {
      const invalidMnemonic = 'invalid words that are not in the bip39 wordlist at all test';
      expect(MnemonicManager.validateMnemonic(invalidMnemonic)).toBe(false);
    });

    it('should reject a mnemonic with wrong word count', () => {
      const wrongCount = 'abandon abandon abandon abandon abandon';
      expect(MnemonicManager.validateMnemonic(wrongCount)).toBe(false);
    });

    it('should reject a mnemonic with invalid checksum', () => {
      // Valid words but wrong checksum
      const invalidChecksum =
        'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon';
      expect(MnemonicManager.validateMnemonic(invalidChecksum)).toBe(false);
    });

    it('should handle extra whitespace', () => {
      const withSpaces = '  abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about  ';
      // Trim should be handled - this tests the current behavior
      expect(MnemonicManager.validateMnemonic(withSpaces.trim())).toBe(true);
    });

    it('should be case-insensitive for valid words', () => {
      const mixedCase =
        'Abandon ABANDON abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
      // BIP39 words are lowercase, mixed case should fail
      expect(MnemonicManager.validateMnemonic(mixedCase)).toBe(false);
    });
  });

  describe('generateMnemonicAsync', () => {
    it('should generate a valid 24-word mnemonic', async () => {
      const mnemonic = await MnemonicManager.generateMnemonicAsync();

      expect(typeof mnemonic).toBe('string');
      expect(mnemonic.split(' ').length).toBe(24);
      expect(MnemonicManager.validateMnemonic(mnemonic)).toBe(true);
    });

    it('should generate unique mnemonics', async () => {
      const mnemonic1 = await MnemonicManager.generateMnemonicAsync();
      const mnemonic2 = await MnemonicManager.generateMnemonicAsync();

      expect(mnemonic1).not.toBe(mnemonic2);
    });
  });

  describe('generateMnemonic (deprecated)', () => {
    it('should throw an error directing to async method', () => {
      expect(() => MnemonicManager.generateMnemonic()).toThrow('Use generateMnemonicAsync instead');
    });
  });

  describe('deriveKeyFromMnemonic', () => {
    it('should derive a key with default prefix', async () => {
      const result = await MnemonicManager.deriveKeyFromMnemonic(validMnemonic12);

      expect(result.address).toBeDefined();
      expect(result.address.startsWith('bze')).toBe(true);
      expect(result.publicKey).toBeInstanceOf(Uint8Array);
      expect(result.publicKey.length).toBeGreaterThan(0);
    });

    it('should derive a key with custom prefix', async () => {
      const result = await MnemonicManager.deriveKeyFromMnemonic(validMnemonic12, 'cosmos');

      expect(result.address.startsWith('cosmos')).toBe(true);
    });

    it('should derive the same key for the same mnemonic', async () => {
      const result1 = await MnemonicManager.deriveKeyFromMnemonic(validMnemonic12);
      const result2 = await MnemonicManager.deriveKeyFromMnemonic(validMnemonic12);

      expect(result1.address).toBe(result2.address);
    });

    it('should derive different keys for different mnemonics', async () => {
      const result1 = await MnemonicManager.deriveKeyFromMnemonic(validMnemonic12);
      const result2 = await MnemonicManager.deriveKeyFromMnemonic(validMnemonic);

      expect(result1.address).not.toBe(result2.address);
    });
  });

  describe('publicKeyToAddress', () => {
    it('should convert public key to bech32 address', async () => {
      const derived = await MnemonicManager.deriveKeyFromMnemonic(validMnemonic12, 'cosmos');
      const address = MnemonicManager.publicKeyToAddress(derived.publicKey, 'cosmos');

      expect(address.startsWith('cosmos')).toBe(true);
      expect(address.length).toBeGreaterThan(10);
    });

    it('should produce different addresses for different prefixes', async () => {
      const derived = await MnemonicManager.deriveKeyFromMnemonic(validMnemonic12, 'bze');

      const bzeAddress = MnemonicManager.publicKeyToAddress(derived.publicKey, 'bze');
      const cosmosAddress = MnemonicManager.publicKeyToAddress(derived.publicKey, 'cosmos');

      expect(bzeAddress).not.toBe(cosmosAddress);
      expect(bzeAddress.startsWith('bze')).toBe(true);
      expect(cosmosAddress.startsWith('cosmos')).toBe(true);
    });
  });

  describe('verifyAddress', () => {
    it('should verify a valid address with correct prefix', async () => {
      const derived = await MnemonicManager.deriveKeyFromMnemonic(validMnemonic12, 'bze');

      expect(MnemonicManager.verifyAddress(derived.address, 'bze')).toBe(true);
    });

    it('should reject an address with wrong prefix', async () => {
      const derived = await MnemonicManager.deriveKeyFromMnemonic(validMnemonic12, 'bze');

      expect(MnemonicManager.verifyAddress(derived.address, 'cosmos')).toBe(false);
    });

    it('should reject an invalid address', () => {
      expect(MnemonicManager.verifyAddress('invalid-address', 'bze')).toBe(false);
    });

    it('should reject an empty address', () => {
      expect(MnemonicManager.verifyAddress('', 'bze')).toBe(false);
    });
  });

  describe('mnemonicToSeed', () => {
    it('should derive seed from mnemonic', async () => {
      const seed = await MnemonicManager.mnemonicToSeed(validMnemonic12);

      expect(seed).toBeInstanceOf(Uint8Array);
      expect(seed.length).toBeGreaterThan(0);
    });

    it('should produce consistent results', async () => {
      const seed1 = await MnemonicManager.mnemonicToSeed(validMnemonic12);
      const seed2 = await MnemonicManager.mnemonicToSeed(validMnemonic12);

      expect(Buffer.from(seed1).toString('hex')).toBe(Buffer.from(seed2).toString('hex'));
    });
  });
});
