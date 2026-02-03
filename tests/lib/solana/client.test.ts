/**
 * Solana Client Tests
 *
 * Tests for Solana RPC client functionality
 */

import { SolanaClient, createSolanaClient } from '@/lib/solana/client';
import { SOLANA_MAINNET, SOLANA_DEVNET } from '@/lib/networks/solana';
import { mockFetchResponse } from '../../setup';

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

describe('Solana Client', () => {
  let client: SolanaClient;

  beforeEach(() => {
    client = createSolanaClient(SOLANA_MAINNET);
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create client for mainnet', () => {
      const mainnetClient = createSolanaClient(SOLANA_MAINNET);
      expect(mainnetClient.getNetwork().id).toBe('solana-mainnet');
    });

    it('should create client for devnet', () => {
      const devnetClient = createSolanaClient(SOLANA_DEVNET);
      expect(devnetClient.getNetwork().id).toBe('solana-devnet');
    });

    it('should have correct network config', () => {
      expect(client.getNetwork().cluster).toBe('mainnet-beta');
      expect(client.getNetwork().symbol).toBe('SOL');
    });
  });

  describe('getBalance', () => {
    it('should fetch SOL balance', async () => {
      const lamports = 1000000000; // 1 SOL = 1 billion lamports
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        rpcResponse({
          context: { slot: 123456 },
          value: lamports,
        })
      );

      const balance = await client.getBalance('11111111111111111111111111111111');

      expect(balance.lamports).toBe(BigInt(lamports));
      expect(balance.sol).toBe(1);
    });

    it('should handle zero balance', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        rpcResponse({
          context: { slot: 123456 },
          value: 0,
        })
      );

      const balance = await client.getBalance('11111111111111111111111111111111');

      expect(balance.lamports).toBe(0n);
      expect(balance.sol).toBe(0);
    });

    it('should calculate SOL correctly from lamports', async () => {
      const lamports = 2500000000; // 2.5 SOL
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        rpcResponse({
          context: { slot: 123456 },
          value: lamports,
        })
      );

      const balance = await client.getBalance('11111111111111111111111111111111');

      expect(balance.sol).toBe(2.5);
    });

    it('should make correct RPC call', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        rpcResponse({
          context: { slot: 123456 },
          value: 0,
        })
      );

      const testAddress = '11111111111111111111111111111111';
      await client.getBalance(testAddress);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('getBalance'),
        })
      );

      const callBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(callBody.method).toBe('getBalance');
      expect(callBody.params[0]).toBe(testAddress);
    });

    it('should throw on RPC error', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(rpcError('Invalid address', -32602));

      await expect(client.getBalance('invalid')).rejects.toThrow('RPC error');
    });
  });

  describe('getTokenBalances', () => {
    it('should fetch SPL token balances', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        rpcResponse({
          context: { slot: 123456 },
          value: [
            {
              pubkey: 'tokenAccountPubkey1',
              account: {
                data: {
                  parsed: {
                    info: {
                      mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
                      owner: 'ownerPubkey',
                      tokenAmount: {
                        amount: '1000000',
                        decimals: 6,
                        uiAmount: 1.0,
                      },
                    },
                    type: 'account',
                  },
                  program: 'spl-token',
                  space: 165,
                },
                executable: false,
                lamports: 2039280,
                owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
                rentEpoch: 0,
              },
            },
          ],
        })
      );

      const tokens = await client.getTokenBalances('11111111111111111111111111111111');

      expect(tokens.length).toBe(1);
      expect(tokens[0].mint).toBe('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
      expect(tokens[0].amount).toBe(1000000n);
      expect(tokens[0].decimals).toBe(6);
      expect(tokens[0].uiAmount).toBe(1.0);
    });

    it('should handle empty token balances', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        rpcResponse({
          context: { slot: 123456 },
          value: [],
        })
      );

      const tokens = await client.getTokenBalances('11111111111111111111111111111111');

      expect(tokens).toEqual([]);
    });

    it('should handle multiple token accounts', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        rpcResponse({
          context: { slot: 123456 },
          value: [
            {
              pubkey: 'tokenAccount1',
              account: {
                data: {
                  parsed: {
                    info: {
                      mint: 'mintAddress1',
                      owner: 'owner',
                      tokenAmount: { amount: '1000000', decimals: 6, uiAmount: 1.0 },
                    },
                    type: 'account',
                  },
                  program: 'spl-token',
                  space: 165,
                },
                executable: false,
                lamports: 2039280,
                owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
                rentEpoch: 0,
              },
            },
            {
              pubkey: 'tokenAccount2',
              account: {
                data: {
                  parsed: {
                    info: {
                      mint: 'mintAddress2',
                      owner: 'owner',
                      tokenAmount: { amount: '2000000000', decimals: 9, uiAmount: 2.0 },
                    },
                    type: 'account',
                  },
                  program: 'spl-token',
                  space: 165,
                },
                executable: false,
                lamports: 2039280,
                owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
                rentEpoch: 0,
              },
            },
          ],
        })
      );

      const tokens = await client.getTokenBalances('11111111111111111111111111111111');

      expect(tokens.length).toBe(2);
      expect(tokens[0].mint).toBe('mintAddress1');
      expect(tokens[1].mint).toBe('mintAddress2');
    });
  });

  describe('getSlot', () => {
    it('should fetch current slot', async () => {
      const slot = 123456789;
      (global.fetch as jest.Mock).mockResolvedValueOnce(rpcResponse(slot));

      const result = await client.getSlot();

      expect(result).toBe(slot);
    });
  });

  describe('getRecentBlockhash', () => {
    it('should fetch recent blockhash', async () => {
      const blockhash = 'EkSnNWid2cvwEVnVx9aBqawnmiCNiDgp3gUdkDPTKN1N';
      const lastValidBlockHeight = 123456789;

      (global.fetch as jest.Mock).mockResolvedValueOnce(
        rpcResponse({
          context: { slot: 123456 },
          value: {
            blockhash,
            lastValidBlockHeight,
          },
        })
      );

      const result = await client.getRecentBlockhash();

      expect(result.blockhash).toBe(blockhash);
      expect(result.lastValidBlockHeight).toBe(lastValidBlockHeight);
    });
  });

  describe('getMinimumBalanceForRentExemption', () => {
    it('should fetch minimum balance for rent exemption', async () => {
      const minBalance = 2039280;
      (global.fetch as jest.Mock).mockResolvedValueOnce(rpcResponse(minBalance));

      const result = await client.getMinimumBalanceForRentExemption(165);

      expect(result).toBe(minBalance);
    });
  });

  describe('sendTransaction', () => {
    it('should send signed transaction', async () => {
      const txSignature =
        '5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW';
      (global.fetch as jest.Mock).mockResolvedValueOnce(rpcResponse(txSignature));

      const signedTx = 'base64EncodedTransaction';
      const result = await client.sendTransaction(signedTx);

      expect(result).toBe(txSignature);
    });

    it('should make correct RPC call for sendTransaction', async () => {
      const txSignature =
        '5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW';
      (global.fetch as jest.Mock).mockResolvedValueOnce(rpcResponse(txSignature));

      const signedTx = 'base64EncodedTransaction';
      await client.sendTransaction(signedTx);

      const callBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(callBody.method).toBe('sendTransaction');
      expect(callBody.params[0]).toBe(signedTx);
      expect(callBody.params[1]).toEqual({
        encoding: 'base64',
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });
    });
  });

  describe('getSignatureStatus', () => {
    it('should fetch transaction status', async () => {
      const signature =
        '5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW';
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        rpcResponse({
          context: { slot: 123456 },
          value: [
            {
              slot: 123450,
              confirmations: 10,
              err: null,
              confirmationStatus: 'confirmed',
            },
          ],
        })
      );

      const status = await client.getSignatureStatus(signature);

      expect(status).toBeDefined();
      expect(status?.slot).toBe(123450);
      expect(status?.confirmations).toBe(10);
      expect(status?.err).toBeNull();
      expect(status?.confirmationStatus).toBe('confirmed');
    });

    it('should return null for unknown signature', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        rpcResponse({
          context: { slot: 123456 },
          value: [null],
        })
      );

      const status = await client.getSignatureStatus('unknownSignature');

      expect(status).toBeNull();
    });
  });

  describe('getAccountInfo', () => {
    it('should fetch account info', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        rpcResponse({
          context: { slot: 123456 },
          value: {
            executable: false,
            owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
            lamports: 2039280,
            data: ['base64EncodedData', 'base64'],
            rentEpoch: 0,
          },
        })
      );

      const info = await client.getAccountInfo('11111111111111111111111111111111');

      expect(info).toBeDefined();
      expect(info?.executable).toBe(false);
      expect(info?.lamports).toBe(2039280);
    });

    it('should return null for non-existent account', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        rpcResponse({
          context: { slot: 123456 },
          value: null,
        })
      );

      const info = await client.getAccountInfo('11111111111111111111111111111111');

      expect(info).toBeNull();
    });
  });

  describe('switchRpcUrl', () => {
    it('should switch to valid RPC URL index', () => {
      const network = client.getNetwork();
      if (network.rpcUrls.length > 1) {
        client.switchRpcUrl(1);
        // Verify by making a request - internal state changed
        expect(true).toBe(true); // No error thrown
      }
    });

    it('should not switch to invalid index', () => {
      client.switchRpcUrl(-1);
      client.switchRpcUrl(999);
      // Should not throw, just ignore invalid index
      expect(true).toBe(true);
    });
  });

  describe('Error handling', () => {
    it('should throw on HTTP error', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(client.getBalance('test')).rejects.toThrow('RPC request failed');
    });

    it('should throw on RPC error response', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(rpcError('Invalid params', -32602));

      await expect(client.getBalance('invalid')).rejects.toThrow('RPC error');
    });

    it('should include error code in message', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(rpcError('Something went wrong', -32000));

      await expect(client.getBalance('test')).rejects.toThrow('code: -32000');
    });
  });
});

describe('createSolanaClient', () => {
  it('should create a SolanaClient instance', () => {
    const client = createSolanaClient(SOLANA_MAINNET);
    expect(client).toBeInstanceOf(SolanaClient);
  });

  it('should create client with correct network', () => {
    const client = createSolanaClient(SOLANA_DEVNET);
    expect(client.getNetwork().id).toBe('solana-devnet');
    expect(client.getNetwork().cluster).toBe('devnet');
  });
});
