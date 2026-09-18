/**
 * UTXO endpoint freshness tests
 *
 * Rejects retired Zcash/Ravencoin hosts and keeps advertised explorers
 * aligned with the live Bitcoin-like network configs.
 */

import {
  BITCOIN_NETWORKS,
  DEPRECATED_UTXO_ENDPOINT_HOSTS,
  formatCatalogReviewMonth,
  formatUtxoExplorerLine,
  getEnabledUtxoExplorerSummaries,
  getExplorerAccountUrl,
  getExplorerTxUrl,
  RAVENCOIN_MAINNET,
  UTXO_ENDPOINTS_REVIEWED_AT,
  utxoNetworkUsesDeprecatedHost,
  ZCASH_MAINNET,
} from '@/lib/networks';

describe('UTXO endpoint freshness', () => {
  it('formats the explorer review month for Settings copy', () => {
    expect(formatCatalogReviewMonth(UTXO_ENDPOINTS_REVIEWED_AT)).toBe('September 2026');
  });

  it('omits retired Zcash, Ravencoin, Flux, and BitcoinZ hosts', () => {
    BITCOIN_NETWORKS.forEach((network) => {
      expect(utxoNetworkUsesDeprecatedHost(network)).toBe(false);
      DEPRECATED_UTXO_ENDPOINT_HOSTS.forEach((host) => {
        expect(JSON.stringify(network)).not.toContain(host);
      });
    });
  });

  it('opens Zcash on CipherScan address and transaction pages', () => {
    expect(ZCASH_MAINNET.explorerUrl).toBe('https://cipherscan.app');
    expect(getExplorerAccountUrl('zcash-mainnet', 't1example')).toBe(
      'https://cipherscan.app/address/t1example'
    );
    expect(getExplorerTxUrl('zcash-mainnet', 'abc123')).toBe('https://cipherscan.app/tx/abc123');
  });

  it('opens Ravencoin on the current explorer host', () => {
    expect(RAVENCOIN_MAINNET.explorerUrl).toBe('https://ravencoinexplorer.com');
    expect(getExplorerAccountUrl('ravencoin-mainnet', 'Rexample')).toBe(
      'https://ravencoinexplorer.com/address/Rexample'
    );
  });

  it('lists one HTTPS explorer per enabled Bitcoin-like network', () => {
    const summaries = getEnabledUtxoExplorerSummaries();
    const enabled = BITCOIN_NETWORKS.filter((network) => network.enabled);

    expect(summaries).toHaveLength(enabled.length);
    summaries.forEach((summary) => {
      expect(summary.explorerUrl).toMatch(/^https:\/\//);
      expect(formatUtxoExplorerLine(summary)).toContain(summary.name);
      expect(formatUtxoExplorerLine(summary)).toContain(summary.explorerHost);
    });
  });
});
