#!/usr/bin/env node
/**
 * Chain Registry Sync Script
 *
 * Fetches chain data from the official Cosmos Chain Registry
 * (https://github.com/cosmos/chain-registry) and generates
 * TypeScript configuration files for the wallet.
 *
 * Usage:
 *   npx ts-node scripts/sync-chain-registry.ts
 *   npx ts-node scripts/sync-chain-registry.ts --chains osmosis,cosmoshub,juno
 *   npx ts-node scripts/sync-chain-registry.ts --all
 *
 * This script:
 * 1. Fetches chain.json and assetlist.json from the registry
 * 2. Transforms data to wallet's CosmosNetworkConfig format
 * 3. Generates src/lib/networks/cosmos-registry.ts
 * 4. Generates src/lib/assets/cosmos-assets.ts
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as process from 'node:process';

const CHAIN_REGISTRY_BASE = 'https://raw.githubusercontent.com/cosmos/chain-registry/master';

// Default chains to include in the bundle (most popular by TVL/usage)
const DEFAULT_CHAINS = [
  'cosmoshub',
  'osmosis',
  'celestia',
  'dydx',
  'injective',
  'sei',
  'stargaze',
  'juno',
  'akash',
  'kujira',
  'neutron',
  'archway',
  'axelar',
  'evmos',
  'noble',
  'stride',
  'terra2',
  'beezee', // Vidulum ecosystem
  'atomone',
];

// Chain Registry types (from chain.json)
interface ChainRegistryChain {
  $schema?: string;
  chain_name: string;
  chain_type: string;
  chain_id: string;
  pretty_name: string;
  status: 'live' | 'upcoming' | 'killed';
  network_type: 'mainnet' | 'testnet' | 'devnet';
  website?: string;
  bech32_prefix: string;
  daemon_name?: string;
  node_home?: string;
  key_algos?: string[];
  slip44: number;
  fees?: {
    fee_tokens: {
      denom: string;
      fixed_min_gas_price?: number;
      low_gas_price?: number;
      average_gas_price?: number;
      high_gas_price?: number;
    }[];
  };
  staking?: {
    staking_tokens: { denom: string }[];
    lock_duration?: { time: string };
  };
  codebase?: {
    git_repo?: string;
    recommended_version?: string;
    genesis?: { genesis_url?: string };
  };
  images?: {
    png?: string;
    svg?: string;
    theme?: { circle?: boolean };
  }[];
  peers?: {
    seeds?: { id: string; address: string; provider?: string }[];
    persistent_peers?: { id: string; address: string; provider?: string }[];
  };
  apis?: {
    rpc?: { address: string; provider?: string }[];
    rest?: { address: string; provider?: string }[];
    grpc?: { address: string; provider?: string }[];
  };
  explorers?: {
    kind?: string;
    url?: string;
    tx_page?: string;
    account_page?: string;
  }[];
  keywords?: string[];
}

// Chain Registry types (from assetlist.json)
interface ChainRegistryAsset {
  description?: string;
  denom_units: { denom: string; exponent: number; aliases?: string[] }[];
  type_asset?: string;
  base: string;
  name: string;
  display: string;
  symbol: string;
  logo_URIs?: { png?: string; svg?: string };
  images?: { png?: string; svg?: string; theme?: object }[];
  coingecko_id?: string;
  keywords?: string[];
  traces?: object[];
  socials?: { website?: string; twitter?: string };
}

interface ChainRegistryAssetList {
  $schema?: string;
  chain_name: string;
  assets: ChainRegistryAsset[];
}

// Wallet types (target format)
interface WalletChainConfig {
  id: string;
  name: string;
  chainName: string; // Registry name for dynamic fetching
  type: 'cosmos';
  enabled: boolean;
  symbol: string;
  decimals: number;
  coinType: number;
  rpc: string[];
  rest: string[];
  bech32Prefix: string;
  feeDenom: string;
  gasPrice: string;
  features: string[];
  logoUrl?: string;
  explorerUrl?: string;
  explorerAccountPath?: string;
  explorerTxPath?: string;
}

interface WalletAssetConfig {
  symbol: string;
  name: string;
  denom: string;
  decimals: number;
  logoUrl?: string;
  coingeckoId?: string;
  type?: 'native' | 'ibc' | 'cw20' | 'factory';
}

/**
 * Fetch JSON from URL with error handling
 */
async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`Failed to fetch ${url}: ${response.status}`);
      return null;
    }
    return (await response.json()) as T;
  } catch (error) {
    console.warn(`Error fetching ${url}:`, error);
    return null;
  }
}

/**
 * Transform chain.json to wallet format
 */
function transformChain(chain: ChainRegistryChain): WalletChainConfig | null {
  // Skip non-live or non-mainnet chains
  if (chain.status !== 'live' || chain.network_type !== 'mainnet') {
    return null;
  }

  // Extract RPC endpoints (filter out localhost/private IPs)
  const rpcEndpoints = (chain.apis?.rpc || [])
    .map((r) => r.address)
    .filter(
      (url) => !url.includes('localhost') && !url.includes('127.0.0.1') && !url.includes('192.168.')
    )
    .slice(0, 5); // Max 5 endpoints

  const restEndpoints = (chain.apis?.rest || [])
    .map((r) => r.address)
    .filter(
      (url) => !url.includes('localhost') && !url.includes('127.0.0.1') && !url.includes('192.168.')
    )
    .slice(0, 5);

  if (rpcEndpoints.length === 0 || restEndpoints.length === 0) {
    console.warn(`Skipping ${chain.chain_name}: No public endpoints`);
    return null;
  }

  // Get fee token info
  const feeToken = chain.fees?.fee_tokens?.[0];
  const feeDenom = feeToken?.denom || `u${chain.bech32_prefix}`;
  const gasPrice = String(feeToken?.average_gas_price || feeToken?.low_gas_price || 0.025);

  // Get staking token for symbol/decimals
  const stakingDenom = chain.staking?.staking_tokens?.[0]?.denom;

  // Determine features based on chain capabilities
  const features = ['stargate', 'ibc-transfer', 'no-legacy-stdTx'];
  if (chain.codebase?.git_repo?.includes('wasmd') || chain.keywords?.includes('cosmwasm')) {
    features.push('cosmwasm');
  }

  // Get explorer info
  const explorer = chain.explorers?.find((e) => e.kind === 'mintscan') || chain.explorers?.[0];

  // Extract relative paths from explorer URLs if they are absolute
  let explorerAccountPath = explorer?.account_page?.replace('${accountAddress}', '{address}');
  let explorerTxPath = explorer?.tx_page?.replace('${txHash}', '{txHash}');
  
  // If the paths are absolute URLs and we have an explorerUrl, extract the relative part
  if (explorer?.url && explorerAccountPath?.startsWith('http')) {
    // Remove the base URL to get just the path
    const baseUrl = explorer.url.replace(/\/$/, ''); // Remove trailing slash
    if (explorerAccountPath.startsWith(baseUrl)) {
      explorerAccountPath = explorerAccountPath.substring(baseUrl.length);
    }
  }
  
  if (explorer?.url && explorerTxPath?.startsWith('http')) {
    const baseUrl = explorer.url.replace(/\/$/, '');
    if (explorerTxPath.startsWith(baseUrl)) {
      explorerTxPath = explorerTxPath.substring(baseUrl.length);
    }
  }

  // Get logo
  const logoUrl = chain.images?.[0]?.png || chain.images?.[0]?.svg;

  return {
    id: chain.chain_id,
    name: chain.pretty_name,
    chainName: chain.chain_name,
    type: 'cosmos',
    enabled: false, // User must enable chains
    symbol: stakingDenom?.replace(/^u/, '').toUpperCase() || chain.bech32_prefix.toUpperCase(),
    decimals: 6, // Standard for most Cosmos chains
    coinType: chain.slip44,
    rpc: rpcEndpoints,
    rest: restEndpoints,
    bech32Prefix: chain.bech32_prefix,
    feeDenom,
    gasPrice,
    features,
    logoUrl,
    explorerUrl: explorer?.url,
    explorerAccountPath,
    explorerTxPath,
  };
}

/**
 * Transform assetlist.json to wallet format
 */
function transformAssets(assetList: ChainRegistryAssetList): WalletAssetConfig[] {
  return assetList.assets.map((asset) => {
    // Get decimals from denom_units
    const displayUnit = asset.denom_units.find((u) => u.denom === asset.display);
    const decimals = displayUnit?.exponent || Math.max(...asset.denom_units.map((u) => u.exponent));

    // Determine asset type
    let type: WalletAssetConfig['type'] = 'native';
    if (asset.base.startsWith('ibc/')) type = 'ibc';
    else if (asset.base.startsWith('cw20:')) type = 'cw20';
    else if (asset.base.startsWith('factory/')) type = 'factory';

    return {
      symbol: asset.symbol,
      name: asset.name,
      denom: asset.base,
      decimals,
      logoUrl: asset.logo_URIs?.png || asset.logo_URIs?.svg || asset.images?.[0]?.png,
      coingeckoId: asset.coingecko_id,
      type,
    };
  });
}

/**
 * Generate TypeScript code for chains
 */
function generateChainsCode(chains: WalletChainConfig[]): string {
  const enabledChains = ['beezee', 'osmosis', 'cosmoshub', 'atomone'];

  // Enable default chains
  chains.forEach((chain) => {
    if (enabledChains.some((name) => chain.id.includes(name) || chain.chainName === name)) {
      chain.enabled = true;
    }
  });

  const chainsJson = JSON.stringify(chains, null, 2)
    .replace(/"([^"]+)":/g, '$1:') // Remove quotes from keys
    .replace(/"/g, "'"); // Use single quotes

  return `/**
 * Cosmos Chain Registry - Auto-generated
 * 
 * This file is generated by scripts/sync-chain-registry.ts
 * Source: https://github.com/cosmos/chain-registry
 * 
 * DO NOT EDIT MANUALLY - Run \`npm run sync:chains\` to update
 * 
 * Generated: ${new Date().toISOString()}
 */

import { CosmosNetworkConfig } from './types';

/**
 * Extended config with chain registry name for dynamic fetching
 */
export interface CosmosRegistryConfig extends CosmosNetworkConfig {
  chainName: string;  // Registry name (e.g., 'osmosis', 'cosmoshub')
  logoUrl?: string;
}

/**
 * Pre-bundled Cosmos chains from the chain registry
 */
export const COSMOS_REGISTRY_CHAINS: CosmosRegistryConfig[] = ${chainsJson};

/**
 * Get chain by registry name
 */
export function getChainByName(chainName: string): CosmosRegistryConfig | undefined {
  return COSMOS_REGISTRY_CHAINS.find(c => c.chainName === chainName);
}

/**
 * Get chain by chain ID
 */
export function getChainById(chainId: string): CosmosRegistryConfig | undefined {
  return COSMOS_REGISTRY_CHAINS.find(c => c.id === chainId);
}

/**
 * Get all enabled chains
 */
export function getEnabledChains(): CosmosRegistryConfig[] {
  return COSMOS_REGISTRY_CHAINS.filter(c => c.enabled);
}
`;
}

/**
 * Generate TypeScript code for assets
 */
function generateAssetsCode(assetsByChain: Map<string, WalletAssetConfig[]>): string {
  const assetsObj: Record<string, WalletAssetConfig[]> = {};
  assetsByChain.forEach((assets, chainName) => {
    assetsObj[chainName] = assets;
  });

  const assetsJson = JSON.stringify(assetsObj, null, 2)
    .replace(/"([^"]+)":/g, '$1:')
    .replace(/"/g, "'");

  return `/**
 * Cosmos Asset Registry - Auto-generated
 * 
 * This file is generated by scripts/sync-chain-registry.ts
 * Source: https://github.com/cosmos/chain-registry
 * 
 * DO NOT EDIT MANUALLY - Run \`npm run sync:chains\` to update
 * 
 * Generated: ${new Date().toISOString()}
 */

export interface RegistryAssetConfig {
  symbol: string;
  name: string;
  denom: string;
  decimals: number;
  logoUrl?: string;
  coingeckoId?: string;
  type?: 'native' | 'ibc' | 'cw20' | 'factory';
}

/**
 * Pre-bundled assets by chain name
 */
export const COSMOS_REGISTRY_ASSETS: Record<string, RegistryAssetConfig[]> = ${assetsJson};

/**
 * Get assets for a chain
 */
export function getChainAssets(chainName: string): RegistryAssetConfig[] {
  return COSMOS_REGISTRY_ASSETS[chainName] || [];
}

/**
 * Get native asset for a chain
 */
export function getNativeAsset(chainName: string): RegistryAssetConfig | undefined {
  return COSMOS_REGISTRY_ASSETS[chainName]?.find(a => a.type === 'native' || !a.type);
}
`;
}

/**
 * Main sync function
 */
async function syncChainRegistry(chainNames: string[] = DEFAULT_CHAINS) {
  console.log('🔄 Syncing Cosmos Chain Registry...\n');
  console.log(`Chains to sync: ${chainNames.join(', ')}\n`);

  const chains: WalletChainConfig[] = [];
  const assetsByChain = new Map<string, WalletAssetConfig[]>();

  for (const chainName of chainNames) {
    process.stdout.write(`  ${chainName}...`);

    // Fetch chain.json
    const chainUrl = `${CHAIN_REGISTRY_BASE}/${chainName}/chain.json`;
    const chainData = await fetchJson<ChainRegistryChain>(chainUrl);

    if (!chainData) {
      console.log(' ❌ (not found)');
      continue;
    }

    const walletChain = transformChain(chainData);
    if (!walletChain) {
      console.log(' ⏭️ (skipped)');
      continue;
    }

    chains.push(walletChain);

    // Fetch assetlist.json
    const assetUrl = `${CHAIN_REGISTRY_BASE}/${chainName}/assetlist.json`;
    const assetData = await fetchJson<ChainRegistryAssetList>(assetUrl);

    if (assetData) {
      const walletAssets = transformAssets(assetData);
      assetsByChain.set(chainName, walletAssets);
      console.log(` ✅ (${walletAssets.length} assets)`);
    } else {
      console.log(' ✅ (no assets)');
    }
  }

  console.log(
    `\n📊 Summary: ${chains.length} chains, ${[...assetsByChain.values()].flat().length} assets\n`
  );

  // Generate code
  const chainsCode = generateChainsCode(chains);
  const assetsCode = generateAssetsCode(assetsByChain);

  // Write files
  const srcDir = path.join(process.cwd(), 'src/lib');

  await fs.writeFile(path.join(srcDir, 'networks/cosmos-registry.ts'), chainsCode, 'utf-8');
  console.log('✅ Generated src/lib/networks/cosmos-registry.ts');

  await fs.writeFile(path.join(srcDir, 'assets/cosmos-registry.ts'), assetsCode, 'utf-8');
  console.log('✅ Generated src/lib/assets/cosmos-registry.ts');

  console.log('\n🎉 Chain registry sync complete!');
}

// Parse CLI args and run
const args = process.argv.slice(2);
let chains = DEFAULT_CHAINS;

if (args.includes('--all')) {
  // Fetch all chains - would need to list the registry directory
  console.log('--all flag: Fetching popular chains only (full registry too large)');
} else if (args.includes('--chains')) {
  const idx = args.indexOf('--chains');
  if (args[idx + 1]) {
    chains = args[idx + 1].split(',').map((s: string) => s.trim());
  }
}

syncChainRegistry(chains);
