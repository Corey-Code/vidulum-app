/**
 * EVM Chain Registry Client
 *
 * Dynamic client for fetching EVM chain data from ethereum-lists/chains
 * at runtime. Used for chains not pre-bundled in the extension.
 *
 * Source: https://github.com/ethereum-lists/chains
 * Data: https://chainid.network/chains.json
 */

import { EvmNetworkConfig } from './types';

const CHAINS_JSON_URL = 'https://chainid.network/chains.json';
const CACHE_DURATION = 1000 * 60 * 60 * 24; // 24 hours

// Storage key for cached chains
const STORAGE_KEY = 'evm_chain_registry_cache';

// Types matching the ethereum-lists/chains schema
interface ChainRegistryEntry {
  name: string;
  chain: string;
  icon?: string;
  rpc: string[];
  features?: { name: string }[];
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  infoURL?: string;
  shortName: string;
  chainId: number;
  networkId?: number;
  slip44?: number;
  explorers?: {
    name: string;
    url: string;
    standard?: string;
  }[];
  status?: 'active' | 'deprecated' | 'incubating';
  redFlags?: string[];
}

interface EvmRegistryConfig extends EvmNetworkConfig {
  shortName: string;
  infoUrl?: string;
  isTestnet?: boolean;
}

interface CachedChain {
  config: EvmRegistryConfig;
  fetchedAt: number;
}

interface EvmRegistryCache {
  chains: Record<number, CachedChain>; // Keyed by chainId
  fullListFetchedAt?: number;
  version: number;
}

/**
 * Filter RPC URLs to only include usable public endpoints
 */
function filterRpcUrls(urls: string[]): string[] {
  return urls
    .filter((url) => {
      if (!url.startsWith('https://')) return false;
      if (url.includes('${')) return false;
      if (url.includes('localhost')) return false;
      if (url.includes('127.0.0.1')) return false;
      if (/192\.168\.|10\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\./.test(url)) return false;
      if (url.toLowerCase().includes('archive')) return false;
      return true;
    })
    .slice(0, 5);
}

/**
 * Determine if a chain is a testnet
 */
function isTestnet(chain: ChainRegistryEntry): boolean {
  const name = chain.name.toLowerCase();
  const shortName = chain.shortName.toLowerCase();
  const patterns = [
    'testnet',
    'test',
    'sepolia',
    'goerli',
    'ropsten',
    'rinkeby',
    'kovan',
    'mumbai',
    'fuji',
    'alfajores',
    'baklava',
    'moonbase',
    'dev',
  ];
  return patterns.some((p) => name.includes(p) || shortName.includes(p));
}

/**
 * Generate a unique ID for the chain
 */
function generateChainId(chain: ChainRegistryEntry): string {
  const shortName = chain.shortName.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const suffix = isTestnet(chain) ? '' : '-mainnet';
  if (shortName.endsWith('-mainnet') || shortName.endsWith('-testnet')) {
    return shortName;
  }
  return `${shortName}${suffix}`;
}

/**
 * EVM Chain Registry Client for dynamic chain fetching
 */
class EvmRegistryClient {
  private cache: EvmRegistryCache = { chains: {}, version: 1 };
  private initialized = false;
  private allChains: ChainRegistryEntry[] | null = null;

  /**
   * Initialize cache from storage
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        const result = await chrome.storage.local.get(STORAGE_KEY);
        if (result[STORAGE_KEY]) {
          this.cache = result[STORAGE_KEY];
        }
      }
    } catch (error) {
      console.warn('Failed to load EVM chain registry cache:', error);
    }

    this.initialized = true;
  }

  /**
   * Save cache to storage
   */
  private async saveCache(): Promise<void> {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        await chrome.storage.local.set({ [STORAGE_KEY]: this.cache });
      }
    } catch (error) {
      console.warn('Failed to save EVM chain registry cache:', error);
    }
  }

  /**
   * Fetch the full chains list from the registry
   */
  private async fetchAllChains(): Promise<ChainRegistryEntry[]> {
    // Check if we have a recent full list fetch
    if (
      this.allChains &&
      this.cache.fullListFetchedAt &&
      Date.now() - this.cache.fullListFetchedAt < CACHE_DURATION
    ) {
      return this.allChains;
    }

    try {
      const response = await fetch(CHAINS_JSON_URL);
      if (!response.ok) {
        throw new Error(`Failed to fetch chains: ${response.status}`);
      }
      this.allChains = await response.json();
      this.cache.fullListFetchedAt = Date.now();
      await this.saveCache();
      return this.allChains!;
    } catch (error) {
      console.error('Failed to fetch EVM chains:', error);
      return [];
    }
  }

  /**
   * Transform registry entry to wallet format
   */
  private transformChain(chain: ChainRegistryEntry): EvmRegistryConfig | null {
    if (chain.status === 'deprecated') return null;
    if (chain.redFlags && chain.redFlags.length > 0) return null;

    const rpcUrls = filterRpcUrls(chain.rpc);
    if (rpcUrls.length === 0) return null;

    const explorer = chain.explorers?.find((e) => e.standard === 'EIP3091') || chain.explorers?.[0];

    const testnet = isTestnet(chain);

    return {
      id: generateChainId(chain),
      name: chain.name,
      shortName: chain.shortName,
      type: 'evm',
      enabled: false, // User must enable dynamically fetched chains
      symbol: chain.nativeCurrency.symbol,
      decimals: chain.nativeCurrency.decimals,
      coinType: chain.slip44 || 60,
      chainId: chain.chainId,
      rpcUrls,
      nativeCurrency: {
        name: chain.nativeCurrency.name,
        symbol: chain.nativeCurrency.symbol,
        decimals: chain.nativeCurrency.decimals,
      },
      explorerUrl: explorer?.url,
      explorerAccountPath: explorer ? '/address/{address}' : undefined,
      explorerTxPath: explorer ? '/tx/{txHash}' : undefined,
      infoUrl: chain.infoURL,
      isTestnet: testnet,
    };
  }

  /**
   * Fetch a specific chain by chain ID
   */
  async fetchChain(chainId: number): Promise<EvmRegistryConfig | null> {
    await this.init();

    // Check cache
    const cached = this.cache.chains[chainId];
    if (cached && Date.now() - cached.fetchedAt < CACHE_DURATION) {
      return cached.config;
    }

    try {
      const allChains = await this.fetchAllChains();
      const chainData = allChains.find((c) => c.chainId === chainId);

      if (!chainData) {
        console.warn(`Chain not found in registry: chainId ${chainId}`);
        return null;
      }

      const config = this.transformChain(chainData);

      if (config) {
        this.cache.chains[chainId] = {
          config,
          fetchedAt: Date.now(),
        };
        await this.saveCache();
      }

      return config;
    } catch (error) {
      console.error(`Failed to fetch chain ${chainId}:`, error);
      return cached?.config || null;
    }
  }

  /**
   * Search chains by name, symbol, or chain ID
   */
  async searchChains(query: string): Promise<EvmRegistryConfig[]> {
    await this.init();

    const allChains = await this.fetchAllChains();
    const lowerQuery = query.toLowerCase();
    const numericQuery = parseInt(query, 10);

    const matches = allChains.filter((chain) => {
      // Match by chainId
      if (!isNaN(numericQuery) && chain.chainId === numericQuery) {
        return true;
      }
      // Match by name
      if (chain.name.toLowerCase().includes(lowerQuery)) {
        return true;
      }
      // Match by symbol
      if (chain.nativeCurrency.symbol.toLowerCase().includes(lowerQuery)) {
        return true;
      }
      // Match by shortName
      if (chain.shortName.toLowerCase().includes(lowerQuery)) {
        return true;
      }
      return false;
    });

    // Transform and filter results
    const results: EvmRegistryConfig[] = [];
    for (const chain of matches.slice(0, 20)) {
      const config = this.transformChain(chain);
      if (config) {
        results.push(config);
      }
    }

    return results;
  }

  /**
   * Get popular chains (curated list)
   */
  async getPopularChains(): Promise<EvmRegistryConfig[]> {
    const popularIds = [
      1, 56, 137, 42161, 10, 43114, 8453, 250, 100, 42220, 25, 324, 1101, 59144, 534352, 5000, 1284,
      1088,
    ];

    await this.init();
    const allChains = await this.fetchAllChains();

    const results: EvmRegistryConfig[] = [];
    for (const chainId of popularIds) {
      const chain = allChains.find((c) => c.chainId === chainId);
      if (chain) {
        const config = this.transformChain(chain);
        if (config) {
          results.push(config);
        }
      }
    }

    return results;
  }

  /**
   * Get all available chain IDs
   */
  async getAvailableChainIds(): Promise<number[]> {
    const allChains = await this.fetchAllChains();
    return allChains
      .filter((c) => c.status !== 'deprecated' && filterRpcUrls(c.rpc).length > 0)
      .map((c) => c.chainId)
      .sort((a, b) => a - b);
  }

  /**
   * Clear cache
   */
  async clearCache(): Promise<void> {
    this.cache = { chains: {}, version: 1 };
    this.allChains = null;
    await this.saveCache();
  }

  /**
   * Get cache stats
   */
  getCacheStats(): {
    chainCount: number;
    oldestFetch: number | null;
    fullListAge: number | null;
  } {
    const chains = Object.values(this.cache.chains);
    return {
      chainCount: chains.length,
      oldestFetch: chains.length > 0 ? Math.min(...chains.map((c) => c.fetchedAt)) : null,
      fullListAge: this.cache.fullListFetchedAt ? Date.now() - this.cache.fullListFetchedAt : null,
    };
  }
}

// Export singleton instance
export const evmRegistryClient = new EvmRegistryClient();

// Export types
export type { ChainRegistryEntry, EvmRegistryConfig };
