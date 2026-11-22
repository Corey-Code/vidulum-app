/**
 * BeeZee Offers (StakingReward) client tests — exit + pending unlock helpers
 */

import {
  BZE_MSG_TYPE_URL,
  EXTRA_GAS_FOR_EXIT_STAKE,
  createClaimStakingRewardsMsg,
  createExitStakingMsg,
  createJoinStakingMsg,
  fetchAddressOffersPendingUnlocks,
  fetchAllPendingUnlockParticipants,
  fetchCurrentHourEpoch,
  formatUnlockRemaining,
  getExitStakingFee,
  parseOffersUnlockIndex,
  remainingUnlockHours,
} from '@/lib/bze/rewards';
import { mockFetchResponse } from '../../setup';

describe('Offers / StakingReward client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('message constructors', () => {
    const creator = 'bze1tester';
    const rewardId = '000000000000';

    it('builds MsgJoinStaking', () => {
      const msg = createJoinStakingMsg(creator, rewardId, '1000000');
      expect(msg.typeUrl).toBe(BZE_MSG_TYPE_URL.JOIN_STAKING);
      expect(msg.value).toEqual({ creator, reward_id: rewardId, amount: '1000000' });
    });

    it('builds MsgExitStaking', () => {
      const msg = createExitStakingMsg(creator, rewardId);
      expect(msg.typeUrl).toBe(BZE_MSG_TYPE_URL.EXIT_STAKING);
      expect(msg.typeUrl).toBe('/bze.rewards.MsgExitStaking');
      expect(msg.value).toEqual({ creator, reward_id: rewardId });
    });

    it('builds MsgClaimStakingRewards', () => {
      const msg = createClaimStakingRewardsMsg(creator, rewardId);
      expect(msg.typeUrl).toBe(BZE_MSG_TYPE_URL.CLAIM_STAKING_REWARDS);
      expect(msg.value).toEqual({ creator, reward_id: rewardId });
    });
  });

  describe('exit fee', () => {
    it('includes extraGasForExitStake', () => {
      const fee = getExitStakingFee(0.01);
      expect(EXTRA_GAS_FOR_EXIT_STAKE).toBe(1_000_000);
      expect(parseInt(fee.gas, 10)).toBe(1_200_000);
      expect(fee.amount[0].denom).toBe('ubze');
      expect(parseInt(fee.amount[0].amount, 10)).toBe(12_000);
    });
  });

  describe('pending unlock index parsing', () => {
    it('parses Offers unlock keys as epoch/rewardId/address', () => {
      const parsed = parseOffersUnlockIndex(
        '20578/000000000463/bze1m6prawsygl4pqpnn520d00hcul3kq6p80p6slp'
      );
      expect(parsed.unlockEpoch).toBe(20578);
      expect(parsed.rewardId).toBe('000000000463');
    });

    it('excludes DenomReward dr/ pending keys from Offers rewardId', () => {
      const parsed = parseOffersUnlockIndex(
        '20667/dr/factory/bze13gzq40che93tgfm9kzmkpjamah5nj0j73pyhqk/uvdl/bze1abc'
      );
      expect(parsed.unlockEpoch).toBe(20667);
      expect(parsed.rewardId).toBeNull();
    });

    it('formats remaining unlock time from hour epochs', () => {
      expect(remainingUnlockHours(100, 90)).toBe(10);
      expect(remainingUnlockHours(90, 100)).toBe(0);
      expect(formatUnlockRemaining(1)).toBe('Unlocking in 1 hour');
      expect(formatUnlockRemaining(10)).toBe('Unlocking in 10 hours');
      expect(formatUnlockRemaining(72)).toBe('Unlocking in 3 days');
    });
  });

  describe('LCD fetchers', () => {
    it('fetches and paginates pending unlock participants', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(
          mockFetchResponse({
            list: [
              {
                index: '20578/000000000000/bze1a',
                address: 'bze1a',
                amount: '1000',
                denom: 'ubze',
              },
            ],
            pagination: { next_key: 'page2' },
          })
        )
        .mockResolvedValueOnce(
          mockFetchResponse({
            list: [
              {
                index: '20580/000000000818/bze1b',
                address: 'bze1b',
                amount: '2000',
                denom: 'ulp/abc',
              },
            ],
            pagination: { next_key: null },
          })
        );

      const list = await fetchAllPendingUnlockParticipants(10);
      expect(list).toHaveLength(2);
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/bze/rewards/all_pending_unlock_participants')
      );
    });

    it('filters address Offers unlocks and drops DenomReward entries', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        mockFetchResponse({
          list: [
            {
              index: '20578/000000000000/bze1me',
              address: 'bze1me',
              amount: '1000',
              denom: 'ubze',
            },
            {
              index: '20667/dr/factory/x/uvdl/bze1me',
              address: 'bze1me',
              amount: '500',
              denom: 'factory/x/uvdl',
            },
            {
              index: '20579/000000000000/bze1other',
              address: 'bze1other',
              amount: '1000',
              denom: 'ubze',
            },
          ],
          pagination: { next_key: null },
        })
      );

      const mine = await fetchAddressOffersPendingUnlocks('bze1me');
      expect(mine).toHaveLength(1);
      expect(mine[0].index).toContain('000000000000');
    });

    it('fetches current hour epoch', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        mockFetchResponse({
          epochs: [
            { identifier: 'day', current_epoch: '856' },
            { identifier: 'hour', current_epoch: '20541' },
          ],
        })
      );

      await expect(fetchCurrentHourEpoch()).resolves.toBe(20541);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/cosmos/epochs/v1beta1/epochs')
      );
    });
  });
});
