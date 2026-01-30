/**
 * Network Type Definitions
 * 
 * Shared types and interfaces for all network configurations.
 */

// Network types supported by the wallet
export type NetworkType = 'cosmos' | 'bitcoin' | 'evm';

// Endpoint health status tracking
export interface EndpointHealth {
  url: string;
  lastSuccess?: number;          // Timestamp of last successful request
  lastFailure?: number;          // Timestamp of last failed request
  consecutiveFailures: number;   // Count of consecutive failures
  isHealthy: boolean;            // Current health status
}

// Base network configuration shared by all networks
export interface BaseNetworkConfig {
  id: string;                    // Unique identifier (e.g., 'beezee-1', 'bitcoin-mainnet')
  name: string;                  // Display name
  type: NetworkType;             // Network type
  enabled: boolean;              // Whether this network is currently enabled
  symbol: string;                // Primary asset symbol (e.g., 'BZE', 'BTC')
  decimals: number;              // Primary asset decimals
  coinType: number;              // BIP44 coin type
  logoUrl?: string;              // Optional logo URL
  explorerUrl?: string;          // Block explorer base URL
  explorerAccountPath?: string;  // Path template for account pages (use {address})
  explorerTxPath?: string;       // Path template for transaction pages (use {txHash})
}

// Cosmos-specific network configuration
export interface CosmosNetworkConfig extends BaseNetworkConfig {
  type: 'cosmos';
  rpc: string[];                 // Array of RPC endpoints (failover order)
  rest: string[];                // Array of REST/LCD endpoints (failover order)
  bech32Prefix: string;
  feeDenom: string;
  gasPrice: string;              // Default gas price (e.g., '0.01')
  features: string[];            // Cosmos features (e.g., 'stargate', 'ibc-transfer')
}

// Bitcoin/UTXO-specific network configuration
// Used for Bitcoin and UTXO-based altcoins (Zcash, Flux, Ravencoin, etc.)
export interface BitcoinNetworkConfig extends BaseNetworkConfig {
  type: 'bitcoin';
  network: 'mainnet' | 'testnet';
  rpcUrls?: string[];            // Optional RPC endpoints for direct node access
  apiUrls: string[];             // Blockstream/Mempool-style API or chain-specific API
  addressType: 'p2wpkh' | 'p2sh-p2wpkh' | 'p2pkh' | 'transparent';  // Default address type
  // Chain-specific address configuration
  addressPrefix?: {
    pubKeyHash?: number | number[] | Uint8Array;   // P2PKH address version byte/prefix
    scriptHash?: number | number[] | Uint8Array;   // P2SH address version byte/prefix
    bech32?: string;             // Bech32 HRP (human-readable part)
  };
}

// EVM-specific network configuration
export interface EvmNetworkConfig extends BaseNetworkConfig {
  type: 'evm';
  chainId: number;
  rpcUrls: string[];             // Array of RPC endpoints (failover order)
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

// Union type for all network configs
export type NetworkConfig = CosmosNetworkConfig | BitcoinNetworkConfig | EvmNetworkConfig;
