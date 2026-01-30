/**
 * Swap Router Tests
 *
 * Tests for multi-hop swap routing with BFS pathfinding
 */

import {
  findBestRoute,
  getRoutePoolIds,
  formatRoutePath,
  LiquidityPool,
} from '@/lib/cosmos/swap-router';

describe('Swap Router', () => {
  // Mock liquidity pools
  const mockPools: LiquidityPool[] = [
    {
      id: 'pool1',
      base: 'ubze',
      quote: 'uvdl',
      reserve_base: '1000000000', // 1000 BZE
      reserve_quote: '500000000', // 500 VDL
      fee: '0.003', // 0.3%
    },
    {
      id: 'pool2',
      base: 'ubze',
      quote: 'uphoton',
      reserve_base: '2000000000', // 2000 BZE
      reserve_quote: '1000000000', // 1000 PHOTON
      fee: '0.003',
    },
    {
      id: 'pool3',
      base: 'uphoton',
      quote: 'uvdl',
      reserve_base: '800000000', // 800 PHOTON
      reserve_quote: '400000000', // 400 VDL
      fee: '0.003',
    },
  ];

  describe('findBestRoute', () => {
    it('should find direct route (single hop)', () => {
      const inputAmount = BigInt(100000000); // 100 BZE
      const route = findBestRoute(mockPools, 'ubze', 'uvdl', inputAmount);

      expect(route).not.toBeNull();
      expect(route!.pools.length).toBe(1);
      expect(route!.path).toEqual(['ubze', 'uvdl']);
      expect(route!.pools[0].id).toBe('pool1');
    });

    it('should find multi-hop route when no direct pool exists', () => {
      // Remove direct pool
      const poolsWithoutDirect = mockPools.filter((p) => p.id !== 'pool1');
      const inputAmount = BigInt(100000000); // 100 BZE

      const route = findBestRoute(poolsWithoutDirect, 'ubze', 'uvdl', inputAmount);

      expect(route).not.toBeNull();
      expect(route!.pools.length).toBe(2);
      expect(route!.path).toEqual(['ubze', 'uphoton', 'uvdl']);
      expect(route!.pools[0].id).toBe('pool2');
      expect(route!.pools[1].id).toBe('pool3');
    });

    it('should choose direct route over multi-hop when direct has better output', () => {
      const inputAmount = BigInt(100000000); // 100 BZE
      const route = findBestRoute(mockPools, 'ubze', 'uvdl', inputAmount);

      expect(route).not.toBeNull();
      expect(route!.pools.length).toBe(1); // Direct route should be better
      expect(route!.path).toEqual(['ubze', 'uvdl']);
    });

    it('should return null when no route exists', () => {
      const inputAmount = BigInt(100000000);
      const route = findBestRoute(mockPools, 'ubze', 'uatom', inputAmount);

      expect(route).toBeNull();
    });

    it('should respect max hops limit', () => {
      const complexPools: LiquidityPool[] = [
        {
          id: 'p1',
          base: 'token1',
          quote: 'token2',
          reserve_base: '1000000',
          reserve_quote: '1000000',
          fee: '0.003',
        },
        {
          id: 'p2',
          base: 'token2',
          quote: 'token3',
          reserve_base: '1000000',
          reserve_quote: '1000000',
          fee: '0.003',
        },
        {
          id: 'p3',
          base: 'token3',
          quote: 'token4',
          reserve_base: '1000000',
          reserve_quote: '1000000',
          fee: '0.003',
        },
        {
          id: 'p4',
          base: 'token4',
          quote: 'token5',
          reserve_base: '1000000',
          reserve_quote: '1000000',
          fee: '0.003',
        },
      ];

      const inputAmount = BigInt(100000);
      const route = findBestRoute(complexPools, 'token1', 'token5', inputAmount, 3);

      expect(route).toBeNull(); // Should not find route because it requires 4 hops
    });

    it('should calculate output amount correctly for single hop', () => {
      const inputAmount = BigInt(100000000); // 100 BZE
      const route = findBestRoute(mockPools, 'ubze', 'uvdl', inputAmount);

      expect(route).not.toBeNull();
      expect(route!.outputAmount).toBeGreaterThan(0n);

      // Manual calculation: (100 * 0.997 * 500) / (1000 + 100 * 0.997) ≈ 45.34 VDL
      const expectedOutput = (100000000n * 9970n * 500000000n) / (1000000000n * 10000n + 100000000n * 9970n);
      expect(route!.outputAmount).toBe(expectedOutput);
    });

    it('should calculate total fee correctly for multi-hop', () => {
      const poolsWithoutDirect = mockPools.filter((p) => p.id !== 'pool1');
      const inputAmount = BigInt(100000000);
      const route = findBestRoute(poolsWithoutDirect, 'ubze', 'uvdl', inputAmount);

      expect(route).not.toBeNull();
      expect(route!.totalFee).toBeCloseTo(0.006, 6); // 0.3% + 0.3% = 0.6%
    });

    it('should calculate price impact', () => {
      const inputAmount = BigInt(100000000); // 100 BZE
      const route = findBestRoute(mockPools, 'ubze', 'uvdl', inputAmount);

      expect(route).not.toBeNull();
      expect(route!.priceImpact).toBeGreaterThan(0);
      expect(route!.priceImpact).toBeLessThan(100);
    });

    it('should handle bidirectional pools correctly', () => {
      const inputAmount = BigInt(50000000); // 50 VDL
      const route = findBestRoute(mockPools, 'uvdl', 'ubze', inputAmount);

      expect(route).not.toBeNull();
      expect(route!.path[0]).toBe('uvdl');
      expect(route!.path[route!.path.length - 1]).toBe('ubze');
      expect(route!.outputAmount).toBeGreaterThan(0n);
    });
  });

  describe('getRoutePoolIds', () => {
    it('should return pool IDs in correct order', () => {
      const inputAmount = BigInt(100000000);
      const route = findBestRoute(mockPools, 'ubze', 'uvdl', inputAmount);

      expect(route).not.toBeNull();
      const poolIds = getRoutePoolIds(route!);

      expect(poolIds).toEqual(['pool1']);
    });

    it('should return multiple pool IDs for multi-hop route', () => {
      const poolsWithoutDirect = mockPools.filter((p) => p.id !== 'pool1');
      const inputAmount = BigInt(100000000);
      const route = findBestRoute(poolsWithoutDirect, 'ubze', 'uvdl', inputAmount);

      expect(route).not.toBeNull();
      const poolIds = getRoutePoolIds(route!);

      expect(poolIds).toEqual(['pool2', 'pool3']);
    });
  });

  describe('formatRoutePath', () => {
    it('should format route path with token symbols', () => {
      const inputAmount = BigInt(100000000);
      const route = findBestRoute(mockPools, 'ubze', 'uvdl', inputAmount);

      const tokenSymbols = new Map([
        ['ubze', 'BZE'],
        ['uvdl', 'VDL'],
        ['uphoton', 'PHOTON'],
      ]);

      const formatted = formatRoutePath(route!, tokenSymbols);
      expect(formatted).toBe('BZE → VDL');
    });

    it('should format multi-hop route path', () => {
      const poolsWithoutDirect = mockPools.filter((p) => p.id !== 'pool1');
      const inputAmount = BigInt(100000000);
      const route = findBestRoute(poolsWithoutDirect, 'ubze', 'uvdl', inputAmount);

      const tokenSymbols = new Map([
        ['ubze', 'BZE'],
        ['uvdl', 'VDL'],
        ['uphoton', 'PHOTON'],
      ]);

      const formatted = formatRoutePath(route!, tokenSymbols);
      expect(formatted).toBe('BZE → PHOTON → VDL');
    });

    it('should use denom as fallback when symbol not found', () => {
      const inputAmount = BigInt(100000000);
      const route = findBestRoute(mockPools, 'ubze', 'uvdl', inputAmount);

      const tokenSymbols = new Map([['ubze', 'BZE']]);

      const formatted = formatRoutePath(route!, tokenSymbols);
      expect(formatted).toBe('BZE → uvdl');
    });
  });
});
