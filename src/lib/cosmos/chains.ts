import { ChainInfo } from '@/types/wallet';
import {
  networkRegistry,
  CosmosNetworkConfig,
  getUINetworks,
  isCosmosNetwork,
  getHealthyEndpoint,
} from '@/lib/networks';

/**
 * Convert CosmosNetworkConfig to ChainInfo for backward compatibility
 * Uses the first healthy endpoint from each array
 */
function cosmosConfigToChainInfo(config: CosmosNetworkConfig): ChainInfo {
  // Get the first healthy endpoint or fall back to first in array
  const rpc = getHealthyEndpoint(config.rpc) || config.rpc[0];
  const rest = getHealthyEndpoint(config.rest) || config.rest[0];
  
  return {
    chainId: config.id,
    chainName: config.name,
    rpc,
    rest,
    bip44: {
      coinType: config.coinType,
    },
    bech32Config: {
      bech32PrefixAccAddr: config.bech32Prefix,
      bech32PrefixAccPub: config.bech32Prefix + 'pub',
      bech32PrefixValAddr: config.bech32Prefix + 'valoper',
      bech32PrefixValPub: config.bech32Prefix + 'valoperpub',
      bech32PrefixConsAddr: config.bech32Prefix + 'valcons',
      bech32PrefixConsPub: config.bech32Prefix + 'valconspub',
    },
    currencies: [
      {
        coinDenom: config.symbol,
        coinMinimalDenom: config.feeDenom,
        coinDecimals: config.decimals,
      },
    ],
    feeCurrencies: [
      {
        coinDenom: config.symbol,
        coinMinimalDenom: config.feeDenom,
        coinDecimals: config.decimals,
      },
    ],
    stakeCurrency: {
      coinDenom: config.symbol,
      coinMinimalDenom: config.feeDenom,
      coinDecimals: config.decimals,
    },
    coinType: config.coinType,
    features: config.features,
  };
}

// Legacy exports for backward compatibility
export const BZE_MAINNET: ChainInfo = cosmosConfigToChainInfo(
  networkRegistry.getCosmos('beezee-1')!
);

export const BZE_TESTNET: ChainInfo = cosmosConfigToChainInfo(
  networkRegistry.getCosmos('bzetestnet-2')!
);

// Osmosis is disabled but we keep the export for code that might reference it
export const OSMOSIS_MAINNET: ChainInfo = cosmosConfigToChainInfo(
  networkRegistry.getCosmos('osmosis-1')!
);

// Build SUPPORTED_CHAINS from enabled Cosmos networks only
export const SUPPORTED_CHAINS = new Map<string, ChainInfo>(
  networkRegistry
    .getByType('cosmos')
    .filter(c => c.enabled)
    .map(config => [config.id, cosmosConfigToChainInfo(config)])
);

// UI_CHAINS now includes all enabled networks (Cosmos and non-Cosmos)
// For Cosmos chains, we include the prefix; for others, prefix is undefined
export const UI_CHAINS = getUINetworks();

export const getChainInfo = (chainId: string): ChainInfo | undefined => {
  // First check the enabled chains
  const enabled = SUPPORTED_CHAINS.get(chainId);
  if (enabled) return enabled;
  
  // Fall back to registry for disabled chains (for reference)
  const config = networkRegistry.getCosmos(chainId);
  return config ? cosmosConfigToChainInfo(config) : undefined;
};

/**
 * Check if a network ID is a Cosmos chain
 */
export function isCosmosChain(networkId: string): boolean {
  const network = networkRegistry.get(networkId);
  return network ? isCosmosNetwork(network) : false;
}

/**
 * Get the network type for a given network ID
 */
export function getNetworkType(networkId: string): 'cosmos' | 'bitcoin' | 'evm' | undefined {
  return networkRegistry.get(networkId)?.type;
}
