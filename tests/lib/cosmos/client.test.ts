/**
 * Cosmos Client Tests
 *
 * Tests for Cosmos SDK API client with failover
 */

import { cosmosClient } from '@/lib/cosmos/client';
import { mockFetchResponse } from '../../setup';

describe('Cosmos Client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getBalance', () => {
    const rpcUrl = 'https://rpc.example.com';
    const restUrl = 'https://rest.example.com';
    const testAddress = 'bze1abc123def456';

    it('should fetch balances from REST endpoint', async () => {
      const mockBalances = {
        balances: [
          { denom: 'ubze', amount: '1000000' },
          { denom: 'factory/bze13gzq40che93tgfm9kzmkpjamah5nj0j73pyhqk/uvdl', amount: '500000' },
        ],
        pagination: { next_key: null, total: '2' },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(mockFetchResponse(mockBalances));

      const balances = await cosmosClient.getBalance(rpcUrl, testAddress, restUrl);

      expect(balances.length).toBe(2);
      expect(balances[0].denom).toBe('ubze');
      expect(balances[0].amount).toBe('1000000');
    });

    it('should return empty array for zero balances', async () => {
      const mockBalances = {
        balances: [],
        pagination: { next_key: null, total: '0' },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(mockFetchResponse(mockBalances));

      const balances = await cosmosClient.getBalance(rpcUrl, testAddress, restUrl);

      expect(balances).toEqual([]);
    });

    it('should detect IBC tokens in balances', async () => {
      const mockBalances = {
        balances: [
          { denom: 'ubze', amount: '1000000' },
          {
            denom: 'ibc/6490A7EAB61059BFC1CDDEB05917DD70BDF3A611654162A1A47DB930D40D8AF4',
            amount: '500000',
          },
        ],
        pagination: { next_key: null },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(mockFetchResponse(mockBalances));

      const balances = await cosmosClient.getBalance(rpcUrl, testAddress, restUrl);

      const ibcToken = balances.find((b) => b.denom.startsWith('ibc/'));
      expect(ibcToken).toBeDefined();
    });

    it('should detect factory tokens in balances', async () => {
      const mockBalances = {
        balances: [
          { denom: 'ubze', amount: '1000000' },
          { denom: 'factory/bze13gzq40che93tgfm9kzmkpjamah5nj0j73pyhqk/uvdl', amount: '500000' },
        ],
        pagination: { next_key: null },
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce(mockFetchResponse(mockBalances));

      const balances = await cosmosClient.getBalance(rpcUrl, testAddress, restUrl);

      const factoryToken = balances.find((b) => b.denom.startsWith('factory/'));
      expect(factoryToken).toBeDefined();
    });
  });

  describe('disconnect', () => {
    it('should disconnect without error', () => {
      // This tests that disconnect doesn't throw
      expect(() => cosmosClient.disconnect('https://rpc.example.com')).not.toThrow();
    });
  });

  describe('disconnectAll', () => {
    it('should disconnect all clients without error', () => {
      expect(() => cosmosClient.disconnectAll()).not.toThrow();
    });
  });
});
