/**
 * Chain Registry Client
 *
 * Dynamic client for fetching chain data from the Cosmos Chain Registry
 * at runtime. Used for chains not pre-bundled in the extension.
 *
 * Source: https://github.com/cosmos/chain-registry
 */

import { CosmosNetworkConfig } from './types';
import browser from 'webextension-polyfill';

const CHAIN_REGISTRY_BASE = 'https://raw.githubusercontent.com/cosmos/chain-registry/master';
const CACHE_DURATION = 1000 * 60 * 60 * 24; // 24 hours

// Storage key for cached chains
const STORAGE_KEY = 'cosmos_chain_registry_cache';

// Types matching the chain registry schema
interface ChainRegistryChain {
  chain_name: string;
  chain_id: string;
  pretty_name: string;
  status: 'live' | 'upcoming' | 'killed';
  network_type: 'mainnet' | 'testnet' | 'devnet';
  bech32_prefix: string;
  slip44: number;
  fees?: {
    fee_tokens: {
      denom: string;
      average_gas_price?: number;
      low_gas_price?: number;
    }[];
  };
  staking?: {
    staking_tokens: { denom: string }[];
  };
  apis?: {
    rpc?: { address: string; provider?: string }[];
    rest?: { address: string; provider?: string }[];
  };
  explorers?: {
    kind?: string;
    url?: string;
    tx_page?: string;
    account_page?: string;
  }[];
  images?: { png?: string; svg?: string }[];
  keywords?: string[];
}

interface CachedChain {
  config: CosmosNetworkConfig & { chainName: string };
  fetchedAt: number;
}

interface ChainRegistryCache {
  chains: Record<string, CachedChain>;
  version: number;
}

/**
 * Chain Registry Client for dynamic chain fetching
 */
class ChainRegistryClient {
  private cache: ChainRegistryCache = { chains: {}, version: 1 };
  private initialized = false;

  /**
   * Initialize cache from storage
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      const result = await browser.storage.local.get(STORAGE_KEY);
      if (result[STORAGE_KEY]) {
        this.cache = result[STORAGE_KEY];
      }
    } catch (error) {
      console.warn('Failed to load chain registry cache:', error);
    }

    this.initialized = true;
  }

  /**
   * Save cache to storage
   */
  private async saveCache(): Promise<void> {
    try {
      await browser.storage.local.set({ [STORAGE_KEY]: this.cache });
    } catch (error) {
      console.warn('Failed to save chain registry cache:', error);
    }
  }

  /**
   * Fetch chain data from registry
   */
  async fetchChain(
    chainName: string
  ): Promise<(CosmosNetworkConfig & { chainName: string }) | null> {
    await this.init();

    // Check cache
    const cached = this.cache.chains[chainName];
    if (cached && Date.now() - cached.fetchedAt < CACHE_DURATION) {
      return cached.config;
    }

    try {
      const url = `${CHAIN_REGISTRY_BASE}/${chainName}/chain.json`;
      const response = await fetch(url);

      if (!response.ok) {
        console.warn(`Chain not found in registry: ${chainName}`);
        return null;
      }

      const chainData: ChainRegistryChain = await response.json();
      const config = this.transformChain(chainData);

      if (config) {
        // Update cache
        this.cache.chains[chainName] = {
          config,
          fetchedAt: Date.now(),
        };
        await this.saveCache();
      }

      return config;
    } catch (error) {
      console.error(`Failed to fetch chain ${chainName}:`, error);
      return cached?.config || null;
    }
  }

  /**
   * Get list of available chains from registry
   */
  async getAvailableChains(): Promise<string[]> {
    // The chain registry doesn't have a directory listing API
    // Return a curated list of popular chains
    return [
      'cosmoshub',
      'osmosis',
      'juno',
      'stargaze',
      'akash',
      'celestia',
      'dydx',
      'injective',
      'sei',
      'kujira',
      'neutron',
      'archway',
      'axelar',
      'evmos',
      'noble',
      'stride',
      'terra2',
      'secret',
      'persistence',
      'sommelier',
      'regen',
      'likecoin',
      'cheqd',
      'assetmantle',
      'fetchhub',
      'gravitybridge',
      'irisnet',
      'emoney',
      'bitsong',
      'bitcanna',
      'chihuahua',
      'comdex',
      'crescent',
      'desmos',
      'gitopia',
      'beezee',
      'atomone',
      'omniflixhub',
      'jackal',
      'agoric',
    ];
  }

  /**
   * Search chains by name or symbol
   */
  async searchChains(query: string): Promise<string[]> {
    const available = await this.getAvailableChains();
    const lowerQuery = query.toLowerCase();

    return available.filter(
      (name) =>
        name.includes(lowerQuery) ||
        this.cache.chains[name]?.config.name.toLowerCase().includes(lowerQuery) ||
        this.cache.chains[name]?.config.symbol.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Transform chain registry format to wallet format
   */
  private transformChain(
    chain: ChainRegistryChain
  ): (CosmosNetworkConfig & { chainName: string }) | null {
    // Skip non-live or non-mainnet
    if (chain.status !== 'live' || chain.network_type !== 'mainnet') {
      return null;
    }

    // Helper: only allow public HTTPS endpoints
    const isPublicHttpsEndpoint = (url: string): boolean => {
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        // Reject malformed URLs
        return false;
      }

      if (parsed.protocol !== 'https:') {
        return false;
      }

      const hostname = parsed.hostname;

      // Block obvious local/loopback hosts
      if (hostname === 'localhost' || hostname === '::1' || hostname === '0:0:0:0:0:0:0:1') {
        return false;
      }

      // Block IPv4 loopback 127.0.0.0/8
      if (hostname.startsWith('127.')) {
        return false;
      }

      // Block RFC1918 private ranges:
      // 10.0.0.0/8
      if (hostname.startsWith('10.')) {
        return false;
      }

      // 172.16.0.0/12 (172.16.* - 172.31.*)
      if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)) {
        return false;
      }

      // 192.168.0.0/16
      if (hostname.startsWith('192.168.')) {
        return false;
      }

      return true;
    };

    // Filter endpoints
    const filterEndpoints = (endpoints?: { address: string }[]) =>
      (endpoints || [])
        .map((e) => e.address)
        .filter((url) => isPublicHttpsEndpoint(url))
        .slice(0, 5);

    const rpc = filterEndpoints(chain.apis?.rpc);
    const rest = filterEndpoints(chain.apis?.rest);

    if (rpc.length === 0 || rest.length === 0) {
      return null;
    }

    const feeToken = chain.fees?.fee_tokens?.[0];
    const stakingDenom = chain.staking?.staking_tokens?.[0]?.denom;
    const explorer = chain.explorers?.find((e) => e.kind === 'mintscan') || chain.explorers?.[0];

    // Determine features
    const features = ['stargate', 'ibc-transfer', 'no-legacy-stdTx'];
    if (chain.keywords?.includes('cosmwasm')) {
      features.push('cosmwasm');
    }

    return {
      id: chain.chain_id,
      name: chain.pretty_name,
      chainName: chain.chain_name,
      type: 'cosmos',
      enabled: false,
      symbol: stakingDenom?.replace(/^u/, '').toUpperCase() || chain.bech32_prefix.toUpperCase(),
      decimals: 6,
      coinType: chain.slip44,
      rpc,
      rest,
      bech32Prefix: chain.bech32_prefix,
      feeDenom: feeToken?.denom || `u${chain.bech32_prefix}`,
      gasPrice: String(feeToken?.average_gas_price || feeToken?.low_gas_price || 0.025),
      features,
      logoUrl: chain.images?.[0]?.png || chain.images?.[0]?.svg,
      explorerUrl: explorer?.url,
      explorerAccountPath: explorer?.account_page?.replace('${accountAddress}', '{address}'),
      explorerTxPath: explorer?.tx_page?.replace('${txHash}', '{txHash}'),
    };
  }

  /**
   * Clear cache
   */
  async clearCache(): Promise<void> {
    this.cache = { chains: {}, version: 1 };
    await this.saveCache();
  }

  /**
   * Get cache stats
   */
  getCacheStats(): { chainCount: number; oldestFetch: number | null } {
    const chains = Object.values(this.cache.chains);
    return {
      chainCount: chains.length,
      oldestFetch: chains.length > 0 ? Math.min(...chains.map((c) => c.fetchedAt)) : null,
    };
  }
}

// Export singleton instance
export const chainRegistryClient = new ChainRegistryClient();

// Export types
export type { ChainRegistryChain };
