/**
 * UTXO endpoint freshness tests
 *
 * BitcoinClient speaks Esplora (Blockstream/Mempool) paths. After the lull,
 * several advertised hosts were dead or used a different JSON shape.
 */

import {
  BITCOIN_MAINNET,
  BITCOIN_NETWORKS,
  BITCOIN_TESTNET,
  getExplorerAccountUrl,
  getExplorerTxUrl,
} from '@/lib/networks';
import {
  BITCOINZ_MAINNET,
  DOGECOIN_MAINNET,
  FLUX_MAINNET,
  LITECOIN_MAINNET,
  NOSO_MAINNET,
  RAVENCOIN_MAINNET,
  RITOCOIN_MAINNET,
  ZCASH_MAINNET,
} from '@/lib/networks/bitcoin';
import {
  DEPRECATED_UTXO_ENDPOINT_HOSTS,
  ESPLORA_UTXO_NETWORK_IDS,
  INCOMPATIBLE_UTXO_API_HOSTS,
  usesDeprecatedUtxoHost,
  usesIncompatibleUtxoApiHost,
  utxoEndpointHaystack,
} from '@/lib/networks/utxo-endpoints';

function endpointHaystack(network: { apiUrls: string[]; explorerUrl?: string }): string {
  return [...network.apiUrls, network.explorerUrl ?? ''].join(' ');
}

describe('UTXO endpoint freshness', () => {
  const advertised = BITCOIN_NETWORKS.filter((network) => network.enabled);

  it('omits retired explorer and API hosts from every UTXO config', () => {
    advertised.forEach((network) => {
      const haystack = endpointHaystack(network);
      DEPRECATED_UTXO_ENDPOINT_HOSTS.forEach((host) => {
        expect(haystack).not.toContain(host);
      });
    });
  });

  it('does not use incompatible JSON APIs as Esplora failover', () => {
    advertised.forEach((network) => {
      const apis = network.apiUrls.join(' ');
      INCOMPATIBLE_UTXO_API_HOSTS.forEach((host) => {
        expect(apis).not.toContain(host);
      });
    });
  });

  it('keeps HTTPS Esplora bases on Bitcoin and Litecoin', () => {
    expect(ESPLORA_UTXO_NETWORK_IDS).toEqual([
      'bitcoin-mainnet',
      'bitcoin-testnet',
      'litecoin-mainnet',
    ]);

    expect(BITCOIN_MAINNET.apiUrls).toEqual([
      'https://blockstream.info/api',
      'https://mempool.space/api',
    ]);
    expect(BITCOIN_TESTNET.apiUrls).toEqual([
      'https://blockstream.info/testnet/api',
      'https://mempool.space/testnet/api',
    ]);
    expect(LITECOIN_MAINNET.apiUrls).toEqual(['https://litecoinspace.org/api']);

    [BITCOIN_MAINNET, BITCOIN_TESTNET, LITECOIN_MAINNET].forEach((network) => {
      expect(network.apiUrls.length).toBeGreaterThan(0);
      network.apiUrls.forEach((endpoint) => {
        expect(endpoint).toMatch(/^https:\/\//);
      });
    });
  });

  it('points Zcash users at a live explorer instead of zcha.in', () => {
    expect(ZCASH_MAINNET.explorerUrl).toBe('https://cipherscan.app');
    expect(ZCASH_MAINNET.explorerAccountPath).toBe('/address/{address}');
    expect(ZCASH_MAINNET.explorerTxPath).toBe('/tx/{txHash}');
    expect(ZCASH_MAINNET.apiUrls).toEqual([]);
    expect(getExplorerAccountUrl('zcash-mainnet', 't1example')).toBe(
      'https://cipherscan.app/address/t1example'
    );
    expect(getExplorerTxUrl('zcash-mainnet', 'abcd')).toBe('https://cipherscan.app/tx/abcd');
  });

  it('points Ravencoin users at Ravencoin Explorer instead of ravencoin.network', () => {
    expect(RAVENCOIN_MAINNET.explorerUrl).toBe('https://ravencoinexplorer.com');
    expect(RAVENCOIN_MAINNET.explorerAccountPath).toBe('/address/{address}');
    expect(RAVENCOIN_MAINNET.explorerTxPath).toBe('/tx/{txHash}');
    expect(getExplorerAccountUrl('ravencoin-mainnet', 'RVexample')).toBe(
      'https://ravencoinexplorer.com/address/RVexample'
    );
    expect(getExplorerTxUrl('ravencoin-mainnet', 'abcd')).toBe(
      'https://ravencoinexplorer.com/tx/abcd'
    );
  });

  it('omits Ritocoin explorer links after the public hosts went dark', () => {
    expect(RITOCOIN_MAINNET.explorerUrl).toBeUndefined();
    expect(getExplorerAccountUrl('ritocoin-mainnet', 'Rexample')).toBeNull();
    expect(getExplorerTxUrl('ritocoin-mainnet', 'abcd')).toBeNull();
  });

  it('points Dogecoin users at OKLink instead of dogechain.info', () => {
    expect(DOGECOIN_MAINNET.explorerUrl).toBe('https://www.oklink.com/dogecoin');
    expect(DOGECOIN_MAINNET.explorerAccountPath).toBe('/address/{address}');
    expect(DOGECOIN_MAINNET.explorerTxPath).toBe('/tx/{txHash}');
    expect(getExplorerAccountUrl('dogecoin-mainnet', 'Dexample')).toBe(
      'https://www.oklink.com/dogecoin/address/Dexample'
    );
    expect(getExplorerTxUrl('dogecoin-mainnet', 'abcd')).toBe(
      'https://www.oklink.com/dogecoin/tx/abcd'
    );
    expect(DOGECOIN_MAINNET.explorerUrl).not.toContain('dogechain.info');
  });

  it('points Flux users at Blockbook instead of explorer.runonflux.io', () => {
    expect(FLUX_MAINNET.explorerUrl).toBe('https://blockbook.runonflux.io');
    expect(FLUX_MAINNET.explorerAccountPath).toBe('/address/{address}');
    expect(FLUX_MAINNET.explorerTxPath).toBe('/tx/{txHash}');
    expect(getExplorerAccountUrl('flux-mainnet', 't1example')).toBe(
      'https://blockbook.runonflux.io/address/t1example'
    );
    expect(getExplorerTxUrl('flux-mainnet', 'abcd')).toBe(
      'https://blockbook.runonflux.io/tx/abcd'
    );
    expect(FLUX_MAINNET.explorerUrl).not.toContain('explorer.runonflux.io');
  });

  it('omits NOSO explorer links after the archive page lost address URLs', () => {
    expect(NOSO_MAINNET.explorerUrl).toBeUndefined();
    expect(getExplorerAccountUrl('noso-mainnet', 'Xexample')).toBeNull();
    expect(getExplorerTxUrl('noso-mainnet', 'abcd')).toBeNull();
  });

  it('keeps live explorers on BitcoinZ, Bitcoin, and Litecoin', () => {
    expect(BITCOINZ_MAINNET.explorerUrl).toBe('https://explorer.btcz.rocks');
    expect(BITCOIN_MAINNET.explorerUrl).toBe('https://blockstream.info');
    expect(LITECOIN_MAINNET.explorerUrl).toBe('https://litecoinspace.org');
  });

  it('classifies leftover retired Bitcoin-like explorer hosts', () => {
    expect(usesDeprecatedUtxoHost('https://dogechain.info/address/Dexample')).toBe(true);
    expect(usesDeprecatedUtxoHost('https://explorer.runonflux.io/address/t1example')).toBe(true);
    expect(usesDeprecatedUtxoHost('https://explorer.nosocoin.com/address/Xexample')).toBe(true);
    expect(usesDeprecatedUtxoHost('https://www.oklink.com/dogecoin/address/Dexample')).toBe(false);
    expect(usesDeprecatedUtxoHost('https://blockbook.runonflux.io/address/t1example')).toBe(false);
  });

  it('does not advertise Insight-style APIs that BitcoinClient cannot read', () => {
    const nonEsplora = [
      FLUX_MAINNET,
      RAVENCOIN_MAINNET,
      RITOCOIN_MAINNET,
      BITCOINZ_MAINNET,
      DOGECOIN_MAINNET,
      NOSO_MAINNET,
    ];

    nonEsplora.forEach((network) => {
      expect(network.apiUrls).toEqual([]);
    });
  });

  it('classifies retired and incompatible hosts', () => {
    const retired = utxoEndpointHaystack(
      ['https://api.zcha.in/v2'],
      'https://explorer.zcha.in'
    );
    expect(usesDeprecatedUtxoHost(retired)).toBe(true);
    expect(usesDeprecatedUtxoHost('https://blockstream.info/api')).toBe(false);
    expect(usesIncompatibleUtxoApiHost('https://api.blockcypher.com/v1/btc/main')).toBe(true);
    expect(usesIncompatibleUtxoApiHost('https://mempool.space/api')).toBe(false);
  });
});
