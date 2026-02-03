/**
 * UTXO Transaction Tests
 */

import {
  buildTransaction,
  createSendTransaction,
  estimateFee,
  TransactionInput,
  TransactionOutput,
} from '@/lib/bitcoin/transaction';
import { BitcoinNetworkConfig } from '@/lib/networks/types';
import * as secp256k1 from '@noble/secp256k1';

// Mock network configurations
const BITCOIN_MAINNET: BitcoinNetworkConfig = {
  id: 'bitcoin-mainnet',
  name: 'Bitcoin',
  type: 'bitcoin',
  enabled: true,
  symbol: 'BTC',
  decimals: 8,
  coinType: 0,
  network: 'mainnet',
  apiUrls: ['https://blockstream.info/api'],
  addressType: 'p2wpkh',
  addressPrefix: {
    pubKeyHash: 0x00,
    scriptHash: 0x05,
    bech32: 'bc',
  },
};

const DOGECOIN_MAINNET: BitcoinNetworkConfig = {
  id: 'dogecoin-mainnet',
  name: 'Dogecoin',
  type: 'bitcoin',
  enabled: true,
  symbol: 'DOGE',
  decimals: 8,
  coinType: 3,
  network: 'mainnet',
  apiUrls: ['https://dogechain.info/api/v1'],
  addressType: 'p2pkh',
  addressPrefix: {
    pubKeyHash: 0x1e,
    scriptHash: 0x16,
  },
};

// Generate test keys
async function generateTestKeys(): Promise<{ privateKey: Uint8Array; publicKey: Uint8Array }> {
  let privateKey: Uint8Array;
  // Generate until we get a key that is valid for secp256k1
  do {
    privateKey = new Uint8Array(32);
    crypto.getRandomValues(privateKey);
  } while (!secp256k1.utils.isValidPrivateKey(privateKey));
  const publicKey = secp256k1.getPublicKey(privateKey, true);
  return { privateKey, publicKey: new Uint8Array(publicKey) };
}

describe('UTXO Transaction Module', () => {
  describe('estimateFee', () => {
    it('should estimate SegWit transaction fee correctly', () => {
      const fee = estimateFee(1, 2, 10, true);
      // 1 input (68 vB) + 2 outputs (62 vB) + overhead (11 vB) = 141 vB
      // 141 * 10 = 1410 sats
      expect(fee).toBe(1410);
    });

    it('should estimate legacy transaction fee correctly', () => {
      const fee = estimateFee(1, 2, 10, false);
      // 1 input (148 vB) + 2 outputs (68 vB) + overhead (10 vB) = 226 vB
      // 226 * 10 = 2260 sats
      expect(fee).toBe(2260);
    });

    it('should scale with number of inputs', () => {
      const fee1 = estimateFee(1, 1, 10, true);
      const fee2 = estimateFee(2, 1, 10, true);
      expect(fee2).toBeGreaterThan(fee1);
      expect(fee2 - fee1).toBe(680); // One more input = 68 vB * 10 sat/vB
    });
  });

  describe('buildTransaction', () => {
    it('should build a SegWit transaction for Bitcoin', async () => {
      const { privateKey, publicKey } = await generateTestKeys();

      const inputs: TransactionInput[] = [
        {
          txid: '0'.repeat(64),
          vout: 0,
          value: 100000,
        },
      ];

      const outputs: TransactionOutput[] = [
        {
          address: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
          value: 90000,
        },
      ];

      const result = await buildTransaction({
        inputs,
        outputs,
        privateKey,
        publicKey,
        network: BITCOIN_MAINNET,
      });

      expect(result.txHex).toBeDefined();
      expect(result.txHex.length).toBeGreaterThan(0);
      expect(result.txid).toBeDefined();
      expect(result.txid.length).toBe(64);
      expect(result.size).toBeGreaterThan(0);
      expect(result.vsize).toBeLessThanOrEqual(result.size); // SegWit has witness discount
      expect(result.fee).toBe(10000); // 100000 - 90000
    });

    it('should build a legacy transaction for Dogecoin', async () => {
      const { privateKey, publicKey } = await generateTestKeys();

      const inputs: TransactionInput[] = [
        {
          txid: '1'.repeat(64),
          vout: 0,
          value: 500000000, // 5 DOGE
        },
      ];

      const outputs: TransactionOutput[] = [
        {
          address: 'DH5yaieqoZN36fDVciNyRueRGvGLR3mr7L', // Valid Dogecoin address
          value: 490000000, // 4.9 DOGE
        },
      ];

      const result = await buildTransaction({
        inputs,
        outputs,
        privateKey,
        publicKey,
        network: DOGECOIN_MAINNET,
      });

      expect(result.txHex).toBeDefined();
      expect(result.txid).toBeDefined();
      expect(result.vsize).toBe(result.size); // No witness discount for legacy
      expect(result.fee).toBe(10000000); // 0.1 DOGE
    });

    it('should throw error for empty inputs', async () => {
      const { privateKey, publicKey } = await generateTestKeys();

      await expect(
        buildTransaction({
          inputs: [],
          outputs: [{ address: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4', value: 1000 }],
          privateKey,
          publicKey,
          network: BITCOIN_MAINNET,
        })
      ).rejects.toThrow('No inputs provided');
    });

    it('should throw error for empty outputs', async () => {
      const { privateKey, publicKey } = await generateTestKeys();

      await expect(
        buildTransaction({
          inputs: [{ txid: '0'.repeat(64), vout: 0, value: 10000 }],
          outputs: [],
          privateKey,
          publicKey,
          network: BITCOIN_MAINNET,
        })
      ).rejects.toThrow('No outputs provided');
    });

    it('should throw error for invalid address', async () => {
      const { privateKey, publicKey } = await generateTestKeys();

      await expect(
        buildTransaction({
          inputs: [{ txid: '0'.repeat(64), vout: 0, value: 10000 }],
          outputs: [{ address: 'invalid_address', value: 5000 }],
          privateKey,
          publicKey,
          network: BITCOIN_MAINNET,
        })
      ).rejects.toThrow('Invalid output address');
    });
  });

  describe('createSendTransaction', () => {
    it('should throw error when no confirmed UTXOs available', async () => {
      const { privateKey, publicKey } = await generateTestKeys();

      const utxos = [
        {
          txid: '0'.repeat(64),
          vout: 0,
          value: 100000,
          status: { confirmed: false },
        },
      ];

      await expect(
        createSendTransaction(
          utxos,
          'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
          50000,
          10,
          privateKey,
          publicKey,
          'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
          BITCOIN_MAINNET
        )
      ).rejects.toThrow('No confirmed UTXOs available');
    });

    it('should throw error for insufficient funds', async () => {
      const { privateKey, publicKey } = await generateTestKeys();

      const utxos = [
        {
          txid: '0'.repeat(64),
          vout: 0,
          value: 1000, // Only 1000 sats
          status: { confirmed: true },
        },
      ];

      await expect(
        createSendTransaction(
          utxos,
          'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
          50000, // Want to send 50000 sats
          10,
          privateKey,
          publicKey,
          'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
          BITCOIN_MAINNET
        )
      ).rejects.toThrow('Insufficient funds');
    });

    it('should create transaction with change output', async () => {
      const { privateKey, publicKey } = await generateTestKeys();

      const utxos = [
        {
          txid: '0'.repeat(64),
          vout: 0,
          value: 100000, // 100k sats
          status: { confirmed: true },
        },
      ];

      const result = await createSendTransaction(
        utxos,
        'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
        50000, // Send 50k sats
        10, // 10 sat/vB
        privateKey,
        publicKey,
        'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
        BITCOIN_MAINNET
      );

      expect(result.txHex).toBeDefined();
      expect(result.txid).toBeDefined();
      // Fee should be roughly 1410 sats (1 input, 2 outputs at 10 sat/vB)
      expect(result.fee).toBeGreaterThan(1000);
      expect(result.fee).toBeLessThan(3000);
    });

    it('should create sweepAll transaction successfully', async () => {
      const { privateKey, publicKey } = await generateTestKeys();

      const utxos = [
        {
          txid: '0'.repeat(64),
          vout: 0,
          value: 100000, // 100k sats
          status: { confirmed: true },
        },
      ];

      const result = await createSendTransaction(
        utxos,
        'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
        0, // Amount doesn't matter for sweepAll
        10, // 10 sat/vB
        privateKey,
        publicKey,
        'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
        BITCOIN_MAINNET,
        { sweepAll: true }
      );

      expect(result.txHex).toBeDefined();
      expect(result.txid).toBeDefined();
      // Fee should be roughly 1100 sats (1 input, 1 output at 10 sat/vB)
      expect(result.fee).toBeGreaterThan(800);
      expect(result.fee).toBeLessThan(1500);
    });

    it('should throw error when sweepAll fee exceeds 20% of balance', async () => {
      const { privateKey, publicKey } = await generateTestKeys();

      // Create many small UTXOs to trigger high fee scenario
      const utxos = Array.from({ length: 50 }, (_, i) => ({
        txid: i.toString().padStart(64, '0'),
        vout: 0,
        value: 1000, // 1000 sats each = 50k total
        status: { confirmed: true },
      }));

      await expect(
        createSendTransaction(
          utxos,
          'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
          0,
          100, // High fee rate: 100 sat/vB
          privateKey,
          publicKey,
          'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
          BITCOIN_MAINNET,
          { sweepAll: true }
        )
      ).rejects.toThrow(/Fee too high.*exceeds 20% of total balance/);
    });

    it('should allow sweepAll when fee is below 20% threshold', async () => {
      const { privateKey, publicKey } = await generateTestKeys();

      // Fewer UTXOs with reasonable balance
      const utxos = Array.from({ length: 5 }, (_, i) => ({
        txid: i.toString().padStart(64, '0'),
        vout: 0,
        value: 50000, // 50k sats each = 250k total
        status: { confirmed: true },
      }));

      const result = await createSendTransaction(
        utxos,
        'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
        0,
        10, // 10 sat/vB
        privateKey,
        publicKey,
        'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
        BITCOIN_MAINNET,
        { sweepAll: true }
      );

      expect(result.txHex).toBeDefined();
      expect(result.txid).toBeDefined();
      // With 5 inputs and 1 output, fee should be reasonable
      expect(result.fee).toBeGreaterThan(0);
      expect(result.fee).toBeLessThan(50000); // Well below 20% of 250k
    });

    it('should successfully sweep when fee is reasonable and output is above dust', async () => {
      const { privateKey, publicKey } = await generateTestKeys();

      const utxos = [
        {
          txid: '0'.repeat(64),
          vout: 0,
          value: 10000, // 10k sats
          status: { confirmed: true },
        },
      ];

      // Using lower fee rate to get under 20% and result above dust threshold
      const result = await createSendTransaction(
        utxos,
        'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
        0,
        8, // 8 sat/vB: fee ≈ 880 sats (≈8.8%), leaving ≈9120 sats (well above dust)
        privateKey,
        publicKey,
        'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
        BITCOIN_MAINNET,
        { sweepAll: true }
      );

      // This should succeed since fee is under 20% and result is above dust
      expect(result.txHex).toBeDefined();
      expect(result.txid).toBeDefined();
      expect(result.fee).toBeGreaterThan(0);
      expect(result.fee).toBeLessThan(2000); // Fee should be reasonable
    });
  });
});
