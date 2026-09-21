/**
 * SVM endpoint freshness tests
 *
 * After the lull, advertised Solana still listed Ankr (403 without a key)
 * and Solana dRPC (paid-plan only). Leftover explorer.solana.com then
 * lingered after the official explorer started returning a Vercel
 * Security Checkpoint 429. This keeps SVM RPC and explorer lists honest.
 */

import {
  DEPRECATED_SVM_ENDPOINT_HOSTS,
  ECLIPSE_MAINNET,
  filterPublicSvmRpcUrls,
  getExplorerAccountUrl,
  getExplorerTxUrl,
  selectPublicSvmExplorer,
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

  it('points Solana users at SolanaFM instead of leftover explorer.solana.com', () => {
    expect(SOLANA_MAINNET.explorerUrl).toBe('https://solana.fm');
    expect(getExplorerAccountUrl('solana-mainnet', 'So11111111111111111111111111111111111111112')).toBe(
      'https://solana.fm/address/So11111111111111111111111111111111111111112'
    );
    expect(getExplorerTxUrl('solana-mainnet', 'abcd')).toBe('https://solana.fm/tx/abcd');
    expect(getExplorerAccountUrl('solana-devnet', 'So11111111111111111111111111111111111111112')).toBe(
      'https://solana.fm/address/So11111111111111111111111111111111111111112?cluster=devnet'
    );
    expect(getExplorerTxUrl('solana-testnet', 'abcd')).toBe(
      'https://solana.fm/tx/abcd?cluster=testnet'
    );
    expect(SOLANA_DEVNET.explorerUrl).toBe('https://solana.fm');
    expect(SOLANA_TESTNET.explorerUrl).toBe('https://solana.fm');
    expect(ECLIPSE_MAINNET.explorerUrl).toBe('https://eclipsescan.xyz');
    expect(svmEndpointHaystack(SOLANA_MAINNET.rpcUrls, SOLANA_MAINNET.explorerUrl)).not.toContain(
      'explorer.solana.com'
    );
  });

  it('classifies retired hosts and strips them from public RPC lists', () => {
    expect(usesDeprecatedSvmHost('https://rpc.ankr.com/solana')).toBe(true);
    expect(usesDeprecatedSvmHost('https://solana.drpc.org')).toBe(true);
    expect(usesDeprecatedSvmHost('https://solana.lava.build')).toBe(true);
    expect(usesDeprecatedSvmHost('https://solana-api.projectserum.com')).toBe(true);
    expect(usesDeprecatedSvmHost('https://explorer.solana.com')).toBe(true);
    expect(usesDeprecatedSvmHost('https://solana.fm')).toBe(false);
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

  it('skips leftover explorer.solana.com when picking a public SVM explorer', () => {
    expect(selectPublicSvmExplorer([{ url: 'https://explorer.solana.com' }])).toBeUndefined();
    expect(
      selectPublicSvmExplorer([
        { url: 'https://explorer.solana.com' },
        { url: 'https://solana.fm' },
      ])?.url
    ).toBe('https://solana.fm');
  });
});
