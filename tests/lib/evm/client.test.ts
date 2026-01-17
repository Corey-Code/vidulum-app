/**
 * EVM Client Tests
 * 
 * Tests for EVM JSON-RPC client with failover
 */

import {
  EvmClient,
  getEvmClient,
  formatEther,
  parseEther,
  formatGwei,
  parseGwei,
  isValidEvmAddress,
  checksumAddress,
} from '@/lib/evm/client';
import { mockFetchResponse, mockFetchSequence } from '../../setup';

// Helper to create RPC response
function rpcResponse(result: unknown) {
  return mockFetchResponse({
    jsonrpc: '2.0',
    id: expect.any(Number),
    result,
  });
}

function rpcError(message: string, code: number = -32000) {
  return mockFetchResponse({
    jsonrpc: '2.0',
    id: expect.any(Number),
    error: { code, message },
  });
}

describe('EVM Client', () => {
  let client: EvmClient;

  beforeEach(() => {
    client = new EvmClient('ethereum-mainnet');
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create client for valid network', () => {
      expect(client.getNetwork().id).toBe('ethereum-mainnet');
    });

    it('should throw for invalid network', () => {
      expect(() => new EvmClient('invalid-network')).toThrow('not found');
    });

    it('should have multiple RPC URLs', () => {
      expect(client.getRpcUrls().length).toBeGreaterThan(0);
    });
  });

  describe('getBalance', () => {
    it('should fetch balance and return as bigint', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        rpcResponse('0xde0b6b3a7640000') // 1 ETH in hex
      );

      const balance = await client.getBalance('0x1234567890abcdef1234567890abcdef12345678');
      expect(balance).toBe(1000000000000000000n);
    });

    it('should handle successful response', async () => {
      // Test that the client correctly parses balance responses
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        rpcResponse('0xde0b6b3a7640000') // 1 ETH in hex
      );

      const balance = await client.getBalance('0x1234567890abcdef1234567890abcdef12345678');
      expect(typeof balance).toBe('bigint');
      expect(balance).toBe(1000000000000000000n);
    });
  });

  describe('getBalanceFormatted', () => {
    it('should return formatted balance string', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        rpcResponse('0xde0b6b3a7640000') // 1 ETH
      );

      const balance = await client.getBalanceFormatted('0x1234567890abcdef1234567890abcdef12345678');
      expect(balance).toMatch(/^1\.0/);
    });
  });

  describe('getGasPrice', () => {
    it('should fetch gas price', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        rpcResponse('0x3b9aca00') // 1 gwei
      );

      const gasPrice = await client.getGasPrice();
      expect(gasPrice).toBe(1000000000n);
    });
  });

  describe('getFeeData', () => {
    it('should return gas price for non-EIP1559 chains', async () => {
      // First call: eth_gasPrice
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(rpcResponse('0x3b9aca00'))
        // Second call: eth_getBlockByNumber (no baseFeePerGas)
        .mockResolvedValueOnce(rpcResponse({ number: '0x1' }));

      const feeData = await client.getFeeData();
      expect(feeData.gasPrice).toBe(1000000000n);
      expect(feeData.maxFeePerGas).toBeNull();
    });

    it('should return EIP1559 fees when available', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(rpcResponse('0x3b9aca00'))
        .mockResolvedValueOnce(rpcResponse({
          number: '0x1',
          baseFeePerGas: '0x3b9aca00', // 1 gwei
        }));

      const feeData = await client.getFeeData();
      expect(feeData.maxFeePerGas).not.toBeNull();
      expect(feeData.maxPriorityFeePerGas).not.toBeNull();
    });
  });

  describe('getTransactionCount', () => {
    it('should return nonce as number', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        rpcResponse('0x5')
      );

      const nonce = await client.getTransactionCount('0x1234567890abcdef1234567890abcdef12345678');
      expect(nonce).toBe(5);
    });
  });

  describe('estimateGas', () => {
    it('should estimate gas for transaction', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        rpcResponse('0x5208') // 21000 (standard transfer)
      );

      const gas = await client.estimateGas({
        from: '0x1234567890abcdef1234567890abcdef12345678',
        to: '0xabcdef1234567890abcdef1234567890abcdef12',
        value: '0x1',
      });
      expect(gas).toBe(21000n);
    });
  });

  describe('getTransaction', () => {
    it('should fetch transaction by hash', async () => {
      const mockTx = {
        hash: '0xabc123',
        from: '0x1234',
        to: '0x5678',
        value: '0x1',
        gasPrice: '0x3b9aca00',
        gas: '0x5208',
        nonce: '0x0',
        input: '0x',
        blockHash: '0xblock',
        blockNumber: '0x1',
        transactionIndex: '0x0',
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(
        rpcResponse(mockTx)
      );

      const tx = await client.getTransaction('0xabc123');
      expect(tx?.hash).toBe('0xabc123');
    });

    it('should return null for non-existent transaction', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        rpcResponse(null)
      );

      const tx = await client.getTransaction('0xnonexistent');
      expect(tx).toBeNull();
    });
  });

  describe('getTransactionReceipt', () => {
    it('should fetch transaction receipt', async () => {
      const mockReceipt = {
        transactionHash: '0xabc123',
        status: '0x1',
        gasUsed: '0x5208',
        logs: [],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(
        rpcResponse(mockReceipt)
      );

      const receipt = await client.getTransactionReceipt('0xabc123');
      expect(receipt?.status).toBe('0x1');
    });
  });

  describe('sendRawTransaction', () => {
    it('should broadcast signed transaction', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        rpcResponse('0xnewtxhash')
      );

      const txHash = await client.sendRawTransaction('0xsignedtx');
      expect(txHash).toBe('0xnewtxhash');
    });
  });

  describe('getBlockNumber', () => {
    it('should return current block number', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        rpcResponse('0xf4240') // 1000000
      );

      const blockNumber = await client.getBlockNumber();
      expect(blockNumber).toBe(1000000);
    });
  });

  describe('getChainId', () => {
    it('should return chain ID', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        rpcResponse('0x1')
      );

      const chainId = await client.getChainId();
      expect(chainId).toBe(1);
    });
  });
});

describe('EVM Utility Functions', () => {
  describe('formatEther', () => {
    it('should format wei to ETH', () => {
      expect(formatEther(1000000000000000000n)).toMatch(/^1\.0/);
      expect(formatEther(500000000000000000n)).toMatch(/^0\.5/);
      expect(formatEther(1n)).toMatch(/^0\.000000/);
    });

    it('should handle large values', () => {
      expect(formatEther(1000000000000000000000n)).toMatch(/^1000\.0/);
    });

    it('should handle custom decimals', () => {
      expect(formatEther(1000000n, 6)).toMatch(/^1\.0/);
    });
  });

  describe('parseEther', () => {
    it('should parse ETH to wei', () => {
      expect(parseEther('1')).toBe(1000000000000000000n);
      expect(parseEther('0.5')).toBe(500000000000000000n);
    });

    it('should handle decimal values', () => {
      expect(parseEther('1.5')).toBe(1500000000000000000n);
    });

    it('should handle custom decimals', () => {
      expect(parseEther('1', 6)).toBe(1000000n);
    });
  });

  describe('formatGwei', () => {
    it('should format wei to gwei', () => {
      expect(formatGwei(1000000000n)).toMatch(/^1\.0/);
      expect(formatGwei(1500000000n)).toMatch(/^1\.5/);
    });
  });

  describe('parseGwei', () => {
    it('should parse gwei to wei', () => {
      expect(parseGwei('1')).toBe(1000000000n);
      expect(parseGwei('1.5')).toBe(1500000000n);
    });
  });

  describe('isValidEvmAddress', () => {
    it('should validate correct addresses', () => {
      expect(isValidEvmAddress('0x1234567890abcdef1234567890abcdef12345678')).toBe(true);
      expect(isValidEvmAddress('0xABCDEF1234567890ABCDEF1234567890ABCDEF12')).toBe(true);
    });

    it('should reject invalid addresses', () => {
      expect(isValidEvmAddress('0x1234')).toBe(false);
      expect(isValidEvmAddress('1234567890abcdef1234567890abcdef12345678')).toBe(false);
      expect(isValidEvmAddress('0x1234567890abcdef1234567890abcdef1234567g')).toBe(false);
      expect(isValidEvmAddress('')).toBe(false);
    });
  });

  describe('checksumAddress', () => {
    it('should convert address to lowercase', () => {
      const result = checksumAddress('0xABCDEF1234567890ABCDEF1234567890ABCDEF12');
      expect(result).toBe('0xabcdef1234567890abcdef1234567890abcdef12');
    });

    it('should throw for invalid address', () => {
      expect(() => checksumAddress('invalid')).toThrow('Invalid address');
    });
  });
});

describe('getEvmClient', () => {
  it('should return singleton instance', () => {
    const client1 = getEvmClient('ethereum-mainnet');
    const client2 = getEvmClient('ethereum-mainnet');
    expect(client1).toBe(client2);
  });

  it('should return different instances for different networks', () => {
    const eth = getEvmClient('ethereum-mainnet');
    const bnb = getEvmClient('bnb-mainnet');
    expect(eth).not.toBe(bnb);
  });
});
