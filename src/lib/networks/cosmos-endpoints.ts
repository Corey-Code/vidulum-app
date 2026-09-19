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
