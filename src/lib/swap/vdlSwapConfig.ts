export const VDL_CHAIN_ID = 'beezee-1';
export const VDL_DENOM = 'factory/bze13gzq40che93tgfm9kzmkpjamah5nj0j73pyhqk/uvdl';
export const VDL_SWAP_TITLE = 'Buy / Sell VDL';

/**
 * @skip-go/client appends `/v2/...` to this origin.
 * Skip allows browser CORS, so the wallet calls it directly.
 * Do not add `/v2` here, and do not point this at a hostname with no DNS record.
 */
export const SKIP_GO_API_URL = 'https://api.skip.build';

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

const vdlOnly: Record<string, string[] | undefined> = {
  [VDL_CHAIN_ID]: [VDL_DENOM],
};

export function vdlSwapCopy(mode: VdlSwapMode): string {
  switch (mode) {
    case 'buy':
      return 'Pay with any asset. Receive VDL.';
    case 'sell':
      return 'Pay with VDL. Receive any asset.';
    default: {
      const unreachable: never = mode;
      return unreachable;
    }
  }
}

export function vdlSwapConfig(mode: VdlSwapMode): VdlSwapConfig {
  switch (mode) {
    case 'buy':
      return {
        defaultRoute: {
          destChainId: VDL_CHAIN_ID,
          destAssetDenom: VDL_DENOM,
          destLocked: true,
        },
        filter: { destination: vdlOnly },
        filterOut: { source: vdlOnly },
      };
    case 'sell':
      return {
        defaultRoute: {
          srcChainId: VDL_CHAIN_ID,
          srcAssetDenom: VDL_DENOM,
          srcLocked: true,
        },
        filter: { source: vdlOnly },
        filterOut: { destination: vdlOnly },
      };
    default: {
      const unreachable: never = mode;
      return unreachable;
    }
  }
}
