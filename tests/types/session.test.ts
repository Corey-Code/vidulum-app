import {
  lifecycleFlagsFromPhase,
  unlockedCapability,
  type WalletPhase,
} from '@/types/session';

describe('lifecycleFlagsFromPhase', () => {
  const cases: Array<{
    phase: WalletPhase;
    isDemo: boolean;
    isInitialized: boolean;
    isLocked: boolean;
  }> = [
    {
      phase: { status: 'booting' },
      isDemo: false,
      isInitialized: false,
      isLocked: true,
    },
    {
      phase: { status: 'none' },
      isDemo: false,
      isInitialized: false,
      isLocked: false,
    },
    {
      phase: { status: 'locked' },
      isDemo: false,
      isInitialized: true,
      isLocked: true,
    },
    {
      phase: { status: 'unlocked', capability: 'full' },
      isDemo: false,
      isInitialized: true,
      isLocked: false,
    },
    {
      phase: { status: 'unlocked', capability: 'session' },
      isDemo: false,
      isInitialized: true,
      isLocked: false,
    },
    {
      phase: { status: 'demo' },
      isDemo: true,
      isInitialized: true,
      isLocked: false,
    },
  ];

  it.each(cases)(
    'maps $phase.status correctly',
    ({ phase, isDemo, isInitialized, isLocked }) => {
      expect(lifecycleFlagsFromPhase(phase)).toEqual({
        isDemo,
        isInitialized,
        isLocked,
      });
    }
  );
});

describe('unlockedCapability', () => {
  it('keeps full', () => {
    expect(unlockedCapability('full')).toBe('full');
  });

  it('maps session and empty to session', () => {
    expect(unlockedCapability('session')).toBe('session');
    expect(unlockedCapability('empty')).toBe('session');
  });
});
