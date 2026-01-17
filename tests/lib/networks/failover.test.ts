/**
 * Failover Utility Tests
 * 
 * Tests for endpoint failover, retry logic, and health tracking
 */

import {
  fetchWithFailover,
  withFailover,
  getHealthyEndpoint,
  getSortedEndpoints,
  resetEndpointHealth,
  getEndpointHealthStatus,
  clearAllEndpointHealth,
} from '@/lib/networks/failover';
import { mockFetchResponse, mockFetchError, mockFetchSequence } from '../../setup';

describe('Failover Utility', () => {
  beforeEach(() => {
    clearAllEndpointHealth();
    jest.clearAllMocks();
  });

  describe('fetchWithFailover', () => {
    const endpoints = [
      'https://api1.example.com',
      'https://api2.example.com',
      'https://api3.example.com',
    ];

    it('should succeed with first endpoint when healthy', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        mockFetchResponse({ data: 'success' })
      );

      const result = await fetchWithFailover<{ data: string }>(endpoints, '/test');

      expect(result).toEqual({ data: 'success' });
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api1.example.com/test',
        expect.any(Object)
      );
    });

    it('should failover to second endpoint when first fails with server error', async () => {
      mockFetchSequence([
        { error: 'Server error: 503' },
        { error: 'Server error: 503' },
        { error: 'Server error: 503' },
        { data: { data: 'from second' } },
      ]);

      const result = await fetchWithFailover<{ data: string }>(
        endpoints,
        '/test',
        {},
        { maxRetries: 2 }
      );

      expect(result).toEqual({ data: 'from second' });
      // 3 retries on first endpoint + 1 success on second
      expect(global.fetch).toHaveBeenCalledTimes(4);
    });

    it('should failover through all endpoints until one succeeds', async () => {
      // With maxRetries: 0, each endpoint is tried once
      // We have 3 endpoints, so we need 2 failures + 1 success
      mockFetchSequence([
        { error: 'timeout' }, // endpoint 1 fails
        { error: 'timeout' }, // endpoint 2 fails
        { data: { data: 'from third' } }, // endpoint 3 succeeds
      ]);

      const result = await fetchWithFailover<{ data: string }>(
        endpoints,
        '/test',
        {},
        { maxRetries: 0, retryDelayMs: 10 } // No retries, just failover
      );

      expect(result).toEqual({ data: 'from third' });
    }, 10000);

    it('should throw error when all endpoints fail', async () => {
      mockFetchSequence([
        { error: 'timeout' },
        { error: 'timeout' },
        { error: 'timeout' },
        { error: 'timeout' },
        { error: 'timeout' },
        { error: 'timeout' },
        { error: 'timeout' },
        { error: 'timeout' },
        { error: 'timeout' },
      ]);

      await expect(
        fetchWithFailover(endpoints, '/test', {}, { maxRetries: 2, retryDelayMs: 10 })
      ).rejects.toThrow('All endpoints failed');
    }, 15000);

    it('should not failover on client errors (4xx)', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: () => Promise.resolve('Not found'),
      });

      await expect(
        fetchWithFailover(endpoints, '/test')
      ).rejects.toThrow('Request failed: 404');

      // Should only try first endpoint for client errors
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should failover on server errors (5xx)', async () => {
      mockFetchSequence([
        { ok: false, status: 503, data: 'Service unavailable' },
        { ok: false, status: 503, data: 'Service unavailable' },
        { ok: false, status: 503, data: 'Service unavailable' },
        { data: { success: true } },
      ]);

      const result = await fetchWithFailover<{ success: boolean }>(
        endpoints,
        '/test',
        {},
        { maxRetries: 2 }
      );

      expect(result).toEqual({ success: true });
    });

    it('should include path in request URL', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        mockFetchResponse({ data: 'test' })
      );

      await fetchWithFailover(endpoints, '/api/v1/resource');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api1.example.com/api/v1/resource',
        expect.any(Object)
      );
    });

    it('should use full URL if path starts with http', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        mockFetchResponse({ data: 'test' })
      );

      await fetchWithFailover(endpoints, 'https://custom.example.com/special');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://custom.example.com/special',
        expect.any(Object)
      );
    });

    it('should pass request options to fetch', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        mockFetchResponse({ data: 'test' })
      );

      await fetchWithFailover(
        endpoints,
        '/test',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ foo: 'bar' }),
        }
      );

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ foo: 'bar' }),
        })
      );
    });
  });

  describe('withFailover', () => {
    const endpoints = ['endpoint1', 'endpoint2', 'endpoint3'];

    it('should execute operation with first endpoint', async () => {
      const operation = jest.fn().mockResolvedValue('success');

      const { result, endpoint } = await withFailover(endpoints, operation);

      expect(result).toBe('success');
      expect(endpoint).toBe('endpoint1');
      expect(operation).toHaveBeenCalledWith('endpoint1');
    });

    it('should failover when operation throws', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('timeout'))
        .mockRejectedValueOnce(new Error('timeout'))
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValueOnce('success from second');

      const { result, endpoint } = await withFailover(
        endpoints,
        operation,
        { maxRetries: 2 }
      );

      expect(result).toBe('success from second');
      expect(endpoint).toBe('endpoint2');
    });

    it('should throw when all endpoints fail with server errors', async () => {
      // Use timeout errors which are recognized as server errors
      const operation = jest.fn().mockRejectedValue(new Error('timeout'));

      await expect(
        withFailover(endpoints, operation, { maxRetries: 0, retryDelayMs: 10 })
      ).rejects.toThrow('All endpoints failed');
    }, 10000);

    it('should throw immediately for non-server errors', async () => {
      // Non-server errors (like validation) should not trigger failover
      const operation = jest.fn().mockRejectedValue(new Error('Invalid input'));

      await expect(
        withFailover(endpoints, operation, { maxRetries: 0 })
      ).rejects.toThrow('Invalid input');
    });

    it('should return the successful endpoint', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('timeout'))
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValueOnce('data');

      const { result, endpoint } = await withFailover(
        endpoints,
        operation,
        { maxRetries: 0, retryDelayMs: 10 }
      );

      expect(endpoint).toBe('endpoint3');
    });
  });

  describe('Endpoint Health Tracking', () => {
    const endpoints = [
      'https://healthy.example.com',
      'https://unhealthy.example.com',
    ];

    it('should mark endpoint as healthy after success', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        mockFetchResponse({ data: 'success' })
      );

      await fetchWithFailover(endpoints, '/test');

      const health = getEndpointHealthStatus(endpoints);
      expect(health[0].isHealthy).toBe(true);
      expect(health[0].consecutiveFailures).toBe(0);
    });

    it('should increment failure count on failures', async () => {
      mockFetchSequence([
        { error: 'timeout' },
        { data: { success: true } },
      ]);

      await fetchWithFailover(endpoints, '/test', {}, { maxRetries: 0 });

      const health = getEndpointHealthStatus(endpoints);
      expect(health[0].consecutiveFailures).toBe(1);
    });

    it('should mark endpoint unhealthy after threshold', async () => {
      // Fail first endpoint multiple times
      mockFetchSequence([
        { error: 'timeout' },
        { error: 'timeout' },
        { error: 'timeout' },
        { data: { success: true } },
      ]);

      await fetchWithFailover(
        endpoints,
        '/test',
        {},
        { maxRetries: 2, failureThreshold: 3 }
      );

      const health = getEndpointHealthStatus(endpoints);
      expect(health[0].isHealthy).toBe(false);
      expect(health[0].consecutiveFailures).toBe(3);
    });

    it('should reset health status with resetEndpointHealth', async () => {
      // First make an endpoint unhealthy
      mockFetchSequence([
        { error: 'timeout' },
        { error: 'timeout' },
        { error: 'timeout' },
        { data: { success: true } },
      ]);

      await fetchWithFailover(
        endpoints,
        '/test',
        {},
        { maxRetries: 2, failureThreshold: 3 }
      );

      // Reset health
      resetEndpointHealth(endpoints);

      const health = getEndpointHealthStatus(endpoints);
      expect(health[0].isHealthy).toBe(true);
      expect(health[0].consecutiveFailures).toBe(0);
    });
  });

  describe('getSortedEndpoints', () => {
    it('should return endpoints in original order when all healthy', () => {
      const endpoints = ['a', 'b', 'c'];
      const sorted = getSortedEndpoints(endpoints);
      expect(sorted).toEqual(['a', 'b', 'c']);
    });

    it('should prefer healthy endpoints', async () => {
      const endpoints = ['unhealthy', 'healthy'];

      // Make first endpoint unhealthy by triggering timeout errors
      mockFetchSequence([
        { error: 'timeout' },
        { error: 'timeout' },
        { error: 'timeout' },
        { data: {} },
      ]);

      await fetchWithFailover(
        endpoints,
        '/test',
        {},
        { maxRetries: 2, failureThreshold: 3, retryDelayMs: 10 }
      );

      const sorted = getSortedEndpoints(endpoints);
      expect(sorted[0]).toBe('healthy');
    });
  });

  describe('getHealthyEndpoint', () => {
    it('should return first healthy endpoint', () => {
      const endpoints = ['a', 'b', 'c'];
      expect(getHealthyEndpoint(endpoints)).toBe('a');
    });

    it('should return first endpoint when none are tracked', () => {
      clearAllEndpointHealth();
      const endpoints = ['x', 'y', 'z'];
      expect(getHealthyEndpoint(endpoints)).toBe('x');
    });

    it('should return null for empty array', () => {
      expect(getHealthyEndpoint([])).toBe(null);
    });
  });

  describe('clearAllEndpointHealth', () => {
    it('should clear all health data', async () => {
      const endpoints = ['a', 'b'];
      
      // Record some health data
      mockFetchSequence([{ data: {} }]);
      await fetchWithFailover(endpoints, '/test');

      // Clear
      clearAllEndpointHealth();

      // Should start fresh
      const health = getEndpointHealthStatus(endpoints);
      expect(health[0].lastSuccess).toBeUndefined();
    });
  });
});
