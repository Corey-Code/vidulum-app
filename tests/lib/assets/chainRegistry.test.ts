/**
 * Chain Registry Tests
 *
 * Tests for asset registry and token metadata
 */

import {
  fetchChainAssets,
  getAssetByDenom,
  getTokenColor,
} from '@/lib/assets/chainRegistry';
import { mockFetchResponse } from '../../setup';

describe('Chain Registry', () => {
  describe('fetchChainAssets', () => {
    describe('Bitcoin/UTXO chains (static assets)', () => {
      it('should return assets for Bitcoin mainnet', async () => {
        const assets = await fetchChainAssets('bitcoin-mainnet');

        expect(assets.length).toBe(1);
        expect(assets[0].symbol).toBe('BTC');
        expect(assets[0].decimals).toBe(8);
        expect(assets[0].denom).toBe('sat');
      });

      it('should return assets for Litecoin', async () => {
        const assets = await fetchChainAssets('litecoin-mainnet');

        expect(assets.length).toBe(1);
        expect(assets[0].symbol).toBe('LTC');
        expect(assets[0].decimals).toBe(8);
      });

      it('should return assets for Zcash', async () => {
        const assets = await fetchChainAssets('zcash-mainnet');

        expect(assets.length).toBe(1);
        expect(assets[0].symbol).toBe('ZEC');
      });

      it('should return assets for Dogecoin', async () => {
        const assets = await fetchChainAssets('dogecoin-mainnet');

        expect(assets.length).toBe(1);
        expect(assets[0].symbol).toBe('DOGE');
      });

      it('should return assets for Ravencoin', async () => {
        const assets = await fetchChainAssets('ravencoin-mainnet');

        expect(assets.length).toBe(1);
        expect(assets[0].symbol).toBe('RVN');
      });

      it('should return assets for Ritocoin', async () => {
        const assets = await fetchChainAssets('ritocoin-mainnet');

        expect(assets.length).toBe(1);
        expect(assets[0].symbol).toBe('RITO');
      });

      it('should return assets for NOSO', async () => {
        const assets = await fetchChainAssets('noso-mainnet');

        expect(assets.length).toBe(1);
        expect(assets[0].symbol).toBe('NOSO');
      });

      it('should return assets for Flux', async () => {
        const assets = await fetchChainAssets('flux-mainnet');

        expect(assets.length).toBe(1);
        expect(assets[0].symbol).toBe('FLUX');
      });

      it('should return assets for BitcoinZ', async () => {
        const assets = await fetchChainAssets('bitcoinz-mainnet');

        expect(assets.length).toBe(1);
        expect(assets[0].symbol).toBe('BTCZ');
      });
    });

    describe('EVM chains (static assets)', () => {
      it('should return assets for Ethereum', async () => {
        const assets = await fetchChainAssets('ethereum-mainnet');

        expect(assets.length).toBe(1);
        expect(assets[0].symbol).toBe('ETH');
        expect(assets[0].decimals).toBe(18);
      });

      it('should return assets for BNB Chain', async () => {
        const assets = await fetchChainAssets('bnb-mainnet');

        expect(assets.length).toBe(1);
        expect(assets[0].symbol).toBe('BNB');
      });

      it('should return assets for Base', async () => {
        const assets = await fetchChainAssets('base-mainnet');

        expect(assets.length).toBe(1);
        expect(assets[0].symbol).toBe('ETH');
      });
    });

    describe('Cosmos chains (with fetch)', () => {
      it('should return fallback assets for unknown chain mapping', async () => {
        const assets = await fetchChainAssets('unknown-cosmos-chain');
        expect(assets).toEqual([]);
      });

      it('should return fallback assets when fetch fails', async () => {
        // Mock a failed fetch
        (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

        const assets = await fetchChainAssets('beezee-1');

        // Should return fallback assets
        expect(assets.length).toBeGreaterThan(0);
        const bze = assets.find((a) => a.symbol === 'BZE');
        expect(bze).toBeDefined();
      });

      it('should parse chain registry response correctly', async () => {
        const mockAssetList = {
          chain_name: 'beezee',
          assets: [
            {
              description: 'BeeZee native token',
              denom_units: [
                { denom: 'ubze', exponent: 0 },
                { denom: 'bze', exponent: 6 },
              ],
              base: 'ubze',
              name: 'BeeZee',
              display: 'bze',
              symbol: 'BZE',
              coingecko_id: 'bzedge',
            },
          ],
        };

        (global.fetch as jest.Mock).mockResolvedValueOnce(mockFetchResponse(mockAssetList));

        const assets = await fetchChainAssets('beezee-1');

        expect(assets.length).toBe(1);
        expect(assets[0].symbol).toBe('BZE');
        expect(assets[0].denom).toBe('ubze');
        expect(assets[0].decimals).toBe(6);
        expect(assets[0].coingeckoId).toBe('bzedge');
      });
    });

    it('should return empty array for completely unknown chain', async () => {
      const assets = await fetchChainAssets('totally-unknown-chain-xyz');
      expect(assets).toEqual([]);
    });
  });

  describe('getAssetByDenom', () => {
    it('should find asset by denom in array', () => {
      const assets = [
        { symbol: 'BZE', name: 'BeeZee', denom: 'ubze', decimals: 6 },
        { symbol: 'VDL', name: 'Vidulum', denom: 'factory/bze.../uvdl', decimals: 6 },
      ];

      const asset = getAssetByDenom(assets, 'ubze');

      expect(asset).toBeDefined();
      expect(asset?.symbol).toBe('BZE');
    });

    it('should return undefined for unknown denom', () => {
      const assets = [{ symbol: 'BZE', name: 'BeeZee', denom: 'ubze', decimals: 6 }];

      const asset = getAssetByDenom(assets, 'unknown-denom');
      expect(asset).toBeUndefined();
    });

    it('should work with empty array', () => {
      const asset = getAssetByDenom([], 'ubze');
      expect(asset).toBeUndefined();
    });
  });

  describe('getTokenColor', () => {
    it('should return color for BTC', () => {
      const color = getTokenColor('BTC');
      expect(color).toBe('#F7931A');
    });

    it('should return color for ETH', () => {
      const color = getTokenColor('ETH');
      expect(color).toBe('#627EEA');
    });

    it('should return color for BZE', () => {
      const color = getTokenColor('BZE');
      expect(color).toBe('#3182CE');
    });

    it('should return color for LTC', () => {
      const color = getTokenColor('LTC');
      expect(color).toBe('#345D9D');
    });

    it('should return color for DOGE', () => {
      const color = getTokenColor('DOGE');
      expect(color).toBe('#C2A633');
    });

    it('should return color for RVN', () => {
      const color = getTokenColor('RVN');
      expect(color).toBe('#384182');
    });

    it('should return color for RITO', () => {
      const color = getTokenColor('RITO');
      expect(color).toBe('#4A90D9');
    });

    it('should return color for NOSO', () => {
      const color = getTokenColor('NOSO');
      expect(color).toBe('#1E88E5');
    });

    it('should return default color for unknown token', () => {
      const color = getTokenColor('UNKNOWN');
      expect(color).toBe('#718096');
    });
  });

  describe('Asset Properties', () => {
    it('should have coingeckoId for major UTXO tokens', async () => {
      const btcAssets = await fetchChainAssets('bitcoin-mainnet');
      expect(btcAssets[0].coingeckoId).toBe('bitcoin');

      const ltcAssets = await fetchChainAssets('litecoin-mainnet');
      expect(ltcAssets[0].coingeckoId).toBe('litecoin');
    });

    it('should have coingeckoId for EVM tokens', async () => {
      const ethAssets = await fetchChainAssets('ethereum-mainnet');
      expect(ethAssets[0].coingeckoId).toBe('ethereum');

      const bnbAssets = await fetchChainAssets('bnb-mainnet');
      expect(bnbAssets[0].coingeckoId).toBe('binancecoin');
    });

    it('should have proper decimals for Bitcoin-like chains', async () => {
      const btcAssets = await fetchChainAssets('bitcoin-mainnet');
      expect(btcAssets[0].decimals).toBe(8);

      const dogeAssets = await fetchChainAssets('dogecoin-mainnet');
      expect(dogeAssets[0].decimals).toBe(8);
    });

    it('should have proper decimals for EVM chains', async () => {
      const ethAssets = await fetchChainAssets('ethereum-mainnet');
      expect(ethAssets[0].decimals).toBe(18);
    });
  });
});
