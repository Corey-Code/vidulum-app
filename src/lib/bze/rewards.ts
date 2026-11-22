// BZE Rewards module - Staking Pool (Offers) transactions
// Based on https://github.com/bze-alphateam/bze-dapp
// Proto: https://github.com/bze-alphateam/bze/blob/main/proto/bze/rewards/

import { coin } from '@cosmjs/stargate';

export const BZE_REWARDS_LCD = 'https://rest.getbze.com';

/** Module param: extra gas charged on MsgExitStaking */
export const EXTRA_GAS_FOR_EXIT_STAKE = 1_000_000;

// Message type URLs for BZE Rewards module
// See: https://unpkg.com/@bze/bzejs/bze/rewards/tx.registry.js
export const BZE_MSG_TYPE_URL = {
  JOIN_STAKING: '/bze.rewards.MsgJoinStaking',
  EXIT_STAKING: '/bze.rewards.MsgExitStaking',
  CLAIM_STAKING_REWARDS: '/bze.rewards.MsgClaimStakingRewards',
};

export interface MsgJoinStaking {
  creator: string;
  reward_id: string;
  amount: string;
}

export interface MsgExitStaking {
  creator: string;
  reward_id: string;
}

export interface MsgClaimStakingRewards {
  creator: string;
  reward_id: string;
}

/**
 * Creates a MsgJoinStaking message for staking in a BZE reward pool
 * @param creator The address of the staker
 * @param rewardId The ID of the staking reward pool
 * @param amount The amount to stake in base units (e.g., ubze)
 */
export function createJoinStakingMsg(
  creator: string,
  rewardId: string,
  amount: string
): { typeUrl: string; value: MsgJoinStaking } {
  return {
    typeUrl: BZE_MSG_TYPE_URL.JOIN_STAKING,
    value: {
      creator,
      reward_id: rewardId,
      amount,
    },
  };
}

/**
 * Creates a MsgExitStaking message for unstaking from a BZE reward pool
 * @param creator The address of the staker
 * @param rewardId The ID of the staking reward pool
 */
export function createExitStakingMsg(
  creator: string,
  rewardId: string
): { typeUrl: string; value: MsgExitStaking } {
  return {
    typeUrl: BZE_MSG_TYPE_URL.EXIT_STAKING,
    value: {
      creator,
      reward_id: rewardId,
    },
  };
}

/**
 * Creates a MsgClaimStakingRewards message for claiming rewards from a BZE reward pool
 * @param creator The address of the staker
 * @param rewardId The ID of the staking reward pool
 */
export function createClaimStakingRewardsMsg(
  creator: string,
  rewardId: string
): { typeUrl: string; value: MsgClaimStakingRewards } {
  return {
    typeUrl: BZE_MSG_TYPE_URL.CLAIM_STAKING_REWARDS,
    value: {
      creator,
      reward_id: rewardId,
    },
  };
}

/**
 * Convert a human-readable amount to base units
 * @param amount Human-readable amount (e.g., "1.5")
 * @param decimals Number of decimals (default 6 for BZE)
 */
export function toBaseUnits(amount: string, decimals: number = 6): string {
  const num = parseFloat(amount);
  if (isNaN(num) || num <= 0) {
    throw new Error('Invalid amount');
  }
  const multiplier = Math.pow(10, decimals);
  const baseAmount = Math.floor(num * multiplier);
  return baseAmount.toString();
}

/**
 * Convert base units to human-readable amount
 * @param baseAmount Amount in base units (e.g., "1500000")
 * @param decimals Number of decimals (default 6 for BZE)
 */
export function fromBaseUnits(baseAmount: string, decimals: number = 6): string {
  const num = parseInt(baseAmount);
  if (isNaN(num)) return '0';
  const divisor = Math.pow(10, decimals);
  return (num / divisor).toString();
}

/**
 * Get the default fee for BZE staking transactions
 */
export function getDefaultStakingFee() {
  return {
    amount: [coin('2000', 'ubze')],
    gas: '200000',
  };
}

/**
 * Exit txs need module param extraGasForExitStake (1_000_000).
 * Prefer simulation when available; this is the safe explicit fee.
 */
export function getExitStakingFee(gasPrice = 0.01) {
  const gasLimit = 200_000 + EXTRA_GAS_FOR_EXIT_STAKE;
  const feeAmount = Math.max(1, Math.ceil(gasLimit * gasPrice));
  return {
    amount: [coin(feeAmount.toString(), 'ubze')],
    gas: gasLimit.toString(),
  };
}

// --- Pending unlock (Offers exit lock) ---

export interface PendingUnlockParticipant {
  index: string;
  address: string;
  amount: string;
  denom: string;
}

/**
 * Index format for Offers (StakingReward) unlocks:
 *   `{hourEpoch}/{rewardId}/{address}`
 * DenomReward unlocks use a `dr/` segment after the epoch and are excluded here.
 */
export function parseOffersUnlockIndex(index: string): {
  unlockEpoch: number;
  rewardId: string | null;
} {
  const parts = index.split('/');
  const unlockEpoch = parseInt(parts[0] || '', 10);
  if (!Number.isFinite(unlockEpoch) || parts.length < 3) {
    return { unlockEpoch: 0, rewardId: null };
  }
  // DenomReward pending keys: `{epoch}/dr/factory/.../address`
  if (parts[1] === 'dr') {
    return { unlockEpoch, rewardId: null };
  }
  return { unlockEpoch, rewardId: parts[1] };
}

/** Remaining hours until unlock epoch (hour-based BeeZee epochs). */
export function remainingUnlockHours(unlockEpoch: number, currentHourEpoch: number): number {
  return Math.max(0, unlockEpoch - currentHourEpoch);
}

/** Human-readable unlock countdown (hour epochs). */
export function formatUnlockRemaining(remainingHours: number): string {
  if (remainingHours <= 1) return 'Unlocking in 1 hour';
  if (remainingHours < 48) return `Unlocking in ${remainingHours} hours`;
  const days = Math.floor(remainingHours / 24);
  return `Unlocking in ${days} days`;
}

async function lcdGet<T>(path: string): Promise<T> {
  const response = await fetch(`${BZE_REWARDS_LCD}${path}`);
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`LCD ${path} failed (${response.status}): ${text.slice(0, 200)}`);
  }
  return response.json() as Promise<T>;
}

/**
 * Fetch all pending unlock participants (paginated). Used for Offers lock UX.
 */
export async function fetchAllPendingUnlockParticipants(
  pageLimit = 1000
): Promise<PendingUnlockParticipant[]> {
  const list: PendingUnlockParticipant[] = [];
  let nextKey: string | null = null;

  do {
    const params = new URLSearchParams();
    params.set('pagination.limit', String(pageLimit));
    if (nextKey) params.set('pagination.key', nextKey);

    const data = await lcdGet<{
      list?: PendingUnlockParticipant[];
      pagination?: { next_key?: string | null };
    }>(`/bze/rewards/all_pending_unlock_participants?${params.toString()}`);

    if (data.list?.length) list.push(...data.list);
    nextKey = data.pagination?.next_key || null;
  } while (nextKey);

  return list;
}

/** Pending Offers unlocks for an address (excludes DenomReward `dr/` entries). */
export async function fetchAddressOffersPendingUnlocks(
  address: string
): Promise<PendingUnlockParticipant[]> {
  if (!address) return [];
  try {
    const all = await fetchAllPendingUnlockParticipants();
    return all.filter((item) => {
      if (item.address !== address) return false;
      return parseOffersUnlockIndex(item.index).rewardId !== null;
    });
  } catch (error) {
    console.error('Failed to fetch pending unlocks:', error);
    return [];
  }
}

/** Current BeeZee hour-epoch count (unlock keys are hour-based). */
export async function fetchCurrentHourEpoch(): Promise<number> {
  try {
    const data = await lcdGet<{
      epochs?: Array<{ identifier?: string; current_epoch?: string }>;
    }>('/cosmos/epochs/v1beta1/epochs');
    const hour = data.epochs?.find((e) => e.identifier === 'hour');
    return parseInt(hour?.current_epoch || '0', 10) || 0;
  } catch (error) {
    console.error('Failed to fetch hour epoch:', error);
    return 0;
  }
}
