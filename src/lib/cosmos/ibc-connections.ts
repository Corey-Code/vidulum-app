/**
 * IBC Connections
 *
 * Uses pre-bundled IBC channel data from the chain registry
 * for cross-chain token transfers. No runtime fetching required.
 */

import { COSMOS_REGISTRY_CHAINS } from '@/lib/networks/cosmos-registry';
import {
  IBC_CHANNELS,
  IBCChannelConfig,
  getIBCChannelsForChainId,
} from '@/lib/assets/ibc-registry';

/**
 * IBC Channel info for a specific connection (re-export for backwards compatibility)
 */
export type IBCChannel = IBCChannelConfig;

/**
 * Get display name for a chain
 */
export function getChainDisplayName(chainId: string): string {
  const chain = COSMOS_REGISTRY_CHAINS.find((c) => c.id === chainId);
  return chain?.name || chainId;
}

/**
 * Get list of enabled Cosmos chains from registry
 */
export function getEnabledCosmosChains(): Array<{
  id: string;
  name: string;
  chainName: string;
  bech32Prefix: string;
  logoUrl?: string;
}> {
  return COSMOS_REGISTRY_CHAINS.filter((c) => c.enabled).map((c) => ({
    id: c.id,
    name: c.name,
    chainName: c.chainName,
    bech32Prefix: c.bech32Prefix,
    logoUrl: c.logoUrl,
  }));
}

/**
 * Get IBC connections for a specific chain (uses bundled data, no fetch)
 */
export async function fetchIBCConnections(chainId: string): Promise<IBCChannel[]> {
  // Get enabled chains to filter results
  const enabledChains = getEnabledCosmosChains();
  const enabledChainIds = new Set(enabledChains.map((c) => c.id));

  // Get channels from bundled data
  const channels = getIBCChannelsForChainId(chainId);

  // Filter to only include connections to enabled chains
  return channels.filter((c) => enabledChainIds.has(c.destChainId));
}

/**
 * Get IBC channel for a specific source and destination chain
 */
export async function getIBCChannel(
  sourceChainId: string,
  destChainId: string
): Promise<IBCChannel | null> {
  const channels = getIBCChannelsForChainId(sourceChainId);
  return channels.find((c) => c.destChainId === destChainId) || null;
}

/**
 * Check if a chain has any IBC connections
 */
export async function hasIBCConnections(chainId: string): Promise<boolean> {
  const connections = await fetchIBCConnections(chainId);
  return connections.length > 0;
}

/**
 * Get all available IBC channels (for debugging/info)
 */
export function getAllIBCChannels(): IBCChannel[] {
  return IBC_CHANNELS;
}
