#!/usr/bin/env node
/**
 * EVM Chain Registry Sync Script
 *
 * Fetches chain data from ethereum-lists/chains repository
 * (https://github.com/ethereum-lists/chains) via chainid.network
 * and generates TypeScript configuration files for the wallet.
 *
 * Usage:
 *   npx ts-node --project scripts/tsconfig.json scripts/sync-evm-registry.ts
 *   npx ts-node --project scripts/tsconfig.json scripts/sync-evm-registry.ts --chains 1,56,137
 *   npx ts-node --project scripts/tsconfig.json scripts/sync-evm-registry.ts --all
 *
 * This script:
 * 1. Fetches chains.json from chainid.network
 * 2. Filters and transforms data to wallet's EvmNetworkConfig format
 * 3. Generates src/lib/networks/evm-registry.ts
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as process from 'node:process';

const CHAINS_JSON_URL = 'https://chainid.network/chains.json';

// Default chains to include in the bundle (popular by usage/TVL)
const DEFAULT_CHAIN_IDS = [
  1, // Ethereum
  56, // BNB Chain
  137, // Polygon
  42161, // Arbitrum One
  10, // Optimism
  43114, // Avalanche C-Chain
  8453, // Base
  250, // Fantom
  100, // Gnosis (xDai)
  42220, // Celo
  25, // Cronos
  324, // zkSync Era
  1101, // Polygon zkEVM
  59144, // Linea
  534352, // Scroll
  5000, // Mantle
  1284, // Moonbeam
  1285, // Moonriver
  1088, // Metis
  7777777, // Zora
  81457, // Blast
  34443, // Mode
  169, // Manta Pacific
  // Testnets
  11155111, // Sepolia
  84532, // Base Sepolia
];

// Chains to enable by default
const ENABLED_CHAIN_IDS = [1, 56, 137, 8453, 42161, 10];

// Chain Registry types (from chains.json)
interface ChainRegistryEntry {
  name: string;
  chain: string;
  icon?: string;
  rpc: string[];
  features?: { name: string }[];
  faucets?: string[];
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
  ens?: { registry?: string };
  explorers?: {
    name: string;
    url: string;
    standard?: string;
    icon?: string;
  }[];
  parent?: {
    type: string;
    chain: string;
    bridges?: { url: string }[];
  };
  status?: 'active' | 'deprecated' | 'incubating';
  redFlags?: string[];
}

// Wallet types (target format)
interface WalletEvmConfig {
  id: string;
  name: string;
  shortName: string;
  type: 'evm';
  enabled: boolean;
  symbol: string;
  decimals: number;
  coinType: number;
  chainId: number;
  rpcUrls: string[];
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  explorerUrl?: string;
  explorerAccountPath?: string;
  explorerTxPath?: string;
  infoUrl?: string;
  isTestnet?: boolean;
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
 * Filter RPC URLs to only include usable public endpoints
 */
function filterRpcUrls(urls: string[]): string[] {
  return urls
    .filter((url) => {
      // Must be HTTPS
      if (!url.startsWith('https://')) return false;
      // No placeholders (e.g., ${INFURA_API_KEY})
      if (url.includes('${')) return false;
      // No localhost or private IPs
      if (url.includes('localhost')) return false;
      if (url.includes('127.0.0.1')) return false;
      if (/192\.168\.|10\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\./.test(url)) return false;
      // Filter out archive nodes (typically rate-limited/paid)
      if (url.toLowerCase().includes('archive')) return false;
      return true;
    })
    .slice(0, 5); // Max 5 endpoints
}

/**
 * Determine if a chain is a testnet based on name/chainId patterns
 */
function isTestnet(chain: ChainRegistryEntry): boolean {
  const name = chain.name.toLowerCase();
  const shortName = chain.shortName.toLowerCase();

  // Common testnet identifiers
  const testnetPatterns = [
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

  return testnetPatterns.some((pattern) => name.includes(pattern) || shortName.includes(pattern));
}

/**
 * Generate a unique ID for the chain
 */
function generateChainId(chain: ChainRegistryEntry): string {
  const shortName = chain.shortName.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const suffix = isTestnet(chain) ? '' : '-mainnet';

  // Avoid double-suffixes
  if (shortName.endsWith('-mainnet') || shortName.endsWith('-testnet')) {
    return shortName;
  }

  return `${shortName}${suffix}`;
}

/**
 * Transform chain registry entry to wallet format
 */
function transformChain(chain: ChainRegistryEntry): WalletEvmConfig | null {
  // Skip deprecated chains
  if (chain.status === 'deprecated') {
    return null;
  }

  // Skip chains with red flags
  if (chain.redFlags && chain.redFlags.length > 0) {
    return null;
  }

  // Filter RPC URLs
  const rpcUrls = filterRpcUrls(chain.rpc);

  // Skip chains without usable RPC endpoints
  if (rpcUrls.length === 0) {
    return null;
  }

  // Get explorer info (prefer EIP-3091 compliant)
  const explorer = chain.explorers?.find((e) => e.standard === 'EIP3091') || chain.explorers?.[0];

  const testnet = isTestnet(chain);

  return {
    id: generateChainId(chain),
    name: chain.name,
    shortName: chain.shortName,
    type: 'evm',
    enabled: !testnet && ENABLED_CHAIN_IDS.includes(chain.chainId),
    symbol: chain.nativeCurrency.symbol,
    decimals: chain.nativeCurrency.decimals,
    coinType: chain.slip44 || 60, // Default to Ethereum's coin type
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
 * Generate TypeScript code for chains
 */
function generateChainsCode(chains: WalletEvmConfig[]): string {
  // Sort: enabled first, then by chainId
  chains.sort((a, b) => {
    if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
    if (a.isTestnet !== b.isTestnet) return a.isTestnet ? 1 : -1;
    return a.chainId - b.chainId;
  });

  const chainsJson = JSON.stringify(chains, null, 2)
    .replace(/"([^"]+)":/g, '$1:') // Remove quotes from keys
    .replace(/"/g, "'"); // Use single quotes

  return `/**
 * EVM Chain Registry - Auto-generated
 *
 * This file is generated by scripts/sync-evm-registry.ts
 * Source: https://github.com/ethereum-lists/chains
 *
 * DO NOT EDIT MANUALLY - Run \`npm run sync:evm\` to update
 *
 * Generated: ${new Date().toISOString()}
 */

import { EvmNetworkConfig } from './types';

/**
 * Extended config with registry metadata
 */
export interface EvmRegistryConfig extends EvmNetworkConfig {
  shortName: string; // Registry short name for lookups
  infoUrl?: string; // Chain info URL
  isTestnet?: boolean; // Whether this is a testnet
}

/**
 * Pre-bundled EVM chains from the chain registry
 */
export const EVM_REGISTRY_CHAINS: EvmRegistryConfig[] = ${chainsJson};

/**
 * Get chain by chain ID
 */
export function getEvmChainById(chainId: number): EvmRegistryConfig | undefined {
  return EVM_REGISTRY_CHAINS.find((c) => c.chainId === chainId);
}

/**
 * Get chain by short name
 */
export function getEvmChainByShortName(shortName: string): EvmRegistryConfig | undefined {
  return EVM_REGISTRY_CHAINS.find(
    (c) => c.shortName.toLowerCase() === shortName.toLowerCase()
  );
}

/**
 * Get chain by internal ID
 */
export function getEvmChainByInternalId(id: string): EvmRegistryConfig | undefined {
  return EVM_REGISTRY_CHAINS.find((c) => c.id === id);
}

/**
 * Get all enabled chains
 */
export function getEnabledEvmChains(): EvmRegistryConfig[] {
  return EVM_REGISTRY_CHAINS.filter((c) => c.enabled);
}

/**
 * Get all mainnet chains
 */
export function getMainnetEvmChains(): EvmRegistryConfig[] {
  return EVM_REGISTRY_CHAINS.filter((c) => !c.isTestnet);
}

/**
 * Get all testnet chains
 */
export function getTestnetEvmChains(): EvmRegistryConfig[] {
  return EVM_REGISTRY_CHAINS.filter((c) => c.isTestnet);
}
`;
}

/**
 * Main sync function
 */
async function syncEvmRegistry(chainIds: number[] = DEFAULT_CHAIN_IDS) {
  console.log('🔄 Syncing EVM Chain Registry...\n');

  // Fetch all chains
  console.log(`Fetching chains from ${CHAINS_JSON_URL}...`);
  const allChains = await fetchJson<ChainRegistryEntry[]>(CHAINS_JSON_URL);

  if (!allChains) {
    console.error('❌ Failed to fetch chains.json');
    process.exit(1);
  }

  console.log(`📊 Total chains in registry: ${allChains.length}\n`);

  // Filter to requested chain IDs
  const selectedChains =
    chainIds.length > 0 ? allChains.filter((c) => chainIds.includes(c.chainId)) : allChains;

  console.log(`Processing ${selectedChains.length} chains...\n`);

  const chains: WalletEvmConfig[] = [];
  let skipped = 0;

  for (const chainData of selectedChains) {
    const walletChain = transformChain(chainData);
    if (walletChain) {
      chains.push(walletChain);
      const status = walletChain.enabled ? '✅' : '☑️';
      const testnet = walletChain.isTestnet ? ' (testnet)' : '';
      console.log(`  ${status} ${walletChain.name} (${walletChain.chainId})${testnet}`);
    } else {
      skipped++;
    }
  }

  console.log(`\n📊 Summary: ${chains.length} chains included, ${skipped} skipped\n`);

  // Generate code
  const chainsCode = generateChainsCode(chains);

  // Write file
  const outputPath = path.join(process.cwd(), 'src/lib/networks/evm-registry.ts');

  await fs.writeFile(outputPath, chainsCode, 'utf-8');
  console.log(`✅ Generated ${outputPath}`);

  console.log('\n🎉 EVM chain registry sync complete!');
}

// Parse CLI args and run
const args = process.argv.slice(2);
let chainIds = DEFAULT_CHAIN_IDS;

if (args.includes('--all')) {
  console.log('--all flag: Including all chains with valid RPC endpoints\n');
  chainIds = []; // Empty means all
} else if (args.includes('--chains')) {
  const idx = args.indexOf('--chains');
  if (args[idx + 1]) {
    chainIds = args[idx + 1]
      .split(',')
      .map((s: string) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n));
    console.log(`Custom chains: ${chainIds.join(', ')}\n`);
  }
}

syncEvmRegistry(chainIds);
