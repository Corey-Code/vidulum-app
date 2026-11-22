export const VDL_CHAIN_ID = 'beezee-1';
export const VDL_DENOM = 'factory/bze13gzq40che93tgfm9kzmkpjamah5nj0j73pyhqk/uvdl';
/** CryptoTrtl factory denom on BeeZee — same denom used by DenomReward / tradebin. */
export const CTL_DENOM = 'factory/bze1972aqfzdg29ugjln74edx0xvcg4ehvysjptk77/CTL';

export const VDL_SWAP_TITLE = 'Buy / Sell VDL';
export const CTL_SWAP_TITLE = 'Buy / Sell CTL';

/**
 * @skip-go/client appends `/v2/...` to this origin.
 * Skip allows browser CORS, so the wallet calls it directly.
 * Do not add `/v2` here, and do not point this at a hostname with no DNS record.
 */
export const SKIP_GO_API_URL = 'https://api.skip.build';

export type BeezeeSwapAssetId = 'vdl' | 'ctl';
export type VdlSwapMode = 'buy' | 'sell';

export interface SkipDefaultRoute {
  srcChainId?: string;
  srcAssetDenom?: string;
  destChainId?: string;
  destAssetDenom?: string;
  srcLocked?: boolean;
  destLocked?: boolean;
}

export interface SkipAssetFilter {
  source?: Record<string, string[] | undefined>;
  destination?: Record<string, string[] | undefined>;
}

export interface VdlSwapConfig {
  defaultRoute: SkipDefaultRoute;
  filter: SkipAssetFilter;
  filterOut: SkipAssetFilter;
}

export interface BeezeeSwapAsset {
  id: BeezeeSwapAssetId;
  symbol: 'VDL' | 'CTL';
  denom: string;
  title: string;
}

const ASSETS: Record<BeezeeSwapAssetId, BeezeeSwapAsset> = {
  vdl: {
    id: 'vdl',
    symbol: 'VDL',
    denom: VDL_DENOM,
    title: VDL_SWAP_TITLE,
  },
  ctl: {
    id: 'ctl',
    symbol: 'CTL',
    denom: CTL_DENOM,
    title: CTL_SWAP_TITLE,
  },
};

export function beezeeSwapAsset(id: BeezeeSwapAssetId): BeezeeSwapAsset {
  return ASSETS[id];
}

/**
 * Skip indexes BeeZee CTL metadata but (as of 2026-11) has no BeeZee/tradebin venue
 * and no Osmosis pool path that yields CTL quotes. VDL still routes via Osmosis.
 * Callers may fall back to the in-app BeeZee tradebin SwapModal for CTL.
 */
export function skipCanQuoteBeezeeAsset(id: BeezeeSwapAssetId): boolean {
  switch (id) {
    case 'vdl':
      return true;
    case 'ctl':
      return false;
    default: {
      const unreachable: never = id;
      return unreachable;
    }
  }
}

export function beezeeSwapCopy(assetId: BeezeeSwapAssetId, mode: VdlSwapMode): string {
  const { symbol } = beezeeSwapAsset(assetId);
  switch (mode) {
    case 'buy':
      return `Pay with any asset. Receive ${symbol}.`;
    case 'sell':
      return `Pay with ${symbol}. Receive any asset.`;
    default: {
      const unreachable: never = mode;
      return unreachable;
    }
  }
}

export function beezeeSwapConfig(assetId: BeezeeSwapAssetId, mode: VdlSwapMode): VdlSwapConfig {
  const { denom } = beezeeSwapAsset(assetId);
  const assetOnly: Record<string, string[] | undefined> = {
    [VDL_CHAIN_ID]: [denom],
  };

  switch (mode) {
    case 'buy':
      return {
        defaultRoute: {
          destChainId: VDL_CHAIN_ID,
          destAssetDenom: denom,
          destLocked: true,
        },
        filter: { destination: assetOnly },
        filterOut: { source: assetOnly },
      };
    case 'sell':
      return {
        defaultRoute: {
          srcChainId: VDL_CHAIN_ID,
          srcAssetDenom: denom,
          srcLocked: true,
        },
        filter: { source: assetOnly },
        filterOut: { destination: assetOnly },
      };
    default: {
      const unreachable: never = mode;
      return unreachable;
    }
  }
}

/** @deprecated Prefer beezeeSwapCopy('vdl', mode) */
export function vdlSwapCopy(mode: VdlSwapMode): string {
  return beezeeSwapCopy('vdl', mode);
}

/** @deprecated Prefer beezeeSwapConfig('vdl', mode) */
export function vdlSwapConfig(mode: VdlSwapMode): VdlSwapConfig {
  return beezeeSwapConfig('vdl', mode);
}
