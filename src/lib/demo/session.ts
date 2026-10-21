import { networkRegistry } from '@/lib/networks';
import { VDL_DENOM } from '@/lib/swap/vdlSwapConfig';
import type { Balance } from '@/types/wallet';
import type { Delegation, UnbondingDelegation, Validator } from '@/lib/cosmos/staking';

let active = false;
const spent = new Map<string, bigint>();
const extraDelegations: Delegation[] = [];

export const DEMO_MNEMONIC = 'demo demo demo demo demo demo demo demo demo demo demo demo';

export function isDemoSession(): boolean {
  return active;
}

export function setDemoSession(next: boolean): void {
  active = next;
  if (!next) {
    spent.clear();
    extraDelegations.length = 0;
  }
}

/** Not a real address. DEMO is visible at both ends after the wallet truncates it. */
export function demoAddressForPrefix(prefix: string, accountIndex = 0): string {
  const n = String(accountIndex + 1).padStart(2, '0');
  return `${prefix}1DEMO-NOT-REAL-${n}-DEMO`;
}

export function demoTxHash(): string {
  const salt = Math.floor(Math.random() * 0xffffff)
    .toString(16)
    .padStart(6, '0');
  return `DEMO${salt}${'0'.repeat(54)}`.slice(0, 64);
}

export function demoChainAddress(networkId: string, accountIndex = 0): string {
  const n = String(accountIndex + 1).padStart(2, '0');
  const network = networkRegistry.get(networkId);
  if (network?.type === 'bitcoin') return `bc1DEMO-NOT-A-REAL-BITCOIN-${n}-DEMO`;
  if (network?.type === 'evm') return `0xDEMO-NOT-A-REAL-ADDRESS-${n}-DEMO`;
  if (network?.type === 'svm') return `DEMO-SOL-NOT-A-REAL-ADDRESS-${n}-DEMO`;
  const prefix = networkRegistry.getCosmos(networkId)?.bech32Prefix ?? 'bze';
  return demoAddressForPrefix(prefix, accountIndex);
}

function baseAmount(networkId: string, denom: string): bigint {
  if (networkId === 'beezee-1' && denom === 'ubze') return 2_500_000_000n;
  if (networkId === 'beezee-1' && denom === VDL_DENOM) return 1_800_000_000n;
  if (denom === 'sat') return 1_500_000n;
  if (denom === 'wei') return 420_000_000_000_000_000n;
  if (denom === 'lamports') return 2_500_000_000n;
  return 12_500_000n;
}

export function demoBalances(networkId: string): Balance[] {
  const network = networkRegistry.get(networkId);
  let rows: Balance[] = [];

  if (network?.type === 'bitcoin') {
    rows = [{ denom: 'sat', amount: baseAmount(networkId, 'sat').toString() }];
  } else if (network?.type === 'evm') {
    rows = [{ denom: 'wei', amount: baseAmount(networkId, 'wei').toString() }];
  } else if (network?.type === 'svm') {
    rows = [{ denom: 'lamports', amount: baseAmount(networkId, 'lamports').toString() }];
  } else {
    const denom = networkRegistry.getCosmos(networkId)?.feeDenom ?? 'ustake';
    rows = [{ denom, amount: baseAmount(networkId, denom).toString() }];
    if (networkId === 'beezee-1') {
      rows.push({ denom: VDL_DENOM, amount: baseAmount(networkId, VDL_DENOM).toString() });
    }
  }

  return rows.map((row) => {
    const used = spent.get(`${networkId}:${row.denom}`) ?? 0n;
    const left = baseAmount(networkId, row.denom) - used;
    return { denom: row.denom, amount: (left > 0n ? left : 0n).toString() };
  });
}

export function spendDemo(networkId: string, denom: string, amount: string): void {
  const value = BigInt(amount);
  if (value <= 0n) return;
  const key = `${networkId}:${denom}`;
  spent.set(key, (spent.get(key) ?? 0n) + value);
}

export function creditDemo(networkId: string, denom: string, amount: string): void {
  const value = BigInt(amount);
  if (value <= 0n) return;
  const key = `${networkId}:${denom}`;
  const next = (spent.get(key) ?? 0n) - value;
  if (next > 0n) spent.set(key, next);
  else spent.delete(key);
}

function demoValidator(chainId: string, index: number, moniker: string, commission: string): Validator {
  const prefix = `${networkRegistry.getCosmos(chainId)?.bech32Prefix ?? 'bze'}valoper`;
  return {
    operatorAddress: demoAddressForPrefix(prefix, index),
    consensusPubkey: 'demo',
    jailed: false,
    status: 'BOND_STATUS_BONDED',
    tokens: '1000000000000',
    delegatorShares: '1000000000000',
    description: {
      moniker,
      identity: '',
      website: '',
      securityContact: '',
      details: 'Demo validator. Staking here does not leave this browser.',
    },
    commission: {
      commissionRates: {
        rate: commission,
        maxRate: '0.200000000000000000',
        maxChangeRate: '0.010000000000000000',
      },
      updateTime: '2026-01-01T00:00:00Z',
    },
    minSelfDelegation: '1',
  };
}

function initialDelegation(delegatorAddress: string, denom: string, validatorAddress: string): Delegation {
  return {
    delegation: {
      delegatorAddress,
      validatorAddress,
      shares: '500000000',
    },
    balance: { denom, amount: '500000000' },
  };
}

export function demoStakeSnapshot(chainId: string, delegatorAddress: string) {
  const denom = networkRegistry.getCosmos(chainId)?.feeDenom ?? 'ubze';
  const validators = [
    demoValidator(chainId, 1, 'Demo Validator', '0.050000000000000000'),
    demoValidator(chainId, 2, 'Sample Node', '0.080000000000000000'),
  ];
  const seeded = initialDelegation(delegatorAddress, denom, validators[0].operatorAddress);
  const delegations = [
    seeded,
    ...extraDelegations.filter((item) => item.delegation.delegatorAddress === delegatorAddress),
  ];
  const available = demoBalances(chainId).find((row) => row.denom === denom)?.amount ?? '0';
  const unbonding: UnbondingDelegation[] = [];

  return {
    validators,
    delegations,
    rewards: [{ denom, amount: '12000000' }],
    unbonding,
    available,
    apr: 12,
  };
}

type DemoMessage = {
  typeUrl?: string;
  value?: {
    amount?: { denom?: string; amount?: string };
    validatorAddress?: string;
    delegatorAddress?: string;
  };
};

export function applyDemoMessages(chainId: string, messages: DemoMessage[]): void {
  for (const message of messages) {
    const amount = message.value?.amount;
    if (!amount?.denom || !amount.amount) continue;
    const typeUrl = message.typeUrl ?? '';
    const delegator = message.value?.delegatorAddress ?? '';
    const validator = message.value?.validatorAddress ?? '';

    if (typeUrl.includes('MsgUndelegate')) {
      creditDemo(chainId, amount.denom, amount.amount);
      const match = extraDelegations.find(
        (item) => item.delegation.validatorAddress === validator && item.balance.denom === amount.denom
      );
      if (match) {
        const left = BigInt(match.balance.amount) - BigInt(amount.amount);
        match.balance.amount = (left > 0n ? left : 0n).toString();
        match.delegation.shares = match.balance.amount;
      }
      continue;
    }

    spendDemo(chainId, amount.denom, amount.amount);
    if (typeUrl.includes('MsgDelegate') && delegator && validator) {
      extraDelegations.push({
        delegation: {
          delegatorAddress: delegator,
          validatorAddress: validator,
          shares: amount.amount,
        },
        balance: { denom: amount.denom, amount: amount.amount },
      });
    }
  }
}
