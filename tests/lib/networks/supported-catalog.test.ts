/**
 * Supported network catalog tests
 *
 * Keeps the user-facing Settings/README list aligned with live registry
 * configs and rejects retired Solana endpoints.
 */

import {
  DEPRECATED_SVM_ENDPOINT_HOSTS,
  formatCatalogReviewMonth,
  getSupportedNetworkFamilyLabel,
  getSupportedNetworkFamilySummary,
  getSupportedNetworksByFamily,
  networkRegistry,
  SOLANA_DEVNET,
  SOLANA_MAINNET,
  SOLANA_TESTNET,
  SUPPORTED_NETWORK_CATALOG,
  SUPPORTED_NETWORK_CATALOG_REVIEWED_AT,
  type SupportedNetworkFamily,
} from '@/lib/networks';

describe('Supported network catalog', () => {
  it('lists every advertised network that is registered and enabled', () => {
    expect(SUPPORTED_NETWORK_CATALOG.length).toBeGreaterThan(0);

    SUPPORTED_NETWORK_CATALOG.forEach((entry) => {
      const network = networkRegistry.get(entry.id);
      expect(network).toBeDefined();
      expect(network?.enabled).toBe(true);
      expect(network?.symbol).toBe(entry.symbol);
    });
  });

  it('includes one enabled network from each family', () => {
    const byFamily = getSupportedNetworksByFamily();
    expect(byFamily.cosmos.some((entry) => entry.id === 'beezee-1')).toBe(true);
    expect(byFamily.utxo.some((entry) => entry.id === 'bitcoin-mainnet')).toBe(true);
    expect(byFamily.evm.some((entry) => entry.id === 'eth-mainnet')).toBe(true);
    expect(byFamily.svm.some((entry) => entry.id === 'solana-mainnet')).toBe(true);
  });

  it('uses user-facing family labels', () => {
    const families: SupportedNetworkFamily[] = ['cosmos', 'utxo', 'evm', 'svm'];
    families.forEach((family) => {
      expect(getSupportedNetworkFamilyLabel(family).length).toBeGreaterThan(0);
      expect(getSupportedNetworkFamilySummary(family).length).toBeGreaterThan(0);
    });
    expect(getSupportedNetworkFamilySummary('utxo')).toMatch(
      /Bitcoin and Litecoin can load balances today/
    );
    expect(getSupportedNetworkFamilySummary('evm')).toMatch(
      /current public RPCs/
    );
    expect(getSupportedNetworkFamilySummary('cosmos')).toMatch(
      /current public RPC and LCD/
    );
    expect(getSupportedNetworkFamilySummary('svm')).toMatch(
      /current public RPCs/
    );
  });

  it('formats the catalog review month for Settings copy', () => {
    expect(formatCatalogReviewMonth(SUPPORTED_NETWORK_CATALOG_REVIEWED_AT)).toBe('September 2026');
  });

  it('does not advertise disabled SVM clusters', () => {
    const svmIds = getSupportedNetworksByFamily().svm.map((entry) => entry.id);
    expect(svmIds).not.toContain('solana-devnet');
    expect(svmIds).not.toContain('solana-testnet');
    expect(svmIds).not.toContain('eclipse-mainnet');
  });
});

describe('SVM endpoint freshness', () => {
  const svmConfigs = [SOLANA_MAINNET, SOLANA_DEVNET, SOLANA_TESTNET];

  it('omits retired Project Serum, Ankr, dRPC, and archived token-list hosts', () => {
    svmConfigs.forEach((network) => {
      const haystack = [...network.rpcUrls, network.logoUrl ?? ''].join(' ');
      DEPRECATED_SVM_ENDPOINT_HOSTS.forEach((host) => {
        expect(haystack).not.toContain(host);
      });
    });
  });

  it('keeps multiple HTTPS RPC endpoints on Solana mainnet for failover', () => {
    expect(SOLANA_MAINNET.rpcUrls.length).toBeGreaterThanOrEqual(3);
    SOLANA_MAINNET.rpcUrls.forEach((endpoint) => {
      expect(endpoint).toMatch(/^https:\/\//);
    });
  });
});
