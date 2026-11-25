/**
 * Tendermint2 (tm2) Network Configurations
 *
 * Gno.land and other Tendermint2-based chains. These are NOT Cosmos SDK chains:
 * no LCD/REST — balances use ABCI queries over Tendermint RPC.
 */

import type { Tm2NetworkConfig } from './types';

/** Gno.land mainnet (gnoland-1). Native denom ugnot / display GNOT (6 decimals). */
export const GNOLAND_MAINNET: Tm2NetworkConfig = {
  id: 'gnoland-1',
  name: 'Gno.land',
  type: 'tm2',
  enabled: true,
  symbol: 'GNOT',
  decimals: 6,
  coinType: 118, // Same BIP44 coin type as Cosmos; HRP is `g`
  bech32Prefix: 'g',
  feeDenom: 'ugnot',
  isMainnet: true,
  rpcUrls: ['https://rpc.gno.land'],
  logoUrl: 'https://avatars.githubusercontent.com/u/118141905?s=200&v=4',
  explorerUrl: 'https://gnoscan.io',
  explorerAccountPath: '/account/{address}',
  explorerTxPath: '/transactions/details?txhash={txHash}',
};

export const TM2_NETWORKS: Tm2NetworkConfig[] = [GNOLAND_MAINNET];

export function getTm2NetworkById(id: string): Tm2NetworkConfig | undefined {
  return TM2_NETWORKS.find((n) => n.id === id);
}

export function getEnabledTm2Networks(): Tm2NetworkConfig[] {
  return TM2_NETWORKS.filter((n) => n.enabled);
}
