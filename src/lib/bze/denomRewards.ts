/**
 * BeeZee DenomReward client — stake a denom to earn prizes from schedules.
 * Primary product path for "stake VDL to earn VDL" (factory uvdl).
 *
 * Proto: https://github.com/bze-alphateam/bze/blob/main/proto/bze/rewards/tx.proto
 * LCD:   https://rest.getbze.com/swagger/swagger.yaml
 */

import { coin } from '@cosmjs/stargate';
import { VDL_DENOM } from '@/lib/swap/vdlSwapConfig';
import { fromBaseUnits, toBaseUnits } from '@/lib/bze/rewards';

export const BZE_REWARDS_LCD = 'https://rest.getbze.com';

/** Module param: extra gas charged on MsgExitDenomReward */
export const EXTRA_GAS_FOR_DENOM_EXIT = 1_000_000;

export const DENOM_REWARD_MSG_TYPE_URL = {
  JOIN: '/bze.rewards.MsgJoinDenomReward',
  EXIT: '/bze.rewards.MsgExitDenomReward',
  CLAIM: '/bze.rewards.MsgClaimDenomRewards',
} as const;

export interface MsgJoinDenomReward {
  creator: string;
  denom: string;
  amount: string;
}

export interface MsgExitDenomReward {
  creator: string;
  denom: string;
}

export interface MsgClaimDenomRewards {
  creator: string;
  denom: string;
}

export interface DenomReward {
  staking_denom: string;
  lock: number;
  min_stake: string;
  staked_amount: string;
}

export interface DenomRewardPrize {
  staking_denom: string;
  prize_denom: string;
  distributed_stake: string;
  last_distribution_epoch: string;
}

export interface DenomRewardSchedule {
  schedule_id: string;
  staking_denom: string;
  prize_denom: string;
  daily_amount: string;
  duration: number;
  payouts: number;
}

export interface DenomRewardParticipant {
  address: string;
  staking_denom: string;
  amount: string;
}

export interface PendingPrizeCoin {
  denom: string;
  amount: string;
}

export interface DenomRewardParticipantView {
  participant: DenomRewardParticipant | null;
  pending: PendingPrizeCoin[];
}

function encodeDenomQuery(denom: string): string {
  return encodeURIComponent(denom);
}

async function lcdGet<T>(path: string): Promise<T> {
  const response = await fetch(`${BZE_REWARDS_LCD}${path}`);
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`LCD ${path} failed (${response.status}): ${text.slice(0, 200)}`);
  }
  return response.json() as Promise<T>;
}

export async function fetchAllDenomRewards(): Promise<DenomReward[]> {
  const data = await lcdGet<{ list?: DenomReward[] }>('/bze/rewards/all_denom_rewards');
  return (data.list || []).map(normalizeDenomReward);
}

export async function fetchDenomReward(denom: string): Promise<DenomReward | null> {
  try {
    const data = await lcdGet<{ denom_reward?: DenomReward }>(
      `/bze/rewards/denom_reward?denom=${encodeDenomQuery(denom)}`
    );
    return data.denom_reward ? normalizeDenomReward(data.denom_reward) : null;
  } catch {
    return null;
  }
}

export async function fetchDenomRewardPrizes(denom: string): Promise<DenomRewardPrize[]> {
  const data = await lcdGet<{ list?: DenomRewardPrize[] }>(
    `/bze/rewards/denom_reward_prizes?denom=${encodeDenomQuery(denom)}`
  );
  return data.list || [];
}

export async function fetchDenomRewardSchedules(denom: string): Promise<DenomRewardSchedule[]> {
  const data = await lcdGet<{ list?: DenomRewardSchedule[] }>(
    `/bze/rewards/denom_reward_schedules?denom=${encodeDenomQuery(denom)}`
  );
  return (data.list || []).map((s) => ({
    ...s,
    duration: Number(s.duration) || 0,
    payouts: Number(s.payouts) || 0,
  }));
}

export async function fetchDenomRewardParticipant(
  address: string,
  denom: string
): Promise<DenomRewardParticipantView> {
  try {
    const data = await lcdGet<{
      participant?: DenomRewardParticipant;
      pending?: PendingPrizeCoin[];
    }>(
      `/bze/rewards/denom_reward_participant/${encodeURIComponent(address)}?denom=${encodeDenomQuery(denom)}`
    );
    return {
      participant: data.participant || null,
      pending: data.pending || [],
    };
  } catch {
    return { participant: null, pending: [] };
  }
}

export async function fetchDenomRewardParticipations(
  address: string
): Promise<DenomRewardParticipant[]> {
  try {
    const data = await lcdGet<{ list?: DenomRewardParticipant[] }>(
      `/bze/rewards/denom_reward_participations/${encodeURIComponent(address)}`
    );
    return data.list || [];
  } catch {
    return [];
  }
}

function normalizeDenomReward(raw: DenomReward): DenomReward {
  return {
    staking_denom: raw.staking_denom,
    lock: Number(raw.lock) || 0,
    min_stake: raw.min_stake || '0',
    staked_amount: raw.staked_amount || '0',
  };
}

export function createJoinDenomRewardMsg(
  creator: string,
  denom: string,
  amount: string
): { typeUrl: string; value: MsgJoinDenomReward } {
  return {
    typeUrl: DENOM_REWARD_MSG_TYPE_URL.JOIN,
    value: { creator, denom, amount },
  };
}

export function createExitDenomRewardMsg(
  creator: string,
  denom: string
): { typeUrl: string; value: MsgExitDenomReward } {
  return {
    typeUrl: DENOM_REWARD_MSG_TYPE_URL.EXIT,
    value: { creator, denom },
  };
}

export function createClaimDenomRewardsMsg(
  creator: string,
  denom: string
): { typeUrl: string; value: MsgClaimDenomRewards } {
  return {
    typeUrl: DENOM_REWARD_MSG_TYPE_URL.CLAIM,
    value: { creator, denom },
  };
}

// --- Protobuf wire encoders (field numbers match tx.proto) ---

function encodeVarint(value: number): number[] {
  const bytes: number[] = [];
  while (value > 127) {
    bytes.push((value & 0x7f) | 0x80);
    value >>>= 7;
  }
  bytes.push(value);
  return bytes;
}

function encodeString(fieldNumber: number, value: string): number[] {
  const encoder = new TextEncoder();
  const strBytes = encoder.encode(value);
  const tag = (fieldNumber << 3) | 2;
  return [...encodeVarint(tag), ...encodeVarint(strBytes.length), ...strBytes];
}

/** MsgJoinDenomReward: creator (1), denom (2), amount (3) */
export function encodeMsgJoinDenomReward(message: MsgJoinDenomReward): Uint8Array {
  const bytes: number[] = [];
  if (message.creator) bytes.push(...encodeString(1, message.creator));
  if (message.denom) bytes.push(...encodeString(2, message.denom));
  if (message.amount) bytes.push(...encodeString(3, message.amount));
  return new Uint8Array(bytes);
}

/** MsgExitDenomReward: creator (1), denom (2) */
export function encodeMsgExitDenomReward(message: MsgExitDenomReward): Uint8Array {
  const bytes: number[] = [];
  if (message.creator) bytes.push(...encodeString(1, message.creator));
  if (message.denom) bytes.push(...encodeString(2, message.denom));
  return new Uint8Array(bytes);
}

/** MsgClaimDenomRewards: creator (1), denom (2) */
export function encodeMsgClaimDenomRewards(message: MsgClaimDenomRewards): Uint8Array {
  const bytes: number[] = [];
  if (message.creator) bytes.push(...encodeString(1, message.creator));
  if (message.denom) bytes.push(...encodeString(2, message.denom));
  return new Uint8Array(bytes);
}

/**
 * Exit txs need module param extraGasForDenomExit (1_000_000).
 * Prefer simulation when available; this is the safe explicit fee.
 */
export function getDenomRewardExitFee(gasPrice = 0.01) {
  const gasLimit = 200_000 + EXTRA_GAS_FOR_DENOM_EXIT;
  const feeAmount = Math.max(1, Math.ceil(gasLimit * gasPrice));
  return {
    amount: [coin(feeAmount.toString(), 'ubze')],
    gas: gasLimit.toString(),
  };
}

/**
 * Rough APR from active schedules: sum(daily_amount) * 365 / total_staked * 100.
 * Returns 0 when totals are missing.
 */
export function estimateDenomRewardApr(
  schedules: Pick<DenomRewardSchedule, 'daily_amount' | 'duration' | 'payouts'>[],
  totalStaked: string
): number {
  const staked = parseInt(totalStaked, 10);
  if (!staked || staked <= 0) return 0;

  const activeDaily = schedules.reduce((sum, s) => {
    const remaining = (Number(s.duration) || 0) - (Number(s.payouts) || 0);
    if (remaining <= 0) return sum;
    return sum + (parseInt(s.daily_amount, 10) || 0);
  }, 0);

  if (activeDaily <= 0) return 0;
  return Math.round(((activeDaily * 365) / staked) * 100 * 100) / 100;
}

export function sumPendingForDenom(
  pending: PendingPrizeCoin[],
  prizeDenom: string
): string {
  const match = pending.find((p) => p.denom === prizeDenom);
  return match?.amount || '0';
}

export { VDL_DENOM, toBaseUnits, fromBaseUnits };
