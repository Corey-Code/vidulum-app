import {
  applyDemoMessages,
  creditDemo,
  demoAddressForPrefix,
  demoBalances,
  demoChainAddress,
  demoStakeSnapshot,
  demoTxHash,
  isDemoSession,
  setDemoSession,
  spendDemo,
} from '@/lib/demo/session';
import { VDL_DENOM } from '@/lib/swap/vdlSwapConfig';

describe('demo session', () => {
  beforeEach(() => {
    setDemoSession(false);
    setDemoSession(true);
  });

  afterEach(() => {
    setDemoSession(false);
  });

  it('prints DEMO on both ends of every account address', () => {
    const cosmos = demoAddressForPrefix('bze', 0);
    const bitcoin = demoChainAddress('bitcoin-mainnet', 1);
    const evm = demoChainAddress('eth-mainnet', 0);
    const solana = demoChainAddress('solana-mainnet', 0);

    for (const address of [cosmos, bitcoin, evm, solana]) {
      expect(address.slice(0, 12)).toContain('DEMO');
      expect(address.slice(-12)).toContain('DEMO');
      expect(address).not.toMatch(/^bze1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]+$/);
    }
    expect(cosmos).toBe('bze1DEMO-NOT-REAL-01-DEMO');
    expect(demoAddressForPrefix('osmo', 1)).toBe('osmo1DEMO-NOT-REAL-02-DEMO');
  });

  it('stays in memory and shows BeeZee balances', () => {
    expect(isDemoSession()).toBe(true);
    const rows = demoBalances('beezee-1');
    expect(rows.find((row) => row.denom === 'ubze')?.amount).toBe('2500000000');
    expect(rows.find((row) => row.denom === VDL_DENOM)?.amount).toBe('1800000000');
  });

  it('spends and restores a balance without storage', () => {
    spendDemo('beezee-1', 'ubze', '1000000');
    expect(demoBalances('beezee-1').find((row) => row.denom === 'ubze')?.amount).toBe('2499000000');
    creditDemo('beezee-1', 'ubze', '1000000');
    expect(demoBalances('beezee-1').find((row) => row.denom === 'ubze')?.amount).toBe('2500000000');
  });

  it('records a demo delegation and clears it when the session ends', () => {
    const before = demoStakeSnapshot('beezee-1', demoAddressForPrefix('bze'));
    applyDemoMessages('beezee-1', [
      {
        typeUrl: '/cosmos.staking.v1beta1.MsgDelegate',
        value: {
          delegatorAddress: demoAddressForPrefix('bze'),
          validatorAddress: before.validators[1].operatorAddress,
          amount: { denom: 'ubze', amount: '1000000' },
        },
      },
    ]);
    const after = demoStakeSnapshot('beezee-1', demoAddressForPrefix('bze'));
    expect(after.delegations).toHaveLength(before.delegations.length + 1);
    expect(after.available).toBe('2499000000');
    expect(demoTxHash().startsWith('DEMO')).toBe(true);

    setDemoSession(false);
    expect(isDemoSession()).toBe(false);
    expect(demoStakeSnapshot('beezee-1', demoAddressForPrefix('bze')).delegations).toHaveLength(1);
  });
});
