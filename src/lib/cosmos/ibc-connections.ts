/**
 * IBC Connections
 *
 * Fetches and manages IBC channel data from the Cosmos chain registry
 * for cross-chain token transfers
 */

import { COSMOS_REGISTRY_CHAINS } from '@/lib/networks/cosmos-registry';

/**
 * IBC Channel info for a specific connection
 */
export interface IBCChannel {
  sourceChainId: string;
  sourceChainName: string;
  sourceChannelId: string;
  sourcePort: string;
  destChainId: string;
  destChainName: string;
  destChannelId: string;
  destPort: string;
  status: 'ACTIVE' | 'INACTIVE' | 'UNKNOWN';
}

/**
 * Raw IBC data from chain registry
 */
interface ChainRegistryIBCData {
  chain_1: {
    chain_name: string;
    chain_id: string;
    client_id: string;
    connection_id: string;
  };
  chain_2: {
    chain_name: string;
    chain_id: string;
    client_id: string;
    connection_id: string;
  };
  channels: Array<{
    chain_1: {
      channel_id: string;
      port_id: string;
    };
    chain_2: {
      channel_id: string;
      port_id: string;
    };
    ordering: string;
    version: string;
    tags?: {
      preferred?: boolean;
      status?: string;
    };
  }>;
}

// Cache for IBC connections
const ibcConnectionsCache: Map<string, IBCChannel[]> = new Map();
const cacheExpiry: Map<string, number> = new Map();
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

/**
 * Get chain name from chain ID using the registry
 */
function getChainNameFromId(chainId: string): string | undefined {
  const chain = COSMOS_REGISTRY_CHAINS.find((c) => c.id === chainId);
  return chain?.chainName;
}

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
 * Fetch IBC connections for a specific chain from chain registry
 */
export async function fetchIBCConnections(chainId: string): Promise<IBCChannel[]> {
  // Check cache first
  const cached = ibcConnectionsCache.get(chainId);
  const expiry = cacheExpiry.get(chainId);
  if (cached && expiry && Date.now() < expiry) {
    return cached;
  }

  const chainName = getChainNameFromId(chainId);
  if (!chainName) {
    console.warn(`Unknown chain: ${chainId}`);
    return [];
  }

  // Get list of enabled chains to filter connections
  const enabledChains = getEnabledCosmosChains();
  const enabledChainNames = new Set(enabledChains.map((c) => c.chainName));

  const connections: IBCChannel[] = [];

  // Fetch IBC data for connections with each enabled chain
  const fetchPromises = enabledChains
    .filter((c) => c.chainName !== chainName)
    .map(async (destChain) => {
      try {
        // IBC files are named alphabetically (e.g., beezee-osmosis.json)
        const names = [chainName, destChain.chainName].sort();
        const ibcFileName = `${names[0]}-${names[1]}.json`;
        const url = `https://raw.githubusercontent.com/cosmos/chain-registry/master/_IBC/${ibcFileName}`;

        const response = await fetch(url);
        if (!response.ok) {
          // No IBC connection exists between these chains
          return null;
        }

        const data: ChainRegistryIBCData = await response.json();

        // Find the preferred/active transfer channel
        const transferChannel = data.channels.find(
          (ch) =>
            ch.chain_1.port_id === 'transfer' &&
            ch.chain_2.port_id === 'transfer' &&
            ch.tags?.status === 'ACTIVE'
        );

        if (!transferChannel) {
          // Try to find any transfer channel
          const anyTransferChannel = data.channels.find(
            (ch) => ch.chain_1.port_id === 'transfer' && ch.chain_2.port_id === 'transfer'
          );
          if (!anyTransferChannel) return null;
        }

        const channel = transferChannel || data.channels[0];

        // Determine which chain is source and which is destination
        const isChain1Source = data.chain_1.chain_name === chainName;

        return {
          sourceChainId: chainId,
          sourceChainName: chainName,
          sourceChannelId: isChain1Source ? channel.chain_1.channel_id : channel.chain_2.channel_id,
          sourcePort: isChain1Source ? channel.chain_1.port_id : channel.chain_2.port_id,
          destChainId: isChain1Source ? data.chain_2.chain_id : data.chain_1.chain_id,
          destChainName: isChain1Source ? data.chain_2.chain_name : data.chain_1.chain_name,
          destChannelId: isChain1Source ? channel.chain_2.channel_id : channel.chain_1.channel_id,
          destPort: isChain1Source ? channel.chain_2.port_id : channel.chain_1.port_id,
          status: (channel.tags?.status as 'ACTIVE' | 'INACTIVE') || 'UNKNOWN',
        } as IBCChannel;
      } catch (error) {
        // Connection doesn't exist or failed to fetch
        return null;
      }
    });

  const results = await Promise.all(fetchPromises);

  for (const result of results) {
    if (result && enabledChainNames.has(result.destChainName)) {
      connections.push(result);
    }
  }

  // Cache the results
  ibcConnectionsCache.set(chainId, connections);
  cacheExpiry.set(chainId, Date.now() + CACHE_DURATION);

  return connections;
}

/**
 * Get IBC channel for a specific source and destination chain
 */
export async function getIBCChannel(
  sourceChainId: string,
  destChainId: string
): Promise<IBCChannel | null> {
  const connections = await fetchIBCConnections(sourceChainId);
  return connections.find((c) => c.destChainId === destChainId) || null;
}

/**
 * Check if a chain has any IBC connections
 */
export async function hasIBCConnections(chainId: string): Promise<boolean> {
  const connections = await fetchIBCConnections(chainId);
  return connections.length > 0;
}

/**
 * Clear the IBC connections cache
 */
export function clearIBCCache(): void {
  ibcConnectionsCache.clear();
  cacheExpiry.clear();
}
