import { create } from 'zustand';
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
  getEnabledAssets: (networkId: string) => string[];
  setEnabledAssets: (networkId: string, denoms: string[]) => Promise<void>;
}

// Get default enabled state from network config
function getDefaultPreferences(): NetworkPreferences {
  const enabledNetworks: Record<string, boolean> = {};

  networkRegistry.getAll().forEach((network) => {
    enabledNetworks[network.id] = network.enabled;
  });

  return {
    enabledNetworks,
    enabledAssets: {},
  };
}

export const useNetworkStore = create<NetworkState>((set, get) => ({
  preferences: getDefaultPreferences(),
  isLoaded: false,

  loadPreferences: async () => {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        const result = await chrome.storage.local.get(STORAGE_KEY);
        if (result[STORAGE_KEY]) {
          // Merge stored preferences with defaults (to handle new networks)
          const stored = result[STORAGE_KEY] as NetworkPreferences;
          const defaults = getDefaultPreferences();

          set({
            preferences: {
              enabledNetworks: { ...defaults.enabledNetworks, ...stored.enabledNetworks },
              enabledAssets: { ...defaults.enabledAssets, ...stored.enabledAssets },
            },
            isLoaded: true,
          });
          return;
        }
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
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        await chrome.storage.local.set({ [STORAGE_KEY]: preferences });
      }
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

    set({
      preferences: {
        ...preferences,
        enabledNetworks: {
          ...preferences.enabledNetworks,
          [networkId]: enabled,
        },
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

    // If there are no per-asset preferences yet for this network, do not
    // create an entry based on a single toggle. This preserves the
    // "all assets enabled by default" semantics used in isAssetEnabled().
    const hasPreferencesForNetwork = Object.prototype.hasOwnProperty.call(
      preferences.enabledAssets,
      networkId,
    );
    if (!hasPreferencesForNetwork) {
      return;
    }
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
    return preferences.enabledAssets[networkId] || [];
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
}));
