/**
 * SVM public-RPC contract
 *
 * SolanaClient starts on rpcUrls[0] and can switch hops for failover.
 * After a period of low activity, several bundled hosts were key-gated,
 * paid-only, or discontinued. Keep those hosts out of advertised lists
 * so the first hop can succeed without an API key.
 */

export const DEPRECATED_SVM_ENDPOINT_HOSTS = [
  'projectserum.com',
  'solana-labs/token-list',
  'rpc.ankr.com',
  'solana.drpc.org',
  'solana.lava.build',
  'gateway.tatum.io',
] as const;

export function svmEndpointHaystack(rpcUrls: readonly string[], explorerUrl?: string): string {
  return [...rpcUrls, explorerUrl ?? ''].join(' ');
}

export function usesDeprecatedSvmHost(haystack: string): boolean {
  return DEPRECATED_SVM_ENDPOINT_HOSTS.some((host) => haystack.includes(host));
}

/**
 * Filter RPC URLs to public HTTPS endpoints the wallet can call without keys.
 */
export function filterPublicSvmRpcUrls(urls: string[]): string[] {
  return urls
    .filter((url) => {
      if (!url.startsWith('https://')) return false;
      if (url.includes('${')) return false;
      if (url.includes('localhost')) return false;
      if (url.includes('127.0.0.1')) return false;
      if (/192\.168\.|10\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\./.test(url)) return false;
      if (usesDeprecatedSvmHost(url)) return false;
      return true;
    })
    .slice(0, 5);
}
