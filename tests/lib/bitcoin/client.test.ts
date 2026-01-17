/**
 * Bitcoin Client Tests
 * 
 * Tests for Bitcoin API client with failover
 */

import {
  BitcoinClient,
  getBitcoinClient,
  calculateFee,
  estimateP2WPKHSize,
  selectUTXOs,
  satsToBTC,
  btcToSats,
  UTXO,
} from '@/lib/bitcoin/client';
import { mockFetchResponse, mockFetchSequence } from '../../setup';

describe('Bitcoin Client', () => {
  let client: BitcoinClient;

  beforeEach(() => {
    client = new BitcoinClient('bitcoin-mainnet');
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create client for valid network', () => {
      expect(client.getNetwork().id).toBe('bitcoin-mainnet');
    });

    it('should throw for invalid network', () => {
      expect(() => new BitcoinClient('invalid-network')).toThrow('not found');
    });

    it('should have multiple API URLs', () => {
      expect(client.getApiUrls().length).toBeGreaterThan(0);
    });
  });

  describe('getAddressInfo', () => {
    const mockAddressInfo = {
      address: 'bc1qtest',
      chain_stats: {
        funded_txo_count: 5,
        funded_txo_sum: 100000,
        spent_txo_count: 2,
        spent_txo_sum: 50000,
        tx_count: 7,
      },
      mempool_stats: {
        funded_txo_count: 1,
        funded_txo_sum: 10000,
        spent_txo_count: 0,
        spent_txo_sum: 0,
        tx_count: 1,
      },
    };

    it('should fetch address info', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        mockFetchResponse(mockAddressInfo)
      );

      const info = await client.getAddressInfo('bc1qtest');
      
      expect(info.address).toBe('bc1qtest');
      expect(info.chain_stats.funded_txo_sum).toBe(100000);
    });

    it('should failover to next endpoint on failure', async () => {
      mockFetchSequence([
        { error: 'timeout' },
        { error: 'timeout' },
        { error: 'timeout' },
        { data: mockAddressInfo },
      ]);

      const info = await client.getAddressInfo('bc1qtest');
      expect(info.address).toBe('bc1qtest');
    });
  });

  describe('getBalance', () => {
    it('should calculate correct balance', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        mockFetchResponse({
          address: 'bc1qtest',
          chain_stats: {
            funded_txo_sum: 100000,
            spent_txo_sum: 30000,
          },
          mempool_stats: {
            funded_txo_sum: 5000,
            spent_txo_sum: 0,
          },
        })
      );

      const balance = await client.getBalance('bc1qtest');
      // (100000 - 30000) + (5000 - 0) = 75000
      expect(balance).toBe(75000);
    });
  });

  describe('getUTXOs', () => {
    const mockUTXOs: UTXO[] = [
      {
        txid: 'tx1',
        vout: 0,
        value: 50000,
        status: { confirmed: true, block_height: 100 },
      },
      {
        txid: 'tx2',
        vout: 1,
        value: 30000,
        status: { confirmed: false },
      },
    ];

    it('should fetch UTXOs', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        mockFetchResponse(mockUTXOs)
      );

      const utxos = await client.getUTXOs('bc1qtest');
      expect(utxos.length).toBe(2);
      expect(utxos[0].value).toBe(50000);
    });

    it('should filter confirmed UTXOs', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        mockFetchResponse(mockUTXOs)
      );

      const confirmed = await client.getConfirmedUTXOs('bc1qtest');
      expect(confirmed.length).toBe(1);
      expect(confirmed[0].txid).toBe('tx1');
    });
  });

  describe('getTransaction', () => {
    const mockTx = {
      txid: 'abc123',
      version: 2,
      locktime: 0,
      vin: [],
      vout: [],
      size: 250,
      weight: 1000,
      fee: 500,
      status: { confirmed: true },
    };

    it('should fetch transaction', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        mockFetchResponse(mockTx)
      );

      const tx = await client.getTransaction('abc123');
      expect(tx.txid).toBe('abc123');
      expect(tx.fee).toBe(500);
    });
  });

  describe('getFeeEstimates', () => {
    it('should fetch and format fee estimates', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        mockFetchResponse({
          '1': 25.5,
          '3': 20.2,
          '6': 15.8,
          '144': 5.1,
          '1008': 1.2,
        })
      );

      const fees = await client.getFeeEstimates();
      expect(fees.fastestFee).toBe(26); // Ceiling of 25.5
      expect(fees.halfHourFee).toBe(21);
      expect(fees.hourFee).toBe(16);
      expect(fees.economyFee).toBe(6);
      expect(fees.minimumFee).toBe(2);
    });

    it('should use defaults for missing values', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        mockFetchResponse({})
      );

      const fees = await client.getFeeEstimates();
      expect(fees.fastestFee).toBe(20); // Default
    });
  });

  describe('broadcastTransaction', () => {
    it('should broadcast and return txid', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: () => Promise.resolve('newtxid123'),
      });

      const txid = await client.broadcastTransaction('rawtxhex');
      expect(txid).toBe('newtxid123');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/tx'),
        expect.objectContaining({
          method: 'POST',
          body: 'rawtxhex',
        })
      );
    });

    it('should throw on broadcast failure', async () => {
      // Mock all endpoints returning failure
      const failureResponse = {
        ok: false,
        status: 400,
        text: () => Promise.resolve('Invalid transaction'),
      };
      
      // Need to mock multiple calls since the client has multiple endpoints
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(failureResponse)
        .mockResolvedValueOnce(failureResponse)
        .mockResolvedValueOnce(failureResponse);

      await expect(client.broadcastTransaction('badtx')).rejects.toThrow(
        'All endpoints failed to broadcast'
      );
    });
  });

  describe('getBlockHeight', () => {
    it('should fetch current block height', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve('800000'),
      });

      const height = await client.getBlockHeight();
      expect(height).toBe(800000);
    });
  });
});

describe('Bitcoin Utility Functions', () => {
  describe('calculateFee', () => {
    it('should calculate fee correctly', () => {
      expect(calculateFee(250, 10)).toBe(2500);
      expect(calculateFee(100, 5)).toBe(500);
    });

    it('should round up', () => {
      expect(calculateFee(100, 1.5)).toBe(150);
    });
  });

  describe('estimateP2WPKHSize', () => {
    it('should estimate size for single input/output', () => {
      const size = estimateP2WPKHSize(1, 1);
      expect(size).toBeGreaterThan(0);
    });

    it('should increase with more inputs', () => {
      const size1 = estimateP2WPKHSize(1, 2);
      const size2 = estimateP2WPKHSize(2, 2);
      expect(size2).toBeGreaterThan(size1);
    });

    it('should increase with more outputs', () => {
      const size1 = estimateP2WPKHSize(1, 1);
      const size2 = estimateP2WPKHSize(1, 2);
      expect(size2).toBeGreaterThan(size1);
    });
  });

  describe('selectUTXOs', () => {
    const utxos: UTXO[] = [
      { txid: 'a', vout: 0, value: 100000, status: { confirmed: true } },
      { txid: 'b', vout: 0, value: 50000, status: { confirmed: true } },
      { txid: 'c', vout: 0, value: 25000, status: { confirmed: true } },
    ];

    it('should select sufficient UTXOs', () => {
      const result = selectUTXOs(utxos, 50000, 10);
      expect(result).not.toBeNull();
      expect(result!.selected.length).toBeGreaterThan(0);
    });

    it('should return null for insufficient funds', () => {
      const result = selectUTXOs(utxos, 500000, 10);
      expect(result).toBeNull();
    });

    it('should calculate change correctly', () => {
      const result = selectUTXOs(utxos, 10000, 1);
      expect(result).not.toBeNull();
      expect(result!.change).toBeGreaterThanOrEqual(0);
      expect(result!.fee).toBeGreaterThan(0);
    });

    it('should prefer larger UTXOs first', () => {
      const result = selectUTXOs(utxos, 50000, 10);
      // Should select the 100000 UTXO first
      expect(result!.selected[0].value).toBe(100000);
    });
  });

  describe('satsToBTC', () => {
    it('should convert satoshis to BTC', () => {
      expect(satsToBTC(100000000)).toBe('1.00000000');
      expect(satsToBTC(50000000)).toBe('0.50000000');
      expect(satsToBTC(1)).toBe('0.00000001');
    });
  });

  describe('btcToSats', () => {
    it('should convert BTC to satoshis', () => {
      expect(btcToSats(1)).toBe(100000000);
      expect(btcToSats(0.5)).toBe(50000000);
      expect(btcToSats('0.00000001')).toBe(1);
    });

    it('should handle string input', () => {
      expect(btcToSats('1.5')).toBe(150000000);
    });
  });
});

describe('getBitcoinClient', () => {
  it('should return singleton instance', () => {
    const client1 = getBitcoinClient('bitcoin-mainnet');
    const client2 = getBitcoinClient('bitcoin-mainnet');
    expect(client1).toBe(client2);
  });

  it('should return different instances for different networks', () => {
    const mainnet = getBitcoinClient('bitcoin-mainnet');
    const litecoin = getBitcoinClient('litecoin-mainnet');
    expect(mainnet).not.toBe(litecoin);
  });
});
