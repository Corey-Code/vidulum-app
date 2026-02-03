/**
 * Solana Cryptography Tests
 *
 * Tests for Solana key derivation, address generation, and validation
 */

import {
  deriveSolanaKeyPair,
  getSolanaDerivationPath,
  getSolanaAddress,
  isValidSolanaAddress,
} from '@/lib/crypto/solana';

describe('Solana Crypto', () => {
  // Standard test mnemonic (DO NOT USE IN PRODUCTION)
  const TEST_MNEMONIC =
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

  // Known expected values for test mnemonic
  // These are derived using standard Solana derivation (m/44'/501'/0'/0')
  const EXPECTED_ACCOUNT_0_ADDRESS_PREFIX = ''; // Will be set after first derivation

  describe('getSolanaDerivationPath', () => {
    it('should return correct path for account 0', () => {
      const path = getSolanaDerivationPath(0);
      expect(path).toBe("m/44'/501'/0'/0'");
    });

    it('should return correct path for account 1', () => {
      const path = getSolanaDerivationPath(1);
      expect(path).toBe("m/44'/501'/1'/0'");
    });

    it('should return correct path for account 10', () => {
      const path = getSolanaDerivationPath(10);
      expect(path).toBe("m/44'/501'/10'/0'");
    });

    it('should default to account 0', () => {
      const path = getSolanaDerivationPath();
      expect(path).toBe("m/44'/501'/0'/0'");
    });
  });

  describe('deriveSolanaKeyPair', () => {
    it('should derive a keypair from mnemonic', async () => {
      const keypair = await deriveSolanaKeyPair(TEST_MNEMONIC, 0);

      expect(keypair).toBeDefined();
      expect(keypair.publicKey).toBeInstanceOf(Uint8Array);
      expect(keypair.privateKey).toBeInstanceOf(Uint8Array);
      expect(keypair.address).toBeDefined();
      expect(typeof keypair.address).toBe('string');
    });

    it('should derive 32-byte private key', async () => {
      const keypair = await deriveSolanaKeyPair(TEST_MNEMONIC, 0);
      expect(keypair.privateKey.length).toBe(32);
    });

    it('should derive 32-byte public key', async () => {
      const keypair = await deriveSolanaKeyPair(TEST_MNEMONIC, 0);
      expect(keypair.publicKey.length).toBe(32);
    });

    it('should derive consistent keypairs for same mnemonic and index', async () => {
      const keypair1 = await deriveSolanaKeyPair(TEST_MNEMONIC, 0);
      const keypair2 = await deriveSolanaKeyPair(TEST_MNEMONIC, 0);

      expect(keypair1.address).toBe(keypair2.address);
      expect(keypair1.publicKey).toEqual(keypair2.publicKey);
      expect(keypair1.privateKey).toEqual(keypair2.privateKey);
    });

    it('should derive different keypairs for different account indices', async () => {
      const keypair0 = await deriveSolanaKeyPair(TEST_MNEMONIC, 0);
      const keypair1 = await deriveSolanaKeyPair(TEST_MNEMONIC, 1);

      expect(keypair0.address).not.toBe(keypair1.address);
      expect(keypair0.publicKey).not.toEqual(keypair1.publicKey);
      expect(keypair0.privateKey).not.toEqual(keypair1.privateKey);
    });

    it('should derive different keypairs for different mnemonics', async () => {
      const altMnemonic = 'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong';

      const keypair1 = await deriveSolanaKeyPair(TEST_MNEMONIC, 0);
      const keypair2 = await deriveSolanaKeyPair(altMnemonic, 0);

      expect(keypair1.address).not.toBe(keypair2.address);
    });

    it('should derive valid Solana addresses', async () => {
      const keypair = await deriveSolanaKeyPair(TEST_MNEMONIC, 0);
      expect(isValidSolanaAddress(keypair.address)).toBe(true);
    });

    it('should derive addresses with correct base58 format', async () => {
      const keypair = await deriveSolanaKeyPair(TEST_MNEMONIC, 0);

      // Solana addresses are base58-encoded 32-byte public keys
      // Typical length is 32-44 characters
      expect(keypair.address.length).toBeGreaterThanOrEqual(32);
      expect(keypair.address.length).toBeLessThanOrEqual(44);

      // Check all characters are valid base58
      const base58Chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
      for (const char of keypair.address) {
        expect(base58Chars.includes(char)).toBe(true);
      }
    });
  });

  describe('getSolanaAddress', () => {
    it('should return address from mnemonic', async () => {
      const address = await getSolanaAddress(TEST_MNEMONIC, 0);

      expect(address).toBeDefined();
      expect(typeof address).toBe('string');
      expect(isValidSolanaAddress(address)).toBe(true);
    });

    it('should return same address as deriveSolanaKeyPair', async () => {
      const address = await getSolanaAddress(TEST_MNEMONIC, 0);
      const keypair = await deriveSolanaKeyPair(TEST_MNEMONIC, 0);

      expect(address).toBe(keypair.address);
    });

    it('should default to account 0', async () => {
      const addressDefault = await getSolanaAddress(TEST_MNEMONIC);
      const address0 = await getSolanaAddress(TEST_MNEMONIC, 0);

      expect(addressDefault).toBe(address0);
    });
  });

  describe('isValidSolanaAddress', () => {
    it('should validate a correct Solana address', async () => {
      const keypair = await deriveSolanaKeyPair(TEST_MNEMONIC, 0);
      expect(isValidSolanaAddress(keypair.address)).toBe(true);
    });

    it('should reject empty address', () => {
      expect(isValidSolanaAddress('')).toBe(false);
    });

    it('should reject null/undefined', () => {
      expect(isValidSolanaAddress(null as unknown as string)).toBe(false);
      expect(isValidSolanaAddress(undefined as unknown as string)).toBe(false);
    });

    it('should reject address that is too short', () => {
      expect(isValidSolanaAddress('abc123')).toBe(false);
      expect(isValidSolanaAddress('1234567890123456789012345678901')).toBe(false); // 31 chars
    });

    it('should reject address that is too long', () => {
      expect(isValidSolanaAddress('1'.repeat(45))).toBe(false);
      expect(isValidSolanaAddress('1'.repeat(50))).toBe(false);
    });

    it('should reject address with invalid base58 characters', () => {
      // 0, O, I, l are not in base58
      expect(isValidSolanaAddress('0' + '1'.repeat(43))).toBe(false);
      expect(isValidSolanaAddress('O' + '1'.repeat(43))).toBe(false);
      expect(isValidSolanaAddress('I' + '1'.repeat(43))).toBe(false);
      expect(isValidSolanaAddress('l' + '1'.repeat(43))).toBe(false);
    });

    it('should reject address with special characters', () => {
      expect(isValidSolanaAddress('abc+def/ghi=jkl'.padEnd(44, '1'))).toBe(false);
    });

    it('should accept valid base58 addresses of correct length', () => {
      // Valid base58 characters only, correct length
      expect(isValidSolanaAddress('11111111111111111111111111111111')).toBe(true); // 32 chars
      expect(isValidSolanaAddress('1'.repeat(44))).toBe(true); // 44 chars
    });
  });

  describe('SLIP-0010 Ed25519 derivation', () => {
    it('should use hardened derivation for all path segments', async () => {
      // Ed25519 requires all hardened derivation
      // This is implicit in the implementation, but we verify by checking
      // that the path format is correct
      const path = getSolanaDerivationPath(0);
      expect(path).toMatch(/^m\/44'\/501'\/\d+'\/0'$/);
    });

    it('should produce deterministic results', async () => {
      // Run derivation multiple times to ensure consistency
      const results = await Promise.all([
        deriveSolanaKeyPair(TEST_MNEMONIC, 0),
        deriveSolanaKeyPair(TEST_MNEMONIC, 0),
        deriveSolanaKeyPair(TEST_MNEMONIC, 0),
      ]);

      const addresses = results.map((r) => r.address);
      expect(new Set(addresses).size).toBe(1); // All should be identical
    });
  });

  describe('Multiple account derivation', () => {
    it('should derive multiple unique accounts', async () => {
      const accounts = await Promise.all([
        deriveSolanaKeyPair(TEST_MNEMONIC, 0),
        deriveSolanaKeyPair(TEST_MNEMONIC, 1),
        deriveSolanaKeyPair(TEST_MNEMONIC, 2),
        deriveSolanaKeyPair(TEST_MNEMONIC, 3),
        deriveSolanaKeyPair(TEST_MNEMONIC, 4),
      ]);

      const addresses = accounts.map((a) => a.address);
      const uniqueAddresses = new Set(addresses);

      expect(uniqueAddresses.size).toBe(5);
    });

    it('should derive valid addresses for all accounts', async () => {
      const accounts = await Promise.all(
        Array.from({ length: 10 }, (_, i) => deriveSolanaKeyPair(TEST_MNEMONIC, i))
      );

      for (const account of accounts) {
        expect(isValidSolanaAddress(account.address)).toBe(true);
      }
    });
  });
});
