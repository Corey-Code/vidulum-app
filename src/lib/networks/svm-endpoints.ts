/**
 * SVM public-RPC contract
 *
 * SolanaClient starts on rpcUrls[0] and can switch hops for failover.
 * After a period of low activity, several bundled hosts were key-gated,
 * paid-only, or discontinued. Leftover explorer.solana.com then lingered
 * after the official explorer started returning a Vercel Security
 * Checkpoint 429. SolanaFM still serves public address/tx pages with
 * the same path templates. Keep those hosts out of advertised lists so
 * the first hop can succeed without an API key.
 */

export const DEPRECATED_SVM_ENDPOINT_HOSTS = [
  'projectserum.com',
  'solana-labs/token-list',
  'rpc.ankr.com',
  'solana.drpc.org',
  'solana.lava.build',
  'gateway.tatum.io',
  'explorer.solana.com',
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

export interface SvmExplorerCandidate {
  url?: string;
}

/**
 * Pick a live public explorer, skipping leftover explorer.solana.com
 * after it started returning a Vercel Security Checkpoint 429.
 */
export function selectPublicSvmExplorer(
  explorers: readonly SvmExplorerCandidate[] = []
): SvmExplorerCandidate | undefined {
  return explorers.find((explorer) => {
    const url = explorer.url;
    return Boolean(url && url.startsWith('https://') && !usesDeprecatedSvmHost(url));
  });
}
