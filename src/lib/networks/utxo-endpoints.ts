/**
 * UTXO data-API contract
 *
 * BitcoinClient only speaks Esplora (Blockstream/Mempool) paths:
 *   GET /address/{address}
 *   GET /address/{address}/utxo
 *   GET /tx/{txid}
 *   POST /tx
 *   GET /fee-estimates
 *   GET /blocks/tip/height
 *
 * After a period of low activity, several configs still pointed at retired
 * explorers or at live hosts that return a different JSON shape. Keep those
 * hosts out of apiUrls so failover does not burn time on a guaranteed miss.
 * Also keep retired explorer sites (401, TLS-dead) out of explorerUrl so
 * Settings and Dashboard do not send users to a dead page.
 */

export const DEPRECATED_UTXO_ENDPOINT_HOSTS = [
  'zcha.in',
  'zcashblockexplorer.com',
  'zelcash.online',
  'blockhub.info',
  'ravencoin.network',
  'explorer.ritocoin.org',
  'blockbook.ritocoin.org',
] as const;

/** Live hosts that are not Esplora-compatible. */
export const INCOMPATIBLE_UTXO_API_HOSTS = [
  'blockcypher.com',
  'dogechain.info',
] as const;

export const ESPLORA_UTXO_NETWORK_IDS = [
  'bitcoin-mainnet',
  'bitcoin-testnet',
  'litecoin-mainnet',
] as const;

export function utxoEndpointHaystack(apiUrls: readonly string[], explorerUrl?: string): string {
  return [...apiUrls, explorerUrl ?? ''].join(' ');
}

export function usesDeprecatedUtxoHost(haystack: string): boolean {
  return DEPRECATED_UTXO_ENDPOINT_HOSTS.some((host) => haystack.includes(host));
}

export function usesIncompatibleUtxoApiHost(haystack: string): boolean {
  return INCOMPATIBLE_UTXO_API_HOSTS.some((host) => haystack.includes(host));
}
