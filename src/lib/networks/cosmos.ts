/**
 * Cosmos Network Configurations
 *
 * Manual Cosmos network definitions for networks NOT in the auto-generated registry.
 * Mainnet chains are provided by cosmos-registry.ts (auto-generated from chain-registry).
 */

import { CosmosNetworkConfig } from './types';

// BeeZee Testnet (not in chain registry)
export const BEEZEE_TESTNET: CosmosNetworkConfig = {
  id: 'bzetestnet-2',
  name: 'BeeZee Testnet',
  type: 'cosmos',
  enabled: false, // Testnets disabled by default
  symbol: 'TBZE',
  decimals: 6,
  coinType: 118,
  rpc: ['https://testnet-rpc.getbze.com'],
  rest: ['https://testnet-rest.getbze.com'],
  bech32Prefix: 'bze',
  feeDenom: 'utbze',
  gasPrice: '0.01',
  features: ['stargate', 'ibc-transfer', 'no-legacy-stdTx'],
  explorerUrl: 'https://testnet-explorer.getbze.com/beezee',
  explorerAccountPath: '/account/{address}',
  explorerTxPath: '/tx/{txHash}',
};

// All manual Cosmos networks for registration
// Note: Mainnet chains come from cosmos-registry.ts
export const COSMOS_NETWORKS: CosmosNetworkConfig[] = [BEEZEE_TESTNET];
