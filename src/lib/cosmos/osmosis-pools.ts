/**
 * Osmosis DEX Pool Fetcher
 *
 * Fetches pools from Osmosis LCD and converts to the swap-router format.
 * Supports GAMM (weighted) pools - uses constant product approximation for 2-asset pools.
 */

import type { LiquidityPool } from './swap-router';

export interface OsmosisGammPool {
  '@type': string;
  id: string;
  pool_params?: {
    swap_fee?: string;
    exit_fee?: string;
  };
  pool_assets?: Array<{
    token: { denom: string; amount: string };
    weight?: string;
  }>;
}

export interface OsmosisPoolsResponse {
  pools: OsmosisGammPool[];
}

/**
 * Fetch all pools from Osmosis LCD API
 */
export async function fetchOsmosisPools(restUrl: string): Promise<LiquidityPool[]> {
  const rest = restUrl.replace(/\/$/, '');
  const response = await fetch(`${rest}/osmosis/poolmanager/v1beta1/all-pools`);

  if (!response.ok) {
    throw new Error(`Failed to fetch Osmosis pools: ${response.statusText}`);
  }

  const data: OsmosisPoolsResponse = await response.json();
  const pools: LiquidityPool[] = [];

  for (const pool of data.pools || []) {
    // Only handle 2-asset GAMM pools (constant product approximation)
    if (!pool.pool_assets || pool.pool_assets.length !== 2) {
      continue;
    }

    const swapFee = parseFloat(pool.pool_params?.swap_fee || '0.002');
    // Keep fee as a decimal fraction for router math
    // (e.g. 0.002 = 0.2%).
    const feeFraction = Number.isFinite(swapFee) && swapFee >= 0 ? swapFee : 0.002;

    const asset0 = pool.pool_assets[0];
    const asset1 = pool.pool_assets[1];

    // Ensure consistent ordering for pool id (denom order)
    const [base, quote] =
      asset0.token.denom < asset1.token.denom
        ? [asset0.token.denom, asset1.token.denom]
        : [asset1.token.denom, asset0.token.denom];

    const [reserveBase, reserveQuote] =
      asset0.token.denom === base
        ? [asset0.token.amount, asset1.token.amount]
        : [asset1.token.amount, asset0.token.amount];

    pools.push({
      id: pool.id,
      base,
      quote,
      reserve_base: reserveBase,
      reserve_quote: reserveQuote,
      fee: feeFraction.toString(),
    });
  }

  return pools;
}
