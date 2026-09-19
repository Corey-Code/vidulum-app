/**
 * SVM endpoint freshness tests
 *
 * After the lull, advertised Solana still listed Ankr (403 without a key)
 * and Solana dRPC (paid-plan only). Cosmos/EVM/UTXO lists were already
 * cleaned; this keeps SVM RPC lists honest.
 */

import {
  DEPRECATED_SVM_ENDPOINT_HOSTS,
  ECLIPSE_MAINNET,
  filterPublicSvmRpcUrls,
  getExplorerAccountUrl,
  getExplorerTxUrl,
  SOLANA_DEVNET,
  SOLANA_MAINNET,
  SOLANA_TESTNET,
  SVM_NETWORKS,
  svmEndpointHaystack,
  usesDeprecatedSvmHost,
} from '@/lib/networks';

describe('SVM endpoint freshness', () => {
  it('omits retired or key-gated RPC hosts from every bundled SVM config', () => {
    SVM_NETWORKS.forEach((network) => {
      const haystack = svmEndpointHaystack(network.rpcUrls, network.explorerUrl);
      DEPRECATED_SVM_ENDPOINT_HOSTS.forEach((host) => {
        expect(haystack).not.toContain(host);
      });
      network.rpcUrls.forEach((endpoint) => {
        expect(endpoint).toMatch(/^https:\/\//);
      });
    });
  });

  it('keeps multiple HTTPS RPC hops on advertised Solana mainnet', () => {
    expect(SOLANA_MAINNET.enabled).toBe(true);
    expect(SOLANA_MAINNET.rpcUrls).toEqual([
      'https://api.mainnet-beta.solana.com',
      'https://solana-rpc.publicnode.com',
      'https://solana.publicnode.com',
    ]);
  });

  it('keeps official Solana explorer paths for account and transaction links', () => {
    expect(SOLANA_MAINNET.explorerUrl).toBe('https://explorer.solana.com');
    expect(getExplorerAccountUrl('solana-mainnet', 'So11111111111111111111111111111111111111112')).toBe(
      'https://explorer.solana.com/address/So11111111111111111111111111111111111111112'
    );
    expect(getExplorerTxUrl('solana-mainnet', 'abcd')).toBe('https://explorer.solana.com/tx/abcd');
    expect(SOLANA_DEVNET.explorerUrl).toBe('https://explorer.solana.com');
    expect(SOLANA_TESTNET.explorerUrl).toBe('https://explorer.solana.com');
    expect(ECLIPSE_MAINNET.explorerUrl).toBe('https://eclipsescan.xyz');
  });

  it('classifies retired hosts and strips them from public RPC lists', () => {
    expect(usesDeprecatedSvmHost('https://rpc.ankr.com/solana')).toBe(true);
    expect(usesDeprecatedSvmHost('https://solana.drpc.org')).toBe(true);
    expect(usesDeprecatedSvmHost('https://solana.lava.build')).toBe(true);
    expect(usesDeprecatedSvmHost('https://solana-api.projectserum.com')).toBe(true);
    expect(usesDeprecatedSvmHost('https://solana-rpc.publicnode.com')).toBe(false);

    expect(
      filterPublicSvmRpcUrls([
        'https://rpc.ankr.com/solana',
        'http://127.0.0.1:8899',
        'https://api.mainnet-beta.solana.com',
        'https://solana.drpc.org',
        'https://example.com/${KEY}',
        'https://solana-rpc.publicnode.com',
        'https://solana.lava.build',
      ])
    ).toEqual(['https://api.mainnet-beta.solana.com', 'https://solana-rpc.publicnode.com']);
  });
});
