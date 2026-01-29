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
} from './types';
import { COSMOS_NETWORKS } from './cosmos';
import { BITCOIN_NETWORKS } from './bitcoin';
import { EVM_NETWORKS } from './evm';

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
  if (!networkRegistry.get(network.id)) {
    networkRegistry.register(network);
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
  return networkRegistry.getAll().map((network) => ({
    id: network.id,
    name: network.name,
    symbol: network.symbol,
    type: network.type,
    prefix: isCosmosNetwork(network) ? network.bech32Prefix : undefined,
  }));
}
