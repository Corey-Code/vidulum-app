/**
 * Chain Asset Registry
 *
 * Fetches and manages asset information for all chain types:
 * - Cosmos chains: from https://github.com/cosmos/chain-registry
 * - Bitcoin/UTXO chains: static native asset definitions
 * - EVM chains: static native asset definitions
 */

import { networkRegistry, isBitcoinNetwork, isEvmNetwork, isSvmNetwork } from '@/lib/networks';
import { COSMOS_REGISTRY_ASSETS } from './cosmos-registry';
import { COSMOS_REGISTRY_CHAINS } from '@/lib/networks/cosmos-registry';

export interface RegistryAsset {
  symbol: string;
  name: string;
  denom: string;
  decimals: number;
  logoUrl?: string;
  coingeckoId?: string;
}

interface ChainRegistryAsset {
  description?: string;
  denom_units: { denom: string; exponent: number }[];
  base: string;
  name: string;
  display: string;
  symbol: string;
  logo_URIs?: {
    png?: string;
    svg?: string;
  };
  coingecko_id?: string;
}

interface ChainRegistryAssetList {
  chain_name: string;
  assets: ChainRegistryAsset[];
}

// Cache for asset lists
const assetCache: Map<string, RegistryAsset[]> = new Map();
const cacheExpiry: Map<string, number> = new Map();
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

/**
 * Get chain name from network ID for Cosmos chains
 * Uses the pre-bundled registry config which has chainName
 */
function getChainName(networkId: string): string | undefined {
  // First check the pre-bundled registry chains
  const registryChain = COSMOS_REGISTRY_CHAINS.find((c) => c.id === networkId);
  if (registryChain) {
    return registryChain.chainName;
  }

  // Fallback mapping for manual configs
  const fallbackMap: Record<string, string> = {
    'beezee-1': 'beezee',
    'bzetestnet-2': 'bzetest',
    'osmosis-1': 'osmosis',
    'atomone-1': 'atomone',
    'cosmoshub-4': 'cosmoshub',
  };

  return fallbackMap[networkId];
}

// UTXO chain assets (Bitcoin and UTXO-based altcoins)
const bitcoinAssets: Record<string, RegistryAsset[]> = {
  'bitcoin-mainnet': [
    {
      symbol: 'BTC',
      name: 'Bitcoin',
      denom: 'sat', // Satoshis
      decimals: 8,
      coingeckoId: 'bitcoin',
    },
  ],
  'bitcoin-testnet': [
    {
      symbol: 'tBTC',
      name: 'Bitcoin Testnet',
      denom: 'sat',
      decimals: 8,
    },
  ],
  'zcash-mainnet': [
    {
      symbol: 'ZEC',
      name: 'Zcash',
      denom: 'zatoshi', // Zatoshis (1 ZEC = 100,000,000 zatoshis)
      decimals: 8,
      coingeckoId: 'zcash',
    },
  ],
  'flux-mainnet': [
    {
      symbol: 'FLUX',
      name: 'Flux',
      denom: 'flux', // Base unit
      decimals: 8,
      coingeckoId: 'zelcash',
    },
  ],
  'ravencoin-mainnet': [
    {
      symbol: 'RVN',
      name: 'Ravencoin',
      denom: 'rvn', // Base unit
      decimals: 8,
      coingeckoId: 'ravencoin',
    },
  ],
  'litecoin-mainnet': [
    {
      symbol: 'LTC',
      name: 'Litecoin',
      denom: 'litoshi', // Litoshis (1 LTC = 100,000,000 litoshis)
      decimals: 8,
      coingeckoId: 'litecoin',
    },
  ],
  'bitcoinz-mainnet': [
    {
      symbol: 'BTCZ',
      name: 'BitcoinZ',
      denom: 'satoshi', // Satoshis (1 BTCZ = 100,000,000 satoshis)
      decimals: 8,
      coingeckoId: 'bitcoinz',
    },
  ],
  'dogecoin-mainnet': [
    {
      symbol: 'DOGE',
      name: 'Dogecoin',
      denom: 'koinu', // 1 DOGE = 100,000,000 koinu (smallest unit)
      decimals: 8,
      coingeckoId: 'dogecoin',
    },
  ],
  'ritocoin-mainnet': [
    {
      symbol: 'RITO',
      name: 'Ritocoin',
      denom: 'satoshi', // 1 RITO = 100,000,000 satoshis
      decimals: 8,
      coingeckoId: 'ritocoin',
    },
  ],
  'noso-mainnet': [
    {
      symbol: 'NOSO',
      name: 'NOSO',
      denom: 'duff', // Dash uses duffs (1 DASH = 100,000,000 duffs)
      decimals: 8,
      coingeckoId: 'noso',
    },
  ],
};

// EVM assets
const evmAssets: Record<string, RegistryAsset[]> = {
  'eth-mainnet': [
    {
      symbol: 'ETH',
      name: 'Ethereum',
      denom: 'wei',
      decimals: 18,
      coingeckoId: 'ethereum',
    },
  ],
  'ethereum-mainnet': [
    {
      symbol: 'ETH',
      name: 'Ethereum',
      denom: 'wei',
      decimals: 18,
      coingeckoId: 'ethereum',
    },
  ],
  'bnb-mainnet': [
    {
      symbol: 'BNB',
      name: 'BNB',
      denom: 'wei',
      decimals: 18,
      coingeckoId: 'binancecoin',
    },
  ],
  'pol-mainnet': [
    {
      symbol: 'POL',
      name: 'POL',
      denom: 'wei',
      decimals: 18,
      coingeckoId: 'polygon-ecosystem-token',
    },
  ],
  'base-mainnet': [
    {
      symbol: 'ETH',
      name: 'Ethereum',
      denom: 'wei',
      decimals: 18,
      coingeckoId: 'ethereum',
    },
  ],
  'arb1-mainnet': [
    {
      symbol: 'ETH',
      name: 'Ethereum',
      denom: 'wei',
      decimals: 18,
      coingeckoId: 'ethereum',
    },
  ],
  'oeth-mainnet': [
    {
      symbol: 'ETH',
      name: 'Ethereum',
      denom: 'wei',
      decimals: 18,
      coingeckoId: 'ethereum',
    },
  ],
  'cro-mainnet': [
    {
      symbol: 'CRO',
      name: 'Cronos',
      denom: 'wei',
      decimals: 18,
      coingeckoId: 'crypto-com-chain',
    },
  ],
  'ftm-mainnet': [
    {
      symbol: 'FTM',
      name: 'Fantom',
      denom: 'wei',
      decimals: 18,
      coingeckoId: 'fantom',
    },
  ],
  'gno-mainnet': [
    {
      symbol: 'xDAI',
      name: 'xDAI',
      denom: 'wei',
      decimals: 18,
      coingeckoId: 'xdai',
    },
  ],
  'manta-mainnet': [
    {
      symbol: 'ETH',
      name: 'Ethereum',
      denom: 'wei',
      decimals: 18,
      coingeckoId: 'ethereum',
    },
  ],
  'zksync-mainnet': [
    {
      symbol: 'ETH',
      name: 'Ethereum',
      denom: 'wei',
      decimals: 18,
      coingeckoId: 'ethereum',
    },
  ],
  'metis-andromeda-mainnet': [
    {
      symbol: 'METIS',
      name: 'Metis',
      denom: 'wei',
      decimals: 18,
      coingeckoId: 'metis-token',
    },
  ],
  'zkevm-mainnet': [
    {
      symbol: 'ETH',
      name: 'Ethereum',
      denom: 'wei',
      decimals: 18,
      coingeckoId: 'ethereum',
    },
  ],
  'base-sepolia': [
    {
      symbol: 'ETH',
      name: 'Sepolia ETH',
      denom: 'wei',
      decimals: 18,
    },
  ],
};

// SVM (Solana) assets
const svmAssets: Record<string, RegistryAsset[]> = {
  'solana-mainnet': [
    {
      symbol: 'SOL',
      name: 'Solana',
      denom: 'lamport',
      decimals: 9,
      coingeckoId: 'solana',
    },
  ],
  'solana-devnet': [
    {
      symbol: 'SOL',
      name: 'Solana (Devnet)',
      denom: 'lamport',
      decimals: 9,
    },
  ],
  'solana-testnet': [
    {
      symbol: 'SOL',
      name: 'Solana (Testnet)',
      denom: 'lamport',
      decimals: 9,
    },
  ],
  'eclipse-mainnet': [
    {
      symbol: 'ETH',
      name: 'Ethereum',
      denom: 'lamport',
      decimals: 9,
      coingeckoId: 'ethereum',
    },
  ],
};

// Fallback assets in case chain registry fetch fails
const fallbackAssets: Record<string, RegistryAsset[]> = {
  'beezee-1': [
    // Native token
    { symbol: 'BZE', name: 'BeeZee', denom: 'ubze', decimals: 6, coingeckoId: 'bzedge' },
    // Factory tokens
    {
      symbol: 'VDL',
      name: 'Vidulum',
      denom: 'factory/bze13gzq40che93tgfm9kzmkpjamah5nj0j73pyhqk/uvdl',
      decimals: 6,
      coingeckoId: 'vidulum',
    },
    {
      symbol: 'C2M',
      name: 'Crypto2Mars',
      denom: 'factory/bze15pqjgk4la0mfphwddce00d05n3th3u66n3ptcv/2MARS',
      decimals: 6,
    },
    {
      symbol: 'GGE',
      name: 'GEEGEE',
      denom: 'factory/bze12gyp30f29zg26nuqrwdhl26ej4q066pt572fhm/GGE',
      decimals: 6,
    },
    {
      symbol: 'CTL',
      name: 'CryptoTrtl',
      denom: 'factory/bze1972aqfzdg29ugjln74edx0xvcg4ehvysjptk77/CTL',
      decimals: 6,
    },
    // IBC tokens
    {
      symbol: 'USDC',
      name: 'USDC',
      denom: 'ibc/6490A7EAB61059BFC1CDDEB05917DD70BDF3A611654162A1A47DB930D40D8AF4',
      decimals: 6,
      coingeckoId: 'usd-coin',
    },
    {
      symbol: 'OSMO',
      name: 'Osmosis',
      denom: 'ibc/ED07A3391A112B175915CD8FAF43A2DA8E4790EDE12566649D0C2F97716B8518',
      decimals: 6,
      coingeckoId: 'osmosis',
    },
    {
      symbol: 'ARCH',
      name: 'Archway',
      denom: 'ibc/C00D101A3572A5374E23F11944463D1325319E255D7C824B33AF2F927F532348',
      decimals: 18,
      coingeckoId: 'archway',
    },
    {
      symbol: 'SPICE',
      name: 'Spice',
      denom: 'ibc/08EAEAB525E59C611D5BD8FAC4BE65DF65A69E62874377F6889BBD01A33F385F',
      decimals: 6,
      coingeckoId: 'spice-2',
    },
    {
      symbol: 'JKL',
      name: 'Jackal',
      denom: 'ibc/4AA3B163580B4377250CD4486FB6AD098EB27822EE056949EC4A39B09C5E3B4E',
      decimals: 6,
      coingeckoId: 'jackal-protocol',
    },
    {
      symbol: 'FLIX',
      name: 'OmniFlix',
      denom: 'ibc/FF39851E73089ACBD0B09BDF62FA3C67FBD77A2CD97CD159DBCE9C770561F8AF',
      decimals: 6,
      coingeckoId: 'omniflix-network',
    },
    {
      symbol: 'SHERPA',
      name: 'Sherpa',
      denom: 'ibc/02EE50AB3A4B7540FA001B24CB75E688016F65547CABE885EA184338440080B2',
      decimals: 6,
    },
    {
      symbol: 'ATONE',
      name: 'AtomOne',
      denom: 'ibc/B2219CA05421EA988F83E5E824BF69362E80A6A87503EFD18B92C91C9E03763D',
      decimals: 6,
    },
    {
      symbol: 'PHOTON',
      name: 'Photon',
      denom: 'ibc/82931180F0962712BFABB189083A94C77EA90E269ABFC6D310AF922B2B14E011',
      decimals: 6,
      coingeckoId: 'photon-2',
    },
    {
      symbol: 'PHMN',
      name: 'POSTHUMAN',
      denom: 'ibc/12C0B8B561AFCFDA3C73DEE0F7F84AA2B860D48493C27E8E81A5D14724FAB08B',
      decimals: 6,
      coingeckoId: 'posthuman',
    },
  ],
  'osmosis-1': [
    { symbol: 'OSMO', name: 'Osmosis', denom: 'uosmo', decimals: 6 },
    {
      symbol: 'ATOM',
      name: 'Cosmos Hub',
      denom: 'ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2',
      decimals: 6,
    },
  ],
  'atomone-1': [{ symbol: 'ATONE', name: 'Atom One', denom: 'uatone', decimals: 6 }],
  'cosmoshub-4': [
    { symbol: 'ATOM', name: 'Cosmos Hub', denom: 'uatom', decimals: 6, coingeckoId: 'cosmos' },
  ],
  // Include Bitcoin in fallbacks
  ...bitcoinAssets,
  // Include EVM in fallbacks
  ...evmAssets,
  // Include SVM in fallbacks
  ...svmAssets,
};

/**
 * Fetch asset list from chain registry
 * Supports both Cosmos chains (from chain registry) and Bitcoin (static assets)
 */
export async function fetchChainAssets(networkId: string): Promise<RegistryAsset[]> {
  // Check cache first
  const cached = assetCache.get(networkId);
  const expiry = cacheExpiry.get(networkId);
  if (cached && expiry && Date.now() < expiry) {
    return cached;
  }

  // Check network type from registry
  const network = networkRegistry.get(networkId);

  // Handle Bitcoin networks - return static assets
  if (network && isBitcoinNetwork(network)) {
    const assets = bitcoinAssets[networkId] || [];
    assetCache.set(networkId, assets);
    cacheExpiry.set(networkId, Date.now() + CACHE_DURATION);
    return assets;
  }

  // Handle EVM networks - return static assets
  if (network && isEvmNetwork(network)) {
    const assets = evmAssets[networkId] || [];
    assetCache.set(networkId, assets);
    cacheExpiry.set(networkId, Date.now() + CACHE_DURATION);
    return assets;
  }

  // Handle SVM networks - return static assets
  if (network && isSvmNetwork(network)) {
    const assets = svmAssets[networkId] || [];
    assetCache.set(networkId, assets);
    cacheExpiry.set(networkId, Date.now() + CACHE_DURATION);
    return assets;
  }

  // Handle Cosmos chains
  const chainName = getChainName(networkId);
  if (!chainName) {
    console.warn(`No chain registry mapping for ${networkId}`);
    return fallbackAssets[networkId] || [];
  }

  // First check pre-bundled assets (faster, no network request)
  const bundledAssets = COSMOS_REGISTRY_ASSETS[chainName];
  if (bundledAssets && bundledAssets.length > 0) {
    const assets: RegistryAsset[] = bundledAssets.map((asset) => ({
      symbol: asset.symbol,
      name: asset.name,
      denom: asset.denom,
      decimals: asset.decimals,
      logoUrl: asset.logoUrl,
      coingeckoId: asset.coingeckoId,
    }));

    assetCache.set(networkId, assets);
    cacheExpiry.set(networkId, Date.now() + CACHE_DURATION);
    console.log(`Loaded ${assets.length} assets from pre-bundled registry for ${networkId}`);
    return assets;
  }

  // Fallback: fetch from chain registry if not pre-bundled
  try {
    const url = `https://raw.githubusercontent.com/cosmos/chain-registry/master/${chainName}/assetlist.json`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }

    const data: ChainRegistryAssetList = await response.json();

    const assets: RegistryAsset[] = data.assets.map((asset) => {
      // Get decimals from denom_units (usually the last one with highest exponent)
      const decimals = asset.denom_units.reduce((max, unit) => Math.max(max, unit.exponent), 0);

      return {
        symbol: asset.symbol,
        name: asset.name,
        denom: asset.base,
        decimals,
        logoUrl: asset.logo_URIs?.png || asset.logo_URIs?.svg,
        coingeckoId: asset.coingecko_id,
      };
    });

    // Update cache
    assetCache.set(networkId, assets);
    cacheExpiry.set(networkId, Date.now() + CACHE_DURATION);

    console.log(`Loaded ${assets.length} assets from chain registry for ${networkId}`);
    return assets;
  } catch (error) {
    console.error(`Failed to fetch chain registry for ${networkId}:`, error);
    // Return cached data, or fallback assets if no cache
    const fallback = cached || fallbackAssets[networkId] || [];
    console.log(`Using fallback assets for ${networkId}:`, fallback.length);
    return fallback;
  }
}

/**
 * Get a specific asset by denom
 */
export function getAssetByDenom(assets: RegistryAsset[], denom: string): RegistryAsset | undefined {
  return assets.find((a) => a.denom === denom);
}

/**
 * Filter assets to only those with liquidity pools
 */
export function filterAssetsWithPools(
  assets: RegistryAsset[],
  poolDenoms: Set<string>
): RegistryAsset[] {
  return assets.filter((a) => poolDenoms.has(a.denom));
}

// Default/fallback colors for tokens
const tokenColors: Record<string, string> = {
  // Bitcoin / UTXO chains
  BTC: '#F7931A',
  tBTC: '#F7931A',
  LTC: '#345D9D', // Litecoin blue
  ZEC: '#F4B728', // Zcash gold
  FLUX: '#2B61D1', // Flux blue
  RVN: '#384182', // Ravencoin purple-blue
  RITO: '#4A90D9', // Ritocoin blue
  BTCZ: '#F7931A', // BitcoinZ orange
  DOGE: '#C2A633', // Dogecoin gold
  NOSO: '#1E88E5', // NOSO blue (Dash-derived)
  // EVM
  ETH: '#627EEA',
  BNB: '#F0B90B',
  POL: '#8247E5', // Polygon purple
  CRO: '#002D74', // Cronos blue
  FTM: '#1969FF', // Fantom blue
  xDAI: '#48A9A6', // xDAI teal
  METIS: '#00DACC', // Metis teal
  // SVM (Solana)
  SOL: '#9945FF', // Solana purple
  // Cosmos chains
  BZE: '#3182CE',
  VDL: '#6366F1',
  USDC: '#2775CA',
  OSMO: '#9F7AEA',
  ATOM: '#2E3148',
  PHOTON: '#FF6B6B',
  C2M: '#FF9500',
  ARCH: '#FF4D00',
  JKL: '#00D1B2',
  FLIX: '#E50914',
  SHERPA: '#4A90D9',
  ATONE: '#6B46C1',
  PHMN: '#00CED1',
  GGE: '#FFD700',
  CTL: '#32CD32',
  SPICE: '#FF6347',
};

export function getTokenColor(symbol: string): string {
  return tokenColors[symbol] || '#718096';
}
