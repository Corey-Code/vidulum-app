/**
 * Cosmos public RPC/LCD contract
 *
 * The wallet fails over across rpc + rest. After a period of low activity,
 * several bundled hosts were retired, DNS-dead, or key-gated. Keep those
 * hosts out of advertised lists so the first hop can succeed.
 */

export const DEPRECATED_COSMOS_ENDPOINT_HOSTS = [
  'quickapi.com',
  'lava.build',
  'onivalidator.com',
  'whispernode.com',
  'cosmosia.notional.ventures',
  'pupmos.network',
  'public.blastapi.io',
  'evmos.testnet.run',
  'phoenix-lcd.terra.dev',
  'whenmoonwhenlambo.money',
  'community.nuxian-node.ch',
  'explorer.allinbits.com',
] as const;

export function cosmosEndpointHaystack(
  rpc: readonly string[],
  rest: readonly string[],
  explorerUrl?: string
): string {
  return [...rpc, ...rest, explorerUrl ?? ''].join(' ');
}

export function usesDeprecatedCosmosHost(haystack: string): boolean {
  return DEPRECATED_COSMOS_ENDPOINT_HOSTS.some((host) => haystack.includes(host));
}

/**
 * Filter RPC/LCD URLs to public HTTPS endpoints the wallet can call without keys.
 */
export function filterPublicCosmosEndpoints(urls: string[]): string[] {
  return urls
    .filter((url) => {
      if (!url.startsWith('https://')) return false;
      if (url.includes('${')) return false;
      if (url.includes('localhost')) return false;
      if (url.includes('127.0.0.1')) return false;
      if (/192\.168\.|10\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\./.test(url)) return false;
      if (usesDeprecatedCosmosHost(url)) return false;
      return true;
    })
    .slice(0, 5);
}

export interface CosmosExplorerCandidate {
  kind?: string;
  url?: string;
  tx_page?: string;
  account_page?: string;
}

/**
 * Pick a live public explorer, skipping retired hosts such as
 * explorer.allinbits.com (times out). Prefer mintscan when present.
 */
export function selectPublicCosmosExplorer(
  explorers: readonly CosmosExplorerCandidate[] = []
): CosmosExplorerCandidate | undefined {
  const usable = explorers.filter((explorer) => {
    const url = explorer.url;
    return Boolean(url && url.startsWith('https://') && !usesDeprecatedCosmosHost(url));
  });
  return usable.find((explorer) => explorer.kind === 'mintscan') ?? usable[0];
}

/**
 * Governance pages for advertised Cosmos networks.
 * AtomOne now uses Mintscan so account, tx, and governance links stay on one host.
 */
export function getAdvertisedCosmosGovernanceUrl(chainId: string): string | undefined {
  switch (chainId) {
    case 'beezee-1':
      return 'https://explorer.getbze.com/beezee/gov';
    case 'atomone-1':
      return 'https://www.mintscan.io/atomone/proposals';
    case 'cosmoshub-4':
      return 'https://www.mintscan.io/cosmos/proposals';
    case 'osmosis-1':
      return 'https://www.mintscan.io/osmosis/proposals';
    default:
      return undefined;
  }
}
