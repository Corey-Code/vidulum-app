/**
 * Network Store Tests
 *
 * Tests for network preferences persistence and asset enablement
 */

import { act, renderHook } from '@testing-library/react';

// Mock chrome.storage.local before importing the store
const mockStorage: Record<string, unknown> = {};
const mockChromeStorage = {
  local: {
    get: jest.fn((key: string) => Promise.resolve({ [key]: mockStorage[key] })),
    set: jest.fn((data: Record<string, unknown>) => {
      Object.assign(mockStorage, data);
      return Promise.resolve();
    }),
  },
};

// @ts-expect-error - mocking chrome global
global.chrome = { storage: mockChromeStorage };

// Mock the network registry
jest.mock('@/lib/networks', () => ({
  networkRegistry: {
    getAll: jest.fn(() => [
      { id: 'beezee-1', name: 'BeeZee', type: 'cosmos', enabled: true },
      { id: 'osmosis-1', name: 'Osmosis', type: 'cosmos', enabled: true },
      { id: 'cosmoshub-4', name: 'Cosmos Hub', type: 'cosmos', enabled: false },
      { id: 'bitcoin-mainnet', name: 'Bitcoin', type: 'bitcoin', enabled: true },
      { id: 'ethereum-mainnet', name: 'Ethereum', type: 'evm', enabled: true },
    ]),
    get: jest.fn((id: string) => {
      const networks: Record<string, { id: string; enabled: boolean }> = {
        'beezee-1': { id: 'beezee-1', enabled: true },
        'osmosis-1': { id: 'osmosis-1', enabled: true },
        'cosmoshub-4': { id: 'cosmoshub-4', enabled: false },
        'bitcoin-mainnet': { id: 'bitcoin-mainnet', enabled: true },
        'ethereum-mainnet': { id: 'ethereum-mainnet', enabled: true },
      };
      return networks[id];
    }),
    getByType: jest.fn((type: string) => {
      const networks = [
        { id: 'beezee-1', name: 'BeeZee', type: 'cosmos', enabled: true },
        { id: 'osmosis-1', name: 'Osmosis', type: 'cosmos', enabled: true },
        { id: 'cosmoshub-4', name: 'Cosmos Hub', type: 'cosmos', enabled: false },
        { id: 'bitcoin-mainnet', name: 'Bitcoin', type: 'bitcoin', enabled: true },
        { id: 'ethereum-mainnet', name: 'Ethereum', type: 'evm', enabled: true },
      ];
      return networks.filter((n) => n.type === type);
    }),
  },
}));

import { useNetworkStore } from '@/store/networkStore';

describe('Network Store', () => {
  beforeEach(() => {
    // Clear mock storage and reset store state
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
    mockChromeStorage.local.get.mockClear();
    mockChromeStorage.local.set.mockClear();

    // Reset the store state
    useNetworkStore.setState({
      preferences: {
        enabledNetworks: {
          'beezee-1': true,
          'osmosis-1': true,
          'cosmoshub-4': false,
          'bitcoin-mainnet': true,
          'ethereum-mainnet': true,
        },
        enabledAssets: {},
      },
      isLoaded: false,
    });
  });

  describe('Default Preferences', () => {
    it('should initialize with default network enabled states from registry', () => {
      const { result } = renderHook(() => useNetworkStore());

      expect(result.current.isNetworkEnabled('beezee-1')).toBe(true);
      expect(result.current.isNetworkEnabled('osmosis-1')).toBe(true);
      expect(result.current.isNetworkEnabled('cosmoshub-4')).toBe(false);
    });

    it('should return false for unknown networks', () => {
      const { result } = renderHook(() => useNetworkStore());

      expect(result.current.isNetworkEnabled('unknown-network')).toBe(false);
    });
  });

  describe('Load Preferences - Merge Behavior', () => {
    it('should load stored preferences and merge with defaults', async () => {
      // Set up stored preferences (user disabled osmosis)
      mockStorage['network_preferences'] = {
        enabledNetworks: {
          'osmosis-1': false,
        },
        enabledAssets: {},
      };

      const { result } = renderHook(() => useNetworkStore());

      await act(async () => {
        await result.current.loadPreferences();
      });

      // Stored preference should override default
      expect(result.current.isNetworkEnabled('osmosis-1')).toBe(false);
      // Networks not in stored prefs should use defaults
      expect(result.current.isNetworkEnabled('beezee-1')).toBe(true);
      expect(result.current.isLoaded).toBe(true);
    });

    it('should use defaults when no stored preferences exist', async () => {
      const { result } = renderHook(() => useNetworkStore());

      await act(async () => {
        await result.current.loadPreferences();
      });

      expect(result.current.isNetworkEnabled('beezee-1')).toBe(true);
      expect(result.current.isNetworkEnabled('cosmoshub-4')).toBe(false);
      expect(result.current.isLoaded).toBe(true);
    });

    it('should handle new networks added after user stored preferences', async () => {
      // Simulate stored prefs from before a new network was added
      mockStorage['network_preferences'] = {
        enabledNetworks: {
          'beezee-1': true,
          // 'new-network' not in stored prefs
        },
        enabledAssets: {},
      };

      const { result } = renderHook(() => useNetworkStore());

      await act(async () => {
        await result.current.loadPreferences();
      });

      // Existing networks should maintain their stored state
      expect(result.current.isNetworkEnabled('beezee-1')).toBe(true);
      // New networks should use registry defaults
      expect(result.current.isNetworkEnabled('osmosis-1')).toBe(true);
    });
  });

  describe('Network Enablement', () => {
    it('should enable a network and persist', async () => {
      const { result } = renderHook(() => useNetworkStore());

      await act(async () => {
        await result.current.setNetworkEnabled('cosmoshub-4', true);
      });

      expect(result.current.isNetworkEnabled('cosmoshub-4')).toBe(true);
      expect(mockChromeStorage.local.set).toHaveBeenCalled();
    });

    it('should disable a network and persist', async () => {
      const { result } = renderHook(() => useNetworkStore());

      await act(async () => {
        await result.current.setNetworkEnabled('beezee-1', false);
      });

      expect(result.current.isNetworkEnabled('beezee-1')).toBe(false);
      expect(mockChromeStorage.local.set).toHaveBeenCalled();
    });

    it('should get enabled networks only', () => {
      const { result } = renderHook(() => useNetworkStore());

      const enabled = result.current.getEnabledNetworks();
      const enabledIds = enabled.map((n) => n.id);

      expect(enabledIds).toContain('beezee-1');
      expect(enabledIds).toContain('osmosis-1');
      expect(enabledIds).not.toContain('cosmoshub-4');
    });

    it('should get networks by type', () => {
      const { result } = renderHook(() => useNetworkStore());

      const cosmos = result.current.getNetworksByType('cosmos');
      expect(cosmos.every((n) => n.type === 'cosmos')).toBe(true);

      const bitcoin = result.current.getNetworksByType('bitcoin');
      expect(bitcoin.every((n) => n.type === 'bitcoin')).toBe(true);
    });
  });

  describe('Asset Enablement - Default Behavior', () => {
    it('should have all assets enabled by default (no preference set)', () => {
      const { result } = renderHook(() => useNetworkStore());

      // When no asset preferences are set, all assets should be enabled
      expect(result.current.isAssetEnabled('beezee-1', 'ubze')).toBe(true);
      expect(result.current.isAssetEnabled('beezee-1', 'uvdl')).toBe(true);
      expect(result.current.isAssetEnabled('beezee-1', 'any-random-denom')).toBe(true);
    });

    it('should return empty array for getEnabledAssets when no preference set', () => {
      const { result } = renderHook(() => useNetworkStore());

      // getEnabledAssets returns the explicit list, empty means "all enabled by default"
      expect(result.current.getEnabledAssets('beezee-1')).toEqual([]);
    });
  });

  describe('Asset Enablement - First Toggle Behavior', () => {
    it('should track enabled assets after first enable', async () => {
      const { result } = renderHook(() => useNetworkStore());

      // Before any toggle: all assets enabled by default
      expect(result.current.isAssetEnabled('beezee-1', 'ubze')).toBe(true);
      expect(result.current.isAssetEnabled('beezee-1', 'uvdl')).toBe(true);

      // Enable a specific asset (starts tracking)
      await act(async () => {
        await result.current.setAssetEnabled('beezee-1', 'ubze', true);
      });

      // Now only explicitly enabled assets are enabled
      expect(result.current.isAssetEnabled('beezee-1', 'ubze')).toBe(true);
      expect(result.current.isAssetEnabled('beezee-1', 'uvdl')).toBe(false); // Not in enabled list
      expect(result.current.getEnabledAssets('beezee-1')).toEqual(['ubze']);
    });

    it('should handle disabling an asset from default-all-enabled state', async () => {
      const { result } = renderHook(() => useNetworkStore());

      // Disable an asset (this starts tracking with empty list)
      await act(async () => {
        await result.current.setAssetEnabled('beezee-1', 'ubze', false);
      });

      // The disabled asset should now be disabled
      // Note: This creates an empty enabledAssets array, which means nothing is enabled
      expect(result.current.isAssetEnabled('beezee-1', 'ubze')).toBe(false);
      expect(result.current.getEnabledAssets('beezee-1')).toEqual([]);
    });

    it('should add asset to enabled list when enabling', async () => {
      const { result } = renderHook(() => useNetworkStore());

      await act(async () => {
        await result.current.setAssetEnabled('beezee-1', 'ubze', true);
        await result.current.setAssetEnabled('beezee-1', 'uvdl', true);
      });

      expect(result.current.getEnabledAssets('beezee-1')).toContain('ubze');
      expect(result.current.getEnabledAssets('beezee-1')).toContain('uvdl');
    });

    it('should remove asset from enabled list when disabling', async () => {
      const { result } = renderHook(() => useNetworkStore());

      // First enable some assets
      await act(async () => {
        await result.current.setAssetEnabled('beezee-1', 'ubze', true);
        await result.current.setAssetEnabled('beezee-1', 'uvdl', true);
      });

      // Then disable one
      await act(async () => {
        await result.current.setAssetEnabled('beezee-1', 'ubze', false);
      });

      expect(result.current.getEnabledAssets('beezee-1')).not.toContain('ubze');
      expect(result.current.getEnabledAssets('beezee-1')).toContain('uvdl');
    });

    it('should not duplicate assets when enabling already enabled asset', async () => {
      const { result } = renderHook(() => useNetworkStore());

      await act(async () => {
        await result.current.setAssetEnabled('beezee-1', 'ubze', true);
        await result.current.setAssetEnabled('beezee-1', 'ubze', true); // Duplicate
      });

      const assets = result.current.getEnabledAssets('beezee-1');
      const ubzeCount = assets.filter((a) => a === 'ubze').length;
      expect(ubzeCount).toBe(1);
    });
  });

  describe('Bulk Asset Management', () => {
    it('should set multiple enabled assets at once', async () => {
      const { result } = renderHook(() => useNetworkStore());

      await act(async () => {
        await result.current.setEnabledAssets('beezee-1', ['ubze', 'uvdl', 'ibc/ABC']);
      });

      expect(result.current.getEnabledAssets('beezee-1')).toEqual(['ubze', 'uvdl', 'ibc/ABC']);
      expect(result.current.isAssetEnabled('beezee-1', 'ubze')).toBe(true);
      expect(result.current.isAssetEnabled('beezee-1', 'uvdl')).toBe(true);
      expect(result.current.isAssetEnabled('beezee-1', 'other')).toBe(false);
    });

    it('should clear all assets when setting empty array', async () => {
      const { result } = renderHook(() => useNetworkStore());

      // First set some assets
      await act(async () => {
        await result.current.setEnabledAssets('beezee-1', ['ubze', 'uvdl']);
      });

      // Then clear
      await act(async () => {
        await result.current.setEnabledAssets('beezee-1', []);
      });

      expect(result.current.getEnabledAssets('beezee-1')).toEqual([]);
      expect(result.current.isAssetEnabled('beezee-1', 'ubze')).toBe(false);
    });
  });

  describe('Persistence', () => {
    it('should persist network changes to storage', async () => {
      const { result } = renderHook(() => useNetworkStore());

      await act(async () => {
        await result.current.setNetworkEnabled('beezee-1', false);
      });

      expect(mockChromeStorage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          network_preferences: expect.objectContaining({
            enabledNetworks: expect.objectContaining({
              'beezee-1': false,
            }),
          }),
        })
      );
    });

    it('should persist asset changes to storage', async () => {
      const { result } = renderHook(() => useNetworkStore());

      await act(async () => {
        await result.current.setAssetEnabled('beezee-1', 'uvdl', true);
      });

      expect(mockChromeStorage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          network_preferences: expect.objectContaining({
            enabledAssets: expect.objectContaining({
              'beezee-1': expect.arrayContaining(['uvdl']),
            }),
          }),
        })
      );
    });
  });

  describe('Cross-Network Isolation', () => {
    it('should keep asset preferences isolated per network', async () => {
      const { result } = renderHook(() => useNetworkStore());

      await act(async () => {
        await result.current.setAssetEnabled('beezee-1', 'ubze', true);
        await result.current.setAssetEnabled('osmosis-1', 'uosmo', true);
      });

      expect(result.current.getEnabledAssets('beezee-1')).toEqual(['ubze']);
      expect(result.current.getEnabledAssets('osmosis-1')).toEqual(['uosmo']);

      // Changing one network shouldn't affect the other
      await act(async () => {
        await result.current.setAssetEnabled('beezee-1', 'uvdl', true);
      });

      expect(result.current.getEnabledAssets('beezee-1')).toContain('uvdl');
      expect(result.current.getEnabledAssets('osmosis-1')).not.toContain('uvdl');
    });
  });
});
