/**
 * Network Registry Tests
 * 
 * Tests for network configuration and registry functionality
 */

import {
  networkRegistry,
  getExplorerAccountUrl,
  getExplorerTxUrl,
  isCosmosNetwork,
  isBitcoinNetwork,
  isEvmNetwork,
  getUINetworks,
  BEEZEE_MAINNET,
  BITCOIN_MAINNET,
  ETHEREUM_MAINNET,
} from '@/lib/networks';

describe('Network Registry', () => {
  describe('networkRegistry', () => {
    it('should have registered Cosmos networks', () => {
      const cosmos = networkRegistry.getByType('cosmos');
      expect(cosmos.length).toBeGreaterThan(0);
      expect(cosmos.some(n => n.id === 'beezee-1')).toBe(true);
    });

    it('should have registered Bitcoin networks', () => {
      const bitcoin = networkRegistry.getByType('bitcoin');
      expect(bitcoin.length).toBeGreaterThan(0);
      expect(bitcoin.some(n => n.id === 'bitcoin-mainnet')).toBe(true);
    });

    it('should have registered EVM networks', () => {
      const evm = networkRegistry.getByType('evm');
      expect(evm.length).toBeGreaterThan(0);
      expect(evm.some(n => n.id === 'ethereum-mainnet')).toBe(true);
    });

    it('should get network by ID', () => {
      const beezee = networkRegistry.get('beezee-1');
      expect(beezee).toBeDefined();
      expect(beezee?.name).toBe('BeeZee');
    });

    it('should return undefined for unknown network', () => {
      const unknown = networkRegistry.get('unknown-network');
      expect(unknown).toBeUndefined();
    });

    it('should get Cosmos network with correct type', () => {
      const cosmos = networkRegistry.getCosmos('beezee-1');
      expect(cosmos).toBeDefined();
      expect(cosmos?.type).toBe('cosmos');
      expect(cosmos?.rpc).toBeInstanceOf(Array);
      expect(cosmos?.rest).toBeInstanceOf(Array);
    });

    it('should get Bitcoin network with correct type', () => {
      const bitcoin = networkRegistry.getBitcoin('bitcoin-mainnet');
      expect(bitcoin).toBeDefined();
      expect(bitcoin?.type).toBe('bitcoin');
      expect(bitcoin?.apiUrls).toBeInstanceOf(Array);
    });

    it('should get EVM network with correct type', () => {
      const evm = networkRegistry.getEvm('ethereum-mainnet');
      expect(evm).toBeDefined();
      expect(evm?.type).toBe('evm');
      expect(evm?.rpcUrls).toBeInstanceOf(Array);
    });

    it('should return null for wrong network type getter', () => {
      expect(networkRegistry.getCosmos('bitcoin-mainnet')).toBeUndefined();
      expect(networkRegistry.getBitcoin('beezee-1')).toBeUndefined();
      expect(networkRegistry.getEvm('beezee-1')).toBeUndefined();
    });

    it('should check if network is enabled', () => {
      expect(networkRegistry.isEnabled('beezee-1')).toBe(true);
      expect(networkRegistry.isEnabled('bzetestnet-2')).toBe(false);
    });

    it('should get only enabled networks', () => {
      const enabled = networkRegistry.getEnabled();
      const allEnabled = enabled.every(n => n.enabled);
      expect(allEnabled).toBe(true);
    });

    it('should get enabled networks by type', () => {
      const enabledCosmos = networkRegistry.getEnabledByType('cosmos');
      expect(enabledCosmos.every(n => n.enabled && n.type === 'cosmos')).toBe(true);
    });
  });

  describe('Network Configurations', () => {
    describe('Cosmos Networks', () => {
      it('should have valid BeeZee mainnet config', () => {
        expect(BEEZEE_MAINNET.id).toBe('beezee-1');
        expect(BEEZEE_MAINNET.type).toBe('cosmos');
        expect(BEEZEE_MAINNET.rpc.length).toBeGreaterThan(0);
        expect(BEEZEE_MAINNET.rest.length).toBeGreaterThan(0);
        expect(BEEZEE_MAINNET.bech32Prefix).toBe('bze');
        expect(BEEZEE_MAINNET.feeDenom).toBe('ubze');
        expect(BEEZEE_MAINNET.coinType).toBe(118);
      });

      it('should have multiple RPC endpoints for failover', () => {
        expect(BEEZEE_MAINNET.rpc.length).toBeGreaterThanOrEqual(1);
        BEEZEE_MAINNET.rpc.forEach(endpoint => {
          expect(endpoint).toMatch(/^https?:\/\//);
        });
      });

      it('should have multiple REST endpoints for failover', () => {
        expect(BEEZEE_MAINNET.rest.length).toBeGreaterThanOrEqual(1);
        BEEZEE_MAINNET.rest.forEach(endpoint => {
          expect(endpoint).toMatch(/^https?:\/\//);
        });
      });
    });

    describe('Bitcoin Networks', () => {
      it('should have valid Bitcoin mainnet config', () => {
        expect(BITCOIN_MAINNET.id).toBe('bitcoin-mainnet');
        expect(BITCOIN_MAINNET.type).toBe('bitcoin');
        expect(BITCOIN_MAINNET.apiUrls.length).toBeGreaterThan(0);
        expect(BITCOIN_MAINNET.network).toBe('mainnet');
        expect(BITCOIN_MAINNET.coinType).toBe(0);
        expect(BITCOIN_MAINNET.decimals).toBe(8);
      });

      it('should have valid address prefixes', () => {
        expect(BITCOIN_MAINNET.addressPrefix).toBeDefined();
        expect(BITCOIN_MAINNET.addressPrefix?.bech32).toBe('bc');
      });

      it('should have multiple API endpoints for failover', () => {
        expect(BITCOIN_MAINNET.apiUrls.length).toBeGreaterThanOrEqual(1);
        BITCOIN_MAINNET.apiUrls.forEach(endpoint => {
          expect(endpoint).toMatch(/^https?:\/\//);
        });
      });
    });

    describe('EVM Networks', () => {
      it('should have valid Ethereum mainnet config', () => {
        expect(ETHEREUM_MAINNET.id).toBe('ethereum-mainnet');
        expect(ETHEREUM_MAINNET.type).toBe('evm');
        expect(ETHEREUM_MAINNET.rpcUrls.length).toBeGreaterThan(0);
        expect(ETHEREUM_MAINNET.chainId).toBe(1);
        expect(ETHEREUM_MAINNET.coinType).toBe(60);
        expect(ETHEREUM_MAINNET.decimals).toBe(18);
      });

      it('should have valid native currency', () => {
        expect(ETHEREUM_MAINNET.nativeCurrency).toBeDefined();
        expect(ETHEREUM_MAINNET.nativeCurrency.symbol).toBe('ETH');
        expect(ETHEREUM_MAINNET.nativeCurrency.decimals).toBe(18);
      });

      it('should have multiple RPC endpoints for failover', () => {
        expect(ETHEREUM_MAINNET.rpcUrls.length).toBeGreaterThanOrEqual(1);
        ETHEREUM_MAINNET.rpcUrls.forEach(endpoint => {
          expect(endpoint).toMatch(/^https?:\/\//);
        });
      });
    });
  });

  describe('Explorer URL Helpers', () => {
    it('should generate account URL for Cosmos chain', () => {
      const url = getExplorerAccountUrl('beezee-1', 'bze1abc123');
      expect(url).toContain('bze1abc123');
      expect(url).toMatch(/^https?:\/\//);
    });

    it('should generate transaction URL for Cosmos chain', () => {
      const url = getExplorerTxUrl('beezee-1', 'ABC123TXHASH');
      expect(url).toContain('ABC123TXHASH');
      expect(url).toMatch(/^https?:\/\//);
    });

    it('should generate account URL for Bitcoin', () => {
      const url = getExplorerAccountUrl('bitcoin-mainnet', 'bc1qtest');
      expect(url).toContain('bc1qtest');
    });

    it('should generate transaction URL for Bitcoin', () => {
      const url = getExplorerTxUrl('bitcoin-mainnet', 'txhash123');
      expect(url).toContain('txhash123');
    });

    it('should generate account URL for EVM', () => {
      const url = getExplorerAccountUrl('ethereum-mainnet', '0x1234567890abcdef');
      expect(url).toContain('0x1234567890abcdef');
    });

    it('should return null for unknown network', () => {
      expect(getExplorerAccountUrl('unknown', 'addr')).toBeNull();
      expect(getExplorerTxUrl('unknown', 'hash')).toBeNull();
    });

    it('should handle absolute URLs in explorerAccountPath', () => {
      // Create a mock network with absolute URL
      const mockNetwork = {
        id: 'test-absolute',
        name: 'Test Absolute',
        type: 'cosmos' as const,
        enabled: true,
        symbol: 'TEST',
        decimals: 6,
        coinType: 118,
        rpc: ['https://rpc.test.com'],
        rest: ['https://rest.test.com'],
        bech32Prefix: 'test',
        feeDenom: 'utest',
        gasPrice: '0.025',
        features: [],
        explorerUrl: 'https://explorer-base.com',
        explorerAccountPath: 'https://mintscan.io/test/accounts/{address}',
      };
      
      networkRegistry.register(mockNetwork);
      const url = getExplorerAccountUrl('test-absolute', 'test1abc123');
      
      expect(url).toBe('https://mintscan.io/test/accounts/test1abc123');
      expect(url).toMatch(/^https:\/\//);
      // Should not have double host
      expect(url.split('https://').length - 1).toBe(1);
    });

    it('should handle absolute URLs in explorerTxPath', () => {
      // Create a mock network with absolute URL
      const mockNetwork = {
        id: 'test-absolute-tx',
        name: 'Test Absolute TX',
        type: 'cosmos' as const,
        enabled: true,
        symbol: 'TEST',
        decimals: 6,
        coinType: 118,
        rpc: ['https://rpc.test.com'],
        rest: ['https://rest.test.com'],
        bech32Prefix: 'test',
        feeDenom: 'utest',
        gasPrice: '0.025',
        features: [],
        explorerUrl: 'https://explorer-base.com',
        explorerTxPath: 'https://mintscan.io/test/transactions/{txHash}',
      };
      
      networkRegistry.register(mockNetwork);
      const url = getExplorerTxUrl('test-absolute-tx', 'ABCD1234TXHASH');
      
      expect(url).toBe('https://mintscan.io/test/transactions/ABCD1234TXHASH');
      expect(url).toMatch(/^https:\/\//);
      // Should not have double host
      expect(url.split('https://').length - 1).toBe(1);
    });

    it('should handle relative paths with explorerUrl', () => {
      // Test with Ethereum which uses relative paths
      const url = getExplorerAccountUrl('ethereum-mainnet', '0xtest');
      expect(url).toContain('etherscan.io');
      expect(url).toContain('/address/0xtest');
      expect(url).toMatch(/^https:\/\//);
      // Should not have double host
      expect(url.split('https://').length - 1).toBe(1);
    });
  });

  describe('Network Type Guards', () => {
    it('should identify Cosmos network', () => {
      const beezee = networkRegistry.get('beezee-1')!;
      expect(isCosmosNetwork(beezee)).toBe(true);
      expect(isBitcoinNetwork(beezee)).toBe(false);
      expect(isEvmNetwork(beezee)).toBe(false);
    });

    it('should identify Bitcoin network', () => {
      const bitcoin = networkRegistry.get('bitcoin-mainnet')!;
      expect(isCosmosNetwork(bitcoin)).toBe(false);
      expect(isBitcoinNetwork(bitcoin)).toBe(true);
      expect(isEvmNetwork(bitcoin)).toBe(false);
    });

    it('should identify EVM network', () => {
      const ethereum = networkRegistry.get('ethereum-mainnet')!;
      expect(isCosmosNetwork(ethereum)).toBe(false);
      expect(isBitcoinNetwork(ethereum)).toBe(false);
      expect(isEvmNetwork(ethereum)).toBe(true);
    });
  });

  describe('getUINetworks', () => {
    it('should return enabled networks for UI', () => {
      const uiNetworks = getUINetworks();
      expect(uiNetworks.length).toBeGreaterThan(0);
    });

    it('should include required UI fields', () => {
      const uiNetworks = getUINetworks();
      uiNetworks.forEach(network => {
        expect(network.id).toBeDefined();
        expect(network.name).toBeDefined();
        expect(network.symbol).toBeDefined();
        expect(network.type).toBeDefined();
      });
    });

    it('should include prefix only for Cosmos chains', () => {
      const uiNetworks = getUINetworks();
      uiNetworks.forEach(network => {
        if (network.type === 'cosmos') {
          expect(network.prefix).toBeDefined();
        } else {
          expect(network.prefix).toBeUndefined();
        }
      });
    });
  });
});
