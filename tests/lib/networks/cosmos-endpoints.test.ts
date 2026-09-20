/**
 * Cosmos endpoint freshness tests
 *
 * After the lull, advertised Cosmos Hub still led with Lava, QuickApi, and
 * DNS-dead Whispernode/Onivalidator hops. Leftover side-chain RPC/LCD lists
 * still pointed at ezstaking.dev (521), itastakers (DNS-dead), setten.io
 * (TLS hostname mismatch), and other retired hops. Leftover official Neutron
 * hops then lingered (HTML 302 / TLS-dead LCD). Leftover Evmos hops then
 * lingered after the chain was killed (Lavender.Five 503), plus leftover
 * goldenratiostaking.net / owallet.io (502) and w3coins.io / stakeflow.io
 * (DNS-dead) hops. Leftover Kujira and Stargaze hops then lingered
 * (Lavender.Five 503; Stargaze killed / Kleomedes empty 200; Autostake
 * 404). Leftover Injective Polkachu hops then lingered (RPC/LCD
 * timeout). Leftover dYdX Polkachu dao hosts then lingered after the
 * official registry moved to dydx-rpc.polkachu.com. Leftover Juno
 * Lavender.Five hops then lingered (503). Leftover Celestia lunaroasis
 * LCD then lingered (TLS-dead) plus leftover Numia LCD (501). This
 * keeps those lists honest.
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

  it('replaces leftover Stargaze, Juno, and Kujira RPC/LCD first hops', () => {
    const stargaze = getChainById('stargaze-1');
    expect(stargaze?.rpc).toEqual([]);
    expect(stargaze?.rest).toEqual([]);
    expect(stargaze?.rpc.concat(stargaze?.rest ?? []).join(' ')).not.toMatch(
      /ezstaking\.dev|stargaze-apis\.com|stargaze\.c29r3\.xyz|lavenderfive|kleomedes/
    );

    const juno = getChainById('juno-1');
    expect(juno?.rpc[0]).toBe('https://juno.rpc.m.stavr.tech');
    expect(juno?.rpc.join(' ')).not.toContain('itastakers.com');
    expect(juno?.rpc.concat(juno?.rest ?? []).join(' ')).not.toMatch(
      /lavenderfive/
    );

    const kujira = getChainById('kaiyo-1');
    expect(kujira?.rpc).toEqual([]);
    expect(kujira?.rest).toEqual([]);
    expect(kujira?.rpc.concat(kujira?.rest ?? []).join(' ')).not.toMatch(
      /setten\.io|ibs\.team|wildsage\.io|lavenderfive/
    );
  });

  it('replaces leftover Celestia, Evmos, Archway, Axelar, Neutron, and Stride hops', () => {
    const celestia = getChainById('celestia');
    expect(celestia?.rpc.concat(celestia?.rest ?? []).join(' ')).not.toMatch(
      /newmetric\.xyz|api\.lunaroasis\.net|public-celestia-lcd\.numia\.xyz/
    );
    expect(celestia?.rpc).toEqual(
      expect.arrayContaining([
        'https://public-celestia-rpc.numia.xyz',
        'https://celestia-rpc.publicnode.com:443',
      ])
    );
    expect(celestia?.rest).toEqual(
      expect.arrayContaining([
        'https://api.celestia.nodestake.org',
        'https://celestia-rest.publicnode.com',
      ])
    );

    const evmos = getChainById('evmos_9001-2');
    expect(evmos?.rpc.concat(evmos?.rest ?? []).join(' ')).not.toMatch(
      /bd\.evmos\.org|lavenderfive\.com/
    );
    expect(evmos?.rpc).toEqual([]);
    expect(evmos?.rest).toEqual([]);

    const archway = getChainById('archway-1');
    expect(archway?.rpc[0]).toBe('https://rpc.mainnet.archway.io');
    expect(archway?.rpc.concat(archway?.rest ?? []).join(' ')).not.toMatch(
      /utsa\.tech|allthatnode\.com/
    );

    const axelar = getChainById('axelar-dojo-1');
    expect(axelar?.rpc[0]).toBe('https://axelar-rpc.pops.one:443');
    expect(axelar?.rpc.concat(axelar?.rest ?? []).join(' ')).not.toContain('imperator.co');

    const neutron = getChainById('neutron-1');
    expect(neutron?.rpc.concat(neutron?.rest ?? []).join(' ')).not.toMatch(
      /tm\.p2p\.org|rpc-lb\.neutron\.org|voidara|pulsarix/
    );
    expect(neutron?.rpc[0]).toBe('https://rpc.lavenderfive.com:443/neutron');

    const stride = getChainById('stride-1');
    expect(stride?.rpc.concat(stride?.rest ?? []).join(' ')).not.toMatch(
      /silentvalidator\.com|cosmos-spaces\.cloud/
    );
    expect(stride?.rpc[0]).toBe('https://stride-rpc.polkachu.com/');
  });

  it('drops leftover Evmos RPC/LCD hops after the chain was killed', () => {
    const evmos = getChainById('evmos_9001-2');
    expect(evmos?.enabled).toBe(false);
    expect(evmos?.rpc).toEqual([]);
    expect(evmos?.rest).toEqual([]);
    expect(evmos?.rpc.concat(evmos?.rest ?? []).join(' ')).not.toMatch(
      /lavenderfive\.com|bd\.evmos\.org|publicnode\.com|polkachu\.com/
    );
    expect(evmos?.explorerUrl).toBe('https://www.mintscan.io/evmos');
  });

  it('drops leftover Injective, Noble, Akash, and Terra hops that 502 or no longer resolve', () => {
    const injective = getChainById('injective-1');
    expect(injective?.rpc.concat(injective?.rest ?? []).join(' ')).not.toMatch(
      /goldenratiostaking\.net|stakeflow\.io/
    );
    expect(injective?.rpc[0]).toBe('https://injective-rpc.highstakes.ch');
    expect(injective?.rpc.concat(injective?.rest ?? []).join(' ')).not.toMatch(
      /injective-rpc\.polkachu\.com|injective-api\.polkachu\.com/
    );

    const noble = getChainById('noble-1');
    expect(noble?.rpc.concat(noble?.rest ?? []).join(' ')).not.toContain('owallet.io');
    expect(noble?.rpc).toEqual([
      'https://noble-rpc.polkachu.com',
      'https://rpc.lavenderfive.com:443/noble',
    ]);
    expect(noble?.rest).toEqual([
      'https://noble-api.polkachu.com',
      'https://rest.lavenderfive.com:443/noble',
    ]);

    const akash = getChainById('akashnet-2');
    expect(akash?.rpc.concat(akash?.rest ?? []).join(' ')).not.toMatch(/w3coins\.io|stakeflow\.io/);

    const terra = getChainById('phoenix-1');
    expect(terra?.rpc.concat(terra?.rest ?? []).join(' ')).not.toContain('stakeflow.io');
  });

  it('drops leftover Injective Polkachu hops that now time out', () => {
    const injective = getChainById('injective-1');
    expect(injective?.rpc).toEqual([
      'https://injective-rpc.highstakes.ch',
      'https://rpc.lavenderfive.com:443/injective',
      'https://injective-rpc.publicnode.com:443',
    ]);
    expect(injective?.rest).toEqual([
      'https://injective-api.highstakes.ch',
      'https://rest.lavenderfive.com:443/injective',
      'https://injective-rest.publicnode.com',
      'https://public.stakewolle.com/cosmos/injective/rest',
    ]);
    expect(injective?.rpc.concat(injective?.rest ?? []).join(' ')).not.toMatch(
      /injective-rpc\.polkachu\.com|injective-api\.polkachu\.com/
    );
  });

  it('drops leftover Kujira and Stargaze RPC/LCD hops after public hops died', () => {
    const kujira = getChainById('kaiyo-1');
    expect(kujira?.enabled).toBe(false);
    expect(kujira?.rpc).toEqual([]);
    expect(kujira?.rest).toEqual([]);
    expect(kujira?.rpc.concat(kujira?.rest ?? []).join(' ')).not.toMatch(
      /lavenderfive\.com|kleomedes\.network|polkachu\.com|autostake\.com|theamsolutions\.info/
    );
    expect(kujira?.explorerUrl).toBe('https://atomscan.com/kujira');

    const stargaze = getChainById('stargaze-1');
    expect(stargaze?.enabled).toBe(false);
    expect(stargaze?.rpc).toEqual([]);
    expect(stargaze?.rest).toEqual([]);
    expect(stargaze?.rpc.concat(stargaze?.rest ?? []).join(' ')).not.toMatch(
      /lavenderfive\.com|kleomedes\.network|stargaze-apis\.com|polkachu\.com/
    );
    expect(stargaze?.explorerUrl).toBe('https://www.mintscan.io/stargaze/');
  });

  it('drops leftover Autostake dYdX hops that now 404', () => {
    const dydx = getChainById('dydx-mainnet-1');
    expect(dydx?.rpc.concat(dydx?.rest ?? []).join(' ')).not.toContain('autostake.com');
    expect(dydx?.rpc).toEqual([
      'https://dydx-rpc.kingnodes.com:443',
      'https://dydx-rpc.polkachu.com:443',
      'https://rpc.lavenderfive.com:443/dydx',
      'https://dydx-rpc.publicnode.com:443',
    ]);
    expect(dydx?.rest).toEqual([
      'https://dydx-api.polkachu.com',
      'https://dydx-rest.kingnodes.com:443',
      'https://rest.lavenderfive.com:443/dydx',
      'https://dydx-rest.publicnode.com',
    ]);
  });

  it('drops leftover Juno Lavender.Five hops that now 503', () => {
    const juno = getChainById('juno-1');
    expect(juno?.rpc).toEqual([
      'https://juno.rpc.m.stavr.tech',
      'https://juno-rpc.polkachu.com',
      'https://juno-rpc.kleomedes.network',
      'https://juno-rpc.stakeandrelax.net',
      'https://juno-rpc.publicnode.com:443',
    ]);
    expect(juno?.rest).toEqual([
      'https://juno.api.m.stavr.tech',
      'https://juno-api.polkachu.com',
      'https://juno-api.kleomedes.network',
      'https://juno-api.stakeandrelax.net',
      'https://juno-rest.publicnode.com',
    ]);
    expect(juno?.rpc.concat(juno?.rest ?? []).join(' ')).not.toMatch(
      /lavenderfive\.com/
    );
  });

  it('drops leftover Celestia lunaroasis LCD and leftover Numia LCD', () => {
    const celestia = getChainById('celestia');
    expect(celestia?.rpc).toEqual(
      expect.arrayContaining([
        'https://public-celestia-rpc.numia.xyz',
        'https://rpc.lunaroasis.net',
      ])
    );
    expect(celestia?.rest.join(' ')).not.toMatch(
      /api\.lunaroasis\.net|public-celestia-lcd\.numia\.xyz/
    );
  });

  it('replaces leftover dYdX Polkachu dao hosts with current Polkachu hops', () => {
    const dydx = getChainById('dydx-mainnet-1');
    expect(dydx?.rpc).toEqual([
      'https://dydx-rpc.kingnodes.com:443',
      'https://dydx-rpc.polkachu.com:443',
      'https://rpc.lavenderfive.com:443/dydx',
      'https://dydx-rpc.publicnode.com:443',
    ]);
    expect(dydx?.rest).toEqual([
      'https://dydx-api.polkachu.com',
      'https://dydx-rest.kingnodes.com:443',
      'https://rest.lavenderfive.com:443/dydx',
      'https://dydx-rest.publicnode.com',
    ]);
    expect(dydx?.rpc.concat(dydx?.rest ?? []).join(' ')).not.toMatch(
      /dydx-dao-rpc\.polkachu\.com|dydx-dao-api\.polkachu\.com/
    );
  });

  it('replaces leftover official Neutron RPC/LCD hops with current public hops', () => {
    const neutron = getChainById('neutron-1');
    expect(neutron?.rpc).toEqual([
      'https://rpc.lavenderfive.com:443/neutron',
      'https://neutron-rpc.polkachu.com:443',
      'https://rpc.neutron.solva.solutions:443',
    ]);
    expect(neutron?.rest).toEqual([
      'https://rest.lavenderfive.com:443/neutron',
      'https://neutron-api.polkachu.com',
      'https://rest.neutron.solva.solutions:443',
    ]);
    expect(neutron?.rpc.concat(neutron?.rest ?? []).join(' ')).not.toMatch(
      /rpc-lb\.neutron\.org|rest-lb\.neutron\.org|neutron-1\.neutron\.org/
    );
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
    expect(usesDeprecatedCosmosHost('https://rpc-stargaze.ezstaking.dev')).toBe(true);
    expect(usesDeprecatedCosmosHost('https://rpc-juno.itastakers.com')).toBe(true);
    expect(usesDeprecatedCosmosHost('https://rpc.kaiyo.kujira.setten.io')).toBe(true);
    expect(usesDeprecatedCosmosHost('https://celestia-rpc.mesa.newmetric.xyz')).toBe(true);
    expect(usesDeprecatedCosmosHost('https://tendermint.bd.evmos.org:26657')).toBe(true);
    expect(usesDeprecatedCosmosHost('https://rpc.novel.remedy.tm.p2p.org')).toBe(true);
    expect(usesDeprecatedCosmosHost('https://rpc-lb.neutron.org')).toBe(true);
    expect(usesDeprecatedCosmosHost('https://rest-lb.neutron.org')).toBe(true);
    expect(usesDeprecatedCosmosHost('https://rest-voidara.neutron-1.neutron.org')).toBe(true);
    expect(usesDeprecatedCosmosHost('https://rest-pulsarix.neutron-1.neutron.org')).toBe(true);
    expect(usesDeprecatedCosmosHost('https://rpc.lavenderfive.com:443/evmos')).toBe(true);
    expect(usesDeprecatedCosmosHost('https://rest.lavenderfive.com:443/evmos')).toBe(true);
    expect(usesDeprecatedCosmosHost('https://rpc.injective.goldenratiostaking.net')).toBe(true);
    expect(usesDeprecatedCosmosHost('https://noble-rpc.owallet.io')).toBe(true);
    expect(usesDeprecatedCosmosHost('https://akash-rpc.w3coins.io')).toBe(true);
    expect(usesDeprecatedCosmosHost('https://rpc-terra-01.stakeflow.io')).toBe(true);
    expect(usesDeprecatedCosmosHost('https://rpc.lavenderfive.com:443/kujira')).toBe(true);
    expect(usesDeprecatedCosmosHost('https://rest.lavenderfive.com:443/stargaze')).toBe(true);
    expect(usesDeprecatedCosmosHost('https://dydx-mainnet-rpc.autostake.com:443')).toBe(true);
    expect(usesDeprecatedCosmosHost('https://stargaze-rpc.kleomedes.network')).toBe(true);
    expect(usesDeprecatedCosmosHost('https://kuji-rpc.kleomedes.network')).toBe(true);
    expect(usesDeprecatedCosmosHost('https://kujira-rpc.polkachu.com')).toBe(true);
    expect(usesDeprecatedCosmosHost('https://kujira-rpc.theamsolutions.info')).toBe(true);
    expect(usesDeprecatedCosmosHost('https://injective-rpc.polkachu.com')).toBe(true);
    expect(usesDeprecatedCosmosHost('https://injective-api.polkachu.com')).toBe(true);
    expect(usesDeprecatedCosmosHost('https://dydx-dao-rpc.polkachu.com')).toBe(true);
    expect(usesDeprecatedCosmosHost('https://dydx-dao-api.polkachu.com')).toBe(true);
    expect(usesDeprecatedCosmosHost('https://rpc.lavenderfive.com:443/juno')).toBe(true);
    expect(usesDeprecatedCosmosHost('https://rest.lavenderfive.com:443/juno')).toBe(true);
    expect(usesDeprecatedCosmosHost('https://api.lunaroasis.net')).toBe(true);
    expect(usesDeprecatedCosmosHost('https://public-celestia-lcd.numia.xyz')).toBe(true);
    expect(usesDeprecatedCosmosHost('https://rpc.lunaroasis.net')).toBe(false);
    expect(usesDeprecatedCosmosHost('https://public-celestia-rpc.numia.xyz')).toBe(false);
    expect(usesDeprecatedCosmosHost('https://dydx-rpc.polkachu.com:443')).toBe(false);
    expect(usesDeprecatedCosmosHost('https://dydx-api.polkachu.com')).toBe(false);
    expect(usesDeprecatedCosmosHost('https://noble-rpc.polkachu.com')).toBe(false);
    expect(usesDeprecatedCosmosHost('https://rpc.lavenderfive.com:443/neutron')).toBe(false);
    expect(usesDeprecatedCosmosHost('https://juno-rpc.kleomedes.network')).toBe(false);
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
        'https://rpc-stargaze.ezstaking.dev',
        'https://rpc-juno.itastakers.com',
        'https://rpc.kaiyo.kujira.setten.io',
        'https://rpc-lb.neutron.org',
        'https://rest-voidara.neutron-1.neutron.org',
        'https://rpc.lavenderfive.com:443/evmos',
        'https://rpc.injective.goldenratiostaking.net',
        'https://noble-rpc.owallet.io',
        'https://akash-rpc.w3coins.io',
        'https://rpc-terra-01.stakeflow.io',
        'https://rpc.lavenderfive.com:443/kujira',
        'https://rpc.lavenderfive.com:443/stargaze',
        'https://dydx-mainnet-rpc.autostake.com:443',
        'https://stargaze-rpc.kleomedes.network',
        'https://kujira-rpc.theamsolutions.info',
        'https://injective-rpc.polkachu.com',
        'https://dydx-dao-rpc.polkachu.com',
        'https://rpc.lavenderfive.com:443/juno',
        'https://api.lunaroasis.net',
        'https://public-celestia-lcd.numia.xyz',
        'https://dydx-rpc.polkachu.com:443',
        'https://rpc.lunaroasis.net',
        'https://public-celestia-rpc.numia.xyz',
      ])
    ).toEqual([
      'https://rpc.lavenderfive.com:443/cosmoshub',
      'https://cosmos-rpc.polkachu.com',
      'https://dydx-rpc.polkachu.com:443',
      'https://rpc.lunaroasis.net',
      'https://public-celestia-rpc.numia.xyz',
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
