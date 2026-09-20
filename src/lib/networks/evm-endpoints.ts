/**
 * EVM public-RPC contract
 *
 * EvmClient fails over across rpcUrls with JSON-RPC. After a period of low
 * activity, several bundled hosts were retired, key-gated, or DNS-dead.
 * Leftover Cloudflare Ethereum, Ankr public RPC, BlastAPI, and DNS-dead
 * Moonbeam/Moonriver/Blast hops were still first-hop failures. Keep those
 * hosts out of advertised lists so the first hop can succeed.
 */

export const DEPRECATED_EVM_ENDPOINT_HOSTS = [
  'mycryptoapi.com',
  'rpc.blocknative.com',
  'rpc-mainnet.matic.network',
  'matic-mainnet.chainstacklabs.com',
  'maticvigil.com',
  'polygon-rpc.com',
  'gnosischain-rpc.gateway.pokt.network',
  'gnosis-mainnet.public.blastapi.io',
  'scroll-mainnet.chainstacklabs.com',
  'rpc.ftm.tools',
  'fantom-rpc.publicnode.com',
  'ftmscan.com',
  'cloudflare-eth.com',
  'rpc.ankr.com',
  'public.blastapi.io',
  'rpc.api.moonbeam.network',
  'moonbeam-rpc.dwellir.com',
  'moonbeam.unitedbloc.com',
  'rpc.api.moonriver.moonbeam.network',
  'moonriver-rpc.dwellir.com',
  'blast.din.dev',
] as const;

export function evmEndpointHaystack(rpcUrls: readonly string[], explorerUrl?: string): string {
  return [...rpcUrls, explorerUrl ?? ''].join(' ');
}

export function usesDeprecatedEvmHost(haystack: string): boolean {
  return DEPRECATED_EVM_ENDPOINT_HOSTS.some((host) => haystack.includes(host));
}

/**
 * Filter RPC URLs to public HTTPS endpoints the wallet can call without keys.
 */
export function filterPublicEvmRpcUrls(urls: string[]): string[] {
  return urls
    .filter((url) => {
      if (!url.startsWith('https://')) return false;
      if (url.includes('${')) return false;
      if (url.includes('localhost')) return false;
      if (url.includes('127.0.0.1')) return false;
      if (/192\.168\.|10\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\./.test(url)) return false;
      if (url.toLowerCase().includes('archive')) return false;
      if (usesDeprecatedEvmHost(url)) return false;
      return true;
    })
    .slice(0, 5);
}

export interface EvmExplorerCandidate {
  url?: string;
  standard?: string;
}

/**
 * Pick a live public explorer, skipping retired hosts such as ftmscan.com.
 */
export function selectPublicEvmExplorer(
  explorers: readonly EvmExplorerCandidate[] = []
): EvmExplorerCandidate | undefined {
  const usable = explorers.filter((explorer) => {
    const url = explorer.url;
    return Boolean(url && url.startsWith('https://') && !usesDeprecatedEvmHost(url));
  });
  return usable.find((explorer) => explorer.standard === 'EIP3091') ?? usable[0];
}
