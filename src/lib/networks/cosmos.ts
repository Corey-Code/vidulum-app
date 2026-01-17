/**
 * Cosmos Network Configurations
 *
 * All Cosmos SDK-based network definitions.
 * Endpoints are listed in order of preference for failover.
 */

import { CosmosNetworkConfig } from './types';

// BeeZee Mainnet
export const BEEZEE_MAINNET: CosmosNetworkConfig = {
  id: 'beezee-1',
  name: 'BeeZee',
  type: 'cosmos',
  enabled: true,
  symbol: 'BZE',
  decimals: 6,
  coinType: 118,
  rpc: [
    'https://rpc.getbze.com',
    'https://rpc-1.getbze.com',
    'https://rpc-2.getbze.com',
  ],
  rest: [
    'https://rest.getbze.com',
    'https://rest-1.getbze.com',
    'https://rest-2.getbze.com',
  ],
  bech32Prefix: 'bze',
  feeDenom: 'ubze',
  gasPrice: '0.01',
  features: ['stargate', 'ibc-transfer', 'no-legacy-stdTx'],
  explorerUrl: 'https://explorer.getbze.com/beezee',
  explorerAccountPath: '/account/{address}',
  explorerTxPath: '/tx/{txHash}',
};

// BeeZee Testnet
export const BEEZEE_TESTNET: CosmosNetworkConfig = {
  id: 'bzetestnet-2',
  name: 'BeeZee Testnet',
  type: 'cosmos',
  enabled: false, // Testnets disabled by default
  symbol: 'TBZE',
  decimals: 6,
  coinType: 118,
  rpc: [
    'https://testnet-rpc.getbze.com',
  ],
  rest: [
    'https://testnet-rest.getbze.com',
  ],
  bech32Prefix: 'bze',
  feeDenom: 'utbze',
  gasPrice: '0.01',
  features: ['stargate', 'ibc-transfer', 'no-legacy-stdTx'],
  explorerUrl: 'https://testnet-explorer.getbze.com/beezee',
  explorerAccountPath: '/account/{address}',
  explorerTxPath: '/tx/{txHash}',
};

// Osmosis Mainnet
export const OSMOSIS_MAINNET: CosmosNetworkConfig = {
  id: 'osmosis-1',
  name: 'Osmosis',
  type: 'cosmos',
  enabled: true,
  symbol: 'OSMO',
  decimals: 6,
  coinType: 118,
  rpc: [
    'https://rpc.osmosis.zone',
    'https://osmosis-rpc.polkachu.com',
    'https://rpc-osmosis.blockapsis.com',
    'https://osmosis-rpc.quickapi.com:443',
  ],
  rest: [
    'https://lcd.osmosis.zone',
    'https://osmosis-api.polkachu.com',
    'https://lcd-osmosis.blockapsis.com',
    'https://osmosis-lcd.quickapi.com:443',
  ],
  bech32Prefix: 'osmo',
  feeDenom: 'uosmo',
  gasPrice: '0.025',
  features: ['stargate', 'ibc-transfer', 'no-legacy-stdTx', 'cosmwasm'],
  explorerUrl: 'https://www.mintscan.io/osmosis',
  explorerAccountPath: '/address/{address}',
  explorerTxPath: '/tx/{txHash}',
};

// Atom One Mainnet
export const ATOMONE_MAINNET: CosmosNetworkConfig = {
  id: 'atomone-1',
  name: 'Atom One',
  type: 'cosmos',
  enabled: true,
  symbol: 'ATONE',
  decimals: 6,
  coinType: 118,
  rpc: [
    'https://atomone-rpc.polkachu.com',
    'https://atomone-rpc.allinbits.services',
  ],
  rest: [
    'https://atomone-api.polkachu.com',
    'https://atomone-api.allinbits.services',
  ],
  bech32Prefix: 'atone',
  feeDenom: 'uatone',
  gasPrice: '0.025',
  features: ['stargate', 'ibc-transfer', 'no-legacy-stdTx'],
  explorerUrl: 'https://explorer.govgen.io/atomone',
  explorerAccountPath: '/accounts/{address}',
  explorerTxPath: '/transactions/{txHash}',
};

// Cosmos Hub Mainnet
export const COSMOSHUB_MAINNET: CosmosNetworkConfig = {
  id: 'cosmoshub-4',
  name: 'Cosmos Hub',
  type: 'cosmos',
  enabled: true,
  symbol: 'ATOM',
  decimals: 6,
  coinType: 118,
  rpc: [
    'https://cosmos-rpc.polkachu.com',
    'https://rpc-cosmoshub.blockapsis.com',
    'https://cosmos-rpc.quickapi.com:443',
    'https://rpc.cosmos.network',
  ],
  rest: [
    'https://cosmos-rest.polkachu.com',
    'https://lcd-cosmoshub.blockapsis.com',
    'https://cosmos-lcd.quickapi.com:443',
    'https://api.cosmos.network',
  ],
  bech32Prefix: 'cosmos',
  feeDenom: 'uatom',
  gasPrice: '0.025',
  features: ['stargate', 'ibc-transfer', 'no-legacy-stdTx'],
  explorerUrl: 'https://www.mintscan.io/cosmos',
  explorerAccountPath: '/address/{address}',
  explorerTxPath: '/tx/{txHash}',
};

// All Cosmos networks for registration
export const COSMOS_NETWORKS: CosmosNetworkConfig[] = [
  BEEZEE_MAINNET,
  BEEZEE_TESTNET,
  OSMOSIS_MAINNET,
  ATOMONE_MAINNET,
  COSMOSHUB_MAINNET,
];
