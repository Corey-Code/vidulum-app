/**
 * Unified Network Registry
 *
 * This module provides a centralized registry for all supported networks.
 * It supports different network types (Cosmos, Bitcoin, EVM) with a common interface.
 */

import {
  NetworkType,
  NetworkConfig,
  CosmosNetworkConfig,
  BitcoinNetworkConfig,
  EvmNetworkConfig,
  SvmNetworkConfig,
} from './types';
import { COSMOS_NETWORKS } from './cosmos';
import { BITCOIN_NETWORKS } from './bitcoin';
import { EVM_NETWORKS } from './evm';
import { SVM_NETWORKS } from './solana';

// Import registry chains (auto-generated from chain registries)
import { COSMOS_REGISTRY_CHAINS } from './cosmos-registry';
import { EVM_REGISTRY_CHAINS } from './evm-registry';

/**
 * Network Registry Class
 * Manages all network configurations with type-safe access
 */
class NetworkRegistry {
  private networks: Map<string, NetworkConfig> = new Map();

  register(config: NetworkConfig): void {
    this.networks.set(config.id, config);
  }

  get(id: string): NetworkConfig | undefined {
    return this.networks.get(id);
  }

  getAll(): NetworkConfig[] {
    return Array.from(this.networks.values());
  }

  getEnabled(): NetworkConfig[] {
    return this.getAll().filter((n) => n.enabled);
  }

  getByType<T extends NetworkType>(type: T): Extract<NetworkConfig, { type: T }>[] {
    return this.getAll().filter((n) => n.type === type) as Extract<NetworkConfig, { type: T }>[];
  }

  getEnabledByType<T extends NetworkType>(type: T): Extract<NetworkConfig, { type: T }>[] {
    return this.getEnabled().filter((n) => n.type === type) as Extract<
      NetworkConfig,
      { type: T }
    >[];
  }

  getCosmos(id: string): CosmosNetworkConfig | undefined {
    const network = this.get(id);
    return network?.type === 'cosmos' ? network : undefined;
  }

  getBitcoin(id: string): BitcoinNetworkConfig | undefined {
    const network = this.get(id);
    return network?.type === 'bitcoin' ? network : undefined;
  }

  getEvm(id: string): EvmNetworkConfig | undefined {
    const network = this.get(id);
    return network?.type === 'evm' ? network : undefined;
  }

  getSvm(id: string): SvmNetworkConfig | undefined {
    const network = this.get(id);
    return network?.type === 'svm' ? network : undefined;
  }

  isEnabled(id: string): boolean {
    return this.get(id)?.enabled ?? false;
  }
}

// Singleton instance
export const networkRegistry = new NetworkRegistry();

// ============================================================================
// Register all networks
// ============================================================================

// Register manual configs first (these take priority if duplicates exist)
COSMOS_NETWORKS.forEach((network) => networkRegistry.register(network));
BITCOIN_NETWORKS.forEach((network) => networkRegistry.register(network));
EVM_NETWORKS.forEach((network) => networkRegistry.register(network));
SVM_NETWORKS.forEach((network) => networkRegistry.register(network));

// Register chains from auto-generated registries (skip duplicates)
// These provide additional chains from cosmos/chain-registry and ethereum-lists/chains
COSMOS_REGISTRY_CHAINS.forEach((network) => {
  // Only register if not already registered (manual configs take priority)
  if (!networkRegistry.get(network.id)) {
    networkRegistry.register(network);
  }
});

EVM_REGISTRY_CHAINS.forEach((network) => {
  // Only register if not already registered (manual configs take priority)
  // For EVM, also check chainId to avoid duplicates like 'ethereum-mainnet' vs 'eth-mainnet'
  if (!networkRegistry.get(network.id)) {
    const existingWithChainId = networkRegistry
      .getByType('evm')
      .find((n) => n.chainId === network.chainId);
    if (!existingWithChainId) {
      networkRegistry.register(network);
    }
  }
});

// ============================================================================
// Helper functions
// ============================================================================

/**
 * Get explorer URL for an account
 */
export function getExplorerAccountUrl(networkId: string, address: string): string | null {
  const network = networkRegistry.get(networkId);
  if (!network?.explorerAccountPath) return null;

  const accountPath = network.explorerAccountPath.replace('{address}', address);

  // If the path is already an absolute URL, return it directly
  if (accountPath.startsWith('http://') || accountPath.startsWith('https://')) {
    return accountPath;
  }

  // Otherwise, concatenate with explorerUrl
  if (!network.explorerUrl) return null;
  return network.explorerUrl + accountPath;
}

/**
 * Get explorer URL for a transaction
 */
export function getExplorerTxUrl(networkId: string, txHash: string): string | null {
  const network = networkRegistry.get(networkId);
  if (!network?.explorerTxPath) return null;

  const txPath = network.explorerTxPath.replace('{txHash}', txHash);

  // If the path is already an absolute URL, return it directly
  if (txPath.startsWith('http://') || txPath.startsWith('https://')) {
    return txPath;
  }

  // Otherwise, concatenate with explorerUrl
  if (!network.explorerUrl) return null;
  return network.explorerUrl + txPath;
}

/**
 * Check if a network is a Cosmos chain
 */
export function isCosmosNetwork(network: NetworkConfig): network is CosmosNetworkConfig {
  return network.type === 'cosmos';
}

/**
 * Check if a network is Bitcoin
 */
export function isBitcoinNetwork(network: NetworkConfig): network is BitcoinNetworkConfig {
  return network.type === 'bitcoin';
}

/**
 * Check if a network is EVM-compatible
 */
export function isEvmNetwork(network: NetworkConfig): network is EvmNetworkConfig {
  return network.type === 'evm';
}

/**
 * Check if a network is SVM (Solana) compatible
 */
export function isSvmNetwork(network: NetworkConfig): network is SvmNetworkConfig {
  return network.type === 'svm';
}

/**
 * Get all networks for UI display
 * Note: Filtering by user preferences should be done at the component level
 * using isNetworkEnabled() from the network store
 */
export function getUINetworks(): Array<{
  id: string;
  name: string;
  symbol: string;
  type: NetworkType;
  prefix?: string; // For Cosmos chains
}> {
  // Priority networks that should appear first (in order)
  const priorityNetworks = ['beezee-1', 'atomone-1', 'cosmoshub-4', 'osmosis-1'];

  const networks = networkRegistry.getAll().map((network) => ({
    id: network.id,
    name: network.name,
    symbol: network.symbol,
    type: network.type,
    prefix: isCosmosNetwork(network) ? network.bech32Prefix : undefined,
  }));

  // Sort: priority networks first (in specified order), then alphabetically by name
  return networks.sort((a, b) => {
    const aIndex = priorityNetworks.indexOf(a.id);
    const bIndex = priorityNetworks.indexOf(b.id);

    // Both are priority networks - sort by priority order
    if (aIndex !== -1 && bIndex !== -1) {
      return aIndex - bIndex;
    }
    // Only a is priority - a comes first
    if (aIndex !== -1) return -1;
    // Only b is priority - b comes first
    if (bIndex !== -1) return 1;
    // Neither is priority - sort alphabetically
    return a.name.localeCompare(b.name);
  });
}
