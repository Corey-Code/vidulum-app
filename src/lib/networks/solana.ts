/**
 * SVM (Solana Virtual Machine) Network Configurations
 *
 * Network configurations for Solana and SVM-compatible blockchains.
 * SVM chains include Solana, Eclipse, Sonic, and other Solana forks.
 */

import { SvmNetworkConfig } from './types';

// ==============================================================================
// Solana Networks
// ==============================================================================

// Solana Mainnet
export const SOLANA_MAINNET: SvmNetworkConfig = {
  id: 'solana-mainnet',
  name: 'Solana',
  type: 'svm',
  enabled: true,
  symbol: 'SOL',
  decimals: 9,
  coinType: 501, // BIP44 coin type for Solana
  cluster: 'mainnet-beta',
  isMainnet: true,
  rpcUrls: [
    'https://api.mainnet-beta.solana.com',
    'https://solana-api.projectserum.com',
    'https://rpc.ankr.com/solana',
    'https://solana-mainnet.rpc.extrnode.com',
  ],
  logoUrl:
    'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
  explorerUrl: 'https://explorer.solana.com',
  explorerAccountPath: '/address/{address}',
  explorerTxPath: '/tx/{txHash}',
};

// Solana Devnet
export const SOLANA_DEVNET: SvmNetworkConfig = {
  id: 'solana-devnet',
  name: 'Solana Devnet',
  type: 'svm',
  enabled: false,
  symbol: 'SOL',
  decimals: 9,
  coinType: 501,
  cluster: 'devnet',
  isMainnet: false,
  rpcUrls: ['https://api.devnet.solana.com'],
  logoUrl:
    'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
  explorerUrl: 'https://explorer.solana.com',
  explorerAccountPath: '/address/{address}?cluster=devnet',
  explorerTxPath: '/tx/{txHash}?cluster=devnet',
};

// Solana Testnet
export const SOLANA_TESTNET: SvmNetworkConfig = {
  id: 'solana-testnet',
  name: 'Solana Testnet',
  type: 'svm',
  enabled: false,
  symbol: 'SOL',
  decimals: 9,
  coinType: 501,
  cluster: 'testnet',
  rpcUrls: ['https://api.testnet.solana.com'],
  logoUrl:
    'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
  explorerUrl: 'https://explorer.solana.com',
  explorerAccountPath: '/address/{address}?cluster=testnet',
  explorerTxPath: '/tx/{txHash}?cluster=testnet',
};

// ==============================================================================
// Eclipse (Ethereum L2 using SVM)
// ==============================================================================

export const ECLIPSE_MAINNET: SvmNetworkConfig = {
  id: 'eclipse-mainnet',
  name: 'Eclipse',
  type: 'svm',
  enabled: false,
  symbol: 'ETH',
  decimals: 9,
  coinType: 501,
  cluster: 'mainnet',
  isMainnet: true,
  rpcUrls: ['https://mainnetbeta-rpc.eclipse.xyz'],
  logoUrl: 'https://www.eclipse.xyz/eclipse-logo.svg',
  explorerUrl: 'https://eclipsescan.xyz',
  explorerAccountPath: '/address/{address}',
  explorerTxPath: '/tx/{txHash}',
};

// ==============================================================================
// All SVM Networks
// ==============================================================================

export const SVM_NETWORKS: SvmNetworkConfig[] = [
  SOLANA_MAINNET,
  SOLANA_DEVNET,
  SOLANA_TESTNET,
  ECLIPSE_MAINNET,
];

/**
 * Get SVM network by ID
 */
export function getSvmNetworkById(networkId: string): SvmNetworkConfig | undefined {
  return SVM_NETWORKS.find((n) => n.id === networkId);
}

/**
 * Get all enabled SVM networks
 */
export function getEnabledSvmNetworks(): SvmNetworkConfig[] {
  return SVM_NETWORKS.filter((n) => n.enabled);
}
