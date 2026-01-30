/**
 * Global TypeScript declarations for window extensions
 */

import type { Keplr } from './keplr';

declare global {
  interface Window {
    keplr?: Keplr;
    vidulum?: Keplr;
    getOfflineSigner?: (chainId: string) => ReturnType<Keplr['getOfflineSigner']>;
    getOfflineSignerOnlyAmino?: (chainId: string) => ReturnType<Keplr['getOfflineSignerOnlyAmino']>;
    getOfflineSignerAuto?: (chainId: string) => Promise<ReturnType<Keplr['getOfflineSigner']>>;
  }
}

export {};
