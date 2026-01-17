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
COSMOS_NETWORKS.forEach((network) => networkRegistry.register(network));
BITCOIN_NETWORKS.forEach((network) => networkRegistry.register(network));
EVM_NETWORKS.forEach((network) => networkRegistry.register(network));

// ============================================================================
// Helper functions
// ============================================================================

/**
 * Get explorer URL for an account
 */
export function getExplorerAccountUrl(networkId: string, address: string): string | null {
  const network = networkRegistry.get(networkId);
  if (!network?.explorerUrl || !network?.explorerAccountPath) return null;
  return network.explorerUrl + network.explorerAccountPath.replace('{address}', address);
}

/**
 * Get explorer URL for a transaction
 */
export function getExplorerTxUrl(networkId: string, txHash: string): string | null {
  const network = networkRegistry.get(networkId);
  if (!network?.explorerUrl || !network?.explorerTxPath) return null;
  return network.explorerUrl + network.explorerTxPath.replace('{txHash}', txHash);
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
 * Get networks for UI display (enabled networks only)
 */
export function getUINetworks(): Array<{
  id: string;
  name: string;
  symbol: string;
  type: NetworkType;
  prefix?: string; // For Cosmos chains
}> {
  return networkRegistry.getEnabled().map((network) => ({
    id: network.id,
    name: network.name,
    symbol: network.symbol,
    type: network.type,
    prefix: isCosmosNetwork(network) ? network.bech32Prefix : undefined,
  }));
}
