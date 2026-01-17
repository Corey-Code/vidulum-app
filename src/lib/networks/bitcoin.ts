/**
 * UTXO Network Configurations
 *
 * All UTXO-based network definitions (Bitcoin, Zcash, Flux, Ravencoin, etc.).
 * Endpoints are listed in order of preference for failover.
 */

import { BitcoinNetworkConfig } from './types';

// ============================================================================
// Bitcoin
// ============================================================================

// Bitcoin Mainnet
export const BITCOIN_MAINNET: BitcoinNetworkConfig = {
  id: 'bitcoin-mainnet',
  name: 'Bitcoin',
  type: 'bitcoin',
  enabled: true,
  symbol: 'BTC',
  decimals: 8,
  coinType: 0, // BIP44 coin type for Bitcoin
  network: 'mainnet',
  apiUrls: [
    'https://blockstream.info/api',
    'https://mempool.space/api',
    'https://api.blockcypher.com/v1/btc/main',
  ],
  addressType: 'p2wpkh', // Native SegWit (bc1...)
  addressPrefix: {
    pubKeyHash: 0x00,
    scriptHash: 0x05,
    bech32: 'bc',
  },
  explorerUrl: 'https://blockstream.info',
  explorerAccountPath: '/address/{address}',
  explorerTxPath: '/tx/{txHash}',
};

// Bitcoin Testnet
export const BITCOIN_TESTNET: BitcoinNetworkConfig = {
  id: 'bitcoin-testnet',
  name: 'Bitcoin Testnet',
  type: 'bitcoin',
  enabled: false, // Testnets disabled by default
  symbol: 'tBTC',
  decimals: 8,
  coinType: 1, // BIP44 coin type for Bitcoin testnet
  network: 'testnet',
  apiUrls: [
    'https://blockstream.info/testnet/api',
    'https://mempool.space/testnet/api',
  ],
  addressType: 'p2wpkh',
  addressPrefix: {
    pubKeyHash: 0x6f,
    scriptHash: 0xc4,
    bech32: 'tb',
  },
  explorerUrl: 'https://blockstream.info/testnet',
  explorerAccountPath: '/address/{address}',
  explorerTxPath: '/tx/{txHash}',
};

// ============================================================================
// Zcash
// ============================================================================

// Zcash Mainnet
export const ZCASH_MAINNET: BitcoinNetworkConfig = {
  id: 'zcash-mainnet',
  name: 'Zcash',
  type: 'bitcoin',
  enabled: true,
  symbol: 'ZEC',
  decimals: 8,
  coinType: 133, // BIP44 coin type for Zcash
  network: 'mainnet',
  apiUrls: [
    'https://api.zcha.in/v2',
    'https://zcashblockexplorer.com/api',
  ],
  addressType: 'transparent', // t1... transparent addresses
  addressPrefix: {
    pubKeyHash: 0x1cb8, // t1 addresses (two bytes: 0x1c, 0xb8)
    scriptHash: 0x1cbd, // t3 addresses
  },
  explorerUrl: 'https://explorer.zcha.in',
  explorerAccountPath: '/accounts/{address}',
  explorerTxPath: '/transactions/{txHash}',
};

// ============================================================================
// Flux (formerly ZelCash)
// ============================================================================

// Flux Mainnet
export const FLUX_MAINNET: BitcoinNetworkConfig = {
  id: 'flux-mainnet',
  name: 'Flux',
  type: 'bitcoin',
  enabled: true,
  symbol: 'FLUX',
  decimals: 8,
  coinType: 19167, // BIP44 coin type for Flux
  network: 'mainnet',
  apiUrls: [
    'https://explorer.runonflux.io/api',
    'https://explorer.zelcash.online/api',
  ],
  addressType: 'transparent', // t1... transparent addresses (Zcash-derived)
  addressPrefix: {
    pubKeyHash: 0x1cb8, // t1 addresses (same as Zcash)
    scriptHash: 0x1cbd, // t3 addresses
  },
  explorerUrl: 'https://explorer.runonflux.io',
  explorerAccountPath: '/address/{address}',
  explorerTxPath: '/tx/{txHash}',
};

// ============================================================================
// Ravencoin
// ============================================================================

// Ravencoin Mainnet
export const RAVENCOIN_MAINNET: BitcoinNetworkConfig = {
  id: 'ravencoin-mainnet',
  name: 'Ravencoin',
  type: 'bitcoin',
  enabled: true,
  symbol: 'RVN',
  decimals: 8,
  coinType: 175, // BIP44 coin type for Ravencoin
  network: 'mainnet',
  apiUrls: [
    'https://api.ravencoin.org/api',
    'https://ravencoin.network/api',
  ],
  addressType: 'p2pkh', // R... addresses (legacy P2PKH)
  addressPrefix: {
    pubKeyHash: 0x3c, // R addresses (60 in decimal)
    scriptHash: 0x7a, // r addresses (122 in decimal)
  },
  explorerUrl: 'https://ravencoin.network',
  explorerAccountPath: '/address/{address}',
  explorerTxPath: '/tx/{txHash}',
};

// ============================================================================
// Litecoin
// ============================================================================

// Litecoin Mainnet
export const LITECOIN_MAINNET: BitcoinNetworkConfig = {
  id: 'litecoin-mainnet',
  name: 'Litecoin',
  type: 'bitcoin',
  enabled: true,
  symbol: 'LTC',
  decimals: 8,
  coinType: 2, // BIP44 coin type for Litecoin
  network: 'mainnet',
  apiUrls: [
    'https://litecoinspace.org/api',
    'https://api.blockcypher.com/v1/ltc/main',
  ],
  addressType: 'p2wpkh', // Native SegWit (ltc1...)
  addressPrefix: {
    pubKeyHash: 0x30, // L addresses (48 in decimal)
    scriptHash: 0x32, // M addresses (50 in decimal)
    bech32: 'ltc',
  },
  explorerUrl: 'https://litecoinspace.org',
  explorerAccountPath: '/address/{address}',
  explorerTxPath: '/tx/{txHash}',
};

// ============================================================================
// BitcoinZ
// ============================================================================

// BitcoinZ Mainnet
export const BITCOINZ_MAINNET: BitcoinNetworkConfig = {
  id: 'bitcoinz-mainnet',
  name: 'BitcoinZ',
  type: 'bitcoin',
  enabled: true,
  symbol: 'BTCZ',
  decimals: 8,
  coinType: 177, // BIP44 coin type for BitcoinZ
  network: 'mainnet',
  apiUrls: [
    'https://explorer.btcz.rocks/api',
    'https://btczexplorer.blockhub.info/api',
  ],
  addressType: 'transparent', // t1... transparent addresses (Zcash-derived)
  addressPrefix: {
    pubKeyHash: 0x1cb8, // t1 addresses (same as Zcash)
    scriptHash: 0x1cbd, // t3 addresses
  },
  explorerUrl: 'https://explorer.btcz.rocks',
  explorerAccountPath: '/address/{address}',
  explorerTxPath: '/tx/{txHash}',
};

// ============================================================================
// Dogecoin
// ============================================================================

// Dogecoin Mainnet
export const DOGECOIN_MAINNET: BitcoinNetworkConfig = {
  id: 'dogecoin-mainnet',
  name: 'Dogecoin',
  type: 'bitcoin',
  enabled: true,
  symbol: 'DOGE',
  decimals: 8,
  coinType: 3, // BIP44 coin type for Dogecoin
  network: 'mainnet',
  apiUrls: [
    'https://dogechain.info/api/v1',
    'https://api.blockcypher.com/v1/doge/main',
  ],
  addressType: 'p2pkh', // D... addresses (no SegWit support)
  addressPrefix: {
    pubKeyHash: 0x1e, // D addresses (30)
    scriptHash: 0x16, // 9 or A addresses (22)
  },
  explorerUrl: 'https://dogechain.info',
  explorerAccountPath: '/address/{address}',
  explorerTxPath: '/tx/{txHash}',
};

// ============================================================================
// All UTXO networks for registration
// ============================================================================

export const BITCOIN_NETWORKS: BitcoinNetworkConfig[] = [
  BITCOIN_MAINNET,
  BITCOIN_TESTNET,
  LITECOIN_MAINNET,
  ZCASH_MAINNET,
  FLUX_MAINNET,
  RAVENCOIN_MAINNET,
  BITCOINZ_MAINNET,
  DOGECOIN_MAINNET,
];
