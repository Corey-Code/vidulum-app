/**
 * Tendermint2 (tm2) RPC client — ABCI balance queries for Gno.land.
 *
 * Uses raw JSON-RPC abci_query (no @gnolang/tm2-js-client) to avoid
 * pulling CosmJS 0.39 into the CosmJS 0.32 wallet tree.
 */

import type { Tm2NetworkConfig } from '../networks/types';
import { networkRegistry } from '../networks/registry';

export interface Tm2Coin {
  denom: string;
  amount: string;
}

interface AbciQueryResponseBase {
  Error?: unknown;
  Data?: string | null;
  Log?: string;
}

interface AbciQueryResult {
  response: {
    ResponseBase?: AbciQueryResponseBase;
    value?: string | null;
    Key?: string | null;
    Height?: string;
  };
}

interface JsonRpcResponse<T> {
  jsonrpc: string;
  id: number | string;
  result?: T;
  error?: { code: number; message: string; data?: string };
}

/**
 * Parse a single Cosm/tm2 coin string such as `5692902826497ugnot`.
 */
export function parseCoinString(coin: string): Tm2Coin | null {
  const trimmed = coin.trim();
  if (!trimmed) return null;
  const match = /^(\d+)([a-zA-Z][a-zA-Z0-9/:._-]*)$/.exec(trimmed);
  if (!match) return null;
  return { amount: match[1], denom: match[2] };
}

/**
 * Parse ABCI bank/balances payload.
 * Gno returns amino JSON: `""` when empty, or `"123ugnot"` / `"1ugnot,2foo"`.
 * Also accepts a JSON array of `{denom,amount}` for forward compatibility.
 */
export function parseBankBalancesData(decodedUtf8: string): Tm2Coin[] {
  const text = decodedUtf8.trim();
  if (!text || text === 'null') return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Raw coin string without JSON quotes
    const single = parseCoinString(text);
    return single ? [single] : [];
  }

  if (parsed === null || parsed === '') return [];

  if (typeof parsed === 'string') {
    if (!parsed) return [];
    return parsed
      .split(',')
      .map((part) => parseCoinString(part))
      .filter((c): c is Tm2Coin => c !== null);
  }

  if (Array.isArray(parsed)) {
    return parsed
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const denom = (item as { denom?: unknown }).denom;
        const amount = (item as { amount?: unknown }).amount;
        if (typeof denom !== 'string' || (typeof amount !== 'string' && typeof amount !== 'number')) {
          return null;
        }
        return { denom, amount: String(amount) };
      })
      .filter((c): c is Tm2Coin => c !== null);
  }

  return [];
}

function decodeAbciData(data: string | null | undefined): string {
  if (!data) return '';
  if (typeof atob === 'function') {
    try {
      return atob(data);
    } catch {
      // fall through
    }
  }
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(data, 'base64').toString('utf8');
  }
  throw new Error('Unable to decode ABCI base64 data');
}

export class Tm2Client {
  private rpcUrl: string;
  private network: Tm2NetworkConfig;

  constructor(network: Tm2NetworkConfig, rpcUrl?: string) {
    this.network = network;
    this.rpcUrl = rpcUrl || network.rpcUrls[0];
  }

  private async abciQuery(path: string): Promise<string> {
    const response = await fetch(this.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'abci_query',
        params: {
          path,
          data: '',
          prove: false,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`tm2 RPC HTTP ${response.status}`);
    }

    const payload = (await response.json()) as JsonRpcResponse<AbciQueryResult>;
    if (payload.error) {
      throw new Error(`tm2 RPC error: ${payload.error.message}`);
    }

    const responseBase = payload.result?.response?.ResponseBase;
    if (responseBase?.Error) {
      const errMsg =
        typeof responseBase.Error === 'string'
          ? responseBase.Error
          : JSON.stringify(responseBase.Error);
      throw new Error(`tm2 ABCI error: ${errMsg || responseBase.Log || 'unknown'}`);
    }

    const data = responseBase?.Data ?? payload.result?.response?.value ?? null;
    return decodeAbciData(data);
  }

  /**
   * Query all bank balances for an address via ABCI `bank/balances/{addr}`.
   */
  async getBalances(address: string): Promise<Tm2Coin[]> {
    const decoded = await this.abciQuery(`bank/balances/${address}`);
    return parseBankBalancesData(decoded);
  }

  /**
   * Native fee-denom balance (ugnot on Gno.land). Missing denom → `"0"`.
   */
  async getNativeBalance(address: string): Promise<Tm2Coin> {
    const denom = this.network.feeDenom;
    const coins = await this.getBalances(address);
    const hit = coins.find((c) => c.denom === denom);
    return hit ?? { denom, amount: '0' };
  }
}

const clientCache = new Map<string, Tm2Client>();

export function getTm2Client(networkId: string): Tm2Client {
  const existing = clientCache.get(networkId);
  if (existing) return existing;

  const network = networkRegistry.getTm2(networkId);
  if (!network) {
    throw new Error(`tm2 network ${networkId} not found`);
  }
  const client = new Tm2Client(network);
  clientCache.set(networkId, client);
  return client;
}

export function clearTm2ClientCache(): void {
  clientCache.clear();
}
