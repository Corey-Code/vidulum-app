/**
 * EVM Network Configurations
 *
 * All EVM-compatible network definitions (Ethereum, L2s, etc.).
 * Endpoints are listed in order of preference for failover.
 */

import { EvmNetworkConfig } from './types';

// Ethereum Mainnet
export const ETHEREUM_MAINNET: EvmNetworkConfig = {
  id: 'ethereum-mainnet',
  name: 'Ethereum',
  type: 'evm',
  enabled: true,
  symbol: 'ETH',
  decimals: 18,
  coinType: 60, // BIP44 coin type for Ethereum
  chainId: 1,
  rpcUrls: [
    'https://eth.llamarpc.com',
    'https://rpc.ankr.com/eth',
    'https://ethereum.publicnode.com',
    'https://1rpc.io/eth',
    'https://cloudflare-eth.com',
  ],
  nativeCurrency: {
    name: 'Ethereum',
    symbol: 'ETH',
    decimals: 18,
  },
  explorerUrl: 'https://etherscan.io',
  explorerAccountPath: '/address/{address}',
  explorerTxPath: '/tx/{txHash}',
};

// BNB Chain (BSC) Mainnet
export const BNB_MAINNET: EvmNetworkConfig = {
  id: 'bnb-mainnet',
  name: 'BNB Chain',
  type: 'evm',
  enabled: true,
  symbol: 'BNB',
  decimals: 18,
  coinType: 60, // Uses same derivation path as Ethereum
  chainId: 56,
  rpcUrls: [
    'https://bsc-dataseed.binance.org',
    'https://bsc-dataseed1.binance.org',
    'https://bsc-dataseed2.binance.org',
    'https://bsc-dataseed3.binance.org',
    'https://bsc-dataseed4.binance.org',
    'https://rpc.ankr.com/bsc',
    'https://bsc.publicnode.com',
  ],
  nativeCurrency: {
    name: 'BNB',
    symbol: 'BNB',
    decimals: 18,
  },
  explorerUrl: 'https://bscscan.com',
  explorerAccountPath: '/address/{address}',
  explorerTxPath: '/tx/{txHash}',
};

// Base Mainnet (EVM L2)
export const BASE_MAINNET: EvmNetworkConfig = {
  id: 'base-mainnet',
  name: 'Base',
  type: 'evm',
  enabled: true,
  symbol: 'ETH',
  decimals: 18,
  coinType: 60, // BIP44 coin type for Ethereum
  chainId: 8453,
  rpcUrls: [
    'https://mainnet.base.org',
    'https://base.llamarpc.com',
    'https://rpc.ankr.com/base',
    'https://base.publicnode.com',
    'https://1rpc.io/base',
  ],
  nativeCurrency: {
    name: 'Ethereum',
    symbol: 'ETH',
    decimals: 18,
  },
  explorerUrl: 'https://basescan.org',
  explorerAccountPath: '/address/{address}',
  explorerTxPath: '/tx/{txHash}',
};

// Base Sepolia Testnet (EVM L2)
export const BASE_SEPOLIA: EvmNetworkConfig = {
  id: 'base-sepolia',
  name: 'Base Sepolia',
  type: 'evm',
  enabled: false, // Testnets disabled by default
  symbol: 'ETH',
  decimals: 18,
  coinType: 60,
  chainId: 84532,
  rpcUrls: [
    'https://sepolia.base.org',
    'https://base-sepolia.publicnode.com',
  ],
  nativeCurrency: {
    name: 'Ethereum',
    symbol: 'ETH',
    decimals: 18,
  },
  explorerUrl: 'https://sepolia.basescan.org',
  explorerAccountPath: '/address/{address}',
  explorerTxPath: '/tx/{txHash}',
};

// All EVM networks for registration
export const EVM_NETWORKS: EvmNetworkConfig[] = [
  ETHEREUM_MAINNET,
  BNB_MAINNET,
  BASE_MAINNET,
  BASE_SEPOLIA,
];
