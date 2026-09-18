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
  SvmNetworkConfig,
  NetworkConfig,
  EndpointHealth,
} from './types';

// Network configurations (manual overrides only - most come from auto-generated registries)
export { BEEZEE_TESTNET, COSMOS_NETWORKS } from './cosmos';

export { BITCOIN_MAINNET, BITCOIN_TESTNET, BITCOIN_NETWORKS } from './bitcoin';

export { EVM_NETWORKS } from './evm';

// SVM (Solana) Networks
export {
  SVM_NETWORKS,
  SOLANA_MAINNET,
  SOLANA_DEVNET,
  SOLANA_TESTNET,
  ECLIPSE_MAINNET,
  getSvmNetworkById,
  getEnabledSvmNetworks,
} from './solana';

export {
  SUPPORTED_NETWORK_CATALOG,
  SUPPORTED_NETWORK_CATALOG_REVIEWED_AT,
  DEPRECATED_SVM_ENDPOINT_HOSTS,
  getSupportedNetworkFamilyLabel,
  getSupportedNetworkFamilySummary,
  getSupportedNetworksByFamily,
  formatCatalogReviewMonth,
  type SupportedNetworkFamily,
  type SupportedNetworkEntry,
} from './supported-catalog';

export {
  DEPRECATED_UTXO_ENDPOINT_HOSTS,
  INCOMPATIBLE_UTXO_API_HOSTS,
  ESPLORA_UTXO_NETWORK_IDS,
  utxoEndpointHaystack,
  usesDeprecatedUtxoHost,
  usesIncompatibleUtxoApiHost,
} from './utxo-endpoints';

export {
  DEPRECATED_EVM_ENDPOINT_HOSTS,
  evmEndpointHaystack,
  usesDeprecatedEvmHost,
  filterPublicEvmRpcUrls,
  selectPublicEvmExplorer,
  type EvmExplorerCandidate,
} from './evm-endpoints';

// EVM Registry (auto-generated from ethereum-lists/chains)
export {
  EVM_REGISTRY_CHAINS,
  getEvmChainById,
  getEvmChainByShortName,
  getEvmChainByInternalId,
  getEnabledEvmChains,
  getMainnetEvmChains,
  getTestnetEvmChains,
  type EvmRegistryConfig,
} from './evm-registry';

// Registry and helpers
export {
  networkRegistry,
  getExplorerAccountUrl,
  getExplorerTxUrl,
  isCosmosNetwork,
  isBitcoinNetwork,
  isEvmNetwork,
  isSvmNetwork,
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
  type FailoverStatusCallback,
} from './failover';

// Chain Registry Clients (dynamic chain fetching)
export { chainRegistryClient } from './chain-registry-client';
export { evmRegistryClient } from './evm-registry-client';
