/**
 * tm2 ABCI balance client tests
 */

import {
  parseBankBalancesData,
  parseCoinString,
  Tm2Client,
} from '@/lib/tm2';
import { GNOLAND_MAINNET } from '@/lib/networks';

describe('tm2 coin parsing', () => {
  it('parses a single coin string', () => {
    expect(parseCoinString('5692902826497ugnot')).toEqual({
      amount: '5692902826497',
      denom: 'ugnot',
    });
  });

  it('rejects empty or invalid coin strings', () => {
    expect(parseCoinString('')).toBeNull();
    expect(parseCoinString('ugnot')).toBeNull();
    expect(parseCoinString('123')).toBeNull();
  });

  it('parses empty ABCI bank/balances payload', () => {
    expect(parseBankBalancesData('""')).toEqual([]);
    expect(parseBankBalancesData('null')).toEqual([]);
    expect(parseBankBalancesData('')).toEqual([]);
  });

  it('parses a single-coin amino JSON string', () => {
    expect(parseBankBalancesData('"5692902826497ugnot"')).toEqual([
      { amount: '5692902826497', denom: 'ugnot' },
    ]);
  });

  it('parses multi-coin comma-separated string', () => {
    expect(parseBankBalancesData('"10ugnot,5foo"')).toEqual([
      { amount: '10', denom: 'ugnot' },
      { amount: '5', denom: 'foo' },
    ]);
  });

  it('parses a JSON array of coins', () => {
    expect(
      parseBankBalancesData(JSON.stringify([{ denom: 'ugnot', amount: '42' }]))
    ).toEqual([{ denom: 'ugnot', amount: '42' }]);
  });
});

describe('Tm2Client.getBalances', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('queries bank/balances via abci_query and returns coins', async () => {
    const payload = Buffer.from('"123ugnot"').toString('base64');
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        jsonrpc: '2.0',
        id: 1,
        result: {
          response: {
            ResponseBase: { Error: null, Data: payload, Log: '', Info: '' },
          },
        },
      }),
    }) as unknown as typeof fetch;

    const client = new Tm2Client(GNOLAND_MAINNET);
    const coins = await client.getBalances('g1ct00m8t88chjcfaysafhsk9fdz43qyr9d2tccd');
    expect(coins).toEqual([{ amount: '123', denom: 'ugnot' }]);

    expect(global.fetch).toHaveBeenCalledWith(
      'https://rpc.gno.land',
      expect.objectContaining({
        method: 'POST',
      })
    );
    const body = JSON.parse(
      (global.fetch as jest.Mock).mock.calls[0][1].body as string
    );
    expect(body.method).toBe('abci_query');
    expect(body.params.path).toBe(
      'bank/balances/g1ct00m8t88chjcfaysafhsk9fdz43qyr9d2tccd'
    );
  });

  it('returns zero native balance when account has no coins', async () => {
    const payload = Buffer.from('""').toString('base64');
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        jsonrpc: '2.0',
        id: 1,
        result: {
          response: {
            ResponseBase: { Error: null, Data: payload },
          },
        },
      }),
    }) as unknown as typeof fetch;

    const client = new Tm2Client(GNOLAND_MAINNET);
    const native = await client.getNativeBalance('g19rl4cm2hmr8afy4kldpxz3fka4jguq0a0u3773');
    expect(native).toEqual({ denom: 'ugnot', amount: '0' });
  });
});
