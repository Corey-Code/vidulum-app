/**
 * EVM endpoint freshness tests
 *
 * After the lull, advertised Ethereum still led with MyCrypto, then with
 * Cloudflare's public gateway. Leftover Ankr, BlastAPI, and DNS-dead
 * Moonbeam/Moonriver/Blast hops also lingered. This keeps EVM RPC lists honest.
 */

import {
  EVM_REGISTRY_CHAINS,
  getEnabledEvmChains,
  getEvmChainByInternalId,
  getExplorerTxUrl,
  SUPPORTED_NETWORK_CATALOG,
} from '@/lib/networks';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  DEPRECATED_EVM_ENDPOINT_HOSTS,
  evmEndpointHaystack,
  filterPublicEvmRpcUrls,
  selectPublicEvmExplorer,
  usesDeprecatedEvmHost,
} from '@/lib/networks/evm-endpoints';

const ADVERTISED_EVM_IDS = SUPPORTED_NETWORK_CATALOG.filter((entry) => entry.family === 'evm').map(
  (entry) => entry.id
);

function endpointHaystack(network: { rpcUrls: string[]; explorerUrl?: string }): string {
  return evmEndpointHaystack(network.rpcUrls, network.explorerUrl);
}

describe('EVM endpoint freshness', () => {
  it('omits retired RPC and explorer hosts from every bundled EVM config', () => {
    EVM_REGISTRY_CHAINS.forEach((network) => {
      const haystack = endpointHaystack(network);
      DEPRECATED_EVM_ENDPOINT_HOSTS.forEach((host) => {
        expect(haystack).not.toContain(host);
      });
    });
  });

  it('keeps multiple HTTPS RPCs on every advertised EVM network', () => {
    expect(ADVERTISED_EVM_IDS).toEqual([
      'eth-mainnet',
      'oeth-mainnet',
      'bnb-mainnet',
      'pol-mainnet',
      'base-mainnet',
      'arb1-mainnet',
    ]);

    ADVERTISED_EVM_IDS.forEach((id) => {
      const network = getEvmChainByInternalId(id);
      expect(network).toBeDefined();
      expect(network?.enabled).toBe(true);
      expect(network!.rpcUrls.length).toBeGreaterThanOrEqual(2);
      network!.rpcUrls.forEach((endpoint) => {
        expect(endpoint).toMatch(/^https:\/\//);
      });
    });
  });

  it('replaces Polygon\'s retired first-hop hosts with public RPCs', () => {
    const polygon = getEvmChainByInternalId('pol-mainnet');
    expect(polygon?.rpcUrls).toEqual([
      'https://polygon-bor-rpc.publicnode.com',
      'https://polygon.drpc.org',
      'https://rpc-mainnet.matic.quiknode.pro',
    ]);
  });

  it('replaces Ethereum\'s leftover Cloudflare hop with current public RPCs', () => {
    const ethereum = getEvmChainByInternalId('eth-mainnet');
    expect(ethereum?.rpcUrls).toEqual([
      'https://ethereum-rpc.publicnode.com',
      'https://eth.drpc.org',
      'https://1rpc.io/eth',
      'https://mainnet.gateway.tenderly.co',
    ]);
    expect(ethereum?.rpcUrls.join(' ')).not.toContain('cloudflare-eth.com');
  });

  it('replaces leftover Ankr and BlastAPI hops on bundled side chains', () => {
    const gnosis = getEvmChainByInternalId('gno-mainnet');
    expect(gnosis?.rpcUrls).toEqual([
      'https://rpc.gnosischain.com',
      'https://rpc.gnosis.gateway.fm',
      'https://gnosis-rpc.publicnode.com',
      'https://gnosis.drpc.org',
    ]);

    const moonbeam = getEvmChainByInternalId('mbeam-mainnet');
    expect(moonbeam?.rpcUrls).toEqual([
      'https://moonbeam.api.onfinality.io/public',
      'https://moonbeam.drpc.org',
    ]);

    const moonriver = getEvmChainByInternalId('mriver-mainnet');
    expect(moonriver?.rpcUrls).toEqual([
      'https://moonriver.api.onfinality.io/public',
      'https://moonriver.drpc.org',
      'https://moonriver.unitedbloc.com',
    ]);

    const blast = getEvmChainByInternalId('blastmainnet-mainnet');
    expect(blast?.rpcUrls).toEqual([
      'https://rpc.blast.io',
      'https://blast.drpc.org',
      'https://blast-rpc.publicnode.com',
    ]);

    const scroll = getEvmChainByInternalId('scr-mainnet');
    expect(scroll?.rpcUrls).toEqual([
      'https://rpc.scroll.io',
      'https://scroll-rpc.publicnode.com',
      'https://scroll.drpc.org',
    ]);
  });

  it('points Fantom users at a live explorer instead of ftmscan.com', () => {
    const fantom = getEvmChainByInternalId('ftm-mainnet');
    expect(fantom?.explorerUrl).toBe('https://explorer.fantom.network');
    expect(fantom?.explorerAccountPath).toBe('/address/{address}');
    expect(fantom?.explorerTxPath).toBe('/transactions/{txHash}');
    expect(fantom?.rpcUrls).toEqual(['https://fantom.drpc.org']);
    expect(getExplorerTxUrl('ftm-mainnet', 'abcd')).toBe(
      'https://explorer.fantom.network/transactions/abcd'
    );
  });

  it('keeps enabled advertised chains aligned with the live registry', () => {
    const enabledIds = getEnabledEvmChains().map((chain) => chain.id);
    ADVERTISED_EVM_IDS.forEach((id) => {
      expect(enabledIds).toContain(id);
    });
  });

  it('classifies retired hosts and strips them from public RPC lists', () => {
    expect(usesDeprecatedEvmHost('https://api.mycryptoapi.com/eth')).toBe(true);
    expect(usesDeprecatedEvmHost('https://rpc-mainnet.maticvigil.com')).toBe(true);
    expect(usesDeprecatedEvmHost('https://cloudflare-eth.com')).toBe(true);
    expect(usesDeprecatedEvmHost('https://rpc.ankr.com/gnosis')).toBe(true);
    expect(usesDeprecatedEvmHost('https://moonbeam.public.blastapi.io')).toBe(true);
    expect(usesDeprecatedEvmHost('https://ethereum-rpc.publicnode.com')).toBe(false);

    expect(
      filterPublicEvmRpcUrls([
        'https://api.mycryptoapi.com/eth',
        'http://127.0.0.1:8545',
        'https://ethereum-rpc.publicnode.com',
        'https://eth.example.com/${KEY}',
        'https://rpc-mainnet.maticvigil.com',
        'https://cloudflare-eth.com',
        'https://rpc.ankr.com/eth',
        'https://eth.drpc.org',
      ])
    ).toEqual(['https://ethereum-rpc.publicnode.com', 'https://eth.drpc.org']);

    expect(
      selectPublicEvmExplorer([
        { url: 'https://ftmscan.com', standard: 'EIP3091' },
        { url: 'https://explorer.fantom.network' },
      ])?.url
    ).toBe('https://explorer.fantom.network');
    expect(selectPublicEvmExplorer([{ url: 'https://ftmscan.com' }])).toBeUndefined();
  });

  it('keeps the sync-script denylist aligned with evm-endpoints', () => {
    const script = readFileSync(join(__dirname, '../../../scripts/sync-evm-registry.ts'), 'utf8');
    DEPRECATED_EVM_ENDPOINT_HOSTS.forEach((host) => {
      expect(script).toContain(host);
    });
    expect(script).toMatch(/explorers[\s\S]*DEPRECATED_EVM_ENDPOINT_HOSTS/);
  });
});
