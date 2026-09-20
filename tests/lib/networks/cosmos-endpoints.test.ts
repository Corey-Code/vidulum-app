/**
 * Cosmos endpoint freshness tests
 *
 * After the lull, advertised Cosmos Hub still led with Lava, QuickApi, and
 * DNS-dead Whispernode/Onivalidator hops. BeeZee still pointed explorers at
 * ping.pub (404). EVM/UTXO/SVM lists were already cleaned; this keeps Cosmos
 * RPC/LCD lists honest.
 */

import {
  COSMOS_REGISTRY_CHAINS,
  getAdvertisedCosmosGovernanceUrl,
  getChainById,
  getEnabledChains,
  getExplorerAccountUrl,
  getExplorerTxUrl,
  selectPublicCosmosExplorer,
  SUPPORTED_NETWORK_CATALOG,
} from '@/lib/networks';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  DEPRECATED_COSMOS_ENDPOINT_HOSTS,
  cosmosEndpointHaystack,
  filterPublicCosmosEndpoints,
  usesDeprecatedCosmosHost,
} from '@/lib/networks/cosmos-endpoints';

const ADVERTISED_COSMOS_IDS = SUPPORTED_NETWORK_CATALOG.filter(
  (entry) => entry.family === 'cosmos'
).map((entry) => entry.id);

function endpointHaystack(network: {
  rpc: string[];
  rest: string[];
  explorerUrl?: string;
}): string {
  return cosmosEndpointHaystack(network.rpc, network.rest, network.explorerUrl);
}

describe('Cosmos endpoint freshness', () => {
  it('omits retired RPC, LCD, and explorer hosts from every bundled Cosmos config', () => {
    COSMOS_REGISTRY_CHAINS.forEach((network) => {
      const haystack = endpointHaystack(network);
      DEPRECATED_COSMOS_ENDPOINT_HOSTS.forEach((host) => {
        expect(haystack).not.toContain(host);
      });
      network.rpc.concat(network.rest).forEach((endpoint) => {
        expect(endpoint).toMatch(/^https:\/\//);
      });
    });
  });

  it('keeps multiple HTTPS RPC and REST hops on every advertised Cosmos network', () => {
    expect(ADVERTISED_COSMOS_IDS).toEqual([
      'beezee-1',
      'osmosis-1',
      'atomone-1',
      'cosmoshub-4',
    ]);

    ADVERTISED_COSMOS_IDS.forEach((id) => {
      const network = getChainById(id);
      expect(network).toBeDefined();
      expect(network?.enabled).toBe(true);
      expect(network!.rpc.length).toBeGreaterThanOrEqual(2);
      expect(network!.rest.length).toBeGreaterThanOrEqual(2);
      network!.rpc.concat(network!.rest).forEach((endpoint) => {
        expect(endpoint).toMatch(/^https:\/\//);
      });
    });
  });

  it('replaces Cosmos Hub retired Lava, QuickApi, and DNS-dead hops', () => {
    const hub = getChainById('cosmoshub-4');
    expect(hub?.rpc).toEqual([
      'https://rpc.cosmoshub-main.ccvalidators.com:443',
      'https://rpc.lavenderfive.com:443/cosmoshub',
      'https://cosmos-rpc.polkachu.com',
      'https://cosmos-rpc.publicnode.com:443',
      'https://rpc-cosmoshub.ecostake.com',
    ]);
    expect(hub?.rest).toEqual([
      'https://rest.cosmoshub-main.ccvalidators.com:443',
      'https://rest.lavenderfive.com:443/cosmoshub',
      'https://cosmos-rest.publicnode.com',
      'https://cosmos-api.polkachu.com',
      'https://cosmos-lcd.easy2stake.com',
    ]);
  });

  it('points AtomOne users at Mintscan instead of explorer.allinbits.com', () => {
    const atomone = getChainById('atomone-1');
    expect(atomone?.explorerUrl).toBe('https://www.mintscan.io/atomone');
    expect(atomone?.explorerAccountPath).toBe('/accounts/{address}');
    expect(atomone?.explorerTxPath).toBe('/transactions/{txHash}');
    expect(getExplorerAccountUrl('atomone-1', 'atone1abc')).toBe(
      'https://www.mintscan.io/atomone/accounts/atone1abc'
    );
    expect(getExplorerTxUrl('atomone-1', 'abcd')).toBe(
      'https://www.mintscan.io/atomone/transactions/abcd'
    );
    expect(atomone?.rest).not.toEqual(
      expect.arrayContaining([expect.stringContaining('cros-nest.com')])
    );
    expect(atomone?.explorerUrl).not.toContain('allinbits.com');
  });

  it('points Juno users at ATOMScan instead of ezstaking.app', () => {
    const juno = getChainById('juno-1');
    expect(juno?.explorerUrl).toBe('https://atomscan.com/juno');
    expect(juno?.explorerAccountPath).toBe('/accounts/{address}');
    expect(juno?.explorerTxPath).toBe('/transactions/{txHash}');
    expect(getExplorerAccountUrl('juno-1', 'juno1abc')).toBe(
      'https://atomscan.com/juno/accounts/juno1abc'
    );
    expect(getExplorerTxUrl('juno-1', 'abcd')).toBe(
      'https://atomscan.com/juno/transactions/abcd'
    );
    expect(juno?.explorerUrl).not.toContain('ezstaking.app');
    expect(juno?.explorerUrl).not.toContain('mintscan.io');
  });

  it('points Celestia users at Mintscan instead of explorers.guru', () => {
    const celestia = getChainById('celestia');
    expect(celestia?.explorerUrl).toBe('https://www.mintscan.io/celestia');
    expect(celestia?.explorerAccountPath).toBe('/accounts/{address}');
    expect(celestia?.explorerTxPath).toBe('/transactions/{txHash}');
    expect(getExplorerAccountUrl('celestia', 'celestia1abc')).toBe(
      'https://www.mintscan.io/celestia/accounts/celestia1abc'
    );
    expect(getExplorerTxUrl('celestia', 'abcd')).toBe(
      'https://www.mintscan.io/celestia/transactions/abcd'
    );
    expect(celestia?.explorerUrl).not.toContain('explorers.guru');
  });

  it('points Archway users at Mintscan after explorers.guru stopped resolving', () => {
    const archway = getChainById('archway-1');
    expect(archway?.explorerUrl).toBe('https://www.mintscan.io/archway');
    expect(archway?.explorerAccountPath).toBe('/accounts/{address}');
    expect(archway?.explorerTxPath).toBe('/transactions/{txHash}');
    expect(getExplorerAccountUrl('archway-1', 'archway1abc')).toBe(
      'https://www.mintscan.io/archway/accounts/archway1abc'
    );
    expect(getExplorerTxUrl('archway-1', 'abcd')).toBe(
      'https://www.mintscan.io/archway/transactions/abcd'
    );
    expect(archway?.explorerUrl).not.toContain('explorers.guru');
  });

  it('points Kujira users at ATOMScan instead of finder.kujira.app', () => {
    const kujira = getChainById('kaiyo-1');
    expect(kujira?.explorerUrl).toBe('https://atomscan.com/kujira');
    expect(kujira?.explorerAccountPath).toBe('/accounts/{address}');
    expect(kujira?.explorerTxPath).toBe('/transactions/{txHash}');
    expect(getExplorerAccountUrl('kaiyo-1', 'kujira1abc')).toBe(
      'https://atomscan.com/kujira/accounts/kujira1abc'
    );
    expect(getExplorerTxUrl('kaiyo-1', 'abcd')).toBe(
      'https://atomscan.com/kujira/transactions/abcd'
    );
    expect(kujira?.explorerUrl).not.toContain('finder.kujira.app');
    expect(kujira?.explorerUrl).not.toContain('mintscan.io');
  });

  it('points advertised Cosmos governance links at current explorers', () => {
    expect(getAdvertisedCosmosGovernanceUrl('beezee-1')).toBe(
      'https://explorer.getbze.com/beezee/gov'
    );
    expect(getAdvertisedCosmosGovernanceUrl('atomone-1')).toBe(
      'https://www.mintscan.io/atomone/proposals'
    );
    expect(getAdvertisedCosmosGovernanceUrl('cosmoshub-4')).toBe(
      'https://www.mintscan.io/cosmos/proposals'
    );
    expect(getAdvertisedCosmosGovernanceUrl('osmosis-1')).toBe(
      'https://www.mintscan.io/osmosis/proposals'
    );
    expect(getAdvertisedCosmosGovernanceUrl('juno-1')).toBeUndefined();
  });

  it('skips retired AtomOne explorers when selecting from registry candidates', () => {
    const selected = selectPublicCosmosExplorer([
      {
        kind: 'ping.pub',
        url: 'https://explorer.allinbits.com/atomone',
      },
      {
        kind: 'mintscan',
        url: 'https://www.mintscan.io/atomone',
      },
    ]);
    expect(selected?.url).toBe('https://www.mintscan.io/atomone');
  });

  it('points BeeZee users at a live explorer instead of ping.pub', () => {
    const beezee = getChainById('beezee-1');
    expect(beezee?.explorerUrl).toBe('https://explorer.getbze.com/beezee');
    expect(beezee?.explorerAccountPath).toBe('/account/{address}');
    expect(beezee?.explorerTxPath).toBe('/tx/{txHash}');
    expect(getExplorerAccountUrl('beezee-1', 'bze1abc')).toBe(
      'https://explorer.getbze.com/beezee/account/bze1abc'
    );
    expect(getExplorerTxUrl('beezee-1', 'abcd')).toBe(
      'https://explorer.getbze.com/beezee/tx/abcd'
    );
    expect(beezee?.rpc).not.toEqual(expect.arrayContaining([expect.stringContaining('whenmoonwhenlambo')]));
    expect(beezee?.rest).not.toEqual(expect.arrayContaining([expect.stringContaining('whenmoonwhenlambo')]));
  });

  it('drops Osmosis goldenratiostaking REST that now 502s', () => {
    const osmosis = getChainById('osmosis-1');
    expect(osmosis?.rest).toEqual([
      'https://lcd.osmosis.zone/',
      'https://rest.lavenderfive.com:443/osmosis',
      'https://rest-osmosis.ecostake.com',
      'https://osmosis-api.polkachu.com',
    ]);
  });

  it('keeps enabled advertised chains aligned with the live registry', () => {
    const enabledIds = getEnabledChains().map((chain) => chain.id);
    ADVERTISED_COSMOS_IDS.forEach((id) => {
      expect(enabledIds).toContain(id);
    });
  });

  it('classifies retired hosts and strips them from public endpoint lists', () => {
    expect(usesDeprecatedCosmosHost('https://cosmos-rpc.quickapi.com:443')).toBe(true);
    expect(usesDeprecatedCosmosHost('https://cosmoshub.lava.build:443')).toBe(true);
    expect(usesDeprecatedCosmosHost('https://rpc-cosmoshub.whispernode.com:443')).toBe(true);
    expect(usesDeprecatedCosmosHost('https://explorer.allinbits.com/atomone')).toBe(true);
    expect(usesDeprecatedCosmosHost('https://ezstaking.app/juno/account/juno1abc')).toBe(true);
    expect(usesDeprecatedCosmosHost('https://finder.kujira.app/kaiyo-1/tx/abcd')).toBe(true);
    expect(usesDeprecatedCosmosHost('https://celestia.explorers.guru/account/celestia1abc')).toBe(
      true
    );
    expect(usesDeprecatedCosmosHost('https://archway.explorers.guru/')).toBe(true);
    expect(usesDeprecatedCosmosHost('https://www.mintscan.io/atomone')).toBe(false);
    expect(usesDeprecatedCosmosHost('https://atomscan.com/juno')).toBe(false);
    expect(usesDeprecatedCosmosHost('https://www.mintscan.io/celestia')).toBe(false);
    expect(usesDeprecatedCosmosHost('https://rpc.lavenderfive.com:443/cosmoshub')).toBe(false);

    expect(
      filterPublicCosmosEndpoints([
        'https://cosmos-rpc.quickapi.com:443',
        'http://rpc-cosmoshub.freshstaking.com:26657',
        'https://rpc.lavenderfive.com:443/cosmoshub',
        'https://rpc.evmos.testnet.run',
        'https://cosmos-rpc.polkachu.com',
        'https://127.0.0.1:26657',
      ])
    ).toEqual([
      'https://rpc.lavenderfive.com:443/cosmoshub',
      'https://cosmos-rpc.polkachu.com',
    ]);
  });

  it('keeps the sync-script denylist aligned with cosmos-endpoints', () => {
    const script = readFileSync(join(__dirname, '../../../scripts/sync-chain-registry.ts'), 'utf8');
    DEPRECATED_COSMOS_ENDPOINT_HOSTS.forEach((host) => {
      expect(script).toContain(host);
    });
    expect(script).toMatch(/DEPRECATED_COSMOS_ENDPOINT_HOSTS/);
  });
});
