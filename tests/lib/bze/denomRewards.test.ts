/**
 * BeeZee DenomReward client tests
 */

import {
  DENOM_REWARD_MSG_TYPE_URL,
  EXTRA_GAS_FOR_DENOM_EXIT,
  VDL_DENOM,
  createClaimDenomRewardsMsg,
  createExitDenomRewardMsg,
  createJoinDenomRewardMsg,
  encodeMsgClaimDenomRewards,
  encodeMsgExitDenomReward,
  encodeMsgJoinDenomReward,
  estimateDenomRewardApr,
  fetchDenomReward,
  fetchDenomRewardParticipant,
  fetchDenomRewardSchedules,
  getDenomRewardExitFee,
  sumPendingForDenom,
} from '@/lib/bze/denomRewards';
import { mockFetchResponse } from '../../setup';

describe('DenomReward client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('message constructors', () => {
    const creator = 'bze1tester';
    const amount = '1000000';

    it('builds MsgJoinDenomReward for VDL', () => {
      const msg = createJoinDenomRewardMsg(creator, VDL_DENOM, amount);
      expect(msg.typeUrl).toBe(DENOM_REWARD_MSG_TYPE_URL.JOIN);
      expect(msg.typeUrl).toBe('/bze.rewards.MsgJoinDenomReward');
      expect(msg.value).toEqual({ creator, denom: VDL_DENOM, amount });
    });

    it('builds MsgExitDenomReward', () => {
      const msg = createExitDenomRewardMsg(creator, VDL_DENOM);
      expect(msg.typeUrl).toBe('/bze.rewards.MsgExitDenomReward');
      expect(msg.value).toEqual({ creator, denom: VDL_DENOM });
    });

    it('builds MsgClaimDenomRewards', () => {
      const msg = createClaimDenomRewardsMsg(creator, VDL_DENOM);
      expect(msg.typeUrl).toBe('/bze.rewards.MsgClaimDenomRewards');
      expect(msg.value).toEqual({ creator, denom: VDL_DENOM });
    });
  });

  describe('protobuf encoders', () => {
    it('encodes join with fields creator/denom/amount', () => {
      const encoded = encodeMsgJoinDenomReward({
        creator: 'bze1a',
        denom: VDL_DENOM,
        amount: '42',
      });
      expect(encoded.length).toBeGreaterThan(10);
      const text = new TextDecoder().decode(encoded);
      expect(text).toContain('bze1a');
      expect(text).toContain(VDL_DENOM);
      expect(text).toContain('42');
    });

    it('encodes exit and claim with creator/denom only', () => {
      const exit = encodeMsgExitDenomReward({ creator: 'bze1x', denom: VDL_DENOM });
      const claim = encodeMsgClaimDenomRewards({ creator: 'bze1x', denom: VDL_DENOM });
      expect(new TextDecoder().decode(exit)).toContain('bze1x');
      expect(new TextDecoder().decode(claim)).toContain(VDL_DENOM);
      // amount field must not appear on exit/claim
      expect(exit.length).toBeLessThan(
        encodeMsgJoinDenomReward({ creator: 'bze1x', denom: VDL_DENOM, amount: '999999' }).length
      );
    });
  });

  describe('APR and fees', () => {
    it('estimates APR from schedules and total staked', () => {
      // 575 VDL/day, 4_597_647 VDL staked ≈ 4.57%
      const apr = estimateDenomRewardApr(
        [{ daily_amount: '575000000', duration: 3650, payouts: 2 }],
        '4597647125389'
      );
      expect(apr).toBeGreaterThan(4);
      expect(apr).toBeLessThan(6);
    });

    it('returns 0 APR when schedule finished or stake empty', () => {
      expect(
        estimateDenomRewardApr([{ daily_amount: '575000000', duration: 10, payouts: 10 }], '1000')
      ).toBe(0);
      expect(
        estimateDenomRewardApr([{ daily_amount: '575000000', duration: 100, payouts: 0 }], '0')
      ).toBe(0);
    });

    it('includes extraGasForDenomExit in exit fee', () => {
      const fee = getDenomRewardExitFee(0.01);
      expect(EXTRA_GAS_FOR_DENOM_EXIT).toBe(1_000_000);
      expect(parseInt(fee.gas, 10)).toBe(1_200_000);
      expect(fee.amount[0].denom).toBe('ubze');
    });
  });

  describe('pending helpers', () => {
    it('sums pending for prize denom', () => {
      expect(
        sumPendingForDenom(
          [
            { denom: 'ubze', amount: '1' },
            { denom: VDL_DENOM, amount: '2500000' },
          ],
          VDL_DENOM
        )
      ).toBe('2500000');
      expect(sumPendingForDenom([], VDL_DENOM)).toBe('0');
    });
  });

  describe('LCD fetchers', () => {
    it('fetches denom reward by denom', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        mockFetchResponse({
          denom_reward: {
            staking_denom: VDL_DENOM,
            lock: 7,
            min_stake: '0',
            staked_amount: '1000',
          },
        })
      );

      const pool = await fetchDenomReward(VDL_DENOM);
      expect(pool?.staking_denom).toBe(VDL_DENOM);
      expect(pool?.lock).toBe(7);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/bze/rewards/denom_reward?denom=')
      );
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining(encodeURIComponent(VDL_DENOM)));
    });

    it('fetches schedules', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        mockFetchResponse({
          list: [
            {
              schedule_id: '000000000002',
              staking_denom: VDL_DENOM,
              prize_denom: VDL_DENOM,
              daily_amount: '575000000',
              duration: 3650,
              payouts: 2,
            },
          ],
        })
      );

      const schedules = await fetchDenomRewardSchedules(VDL_DENOM);
      expect(schedules).toHaveLength(1);
      expect(schedules[0].daily_amount).toBe('575000000');
    });

    it('fetches participant with pending prizes', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce(
        mockFetchResponse({
          participant: { address: 'bze1me', staking_denom: VDL_DENOM, amount: '5000000' },
          pending: [{ denom: VDL_DENOM, amount: '123' }],
        })
      );

      const view = await fetchDenomRewardParticipant('bze1me', VDL_DENOM);
      expect(view.participant?.amount).toBe('5000000');
      expect(view.pending[0].amount).toBe('123');
    });

    it('returns empty participant view on not-found', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'not found',
      });

      const view = await fetchDenomRewardParticipant('bze1none', VDL_DENOM);
      expect(view.participant).toBeNull();
      expect(view.pending).toEqual([]);
    });
  });

  it('exports the factory uvdl denom constant', () => {
    expect(VDL_DENOM).toBe('factory/bze13gzq40che93tgfm9kzmkpjamah5nj0j73pyhqk/uvdl');
  });
});
