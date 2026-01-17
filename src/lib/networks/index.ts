/**
 * Networks Module
 * 
 * Central export point for all network-related functionality.
 */

// Types
export type {
  NetworkType,
  BaseNetworkConfig,
  CosmosNetworkConfig,
  BitcoinNetworkConfig,
  EvmNetworkConfig,
  NetworkConfig,
  EndpointHealth,
} from './types';

// Network configurations
export {
  BEEZEE_MAINNET,
  BEEZEE_TESTNET,
  OSMOSIS_MAINNET,
  ATOMONE_MAINNET,
  COSMOS_NETWORKS,
} from './cosmos';

export {
  BITCOIN_MAINNET,
  BITCOIN_TESTNET,
  BITCOIN_NETWORKS,
} from './bitcoin';

export {
  ETHEREUM_MAINNET,
  BNB_MAINNET,
  BASE_MAINNET,
  BASE_SEPOLIA,
  EVM_NETWORKS,
} from './evm';

// Registry and helpers
export {
  networkRegistry,
  getExplorerAccountUrl,
  getExplorerTxUrl,
  isCosmosNetwork,
  isBitcoinNetwork,
  isEvmNetwork,
  getUINetworks,
} from './registry';

// Failover utilities
export {
  fetchWithFailover,
  withFailover,
  getHealthyEndpoint,
  getSortedEndpoints,
  resetEndpointHealth,
  getEndpointHealthStatus,
  clearAllEndpointHealth,
  type FailoverConfig,
} from './failover';
