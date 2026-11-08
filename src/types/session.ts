/**
 * Explicit session / wallet lifecycle phases.
 * Prefer these discriminants over boolean products (isDemo × isInitialized × isLocked × keyring?).
 */

/** What the in-memory keyring can do right now. */
export type KeyringCapability = 'empty' | 'session' | 'full';

/**
 * Popup / web wallet lifecycle. `keyring` stays on the store when status is `unlocked`;
 * capability records whether session restore left us address-only (`session`) or mnemonic-ready (`full`).
 */
export type WalletPhase =
  | { status: 'booting' }
  | { status: 'none' }
  | { status: 'locked' }
  | { status: 'unlocked'; capability: 'session' | 'full' }
  | { status: 'demo' };

/** EncryptedStorage session keys + auto-lock, as one status. */
export type PersistentSessionState = 'none' | 'active' | 'expired';

/** Background service-worker SessionManager status. */
export type BgSessionStatus = 'uninitialized' | 'locked' | 'awaiting_sync' | 'unlocked';

/** Legacy boolean flags derived from WalletPhase (migration / existing UI). */
export function lifecycleFlagsFromPhase(phase: WalletPhase): {
  isDemo: boolean;
  isInitialized: boolean;
  isLocked: boolean;
} {
  switch (phase.status) {
    case 'booting':
      return { isDemo: false, isInitialized: false, isLocked: true };
    case 'none':
      return { isDemo: false, isInitialized: false, isLocked: false };
    case 'locked':
      return { isDemo: false, isInitialized: true, isLocked: true };
    case 'unlocked':
      return { isDemo: false, isInitialized: true, isLocked: false };
    case 'demo':
      return { isDemo: true, isInitialized: true, isLocked: false };
    default: {
      const _exhaustive: never = phase;
      return _exhaustive;
    }
  }
}

export function unlockedCapability(
  capability: KeyringCapability
): 'session' | 'full' {
  if (capability === 'full') return 'full';
  // empty keyring should not be unlocked; treat as session for typing safety
  return 'session';
}
