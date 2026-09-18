/**
 * EVM endpoint freshness tests
 *
 * After the lull, advertised Ethereum still led with MyCrypto's retired API
 * and Polygon's first four hosts were dead or key-gated. Bitcoin-like and
 * Solana lists were already cleaned; this keeps EVM RPC lists honest.
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

  it('replaces Ethereum\'s retired MyCrypto and Blocknative hosts', () => {
    const ethereum = getEvmChainByInternalId('eth-mainnet');
    expect(ethereum?.rpcUrls).toEqual([
      'https://cloudflare-eth.com',
      'https://ethereum-rpc.publicnode.com',
      'https://eth.drpc.org',
      'https://1rpc.io/eth',
      'https://mainnet.gateway.tenderly.co',
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
    expect(usesDeprecatedEvmHost('https://ethereum-rpc.publicnode.com')).toBe(false);

    expect(
      filterPublicEvmRpcUrls([
        'https://api.mycryptoapi.com/eth',
        'http://127.0.0.1:8545',
        'https://ethereum-rpc.publicnode.com',
        'https://eth.example.com/${KEY}',
        'https://rpc-mainnet.maticvigil.com',
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
