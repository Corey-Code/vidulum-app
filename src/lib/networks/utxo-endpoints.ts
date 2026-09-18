/**
 * Bitcoin-like (UTXO) explorer and API freshness.
 *
 * The wallet opens these public explorers from the dashboard. APIs used for
 * balances must stay Esplora-shaped; retired hosts are listed so tests reject
 * them if they return.
 *
 * Last reviewed: 2026-09-18 (post-lull spine refresh).
 */

import { BITCOIN_NETWORKS, type BitcoinNetworkConfig } from './bitcoin';

export const UTXO_ENDPOINTS_REVIEWED_AT = '2026-09-18';

export const DEPRECATED_UTXO_ENDPOINT_HOSTS = [
  'zcha.in',
  'zcashblockexplorer.com',
  'zelcash.online',
  'api.ravencoin.org',
  'ravencoin.network',
  'btczexplorer.blockhub.info',
] as const;

export interface UtxoExplorerSummary {
  id: string;
  name: string;
  explorerUrl: string;
  explorerHost: string;
}

function endpointHaystack(network: BitcoinNetworkConfig): string {
  return [...network.apiUrls, network.explorerUrl ?? ''].join(' ');
}

export function getExplorerHost(explorerUrl: string): string {
  return new URL(explorerUrl).host.replace(/^www\./, '');
}

export function getEnabledUtxoExplorerSummaries(): UtxoExplorerSummary[] {
  return BITCOIN_NETWORKS.flatMap((network) => {
    if (!network.enabled || !network.explorerUrl) {
      return [];
    }

    return [
      {
        id: network.id,
        name: network.name,
        explorerUrl: network.explorerUrl,
        explorerHost: getExplorerHost(network.explorerUrl),
      },
    ];
  });
}

export function formatUtxoExplorerLine(summary: UtxoExplorerSummary): string {
  return `${summary.name}: ${summary.explorerHost}`;
}

export function utxoNetworkUsesDeprecatedHost(network: BitcoinNetworkConfig): boolean {
  const haystack = endpointHaystack(network);
  return DEPRECATED_UTXO_ENDPOINT_HOSTS.some((host) => haystack.includes(host));
}
