/**
 * Cosmos public RPC/LCD contract
 *
 * The wallet fails over across rpc + rest. After a period of low activity,
 * several bundled hosts were retired, DNS-dead, or key-gated. Leftover
 * side-chain hops still pointed at ezstaking.dev (Cloudflare 521),
 * itastakers.com (DNS-dead), setten.io (TLS hostname mismatch), and other
 * retired RPC/LCD hosts. Leftover official Neutron hops then lingered:
 * rpc-lb.neutron.org / rest-lb.neutron.org now serve HTML (302), and
 * rest-*.neutron-1.neutron.org LCD hosts fail TLS. Leftover Evmos hops
 * then lingered after the chain was marked killed: Lavender.Five Evmos
 * RPC/LCD now 503, and leftover goldenratiostaking.net / owallet.io
 * (502) plus w3coins.io / stakeflow.io (DNS-dead) hops still sat on
 * side-chain lists. Leftover Kujira and Stargaze hops then lingered:
 * Lavender.Five now 503s both, Stargaze is killed (Kleomedes empty 200,
 * official/Polkachu DNS-dead), and Autostake public hops 404. Leftover
 * Injective Polkachu hops then lingered: injective-rpc.polkachu.com and
 * injective-api.polkachu.com now time out. Leftover dYdX Polkachu dao
 * hosts then lingered: dydx-dao-rpc.polkachu.com and
 * dydx-dao-api.polkachu.com after the official registry moved to
 * dydx-rpc.polkachu.com / dydx-api.polkachu.com. Leftover Juno
 * Lavender.Five hops then lingered: rpc.lavenderfive.com:443/juno and
 * rest.lavenderfive.com:443/juno now 503. Leftover Celestia lunaroasis
 * LCD (api.lunaroasis.net) then lingered after TLS handshake failure,
 * and leftover Numia LCD (public-celestia-lcd.numia.xyz) returns 501.
 * Leftover official uquad Injective and dYdX hops then lingered after
 * the Cosmos Chain Registry started leading those lists with
 * injective.rpc.uquad.org (401 missing API key) and
 * dydx.rpc.uquad.org (502). Other uquad hops (Cosmos Hub, Celestia,
 * Akash, Neutron, Stride, Osmosis, Axelar) remain public.
 * Keep those hosts out of advertised lists so the first hop can succeed.
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
  'ezstaking.app',
  'ezstaking.dev',
  'finder.kujira.app',
  'explorers.guru',
  'stargaze-apis.com',
  'stargaze.c29r3.xyz',
  'itastakers.com',
  'setten.io',
  'ibs.team',
  'wildsage.io',
  'newmetric.xyz',
  'bd.evmos.org',
  'utsa.tech',
  'allthatnode.com',
  'imperator.co',
  'tm.p2p.org',
  'silentvalidator.com',
  'cosmos-spaces.cloud',
  'rpc-lb.neutron.org',
  'rest-lb.neutron.org',
  'neutron-1.neutron.org',
  'lavenderfive.com:443/evmos',
  'lavenderfive.com/evmos',
  'goldenratiostaking.net',
  'owallet.io',
  'w3coins.io',
  'stakeflow.io',
  'lavenderfive.com:443/kujira',
  'lavenderfive.com/kujira',
  'lavenderfive.com:443/stargaze',
  'lavenderfive.com/stargaze',
  'autostake.com',
  'stargaze-rpc.kleomedes.network',
  'stargaze-api.kleomedes.network',
  'kuji-rpc.kleomedes.network',
  'kuji-api.kleomedes.network',
  'kujira-rpc.polkachu.com',
  'kujira-api.polkachu.com',
  'theamsolutions.info',
  'injective-rpc.polkachu.com',
  'injective-api.polkachu.com',
  'dydx-dao-rpc.polkachu.com',
  'dydx-dao-api.polkachu.com',
  'lavenderfive.com:443/juno',
  'lavenderfive.com/juno',
  'api.lunaroasis.net',
  'public-celestia-lcd.numia.xyz',
  'injective.rpc.uquad.org',
  'dydx.rpc.uquad.org',
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
 * explorer.allinbits.com (times out), ezstaking.app (account 404),
 * finder.kujira.app (403), and explorers.guru (404 / DNS-dead).
 * Prefer mintscan when present.
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
