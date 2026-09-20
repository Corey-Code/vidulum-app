/**
 * EVM endpoint freshness tests
 *
 * After the lull, advertised Ethereum still led with MyCrypto, then with
 * Cloudflare's public gateway. Leftover Ankr, BlastAPI, and DNS-dead
 * Moonbeam/Moonriver/Blast hops also lingered. Leftover Sepolia.org RPCs
 * (404 / timeout) and the sunset zkEVM explorer still sat in side-chain
 * lists. Leftover Moonriver UnitedBloc then lingered after Moonbeam
 * UnitedBloc was denylisted. Leftover 1rpc.io/eth then lingered after
 * 1RPC discontinued that Ethereum hop (HTTP 410). Leftover
 * 1rpc.io/sepolia then lingered after 1RPC moved public hops to
 * public.1rpc.io. Leftover Avalanche snowscan.xyz then lingered
 * after the explorer started returning a Cloudflare 403 interstitial.
 * This keeps EVM RPC and explorer lists honest.
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
      'https://mainnet.gateway.tenderly.co',
    ]);
    expect(ethereum?.rpcUrls.join(' ')).not.toContain('cloudflare-eth.com');
    expect(ethereum?.rpcUrls.join(' ')).not.toContain('1rpc.io/eth');
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
    ]);
    expect(moonriver?.rpcUrls.join(' ')).not.toContain('unitedbloc.com');

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

  it('replaces leftover discontinued Sepolia.org RPCs with current public hops', () => {
    const sepolia = getEvmChainByInternalId('sep-testnet');
    expect(sepolia?.rpcUrls).toEqual([
      'https://ethereum-sepolia-rpc.publicnode.com',
      'https://sepolia.gateway.tenderly.co',
      'https://public.1rpc.io/sepolia',
      'https://rpc.sepolia.ethpandaops.io',
    ]);
    expect(sepolia?.rpcUrls.join(' ')).not.toMatch(/rpc\.sepolia\.org|rpc2\.sepolia\.org/);
    expect(sepolia?.rpcUrls.join(' ')).not.toContain('https://1rpc.io/sepolia');
    expect(sepolia?.explorerUrl).toBe('https://sepolia.etherscan.io');
  });

  it('omits the DNS-dead Polygon zkEVM explorer after the July 2026 sunset', () => {
    const zkevm = getEvmChainByInternalId('zkevm-mainnet');
    expect(zkevm?.explorerUrl).toBeUndefined();
    expect(zkevm?.rpcUrls).toEqual([
      'https://zkevm-rpc.com',
      'https://polygon-zkevm.drpc.org',
    ]);
    expect(getExplorerTxUrl('zkevm-mainnet', 'abcd')).toBeNull();
    expect(endpointHaystack(zkevm!)).not.toContain('zkevm.polygonscan.com');
  });

  it('points Avalanche users at the official C-Chain explorer instead of leftover snowscan.xyz', () => {
    const avalanche = getEvmChainByInternalId('avax-mainnet');
    expect(avalanche?.explorerUrl).toBe('https://subnets.avax.network/c-chain');
    expect(avalanche?.explorerAccountPath).toBe('/address/{address}');
    expect(avalanche?.explorerTxPath).toBe('/tx/{txHash}');
    expect(getExplorerTxUrl('avax-mainnet', 'abcd')).toBe(
      'https://subnets.avax.network/c-chain/tx/abcd'
    );
    expect(endpointHaystack(avalanche!)).not.toContain('snowscan.xyz');
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
    expect(usesDeprecatedEvmHost('https://rpc.sepolia.org')).toBe(true);
    expect(usesDeprecatedEvmHost('https://rpc2.sepolia.org')).toBe(true);
    expect(usesDeprecatedEvmHost('https://zkevm.polygonscan.com')).toBe(true);
    expect(usesDeprecatedEvmHost('https://moonriver.unitedbloc.com')).toBe(true);
    expect(usesDeprecatedEvmHost('https://1rpc.io/eth')).toBe(true);
    expect(usesDeprecatedEvmHost('https://1rpc.io/sepolia')).toBe(true);
    expect(usesDeprecatedEvmHost('https://snowscan.xyz')).toBe(true);
    expect(usesDeprecatedEvmHost('https://subnets.avax.network/c-chain')).toBe(false);
    expect(usesDeprecatedEvmHost('https://public.1rpc.io/sepolia')).toBe(false);
    expect(usesDeprecatedEvmHost('https://ethereum-rpc.publicnode.com')).toBe(false);
    expect(usesDeprecatedEvmHost('https://rpc.sepolia.ethpandaops.io')).toBe(false);

    expect(
      filterPublicEvmRpcUrls([
        'https://api.mycryptoapi.com/eth',
        'http://127.0.0.1:8545',
        'https://ethereum-rpc.publicnode.com',
        'https://eth.example.com/${KEY}',
        'https://rpc-mainnet.maticvigil.com',
        'https://cloudflare-eth.com',
        'https://rpc.ankr.com/eth',
        'https://rpc.sepolia.org',
        'https://1rpc.io/eth',
        'https://1rpc.io/sepolia',
        'https://eth.drpc.org',
        'https://public.1rpc.io/sepolia',
      ])
    ).toEqual([
      'https://ethereum-rpc.publicnode.com',
      'https://eth.drpc.org',
      'https://public.1rpc.io/sepolia',
    ]);

    expect(
      selectPublicEvmExplorer([
        { url: 'https://ftmscan.com', standard: 'EIP3091' },
        { url: 'https://explorer.fantom.network' },
      ])?.url
    ).toBe('https://explorer.fantom.network');
    expect(selectPublicEvmExplorer([{ url: 'https://ftmscan.com' }])).toBeUndefined();
    expect(selectPublicEvmExplorer([{ url: 'https://zkevm.polygonscan.com' }])).toBeUndefined();
    expect(selectPublicEvmExplorer([{ url: 'https://snowscan.xyz' }])).toBeUndefined();
    expect(
      selectPublicEvmExplorer([
        { url: 'https://snowscan.xyz', standard: 'EIP3091' },
        { url: 'https://subnets.avax.network/c-chain' },
      ])?.url
    ).toBe('https://subnets.avax.network/c-chain');
  });

  it('keeps the sync-script denylist aligned with evm-endpoints', () => {
    const script = readFileSync(join(__dirname, '../../../scripts/sync-evm-registry.ts'), 'utf8');
    DEPRECATED_EVM_ENDPOINT_HOSTS.forEach((host) => {
      expect(script).toContain(host);
    });
    expect(script).toMatch(/explorers[\s\S]*DEPRECATED_EVM_ENDPOINT_HOSTS/);
  });
});
