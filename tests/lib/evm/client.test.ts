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
  RpcError,
} from '@/lib/evm/client';
import { isValidEvmAddress, toChecksumAddress } from '@/lib/crypto/evm';
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
    client = new EvmClient('eth-mainnet');
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create client for valid network', () => {
      expect(client.getNetwork().id).toBe('eth-mainnet');
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

      const balance = await client.getBalanceFormatted(
        '0x1234567890abcdef1234567890abcdef12345678'
      );
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
        .mockResolvedValueOnce(
          rpcResponse({
            number: '0x1',
            baseFeePerGas: '0x3b9aca00', // 1 gwei
          })
        );

      const feeData = await client.getFeeData();
      expect(feeData.maxFeePerGas).not.toBeNull();
      expect(feeData.maxPriorityFeePerGas).not.toBeNull();
    });
  });

  describe('getTransactionCount', () => {
    it('should return nonce as number', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(rpcResponse('0x5'));

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

      (global.fetch as jest.Mock).mockResolvedValueOnce(rpcResponse(mockTx));

      const tx = await client.getTransaction('0xabc123');
      expect(tx?.hash).toBe('0xabc123');
    });

    it('should return null for non-existent transaction', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(rpcResponse(null));

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

      (global.fetch as jest.Mock).mockResolvedValueOnce(rpcResponse(mockReceipt));

      const receipt = await client.getTransactionReceipt('0xabc123');
      expect(receipt?.status).toBe('0x1');
    });
  });

  describe('sendRawTransaction', () => {
    it('should broadcast signed transaction', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(rpcResponse('0xnewtxhash'));

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
      (global.fetch as jest.Mock).mockResolvedValueOnce(rpcResponse('0x1'));

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
    it('should accept all lowercase addresses', () => {
      expect(isValidEvmAddress('0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed')).toBe(true);
      expect(isValidEvmAddress('0x1234567890abcdef1234567890abcdef12345678')).toBe(true);
    });

    it('should accept all uppercase addresses', () => {
      expect(isValidEvmAddress('0xABCDEF1234567890ABCDEF1234567890ABCDEF12')).toBe(true);
      expect(isValidEvmAddress('0x5AAEB6053F3E94C9B9A09F33669435E7EF1BEAED')).toBe(true);
    });

    it('should accept valid checksummed addresses (mixed case)', () => {
      // Valid EIP-55 checksum
      expect(isValidEvmAddress('0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed')).toBe(true);
    });

    it('should reject invalid checksummed addresses (mixed case with wrong checksum)', () => {
      // Invalid checksum - mixed case but not matching EIP-55
      expect(isValidEvmAddress('0x5aAeb6053f3E94C9b9A09f33669435E7Ef1BeAed')).toBe(false);
      expect(isValidEvmAddress('0x5AAEB6053f3e94c9b9a09f33669435e7ef1beaed')).toBe(false);
    });

    it('should reject invalid format addresses', () => {
      expect(isValidEvmAddress('0x1234')).toBe(false);
      expect(isValidEvmAddress('1234567890abcdef1234567890abcdef12345678')).toBe(false);
      expect(isValidEvmAddress('0x1234567890abcdef1234567890abcdef1234567g')).toBe(false);
      expect(isValidEvmAddress('')).toBe(false);
    });
  });

  describe('toChecksumAddress', () => {
    it('should produce EIP-55 compliant checksum', () => {
      // Known test vector - the checksum should have mixed case based on keccak hash
      const result = toChecksumAddress('0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed');
      expect(result).toBe('0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed');
    });

    it('should handle already checksummed address', () => {
      const checksummed = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed';
      expect(toChecksumAddress(checksummed)).toBe(checksummed);
    });

    it('should convert all lowercase to proper checksum', () => {
      const lowercase = '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed';
      const result = toChecksumAddress(lowercase);
      // Should produce mixed case checksum
      expect(result).not.toBe(lowercase);
      expect(result.toLowerCase()).toBe(lowercase);
    });
  });
});

describe('getEvmClient', () => {
  it('should return singleton instance', () => {
    const client1 = getEvmClient('eth-mainnet');
    const client2 = getEvmClient('eth-mainnet');
    expect(client1).toBe(client2);
  });

  it('should return different instances for different networks', () => {
    const eth = getEvmClient('eth-mainnet');
    const bnb = getEvmClient('bnb-mainnet');
    expect(eth).not.toBe(bnb);
  });
});

describe('RpcError', () => {
  it('should create error with code', () => {
    const error = new RpcError('Server overloaded', -32000);
    expect(error.message).toBe('Server overloaded');
    expect(error.code).toBe(-32000);
    expect(error.name).toBe('RpcError');
  });

  it('should be instanceof Error', () => {
    const error = new RpcError('Test error', -32005);
    expect(error instanceof Error).toBe(true);
    expect(error instanceof RpcError).toBe(true);
  });
});

describe('RPC Error Handling', () => {
  let client: EvmClient;

  beforeEach(() => {
    client = new EvmClient('eth-mainnet');
    jest.clearAllMocks();
  });

  it('should throw immediately on client errors (-32600 range)', async () => {
    // Client errors (invalid params, method not found) should NOT trigger failover
    (global.fetch as jest.Mock).mockResolvedValueOnce(rpcError('Invalid params', -32602));

    await expect(client.getBalance('0x1234567890abcdef1234567890abcdef12345678')).rejects.toThrow(
      'Invalid params'
    );

    // Should only have called fetch once (no retries for client errors)
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('should succeed after retry if server error recovers', async () => {
    // First call fails with server error, second succeeds
    // This verifies that -32000 errors trigger retry
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(rpcError('Server overloaded', -32000))
      .mockResolvedValueOnce(rpcResponse('0xde0b6b3a7640000'));

    const balance = await client.getBalance('0x1234567890abcdef1234567890abcdef12345678');
    expect(balance).toBe(1000000000000000000n);
    // Should have retried (2 calls total)
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('should succeed after retry if rate limited recovers', async () => {
    // First call fails with rate limit error, second succeeds
    // This verifies that -32005 errors trigger retry
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(rpcError('Rate limited', -32005))
      .mockResolvedValueOnce(rpcResponse('0xde0b6b3a7640000'));

    const balance = await client.getBalance('0x1234567890abcdef1234567890abcdef12345678');
    expect(balance).toBe(1000000000000000000n);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
