import type { EndpointHealthPhase, WsConnState } from '@/types/network-phase';
import {
  clearAllEndpointHealth,
  fetchWithFailover,
  getEndpointHealthStatus,
} from '@/lib/networks/failover';

describe('network phase types', () => {
  it('WsConnState covers connection lifecycle', () => {
    const states: WsConnState[] = [
      { status: 'idle' },
      { status: 'connecting' },
      { status: 'open' },
      { status: 'reconnecting', attempt: 1 },
      { status: 'failed' },
      { status: 'closed' },
    ];
    expect(states.map((s) => s.status)).toEqual([
      'idle',
      'connecting',
      'open',
      'reconnecting',
      'failed',
      'closed',
    ]);
  });

  it('EndpointHealthPhase set is exhaustive for failover', () => {
    const phases: EndpointHealthPhase[] = ['healthy', 'degraded', 'unhealthy', 'recovering'];
    expect(phases).toHaveLength(4);
  });
});

describe('fetchWithFailover parse modes', () => {
  const endpoints = ['https://api.example.com'];

  beforeEach(() => {
    clearAllEndpointHealth();
    jest.restoreAllMocks();
  });

  it('parses JSON by default', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
      text: async () => '',
    }) as unknown as typeof fetch;

    await expect(fetchWithFailover(endpoints, '/x')).resolves.toEqual({ ok: true });
  });

  it('parses text when parse: text', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
      text: async () => 'deadbeef',
    }) as unknown as typeof fetch;

    await expect(
      fetchWithFailover<string>(endpoints, '/tx/abc/hex', {}, { parse: 'text' })
    ).resolves.toBe('deadbeef');

    const health = getEndpointHealthStatus(endpoints)[0];
    expect(health.phase).toBe('healthy');
    expect(health.isHealthy).toBe(true);
  });
});
