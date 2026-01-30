// BZE Rewards module - Staking Pool transactions
// Based on https://github.com/bze-alphateam/bze-dapp

import { coin } from '@cosmjs/stargate';

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
