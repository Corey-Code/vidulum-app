// Staking API utilities for Cosmos SDK chains
import { fetchWithFailover, getHealthyEndpoint } from '@/lib/networks';

/**
 * Normalize endpoints to array format
 * Supports both single string (legacy) and array formats
 */
function normalizeEndpoints(endpoints: string | string[]): string[] {
  return Array.isArray(endpoints) ? endpoints : [endpoints];
}

export interface Validator {
  operatorAddress: string;
  consensusPubkey: string;
  jailed: boolean;
  status: 'BOND_STATUS_BONDED' | 'BOND_STATUS_UNBONDING' | 'BOND_STATUS_UNBONDED';
  tokens: string;
  delegatorShares: string;
  description: {
    moniker: string;
    identity: string;
    website: string;
    securityContact: string;
    details: string;
  };
  commission: {
    commissionRates: {
      rate: string;
      maxRate: string;
      maxChangeRate: string;
    };
    updateTime: string;
  };
  minSelfDelegation: string;
}

export interface Delegation {
  delegation: {
    delegatorAddress: string;
    validatorAddress: string;
    shares: string;
  };
  balance: {
    denom: string;
    amount: string;
  };
}

export interface Reward {
  validatorAddress: string;
  reward: Array<{
    denom: string;
    amount: string;
  }>;
}

export interface UnbondingDelegation {
  delegatorAddress: string;
  validatorAddress: string;
  entries: Array<{
    creationHeight: string;
    completionTime: string;
    initialBalance: string;
    balance: string;
  }>;
}

export interface StakingParams {
  unbondingTime: string;
  maxValidators: number;
  maxEntries: number;
  historicalEntries: number;
  bondDenom: string;
}

// Fetch all validators (bonded by default)
// Supports both single endpoint (legacy) and array of endpoints (failover)
export async function fetchValidators(
  restEndpoints: string | string[],
  status: string = 'BOND_STATUS_BONDED'
): Promise<Validator[]> {
  const endpoints = normalizeEndpoints(restEndpoints);
  
  try {
    const data = await fetchWithFailover<{ validators?: any[] }>(
      endpoints,
      `/cosmos/staking/v1beta1/validators?status=${status}&pagination.limit=200`
    );

    if (!data.validators) {
      return [];
    }

    return data.validators.map((v: any) => ({
      operatorAddress: v.operator_address,
      consensusPubkey: v.consensus_pubkey,
      jailed: v.jailed,
      status: v.status,
      tokens: v.tokens,
      delegatorShares: v.delegator_shares,
      description: {
        moniker: v.description?.moniker || 'Unknown',
        identity: v.description?.identity || '',
        website: v.description?.website || '',
        securityContact: v.description?.security_contact || '',
        details: v.description?.details || '',
      },
      commission: {
        commissionRates: {
          rate: v.commission?.commission_rates?.rate || '0',
          maxRate: v.commission?.commission_rates?.max_rate || '0',
          maxChangeRate: v.commission?.commission_rates?.max_change_rate || '0',
        },
        updateTime: v.commission?.update_time || '',
      },
      minSelfDelegation: v.min_self_delegation || '0',
    }));
  } catch (error) {
    console.error('Failed to fetch validators:', error);
    return [];
  }
}

// Fetch delegations for an address
// Supports both single endpoint (legacy) and array of endpoints (failover)
export async function fetchDelegations(
  restEndpoints: string | string[],
  delegatorAddress: string
): Promise<Delegation[]> {
  const endpoints = normalizeEndpoints(restEndpoints);
  
  try {
    const data = await fetchWithFailover<{ delegation_responses?: any[] }>(
      endpoints,
      `/cosmos/staking/v1beta1/delegations/${delegatorAddress}`
    );

    if (!data.delegation_responses) {
      return [];
    }

    return data.delegation_responses.map((d: any) => ({
      delegation: {
        delegatorAddress: d.delegation.delegator_address,
        validatorAddress: d.delegation.validator_address,
        shares: d.delegation.shares,
      },
      balance: {
        denom: d.balance.denom,
        amount: d.balance.amount,
      },
    }));
  } catch (error) {
    console.error('Failed to fetch delegations:', error);
    return [];
  }
}

// Fetch rewards for an address
// Supports both single endpoint (legacy) and array of endpoints (failover)
export async function fetchRewards(
  restEndpoints: string | string[],
  delegatorAddress: string
): Promise<{ rewards: Reward[]; total: Array<{ denom: string; amount: string }> }> {
  const endpoints = normalizeEndpoints(restEndpoints);
  
  try {
    const data = await fetchWithFailover<{ rewards?: any[]; total?: any[] }>(
      endpoints,
      `/cosmos/distribution/v1beta1/delegators/${delegatorAddress}/rewards`
    );

    const rewards: Reward[] = (data.rewards || []).map((r: any) => ({
      validatorAddress: r.validator_address,
      reward: r.reward || [],
    }));

    const total = (data.total || []).map((t: any) => ({
      denom: t.denom,
      amount: t.amount,
    }));

    return { rewards, total };
  } catch (error) {
    console.error('Failed to fetch rewards:', error);
    return { rewards: [], total: [] };
  }
}

// Fetch unbonding delegations
// Supports both single endpoint (legacy) and array of endpoints (failover)
export async function fetchUnbondingDelegations(
  restEndpoints: string | string[],
  delegatorAddress: string
): Promise<UnbondingDelegation[]> {
  const endpoints = normalizeEndpoints(restEndpoints);
  
  try {
    const data = await fetchWithFailover<{ unbonding_responses?: any[] }>(
      endpoints,
      `/cosmos/staking/v1beta1/delegators/${delegatorAddress}/unbonding_delegations`
    );

    if (!data.unbonding_responses) {
      return [];
    }

    return data.unbonding_responses.map((u: any) => ({
      delegatorAddress: u.delegator_address,
      validatorAddress: u.validator_address,
      entries: u.entries.map((e: any) => ({
        creationHeight: e.creation_height,
        completionTime: e.completion_time,
        initialBalance: e.initial_balance,
        balance: e.balance,
      })),
    }));
  } catch (error) {
    console.error('Failed to fetch unbonding delegations:', error);
    return [];
  }
}

// Fetch staking params
// Supports both single endpoint (legacy) and array of endpoints (failover)
export async function fetchStakingParams(restEndpoints: string | string[]): Promise<StakingParams | null> {
  const endpoints = normalizeEndpoints(restEndpoints);
  
  try {
    const data = await fetchWithFailover<{ params?: any }>(
      endpoints,
      '/cosmos/staking/v1beta1/params'
    );

    if (!data.params) {
      return null;
    }

    return {
      unbondingTime: data.params.unbonding_time,
      maxValidators: data.params.max_validators,
      maxEntries: data.params.max_entries,
      historicalEntries: data.params.historical_entries,
      bondDenom: data.params.bond_denom,
    };
  } catch (error) {
    console.error('Failed to fetch staking params:', error);
    return null;
  }
}

// Get validator by address
// Supports both single endpoint (legacy) and array of endpoints (failover)
export async function fetchValidator(
  restEndpoints: string | string[],
  validatorAddress: string
): Promise<Validator | null> {
  const endpoints = normalizeEndpoints(restEndpoints);
  
  try {
    const data = await fetchWithFailover<{ validator?: any }>(
      endpoints,
      `/cosmos/staking/v1beta1/validators/${validatorAddress}`
    );

    if (!data.validator) {
      return null;
    }

    const v = data.validator;
    return {
      operatorAddress: v.operator_address,
      consensusPubkey: v.consensus_pubkey,
      jailed: v.jailed,
      status: v.status,
      tokens: v.tokens,
      delegatorShares: v.delegator_shares,
      description: {
        moniker: v.description?.moniker || 'Unknown',
        identity: v.description?.identity || '',
        website: v.description?.website || '',
        securityContact: v.description?.security_contact || '',
        details: v.description?.details || '',
      },
      commission: {
        commissionRates: {
          rate: v.commission?.commission_rates?.rate || '0',
          maxRate: v.commission?.commission_rates?.max_rate || '0',
          maxChangeRate: v.commission?.commission_rates?.max_change_rate || '0',
        },
        updateTime: v.commission?.update_time || '',
      },
      minSelfDelegation: v.min_self_delegation || '0',
    };
  } catch (error) {
    console.error('Failed to fetch validator:', error);
    return null;
  }
}

// Format commission rate (from decimal string to percentage)
export function formatCommission(rate: string): string {
  const decimal = parseFloat(rate);
  return `${(decimal * 100).toFixed(2)}%`;
}

// Format voting power (from tokens to readable)
export function formatVotingPower(tokens: string, decimals: number = 6): string {
  const amount = parseInt(tokens) / Math.pow(10, decimals);
  if (amount >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(2)}M`;
  } else if (amount >= 1_000) {
    return `${(amount / 1_000).toFixed(2)}K`;
  }
  return amount.toFixed(2);
}
