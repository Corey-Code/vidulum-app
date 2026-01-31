import { create } from 'zustand';
import browser from 'webextension-polyfill';
import { networkRegistry, NetworkConfig } from '@/lib/networks';

// Storage key for network preferences
const STORAGE_KEY = 'network_preferences';

interface NetworkPreferences {
  enabledNetworks: Record<string, boolean>; // networkId -> enabled
  enabledAssets: Record<string, string[]>; // networkId -> array of enabled asset denoms
}

interface NetworkState {
  // State
  preferences: NetworkPreferences;
  isLoaded: boolean;

  // Actions
  loadPreferences: () => Promise<void>;
  savePreferences: () => Promise<void>;

  // Network management
  isNetworkEnabled: (networkId: string) => boolean;
  setNetworkEnabled: (networkId: string, enabled: boolean) => Promise<void>;
  getEnabledNetworks: () => NetworkConfig[];
  getAllNetworks: () => NetworkConfig[];
  getNetworksByType: (type: 'cosmos' | 'bitcoin' | 'evm') => NetworkConfig[];

  // Asset management
  isAssetEnabled: (networkId: string, denom: string) => boolean;
  setAssetEnabled: (networkId: string, denom: string, enabled: boolean) => Promise<void>;
  getEnabledAssets: (networkId: string) => string[] | null; // null = all enabled by default
  setEnabledAssets: (networkId: string, denoms: string[]) => Promise<void>;
  hasAssetPreferences: (networkId: string) => boolean; // true if explicit preferences exist
}

// Get default preferences (empty - we compute defaults from registry at runtime)
// This approach stores only user overrides, not all networks, to minimize storage size
function getDefaultPreferences(): NetworkPreferences {
  return {
    enabledNetworks: {}, // Empty - defaults computed from registry
    enabledAssets: {},
  };
}

export const useNetworkStore = create<NetworkState>((set, get) => ({
  preferences: getDefaultPreferences(),
  isLoaded: false,

  loadPreferences: async () => {
    try {
      const result = await browser.storage.local.get(STORAGE_KEY);
      if (result[STORAGE_KEY]) {
        // Load stored overrides directly (defaults computed from registry at runtime)
        const stored = result[STORAGE_KEY] as NetworkPreferences;

        set({
          preferences: {
            enabledNetworks: stored.enabledNetworks || {},
            enabledAssets: stored.enabledAssets || {},
          },
          isLoaded: true,
        });
        return;
      }
    } catch (error) {
      console.warn('Failed to load network preferences:', error);
    }

    // Use defaults if no stored preferences
    set({ preferences: getDefaultPreferences(), isLoaded: true });
  },

  savePreferences: async () => {
    const { preferences } = get();
    try {
      await browser.storage.local.set({ [STORAGE_KEY]: preferences });
    } catch (error) {
      console.warn('Failed to save network preferences:', error);
    }
  },

  isNetworkEnabled: (networkId: string) => {
    const { preferences } = get();
    // If we have a stored preference, use it; otherwise check the network config
    if (networkId in preferences.enabledNetworks) {
      return preferences.enabledNetworks[networkId];
    }
    return networkRegistry.get(networkId)?.enabled ?? false;
  },

  setNetworkEnabled: async (networkId: string, enabled: boolean) => {
    const { preferences, savePreferences } = get();
    const defaultEnabled = networkRegistry.get(networkId)?.enabled ?? false;

    const newEnabledNetworks = { ...preferences.enabledNetworks };

    if (enabled === defaultEnabled) {
      // Remove override if it matches default (minimizes storage)
      delete newEnabledNetworks[networkId];
    } else {
      // Store override only when different from default
      newEnabledNetworks[networkId] = enabled;
    }

    set({
      preferences: {
        ...preferences,
        enabledNetworks: newEnabledNetworks,
      },
    });

    await savePreferences();
  },

  getEnabledNetworks: () => {
    const { isNetworkEnabled } = get();
    return networkRegistry.getAll().filter((n) => isNetworkEnabled(n.id));
  },

  getAllNetworks: () => {
    return networkRegistry.getAll();
  },

  getNetworksByType: (type: 'cosmos' | 'bitcoin' | 'evm') => {
    return networkRegistry.getByType(type);
  },

  isAssetEnabled: (networkId: string, denom: string) => {
    const { preferences } = get();
    const enabledAssets = preferences.enabledAssets[networkId];

    // If no preference set, all assets are enabled by default
    if (!enabledAssets) return true;

    return enabledAssets.includes(denom);
  },

  setAssetEnabled: async (networkId: string, denom: string, enabled: boolean) => {
    const { preferences, savePreferences } = get();

    const currentAssets = preferences.enabledAssets[networkId] || [];

    let newAssets: string[];
    if (enabled) {
      newAssets = currentAssets.includes(denom) ? currentAssets : [...currentAssets, denom];
    } else {
      newAssets = currentAssets.filter((d) => d !== denom);
    }

    set({
      preferences: {
        ...preferences,
        enabledAssets: {
          ...preferences.enabledAssets,
          [networkId]: newAssets,
        },
      },
    });

    await savePreferences();
  },

  getEnabledAssets: (networkId: string) => {
    const { preferences } = get();
    // Return null if no explicit preference (meaning all assets enabled by default)
    // Return the array if explicit preferences exist (even if empty = none enabled)
    return networkId in preferences.enabledAssets ? preferences.enabledAssets[networkId] : null;
  },

  setEnabledAssets: async (networkId: string, denoms: string[]) => {
    const { preferences, savePreferences } = get();

    set({
      preferences: {
        ...preferences,
        enabledAssets: {
          ...preferences.enabledAssets,
          [networkId]: denoms,
        },
      },
    });

    await savePreferences();
  },

  hasAssetPreferences: (networkId: string) => {
    const { preferences } = get();
    return networkId in preferences.enabledAssets;
  },
}));
